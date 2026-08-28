# 🔱 Trident — Intelligent Dual-Model OCR Pipeline

A full-stack, enterprise-grade document processing application featuring **FastAPI**, **Next.js 14**, and a **"Circle to Search"** style interactive UI with real-time toggle between **GPT-5** and **Gemini 3**.

---

## 🌟 Core Architecture & Principles

1. **Parse, Don't OCR (When Possible)**: Born-digital PDFs are triaged using **PyMuPDF (`fitz`)**. If characters exceed threshold (>=12 chars), text and bounding boxes are extracted losslessly at 0 latency and 0 API cost.
2. **Solve Layout Before Reading**: Scans/images are rasterized to >=200 DPI and processed through **Ultralytics YOLOv8 DocLayNet** to detect block regions (Title, Text, Table, List) and enforce multi-column reading order.
3. **Context Beats Vision for Cursive Handwriting**: Cropped regions are routed to frontier Vision-Language Models (**GPT-5** / **Gemini 3**) using a strict anti-hallucination prompt (`temperature: 0.0`) and markdown table formatting.
4. **Circle to Search Interactive UI**: Hovering over any text block on the right panel instantly illuminates a semi-transparent, animated lens overlay with crosshair reticles on the left-hand original document canvas via SVG / Framer Motion.

---

## 📁 Repository Structure

```
d:/Wrok Main/Trident/
├── backend/
│   ├── main.py                # FastAPI entry point with CORS
│   ├── config.py              # Pydantic Settings (.env configuration)
│   ├── routers/
│   │   └── process.py         # POST /api/v1/process-document
│   ├── services/
│   │   ├── triage.py          # Phase 1: PyMuPDF triage & DPI normalization
│   │   ├── layout.py          # Phase 2: YOLOv8 DocLayNet & column sorter
│   │   ├── vlm.py             # Phase 3: GPT-5 & Gemini 3 transcription
│   │   └── deskew.py          # Preprocessing: OpenCV skew correction
│   ├── models/
│   │   └── schemas.py         # Pydantic JSON response schemas
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/
    ├── app/
    │   ├── page.tsx           # Dual-Panel Circle to Search Workspace
    │   ├── layout.tsx
    │   └── globals.css        # Dark theme with glassmorphic tokens
    ├── components/
    │   ├── ModelToggle.tsx    # GPT-5 ↔ Gemini 3 animated toggle
    │   ├── DropZone.tsx       # Drag & drop upload with 1-click presets
    │   ├── DocumentViewer.tsx # Left panel image viewport & zoom controls
    │   ├── RegionCanvas.tsx   # SVG Bounding Box lens overlay
    │   └── TextPanel.tsx      # Right panel text blocks & copy tools
    ├── hooks/
    │   └── useOCRPipeline.ts  # React hook for pipeline orchestration
    └── types/
        └── ocr.ts             # TypeScript response schemas
```

---

## 🚀 Quick Start

### 1. Start Backend (FastAPI)

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # Add your OPENAI_API_KEY and GOOGLE_API_KEY if desired
uvicorn main:app --reload --port 8000
```

Backend API will be available at: `http://localhost:8000` (Interactive docs at `http://localhost:8000/docs`).

### 2. Start Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 📡 API Contract

### Endpoint
`POST /api/v1/process-document`

### Form Data
- `file`: Document file (`.pdf`, `.jpg`, `.png`, `.webp`)
- `model_override`: `"gpt-5"` | `"gemini"`

### Standardized JSON Response
```json
{
  "document_meta": {
    "filename": "handwritten_invoice.jpg",
    "pages": 1,
    "dpi_normalized": 200,
    "model_used": "gpt-5",
    "is_digital_pdf": false,
    "processing_time_ms": 1240.5,
    "page_width": 900,
    "page_height": 1200
  },
  "extracted_regions": [
    {
      "region_id": "001",
      "reading_order_index": 1,
      "class": "Title",
      "bbox": [50, 40, 600, 90],
      "text_content": "TRIDENT FABRICATORS Pvt. Ltd.",
      "is_handwritten": false,
      "confidence": 0.98
    },
    {
      "region_id": "002",
      "reading_order_index": 2,
      "class": "Table",
      "bbox": [20, 200, 800, 650],
      "text_content": "| Sl. No | Item No. | Description |\n|---|---|---|\n| 1 | 72083740 | PL 3 mm thk |",
      "is_handwritten": true,
      "confidence": 0.95
    }
  ]
}
```
