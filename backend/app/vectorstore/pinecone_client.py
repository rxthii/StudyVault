import time
from typing import Any, Dict, List, Optional
from pinecone import Pinecone
from app.core.config import Settings, get_settings
from app.core.logging import logger
from app.core.errors import PineconeServiceError, ConfigurationError


class PineconeManager:
    """Manages Pinecone index lifecycle, vector upsert, metadata filtering, and stats."""

    @staticmethod
    def _serialize_namespace_summaries(namespaces: Any) -> Dict[str, Any]:
        """Convert Pinecone SDK namespace models into JSON-serializable values."""
        if not isinstance(namespaces, dict):
            return {}

        serialized: Dict[str, Any] = {}
        for name, summary in namespaces.items():
            if isinstance(summary, dict):
                serialized[name] = summary
                continue

            # Pinecone SDK versions expose generated response models with one
            # of these conversion methods. Keep a small attribute fallback for
            # versions that expose NamespaceSummary as a plain object.
            for method_name in ("model_dump", "to_dict", "dict"):
                converter = getattr(summary, method_name, None)
                if callable(converter):
                    try:
                        converted = converter()
                        if isinstance(converted, dict):
                            serialized[name] = converted
                            break
                    except Exception:
                        pass
            else:
                vector_count = getattr(summary, "vector_count", None)
                serialized[name] = (
                    {"vector_count": vector_count}
                    if vector_count is not None
                    else {}
                )

        return serialized

    def __init__(self, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()
        self._pc: Optional[Pinecone] = None
        self._index = None

    @property
    def client(self) -> Pinecone:
        if self._pc is None:
            api_key = self.settings.PINECONE_API_KEY
            if not self.settings.is_valid_credential(api_key):
                raise ConfigurationError("Pinecone API Key is missing or invalid in configuration.")
            self._pc = Pinecone(api_key=api_key, timeout=120.0)
        return self._pc

    @property
    def index(self):
        if self._index is None:
            index_name = self.settings.PINECONE_INDEX_NAME
            try:
                self._index = self.client.Index(index_name)
            except Exception as e:
                logger.error(f"Failed to connect to Pinecone index '{index_name}': {e}")
                raise PineconeServiceError(f"Cannot connect to Pinecone index '{index_name}': {str(e)}")
        return self._index

    def upsert_vectors(
        self,
        vectors: List[Dict[str, Any]],
        namespace: Optional[str] = None,
        batch_size: int = 25
    ) -> int:
        """
        Upserts vectors with metadata into Pinecone index.
        Uses a resilient batch size (25 items) and exponential backoff retry
        to prevent SSL socket write timeouts with large document metadata.
        """
        ns = namespace or self.settings.PINECONE_NAMESPACE
        total_upserted = 0
        try:
            for i in range(0, len(vectors), batch_size):
                batch = vectors[i:i + batch_size]
                max_retries = 3
                for attempt in range(1, max_retries + 1):
                    try:
                        self.index.upsert(vectors=batch, namespace=ns)
                        total_upserted += len(batch)
                        break
                    except Exception as batch_err:
                        if attempt == max_retries:
                            logger.error(f"Failed upserting batch {i} after {max_retries} attempts: {batch_err}")
                            raise
                        wait_seconds = attempt * 1.5
                        logger.warning(
                            f"Upsert batch {i} failed (attempt {attempt}/{max_retries}): {batch_err}. "
                            f"Retrying in {wait_seconds}s..."
                        )
                        time.sleep(wait_seconds)

            logger.info(f"Upserted {total_upserted} vectors into Pinecone index under namespace '{ns}'.")
            return total_upserted
        except Exception as e:
            logger.error(f"Error upserting vectors into Pinecone: {e}")
            raise PineconeServiceError(f"Vector upsert failed: {str(e)}")

    def query(
        self,
        vector: List[float],
        top_k: int = 5,
        filter_dict: Optional[Dict[str, Any]] = None,
        namespace: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Queries Pinecone index with cosine similarity and metadata filters.
        """
        ns = namespace or self.settings.PINECONE_NAMESPACE
        try:
            response = self.index.query(
                vector=vector,
                top_k=top_k,
                filter=filter_dict,
                include_metadata=True,
                namespace=ns
            )
            matches = []
            for match in response.get("matches", []):
                matches.append({
                    "id": match.get("id"),
                    "score": float(match.get("score", 0.0)),
                    "metadata": match.get("metadata", {})
                })
            return matches
        except Exception as e:
            logger.error(f"Error querying Pinecone index: {e}")
            raise PineconeServiceError(f"Vector search failed: {str(e)}")

    def delete_by_document_id(self, document_id: str, namespace: Optional[str] = None) -> None:
        """
        Deletes all vector chunks associated with a document_id.
        """
        ns = namespace or self.settings.PINECONE_NAMESPACE
        try:
            # Delete by metadata filter
            self.index.delete(
                filter={"document_id": {"$eq": document_id}},
                namespace=ns
            )
            logger.info(f"Deleted vectors for document_id '{document_id}' from Pinecone namespace '{ns}'.")
        except Exception as e:
            logger.warning(f"Could not delete vectors by filter for document_id {document_id}: {e}")
            # Try fetching/deleting by IDs if supported or ignore gracefully
            pass

    def get_stats(self) -> Dict[str, Any]:
        """Returns statistics for the Pinecone index."""
        try:
            stats = self.index.describe_index_stats()
            namespaces = self._serialize_namespace_summaries(
                stats.get("namespaces", {})
            )
            return {
                "index_name": self.settings.PINECONE_INDEX_NAME,
                "dimension": stats.get("dimension", self.settings.EMBEDDING_DIMENSION),
                "total_vector_count": stats.get("total_vector_count", 0),
                "namespaces": namespaces,
                "metric": stats.get("metric", "cosine")
            }
        except Exception as e:
            logger.error(f"Error obtaining Pinecone stats: {e}")
            return {
                "index_name": self.settings.PINECONE_INDEX_NAME,
                "dimension": self.settings.EMBEDDING_DIMENSION,
                "total_vector_count": 0,
                "namespaces": {},
                "metric": "cosine",
                "error": str(e)
            }


_pinecone_manager: Optional[PineconeManager] = None


def get_pinecone_manager() -> PineconeManager:
    global _pinecone_manager
    if _pinecone_manager is None:
        settings = get_settings()
        if settings.APP_ENV == "test":
            from tests.conftest import InMemoryMockPineconeManager
            _pinecone_manager = InMemoryMockPineconeManager()
        else:
            _pinecone_manager = PineconeManager()
    return _pinecone_manager
