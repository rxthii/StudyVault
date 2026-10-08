import hashlib
import math
from typing import List
from langchain_core.embeddings import Embeddings
from app.core.config import Settings, get_settings
from app.core.logging import logger
from app.core.errors import ConfigurationError


class MockEmbeddings(Embeddings):
    """Deterministic mock embeddings for fast offline testing and fallback."""
    def __init__(self, dimension: int = 1024):
        self.dimension = dimension

    def _embed_text(self, text: str) -> List[float]:
        # Generate pseudo-vector using MD5 hash of text
        h = hashlib.sha256(text.encode("utf-8")).digest()
        vec = []
        for i in range(self.dimension):
            byte_val = h[i % len(h)]
            # normalize float between -1.0 and 1.0
            vec.append((byte_val / 128.0) - 1.0 + (i * 0.001))
        # Normalize unit length
        norm = math.sqrt(sum(x * x for x in vec)) or 1.0
        return [x / norm for x in vec]

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._embed_text(t) for t in texts]

    def embed_query(self, text: str) -> List[float]:
        return self._embed_text(text)


class PineconeInferenceEmbeddings(Embeddings):
    """LangChain-compatible Embeddings implementation using Pinecone Inference API."""
    def __init__(self, api_key: str, model: str = "multilingual-e5-large"):
        import time
        from pinecone import Pinecone
        if not api_key or not api_key.strip():
            raise ConfigurationError("Pinecone API key is required for PineconeInferenceEmbeddings.")
        self.pc = Pinecone(api_key=api_key, timeout=120.0)
        self.model = model

    def embed_documents(self, texts: List[str], batch_size: int = 32) -> List[List[float]]:
        import time
        if not texts:
            return []
        all_embeddings = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            max_retries = 3
            for attempt in range(1, max_retries + 1):
                try:
                    res = self.pc.inference.embed(
                        model=self.model,
                        inputs=batch,
                        parameters={"input_type": "passage", "truncate": "END"}
                    )
                    all_embeddings.extend([r.values for r in res])
                    break
                except Exception as e:
                    if attempt == max_retries:
                        logger.error(f"Pinecone inference embed_documents failed for batch {i} after {max_retries} attempts: {e}")
                        raise
                    wait_seconds = attempt * 1.5
                    logger.warning(f"Embedding batch {i} failed (attempt {attempt}/{max_retries}): {e}. Retrying in {wait_seconds}s...")
                    time.sleep(wait_seconds)
        return all_embeddings

    def embed_query(self, text: str) -> List[float]:
        try:
            res = self.pc.inference.embed(
                model=self.model,
                inputs=[text],
                parameters={"input_type": "query", "truncate": "END"}
            )
            return res[0].values
        except Exception as e:
            logger.error(f"Pinecone inference embed_query failed: {e}")
            raise


def get_embedding_model(settings: Settings = None) -> Embeddings:
    """Factory returning configured LangChain embeddings instance."""
    if settings is None:
        settings = get_settings()

    provider = settings.EMBEDDING_PROVIDER.lower().strip()
    
    if provider == "mock":
        return MockEmbeddings(dimension=settings.EMBEDDING_DIMENSION)
    
    if provider == "pinecone":
        if not settings.is_valid_credential(settings.PINECONE_API_KEY):
            logger.warning("Pinecone API key not found; falling back to MockEmbeddings.")
            return MockEmbeddings(dimension=settings.EMBEDDING_DIMENSION)
        return PineconeInferenceEmbeddings(
            api_key=settings.PINECONE_API_KEY,
            model=settings.EMBEDDING_MODEL
        )
        
    if provider == "openai":
        from langchain_openai import OpenAIEmbeddings
        return OpenAIEmbeddings(
            model=settings.EMBEDDING_MODEL,
            openai_api_key=settings.OPENROUTER_API_KEY,
            openai_api_base=settings.OPENROUTER_BASE_URL
        )

    logger.warning(f"Unknown embedding provider '{provider}', defaulting to MockEmbeddings.")
    return MockEmbeddings(dimension=settings.EMBEDDING_DIMENSION)
