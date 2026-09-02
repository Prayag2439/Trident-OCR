import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.process import router as process_router
from routers.assistant import router as assistant_router
from routers.challans import router as challans_router
from routers.auth import router as auth_router
from config import settings

app = FastAPI(
    title="Trident OCR — Intelligent Dual-Model Pipeline",
    description="Enterprise-grade document processing with layout analysis and GPT-5 / Gemini 3 VLM transcription.",
    version="1.0.0",
)

# Enable CORS for Next.js frontend with dynamic origin support
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if hasattr(settings, "FRONTEND_ORIGIN") and settings.FRONTEND_ORIGIN:
    for orig in settings.FRONTEND_ORIGIN.split(","):
        orig_clean = orig.strip()
        if orig_clean and orig_clean not in origins:
            origins.append(orig_clean)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(process_router)
app.include_router(assistant_router)
app.include_router(challans_router)
app.include_router(auth_router)

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
