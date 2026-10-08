import io
import os
import pytest
from typing import Generator
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from pypdf import PdfWriter

# Set test environment
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["OPENROUTER_API_KEY"] = "mock-key"
os.environ["PINECONE_API_KEY"] = "mock-key"
os.environ["PINECONE_INDEX_NAME"] = "studyvault-test"
os.environ["EMBEDDING_PROVIDER"] = "mock"
os.environ["WEB_SEARCH_PROVIDER"] = "mock"

from app.core.config import get_settings
from app.database.database import Base, get_db
from app.main import create_application
from app.vectorstore.pinecone_client import PineconeManager
from app.ai.embeddings import MockEmbeddings
from app.ai.openrouter import MockChatModel
from app.services.web_search_service import WebSearchService
from app.services.retrieval_service import RetrievalService
from app.vectorstore.retriever import PineconeDocumentRetriever


# In-memory SQLite database setup
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


class InMemoryMockPineconeManager(PineconeManager):
    """In-memory mock Pinecone manager storing vectors in a Python dictionary."""
    def __init__(self):
        self.vectors_db = {}  # id -> dict with id, values, metadata

    def upsert_vectors(self, vectors, namespace=None, batch_size=100):
        for v in vectors:
            self.vectors_db[v["id"]] = v
        return len(vectors)

    def query(self, vector, top_k=5, filter_dict=None, namespace=None):
        results = []
        for vid, vdata in self.vectors_db.items():
            meta = vdata.get("metadata", {})
            # Check filter
            if filter_dict:
                match = True
                for k, condition in filter_dict.items():
                    val = meta.get(k)
                    if isinstance(condition, dict):
                        if "$eq" in condition and val != condition["$eq"]:
                            match = False
                        if "$in" in condition and val not in condition["$in"]:
                            match = False
                    elif val != condition:
                        match = False
                if not match:
                    continue

            # Return realistic match with simulated high cosine similarity
            results.append({
                "id": vid,
                "score": 0.88,
                "metadata": meta
            })
            if len(results) >= top_k:
                break
        return results

    def delete_by_document_id(self, document_id, namespace=None):
        to_del = [vid for vid, v in self.vectors_db.items() if v.get("metadata", {}).get("document_id") == document_id]
        for vid in to_del:
            del self.vectors_db[vid]

    def get_stats(self):
        return {
            "index_name": "studyvault-test",
            "dimension": 1024,
            "total_vector_count": len(self.vectors_db),
            "namespaces": {"documents": {"vector_count": len(self.vectors_db)}},
            "metric": "cosine"
        }


@pytest.fixture(scope="session")
def mock_pinecone():
    return InMemoryMockPineconeManager()


@pytest.fixture(scope="function")
def db_session() -> Generator[Session, None, None]:
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db_session: Session, mock_pinecone: InMemoryMockPineconeManager) -> Generator[TestClient, None, None]:
    app = create_application()

    # Override get_db dependency
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def sample_pdf_bytes() -> bytes:
    """Generates a minimal valid PDF in memory for testing."""
    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    stream = io.BytesIO()
    writer.write(stream)
    return stream.getvalue()


@pytest.fixture
def sample_txt_bytes() -> bytes:
    """Generates sample physics textbook text."""
    content = (
        "Electromagnetic induction is the production of an electromotive force across an electrical conductor "
        "in a changing magnetic field. Michael Faraday is generally credited with the discovery of induction in 1831. "
        "Faraday's law of induction is a basic law of electromagnetism predicting how a magnetic field will interact "
        "with an electric circuit to produce an electromotive force. Lenz's law gives the direction of the induced electromotive force."
    )
    return content.encode("utf-8")
