import os
from typing import List, Optional
from sqlalchemy.orm import Session
from app.core.logging import logger
from app.core.errors import DocumentNotFoundError
from app.models.document import Document
from app.database.repositories import DocumentRepository
from app.vectorstore.pinecone_client import PineconeManager, get_pinecone_manager


class DocumentService:
    def __init__(self, db: Session, pinecone_mgr: Optional[PineconeManager] = None):
        self.db = db
        self.repo = DocumentRepository(db)
        self.pinecone_mgr = pinecone_mgr or get_pinecone_manager()

    def list_documents(
        self,
        linked: Optional[bool] = None,
        status: Optional[str] = None
    ) -> List[Document]:
        return self.repo.list_documents(linked=linked, status=status)

    def get_document(self, doc_id: str) -> Document:
        doc = self.repo.get_by_id(doc_id)
        if not doc:
            raise DocumentNotFoundError(doc_id)
        return doc

    def set_link_status(self, doc_id: str, linked: bool) -> Document:
        """
        Links or unlinks a document.
        CRITICAL: Unlinking keeps the document and vectors intact in Pinecone,
        but excludes it from retrieval by updating the SQLite database state.
        """
        doc = self.get_document(doc_id)
        updated = self.repo.set_linked(doc_id, linked)
        logger.info(f"Document '{doc.filename}' ({doc_id}) linked state updated to {linked}.")
        return updated

    def delete_document(self, doc_id: str) -> bool:
        """
        Permanently deletes the document from library:
        1. Deletes associated vectors from Pinecone.
        2. Deletes local file on disk.
        3. Deletes document record and chunk records from SQLite.
        """
        doc = self.get_document(doc_id)

        # 1. Delete vectors from Pinecone
        try:
            self.pinecone_mgr.delete_by_document_id(doc_id)
        except Exception as e:
            logger.warning(f"Failed to delete Pinecone vectors for {doc_id}: {e}")

        # 2. Delete file on disk if exists
        if doc.file_path and os.path.exists(doc.file_path):
            try:
                os.remove(doc.file_path)
            except Exception as e:
                logger.warning(f"Could not remove local file {doc.file_path}: {e}")

        # 3. Delete from DB
        success = self.repo.delete(doc_id)
        logger.info(f"Document '{doc.filename}' ({doc_id}) deleted permanently.")
        return success

    def get_document_content(self, doc_id: str) -> dict:
        doc = self.get_document(doc_id)
        chunks = self.repo.get_all_chunks(doc_id)
        return {
            "document_id": doc.id,
            "filename": doc.filename,
            "total_chunks": len(chunks),
            "chunks": [
                {
                    "chunk_id": c.chunk_id,
                    "page_number": c.page_number,
                    "snippet": c.text,
                    "created_at": c.created_at
                }
                for c in chunks
            ]
        }

    def get_page_content(self, doc_id: str, page_number: int) -> dict:
        doc = self.get_document(doc_id)
        chunks = self.repo.get_chunks_by_page(doc_id, page_number)
        combined_text = "\n\n".join([c.text for c in chunks])
        return {
            "document_id": doc.id,
            "filename": doc.filename,
            "page_number": page_number,
            "content": combined_text,
            "chunk_count": len(chunks)
        }

    def get_chunk_snippet(self, doc_id: str, chunk_id: str) -> dict:
        self.get_document(doc_id)
        chunk = self.repo.get_chunk(doc_id, chunk_id)
        if not chunk:
            raise DocumentNotFoundError(f"Chunk '{chunk_id}' in document '{doc_id}' not found.")
        return {
            "document_id": doc_id,
            "chunk_id": chunk.chunk_id,
            "page_number": chunk.page_number,
            "snippet": chunk.text,
            "created_at": chunk.created_at
        }
