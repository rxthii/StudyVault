from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict
from .retrieval import SourceReference

ChatMode = Literal["ask", "explain", "summarize", "compare", "evidence", "quiz"]
SourceMode = Literal["documents_only", "web_only", "documents_and_web"]
ExplanationStyle = Literal["normal", "simple", "step_by_step"]


class WebSourceReference(BaseModel):
    title: str
    url: str
    snippet: str


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Question or task instruction")
    conversation_id: Optional[str] = Field(default=None, description="Conversation session ID for multi-turn history")
    mode: ChatMode = Field(default="ask", description="AI mode: ask, explain, summarize, compare, evidence, quiz")
    document_ids: Optional[List[str]] = Field(
        default=None,
        examples=[None],
        description="Optional list of document IDs to scope down knowledge. Leave empty or null to use all active linked documents."
    )
    source_mode: SourceMode = Field(default="documents_only", description="documents_only (default), web_only, documents_and_web")
    explanation_style: Optional[ExplanationStyle] = Field(default="normal", description="For explain mode: normal, simple, step_by_step")


class ChatResponse(BaseModel):
    conversation_id: str
    query: str
    answer: str
    mode: str
    source_mode: str
    is_grounded: bool = Field(..., description="Whether the answer was fully found and grounded in provided context")
    document_sources: List[SourceReference] = Field(default_factory=list, description="Retrieved document snippets")
    web_sources: List[WebSourceReference] = Field(default_factory=list, description="External web search results if enabled")
    structured_data: Optional[Dict[str, Any]] = Field(default=None, description="Detailed structured output for compare/evidence modes")
    fallback_used: bool = Field(default=False, description="Whether deterministic fallback was used due to upstream LLM downtime")


class MessageSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    conversation_id: str
    role: str
    content: str
    mode: str
    source_mode: str
    sources_json: Optional[str] = None
    created_at: datetime


class ConversationHistoryResponse(BaseModel):
    conversation_id: str
    title: Optional[str] = None
    messages: List[MessageSchema]
