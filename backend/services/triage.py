import io
import base64
import fitz  # PyMuPDF
from PIL import Image
from typing import Tuple, List, Optional
from config import settings

class PageTriageResult:
    def __init__(
        self,
        page_index: int,
        is_digital: bool,
        image: Image.Image,
        page_width: int,
        page_height: int,
        digital_blocks: Optional[List[dict]] = None,
        preview_base64: Optional[str] = None,
    ):
        self.page_index = page_index
        self.is_digital = is_digital
        self.image = image
        self.page_width = page_width
        self.page_height = page_height
        self.digital_blocks = digital_blocks or []
        self.preview_base64 = preview_base64

def image_to_base64(img: Image.Image, format: str = "PNG") -> str:
    buffered = io.BytesIO()
    img.save(buffered, format=format)
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    return f"data:image/{format.lower()};base64,{img_str}"

def triage_document(file_bytes: bytes, filename: str) -> List[PageTriageResult]:
    """
    Triage input file into digital or scan pipeline page by page.
    Rasterizes scanned pages/PDFs to normalized DPI (>= 200 DPI).
    """
    lower_name = filename.lower()
    results = []
    
    if lower_name.endswith(".pdf"):
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        
        for page_idx in range(len(doc)):
            page = doc[page_idx]
            extracted_text = page.get_text("text").strip()
            
            # DPI calculation: Standard PDF 72 points/inch. To get 200 DPI: zoom = 200 / 72 ≈ 2.777
            zoom = settings.MIN_DPI / 72.0
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            
            pil_image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            b64_preview = image_to_base64(pil_image, format="JPEG")
            
            # Check character count threshold
            if len(extracted_text) >= settings.TEXT_CHAR_THRESHOLD:
                # Digital PDF Path: Extract native text blocks and scale bboxes to rasterized coordinates
                raw_blocks = page.get_text("blocks")
                digital_blocks = []
                for b in raw_blocks:
                    # b = (x0, y0, x1, y1, text, block_no, block_type)
                    # block_type 0 = text, 1 = image
                    if b[6] == 0 and b[4].strip():
                        scaled_bbox = [
                            round(b[0] * zoom, 2),
                            round(b[1] * zoom, 2),
                            round(b[2] * zoom, 2),
                            round(b[3] * zoom, 2),
                        ]
                        digital_blocks.append({
                            "bbox": scaled_bbox,
                            "text": b[4].strip(),
                            "type": "Text" if len(b[4].strip().split("\n")) > 1 else "Title"
                        })
                
                results.append(
                    PageTriageResult(
                        page_index=page_idx,
                        is_digital=True,
                        image=pil_image,
                        page_width=pix.width,
                        page_height=pix.height,
                        digital_blocks=digital_blocks,
                        preview_base64=b64_preview,
                    )
                )
            else:
                # Scanned PDF Path: Needs layout analysis and VLM OCR
                results.append(
                    PageTriageResult(
                        page_index=page_idx,
                        is_digital=False,
                        image=pil_image,
                        page_width=pix.width,
                        page_height=pix.height,
                        digital_blocks=[],
                        preview_base64=b64_preview,
                    )
                )
    else:
        # Standard Image (PNG, JPG, TIFF, WEBP, etc.)
        pil_image = Image.open(io.BytesIO(file_bytes)).convert("RGB")
        
        # Check image resolution, resize or normalize if needed
        w, h = pil_image.size
        b64_preview = image_to_base64(pil_image, format="JPEG")
        
        results.append(
            PageTriageResult(
                page_index=0,
                is_digital=False,
                image=pil_image,
                page_width=w,
                page_height=h,
                digital_blocks=[],
                preview_base64=b64_preview,
            )
        )
        
    return results
