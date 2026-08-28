import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    OPENAI_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    
    OPENAI_MODEL: str = "gpt-4o"
    GOOGLE_MODEL: str = "gemini-2.0-flash"
    
    LAYOUT_MODEL_PATH: str = "yolov8x-doclaynet.pt"
    MIN_DPI: int = 200
    TEXT_CHAR_THRESHOLD: int = 12
    FRONTEND_ORIGIN: str = "http://localhost:3000"
    
    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def get_clean_openai_key(self) -> str:
        key = self.OPENAI_API_KEY.strip()
        if key.startswith("ssk-"):
            key = key[1:]
        return key

    def get_clean_google_key(self) -> str:
        return self.GOOGLE_API_KEY.strip()

settings = Settings()
