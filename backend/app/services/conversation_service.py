import json
import re
from typing import List, Optional
from sqlalchemy.orm import Session
from langchain_core.language_models.chat_models import BaseChatModel

from app.core.config import Settings, get_settings
from app.core.logging import logger
from app.database.repositories import ConversationRepository
from app.models.conversation import Conversation, Message
from app.ai.openrouter import get_llm
from app.ai.prompts import QUERY_REWRITE_PROMPT
from app.schemas.chat import MessageSchema, ConversationHistoryResponse


class ConversationService:
    def __init__(
        self,
        db: Session,
        settings: Optional[Settings] = None,
        llm: Optional[BaseChatModel] = None
    ):
        self.db = db
        self.settings = settings or get_settings()
        self.repo = ConversationRepository(db)
        self.llm = llm or get_llm(self.settings, temperature=0.0, max_tokens=150)

    def get_or_create_conversation(self, conversation_id: Optional[str] = None) -> Conversation:
        return self.repo.get_or_create(conv_id=conversation_id)

    def add_user_message(
        self,
        conversation_id: str,
        query: str,
        mode: str,
        source_mode: str
    ) -> Message:
        return self.repo.add_message(
            conversation_id=conversation_id,
            role="user",
            content=query,
            mode=mode,
            source_mode=source_mode
        )

    def add_assistant_message(
        self,
        conversation_id: str,
        answer: str,
        mode: str,
        source_mode: str,
        sources: Optional[list] = None
    ) -> Message:
        sources_str = json.dumps([s.model_dump() if hasattr(s, "model_dump") else s for s in sources]) if sources else None
        return self.repo.add_message(
            conversation_id=conversation_id,
            role="assistant",
            content=answer,
            mode=mode,
            source_mode=source_mode,
            sources_json=sources_str
        )

    def get_history(self, conversation_id: str) -> ConversationHistoryResponse:
        conv = self.repo.get_by_id(conversation_id)
        messages = self.repo.get_history(conversation_id, limit=30)
        return ConversationHistoryResponse(
            conversation_id=conversation_id,
            title=conv.title if conv else None,
            messages=[MessageSchema.model_validate(m) for m in messages]
        )

    def delete_conversation(self, conversation_id: str) -> bool:
        return self.repo.delete(conversation_id)

    def contextualize_query(self, conversation_id: str, current_query: str) -> str:
        """
        If this is a follow-up in an ongoing conversation, rephrases query into a standalone query
        for accurate Pinecone vector retrieval, without bypassing document grounding.
        """
        history_msgs = self.repo.get_history(conversation_id, limit=6)
        # If there are fewer than 2 previous messages, the current query is already standalone
        if len(history_msgs) < 2:
            return current_query

        # Avoid a serial extra model request for complete questions. Rewrite only
        # brief or context-dependent follow-ups such as "why?" or "what about it?".
        context_references = re.search(
            r"\b(it|this|that|these|those|they|them|there|above|previous|same)\b",
            current_query,
            flags=re.IGNORECASE,
        )
        short_followup = len(current_query.split()) <= 3 and re.match(
            r"(?i)^(and|but|also|why|how|what|which|explain|elaborate|continue)\b",
            current_query.strip(),
        )
        if not context_references and not short_followup:
            return current_query

        # Build clean dialogue turns text
        turns = []
        for m in history_msgs[:-1]:  # exclude the newly added user message
            turns.append(f"{m.role.capitalize()}: {m.content}")
        history_text = "\n".join(turns)

        try:
            formatted_prompt = QUERY_REWRITE_PROMPT.format(
                history=history_text,
                query=current_query
            )
            response = self.llm.invoke(formatted_prompt)
            rewritten = response.content.strip().strip('"') if isinstance(response.content, str) else ""
            query_label = re.search(
                r"(?im)^\s*(?:standalone search query|rewritten query)\s*:\s*(.*)$",
                rewritten,
            )
            if query_label:
                rewritten = query_label.group(1).strip().strip('"')
                if not rewritten:
                    rewritten = response.content[query_label.end():].strip().strip('"')

            looks_like_reasoning = bool(re.match(
                r"(?is)^\s*(?:here(?:'s| is)\s+(?:(?:my|a)\s+)?thinking process|"
                r"(?:\d+[.)]\s*)?(?:\*\*)?(?:analyze(?: user input)?|analysis|reasoning)\b|"
                r"let me think|step\s*1\s*[:.)])",
                rewritten,
            ))
            if rewritten and len(rewritten) > 3 and len(rewritten) <= 500 and "\n" not in rewritten and not looks_like_reasoning:
                logger.info(f"Rephrased follow-up query '{current_query}' -> '{rewritten}'")
                return rewritten
            if looks_like_reasoning or len(rewritten) > 500:
                logger.warning("Query rewriter returned reasoning or an overlong result; using the user's query.")
        except Exception as e:
            logger.warning(f"Failed to contextualize query via LLM: {e}. Using raw query.")

        return current_query
