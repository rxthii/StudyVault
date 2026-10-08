from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    ConversationHistoryResponse,
)
from app.schemas.common import BaseMessageResponse
from app.services.rag_service import RagService
from app.services.conversation_service import ConversationService

router = APIRouter(prefix="/chat", tags=["Chat & RAG"])


@router.post(
    "",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Grounded AI Chat & RAG Modes"
)
async def chat_interaction(
    payload: ChatRequest,
    db: Session = Depends(get_db)
):
    """
    Main grounded AI endpoint for StudyVault.
    Supports modes:
    - **ask**: Grounded question answering strictly based on study material.
    - **explain**: Concept explanation (normal, simple/ELI5, step-by-step).
    - **summarize**: Structured summaries with key takeaways and definitions.
    - **compare**: Multi-document comparative analysis (similarities, divergences, evidence).
    - **evidence**: Deep passage retrieval with relevance evaluation.
    - **quiz**: Direct grounded question generation.
    """
    rag_svc = RagService(db)
    return await rag_svc.generate_response(payload)


@router.post(
    "/stream",
    summary="Streaming Grounded AI Chat (SSE)"
)
async def stream_chat(
    payload: ChatRequest,
    db: Session = Depends(get_db)
):
    """
    Streaming AI chat endpoint utilizing Server-Sent Events (SSE).
    Streams answer tokens in real-time, concluding with complete source citation metadata.
    """
    rag_svc = RagService(db)
    return StreamingResponse(
        rag_svc.stream_chat(payload),
        media_type="text/event-stream"
    )


@router.get(
    "/history/{conversation_id}",
    response_model=ConversationHistoryResponse,
    summary="Get Conversation History"
)
def get_conversation_history(
    conversation_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieve past multi-turn dialog history for a specific conversation session.
    """
    conv_svc = ConversationService(db)
    return conv_svc.get_history(conversation_id)


@router.delete(
    "/history/{conversation_id}",
    response_model=BaseMessageResponse,
    summary="Delete Conversation History"
)
def delete_conversation_history(
    conversation_id: str,
    db: Session = Depends(get_db)
):
    """
    Delete a conversation session and all recorded dialog history.
    """
    conv_svc = ConversationService(db)
    conv_svc.delete_conversation(conversation_id)
    return BaseMessageResponse(
        message=f"Conversation '{conversation_id}' deleted successfully."
    )
