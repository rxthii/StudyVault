from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database.database import get_db
from app.core.config import Settings, get_settings
from app.vectorstore.pinecone_client import get_pinecone_manager

router = APIRouter(tags=["System"])


@router.get("/health", summary="Health Check")
def health_check():
    """Returns basic backend liveness and health status."""
    return {
        "status": "healthy",
        "service": "StudyVault Backend",
        "version": "1.0.0"
    }


@router.get("/status", summary="Detailed Service Status")
def service_status(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings)
):
    """
    Returns application and service status including Database, Pinecone,
    OpenRouter configuration status, and Embedding configuration status.
    NEVER returns actual secret keys.
    """
    # 1. Database check
    db_ok = True
    db_message = "Connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_ok = False
        db_message = str(e)

    # 2. Pinecone status
    pinecone_ok = False
    pinecone_info = {}
    try:
        mgr = get_pinecone_manager()
        stats = mgr.get_stats()
        pinecone_ok = "error" not in stats
        pinecone_info = {
            "index_name": stats.get("index_name"),
            "dimension": stats.get("dimension"),
            "total_vectors": stats.get("total_vector_count"),
            "connected": pinecone_ok
        }
    except Exception as e:
        pinecone_info = {"connected": False, "error": str(e)}

    # 3. Credentials summary
    cred_summary = settings.validate_required_credentials()

    return {
        "status": "operational" if db_ok else "degraded",
        "environment": settings.APP_ENV,
        "database": {
            "status": "connected" if db_ok else "unreachable",
            "type": "sqlite",
            "message": db_message
        },
        "pinecone": pinecone_info,
        "llm_configuration": {
            "provider": "OpenRouter",
            "model": settings.OPENROUTER_MODEL,
            "configured": cred_summary["openrouter_configured"]
        },
        "embedding_configuration": {
            "provider": settings.EMBEDDING_PROVIDER,
            "model": settings.EMBEDDING_MODEL,
            "dimension": settings.EMBEDDING_DIMENSION,
            "configured": cred_summary["embedding_configured"]
        },
        "web_search_configuration": {
            "provider": settings.WEB_SEARCH_PROVIDER,
            "configured": True
        },
        "all_required_credentials_valid": cred_summary["is_valid"]
    }
