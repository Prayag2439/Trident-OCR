import time
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from models.schemas import ProcessResponse, DocumentMeta, ExtractedRegion
from services.triage import triage_document
from services.deskew import deskew_image
from services.layout import layout_detector
from services.vlm import vlm_service
from config import settings

router = APIRouter(prefix="/api/v1", tags=["Document Processing"])

@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "models_configured": {
            "openai_configured": bool(settings.OPENAI_API_KEY),
            "google_configured": bool(settings.GOOGLE_API_KEY),
            "openai_model": settings.OPENAI_MODEL,
            "google_model": settings.GOOGLE_MODEL,
        }
    }

@router.post("/process-document", response_model=ProcessResponse)
def process_document(
    file: UploadFile = File(...),
    model_override: str = Form("gpt-5"),
):
    start_time = time.perf_counter()
    
    try:
        file_bytes = file.file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")
            
        # Phase 1: Triage
        triage_pages = triage_document(file_bytes, file.filename or "document.pdf")
        if not triage_pages:
            raise HTTPException(status_code=400, detail="Could not read or render any pages.")
            
        all_extracted_regions = []
        is_digital_doc = False
        primary_page = triage_pages[0]
        region_counter = 1
        
        for page in triage_pages:
            if page.is_digital:
                is_digital_doc = True
                for b_idx, block in enumerate(page.digital_blocks, start=1):
                    all_extracted_regions.append(
                        ExtractedRegion(
                            region_id=f"{region_counter:03d}",
                            reading_order_index=region_counter,
                            region_class=block.get("type", "Text"),
                            bbox=block["bbox"],
                            text_content=block["text"],
                            is_handwritten=False,
                            confidence=1.0,
                        )
                    )
                    region_counter += 1
            else:
                # Preprocessing: Deskew
                deskewed_img, skew_angle = deskew_image(page.image)
                page.image = deskewed_img
                
                # Phase 2: Layout Analysis (Exactly 3 sections)
                detected_regions = layout_detector.detect_regions(page.image)
                
                # Phase 3: Transcribe the 3 sections
                for r in detected_regions:
                    crop = vlm_service.crop_region(page.image, r["bbox"])
                    text_content, is_handwritten = vlm_service.transcribe_region(
                        crop,
                        model_name=model_override,
                        region_class=r["class"],
                        region_id=r.get("region_id", str(region_counter))
                    )
                    all_extracted_regions.append(
                        ExtractedRegion(
                            region_id=f"{region_counter:03d}",
                            reading_order_index=region_counter,
                            region_class=r["class"],
                            bbox=r["bbox"],
                            text_content=text_content,
                            is_handwritten=is_handwritten,
                            confidence=r.get("confidence", 0.98),
                        )
                    )
                    region_counter += 1
                    
        # Aggregate text for structured invoice extraction
        full_document_text = "\n\n".join(r.text_content for r in all_extracted_regions)
        structured_data = vlm_service.extract_structured_invoice(
            full_document_text,
            page_image=primary_page.image,
            model_name=model_override
        )
        
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        
        doc_meta = DocumentMeta(
            filename=file.filename or "uploaded_document",
            pages=len(triage_pages),
            dpi_normalized=settings.MIN_DPI,
            model_used=model_override,
            is_digital_pdf=is_digital_doc,
            processing_time_ms=elapsed_ms,
            page_width=primary_page.page_width,
            page_height=primary_page.page_height,
            preview_image_base64=primary_page.preview_base64,
            token_usage=structured_data.get("token_usage") if structured_data else None
        )
        
        return ProcessResponse(
            document_meta=doc_meta,
            extracted_regions=all_extracted_regions,
            structured_invoice_data=structured_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Document processing failed: {str(e)}")
