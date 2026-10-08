import os
from functools import lru_cache
from typing import List, Optional, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # OpenRouter LLM Configuration
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "nvidia/nemotron-3.5-lightning:free"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"

    # Pinecone Vector Database Configuration
    PINECONE_API_KEY: str = ""
    PINECONE_INDEX_NAME: str = "studyvault"
    PINECONE_ENVIRONMENT: str = ""
    PINECONE_CLOUD: str = "aws"
    PINECONE_REGION: str = "us-east-1"
    PINECONE_NAMESPACE: str = "documents"

    # Embedding Configuration
    # Supported providers: "pinecone", "openai", "mock"
    EMBEDDING_PROVIDER: str = "pinecone"
    EMBEDDING_MODEL: str = "multilingual-e5-large"
    EMBEDDING_DIMENSION: int = 1024

    # Application Database
    DATABASE_URL: str = "sqlite:///./studyvault.db"

    # Web Search Configuration
    WEB_SEARCH_API_KEY: str = ""
    WEB_SEARCH_PROVIDER: str = "duckduckgo"

    # Application Settings
    APP_ENV: str = "development"
    TOP_K: int = 5
    SIMILARITY_THRESHOLD: float = 0.35
    MAX_FILE_SIZE_MB: int = 25
    CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173"
    ]
    UPLOAD_DIR: str = "./data/uploads"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    def is_valid_credential(self, val: Optional[str]) -> bool:
        if not val or not val.strip():
            return False
        cleaned = val.strip().lower()
        if cleaned.startswith("your_") or cleaned == "your_api_key_here":
            return False
        return True

    def validate_required_credentials(self) -> dict:
        """
        Validates essential external credentials.
        Returns a dictionary with status of each configuration component.
        """
        openrouter_ok = self.is_valid_credential(self.OPENROUTER_API_KEY)
        pinecone_ok = self.is_valid_credential(self.PINECONE_API_KEY)
        index_ok = bool(self.PINECONE_INDEX_NAME and self.PINECONE_INDEX_NAME.strip())
        embedding_ok = bool(self.EMBEDDING_PROVIDER and self.EMBEDDING_PROVIDER.strip())

        missing = []
        if not openrouter_ok:
            missing.append("OPENROUTER_API_KEY")
        if not pinecone_ok:
            missing.append("PINECONE_API_KEY")
        if not index_ok:
            missing.append("PINECONE_INDEX_NAME")
        if not embedding_ok:
            missing.append("EMBEDDING_PROVIDER / EMBEDDING_MODEL")

        return {
            "is_valid": len(missing) == 0,
            "missing_credentials": missing,
            "openrouter_configured": openrouter_ok,
            "pinecone_configured": pinecone_ok,
            "pinecone_index_configured": index_ok,
            "embedding_configured": embedding_ok,
            "openrouter_model": self.OPENROUTER_MODEL,
            "pinecone_index": self.PINECONE_INDEX_NAME,
            "embedding_provider": self.EMBEDDING_PROVIDER,
            "embedding_model": self.EMBEDDING_MODEL,
            "web_search_provider": self.WEB_SEARCH_PROVIDER,
            "app_env": self.APP_ENV
        }


@lru_cache()
def get_settings() -> Settings:
    """Returns singleton instance of application settings."""
    return Settings()
