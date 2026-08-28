import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.process import router as process_router
from config import settings

app = FastAPI(
    title="Trident OCR — Intelligent Dual-Model Pipeline",
    description="Enterprise-grade document processing with layout analysis and GPT-5 / Gemini 3 VLM transcription.",
    version="1.0.0",
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(process_router)

@app.get("/")
def root():
    return {
        "service": "Trident Intelligent Dual-Model OCR Pipeline",
        "version": "1.0.0",
        "endpoints": {
            "process": "/api/v1/process-document",
            "health": "/api/v1/health",
            "docs": "/docs",
        }
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
