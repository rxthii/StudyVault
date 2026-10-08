import os
import re
import time
import uuid
from typing import List, Tuple
from fastapi import UploadFile
from sqlalchemy.orm import Session
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader

from app.core.config import Settings, get_settings
from app.core.logging import logger
from app.core.errors import (
    InvalidFileTypeError,
    FileTooLargeError,
    DocumentProcessingError,
)
from app.models.document import Document
from app.database.repositories import DocumentRepository
from app.vectorstore.pinecone_client import PineconeManager, get_pinecone_manager
from app.ai.embeddings import get_embedding_model


class IngestionService:
    def __init__(
        self,
        db: Session,
        settings: Settings = None,
        pinecone_mgr: PineconeManager = None
    ):
        self.db = db
        self.settings = settings or get_settings()
        self.repo = DocumentRepository(db)
        self.pinecone_mgr = pinecone_mgr or get_pinecone_manager()
        self.embeddings = get_embedding_model(self.settings)
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=800,
            chunk_overlap=150,
            separators=["\n\n", "\n", ". ", " ", ""]
        )

    def _sanitize_filename(self, filename: str) -> str:
        """Sanitizes filename to avoid path traversal and invalid characters."""
        base = os.path.basename(filename)
        cleaned = re.sub(r"[^\w\s.-]", "_", base)
        return cleaned or "document.txt"

    def _validate_file(self, filename: str, content: bytes) -> str:
        """Validates extension and content size. Returns detected file type."""
        ext = os.path.splitext(filename)[1].lower()
        if ext not in [".pdf", ".txt"]:
            raise InvalidFileTypeError(filename, allowed_types=[".pdf", ".txt"])

        size = len(content)
        if size == 0:
            raise DocumentProcessingError(f"File '{filename}' is empty.")

        max_bytes = self.settings.MAX_FILE_SIZE_MB * 1024 * 1024
        if size > max_bytes:
            raise FileTooLargeError(filename, size, self.settings.MAX_FILE_SIZE_MB)

        return ext.replace(".", "")

    def _extract_text(self, file_path: str, file_type: str) -> List[Tuple[int, str]]:
        """
        Extracts text from file.
        Returns a list of tuples: (page_number, text)
        """
        extracted_pages: List[Tuple[int, str]] = []

        if file_type == "txt":
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
            except UnicodeDecodeError:
                with open(file_path, "r", encoding="latin-1") as f:
                    content = f.read()
            if not content.strip():
                raise DocumentProcessingError("Text file is empty or contains no readable characters.")
            extracted_pages.append((1, content))

        elif file_type == "pdf":
            try:
                reader = PdfReader(file_path)
                if len(reader.pages) == 0:
                    raise DocumentProcessingError("PDF contains zero pages.")

                for page_idx, page in enumerate(reader.pages, start=1):
                    text = page.extract_text() or ""
                    if text.strip():
                        extracted_pages.append((page_idx, text))

                if not extracted_pages:
                    raise DocumentProcessingError(
                        "PDF appears scanned or empty; no selectable text could be extracted."
                    )
            except Exception as e:
                logger.error(f"Failed to read PDF '{file_path}': {e}")
                raise DocumentProcessingError(f"Corrupted or unreadable PDF: {str(e)}")

        return extracted_pages

    async def process_file(self, upload_file: UploadFile) -> Document:
        """
        End-to-end ingestion pipeline for a single file:
        Validate -> Save disk -> Extract -> Chunk -> Embed -> Store Pinecone -> Save SQLite.
        """
        original_name = upload_file.filename or "untitled.txt"
        sanitized_name = self._sanitize_filename(original_name)
        file_bytes = await upload_file.read()

        file_type = self._validate_file(sanitized_name, file_bytes)

        # 1. Create document record in SQLite with status 'processing'
        doc_id = str(uuid.uuid4())
        upload_dir = self.settings.UPLOAD_DIR
        os.makedirs(upload_dir, exist_ok=True)

        stored_filename = f"{doc_id}_{sanitized_name}"
        file_path = os.path.join(upload_dir, stored_filename)

        with open(file_path, "wb") as f:
            f.write(file_bytes)

        doc = self.repo.create({
            "id": doc_id,
            "filename": sanitized_name,
            "original_filename": original_name,
            "file_type": file_type,
            "file_path": file_path,
            "file_size": len(file_bytes),
            "status": "processing",
            "linked": True
        })

        try:
            # 2. Extract text page-by-page
            pages_data = self._extract_text(file_path, file_type)

            # 3. Chunk text while preserving page number & document reference
            raw_chunks_to_embed: List[str] = []
            chunk_metadata_list: List[dict] = []
            chunk_counter = 0

            for page_num, page_text in pages_data:
                splits = self.text_splitter.split_text(page_text)
                for split in splits:
                    if not split.strip():
                        continue
                    chunk_counter += 1
                    chunk_id = f"{doc_id}_chunk_{chunk_counter}"
                    raw_chunks_to_embed.append(split)
                    chunk_metadata_list.append({
                        "document_id": doc_id,
                        "chunk_id": chunk_id,
                        "page_number": page_num,
                        "text": split,
                        "pinecone_vector_id": chunk_id
                    })

            if not raw_chunks_to_embed:
                raise DocumentProcessingError("No meaningful text chunks could be extracted from document.")

            # 4. Generate embeddings
            embeddings_list = self.embeddings.embed_documents(raw_chunks_to_embed)

            # 5. Prepare vectors for Pinecone
            upload_timestamp = time.time()
            pinecone_records = []
            for i, vec in enumerate(embeddings_list):
                meta = chunk_metadata_list[i]
                pinecone_records.append({
                    "id": meta["pinecone_vector_id"],
                    "values": vec,
                    "metadata": {
                        "document_id": doc_id,
                        "owner_id": self.repo.owner_id,
                        "filename": sanitized_name,
                        "chunk_id": meta["chunk_id"],
                        "page_number": meta["page_number"],
                        "chunk_text": meta["text"],
                        "document_type": file_type,
                        "linked": True,
                        "upload_timestamp": upload_timestamp
                    }
                })

            # 6. Upsert to Pinecone
            self.pinecone_mgr.upsert_vectors(pinecone_records)

            # 7. Persist chunk records into SQLite
            self.repo.add_chunks(chunk_metadata_list)

            # 8. Mark document as 'ready'
            doc = self.repo.update_status(doc_id, "ready")
            logger.info(f"Document '{sanitized_name}' ({doc_id}) successfully ingested with {len(raw_chunks_to_embed)} chunks.")
            return doc

        except Exception as e:
            logger.error(f"Ingestion failed for document '{sanitized_name}' ({doc_id}): {e}", exc_info=True)
            self.repo.update_status(doc_id, "failed", error_message=str(e))
            raise DocumentProcessingError(f"Failed to process document '{sanitized_name}': {str(e)}", document_id=doc_id)
