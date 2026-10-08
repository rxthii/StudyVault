from typing import List, Optional
from langchain_core.embeddings import Embeddings
from app.core.config import Settings, get_settings
from app.core.logging import logger
from app.schemas.retrieval import SourceReference
from app.vectorstore.pinecone_client import PineconeManager, get_pinecone_manager
from app.ai.embeddings import get_embedding_model


def _page_number_from_metadata(value: object, *, chunk_id: str) -> int:
    """Return a valid page number even when a stored vector has bad metadata."""
    try:
        page_number = int(value)
        if page_number >= 1:
            return page_number
    except (TypeError, ValueError, OverflowError):
        pass

    logger.warning(
        "Invalid page_number metadata for vector chunk '%s' (%r); defaulting to page 1.",
        chunk_id,
        value,
    )
    return 1


class PineconeDocumentRetriever:
    """
    Retriever that queries Pinecone with metadata filtering to strictly enforce
    active (linked) document boundaries.
    """

    def __init__(
        self,
        pinecone_manager: Optional[PineconeManager] = None,
        embeddings: Optional[Embeddings] = None,
        settings: Optional[Settings] = None
    ):
        self.settings = settings or get_settings()
        self.pinecone_mgr = pinecone_manager or get_pinecone_manager()
        self.embeddings = embeddings or get_embedding_model(self.settings)

    def retrieve(
        self,
        query: str,
        allowed_document_ids: List[str],
        top_k: Optional[int] = None,
        similarity_threshold: Optional[float] = None,
        owner_id: Optional[str] = None
    ) -> List[SourceReference]:
        """
        Retrieves top relevant chunks from Pinecone.
        If allowed_document_ids is empty, returns an empty list immediately.
        """
        if not allowed_document_ids:
            logger.info("No active/linked documents provided for retrieval. Returning empty context.")
            return []

        k = top_k or self.settings.TOP_K
        threshold = similarity_threshold if similarity_threshold is not None else self.settings.SIMILARITY_THRESHOLD

        # 1. Embed query
        query_vector = self.embeddings.embed_query(query)

        # 2. Build metadata filter for active documents
        # In Pinecone, {"document_id": {"$in": [...]}} or {"document_id": {"$eq": "..."}}
        if len(allowed_document_ids) == 1:
            document_filter = {"document_id": {"$eq": allowed_document_ids[0]}}
        else:
            document_filter = {"document_id": {"$in": allowed_document_ids}}
        meta_filter = {"$and": [document_filter, {"owner_id": {"$eq": owner_id}}]} if owner_id else document_filter

        # 3. Query Pinecone
        matches = self.pinecone_mgr.query(
            vector=query_vector,
            top_k=k,
            filter_dict=meta_filter
        )

        results: List[SourceReference] = []
        for match in matches:
            score = match["score"]
            raw_meta = match.get("metadata")
            meta = raw_meta if isinstance(raw_meta, dict) else {}

            # Filter out chunks below threshold
            if score < threshold:
                continue

            chunk_ref = SourceReference(
                document_id=meta.get("document_id", ""),
                filename=meta.get("filename", "Unknown Document"),
                page_number=_page_number_from_metadata(
                    meta.get("page_number"), chunk_id=meta.get("chunk_id", match["id"])
                ),
                chunk_id=meta.get("chunk_id", match["id"]),
                relevance_score=round(score, 3),
                snippet=meta.get("chunk_text", "")
            )
            results.append(chunk_ref)

        logger.info(f"Retrieved {len(results)} chunks above threshold {threshold} for query '{query[:30]}...'")
        return results
