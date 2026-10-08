from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class DocumentBase(BaseModel):
    filename: str
    original_filename: str
    file_type: str
    file_size: int
    linked: bool = True
    status: str = "uploaded"


class Document(DocumentBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime
    error_message: Optional[str] = None
    chunk_count: Optional[int] = 0


class DocumentUploadItem(BaseModel):
    document_id: str
    filename: str
    status: str
    file_size: int
    error_message: Optional[str] = None


class DocumentUploadResponse(BaseModel):
    message: str
    documents: List[DocumentUploadItem]
    uploaded_count: int
    failed_count: int


class LinkDocumentRequest(BaseModel):
    linked: bool = Field(..., description="Whether this document is active in retrieval scope")


class LinkDocumentResponse(BaseModel):
    document_id: str
    linked: bool
    message: str


class DocumentChunkInfo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    chunk_id: str
    page_number: int
    snippet: str
    created_at: datetime


class DocumentContentResponse(BaseModel):
    document_id: str
    filename: str
    total_chunks: int
    chunks: List[DocumentChunkInfo]


class PageContentResponse(BaseModel):
    document_id: str
    filename: str
    page_number: int
    content: str
    chunk_count: int
