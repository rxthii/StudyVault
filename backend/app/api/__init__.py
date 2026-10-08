from fastapi import APIRouter
from .health import router as health_router
from .documents import router as documents_router
from .retrieval import router as retrieval_router
from .chat import router as chat_router
from .flashcards import router as flashcards_router
from .quiz import router as quiz_router
from .sources import router as sources_router
from .search import router as search_router

api_router = APIRouter(prefix="/api")

api_router.include_router(health_router)
api_router.include_router(documents_router)
api_router.include_router(retrieval_router)
api_router.include_router(chat_router)
api_router.include_router(flashcards_router)
api_router.include_router(quiz_router)
api_router.include_router(sources_router)
api_router.include_router(search_router)

__all__ = ["api_router"]
