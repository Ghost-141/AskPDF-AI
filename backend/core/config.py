from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central place for application configuration backed by Pydantic BaseSettings.
    """

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    base_dir: Path = Path(__file__).resolve().parents[2]
    data_dir: Path = base_dir / "data"
    upload_dir: Path = data_dir / "raw"
    vector_db_dir: Path = data_dir / "vector_db"

    frontend_origin: str = Field(
        default="http://localhost:3000", alias="FRONTEND_ORIGIN"
    )
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    default_model: str = Field(default="openai/gpt-oss-120b", alias="GROQ_MODEL_NAME")

    def model_post_init(self, __context) -> None:
        # Ensure required directories exist after settings are loaded.
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.vector_db_dir.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()


# Eagerly instantiate a shared settings instance for modules that import directly.
settings = get_settings()
