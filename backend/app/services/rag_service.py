import re
from typing import AsyncGenerator, Dict, List, Optional
from sqlalchemy.orm import Session
from langchain_core.language_models.chat_models import BaseChatModel

from app.core.config import Settings, get_settings
from app.core.logging import logger
from app.core.errors import InvalidModeError
from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
    WebSourceReference,
)
from app.schemas.retrieval import SourceReference
from app.services.retrieval_service import RetrievalService
from app.services.conversation_service import ConversationService
from app.services.web_search_service import WebSearchService, get_web_search_service
from app.ai.openrouter import get_llm
from app.ai.prompts import (
    SYSTEM_GROUNDING_PROMPT,
    SYSTEM_WEB_AND_DOCS_PROMPT,
    SYSTEM_WEB_ONLY_PROMPT,
    EXPLAIN_PROMPT,
    SUMMARIZE_PROMPT,
    COMPARE_PROMPT,
    EVIDENCE_PROMPT,
    build_context_block,
    build_web_context_block,
)


_REASONING_HEADER = re.compile(
    r"(?im)^\s*(?:here(?:'s| is)\s+(?:(?:my|a)\s+)?(?:thinking process|chain of thought)|"
    r"(?:internal\s+)?(?:analysis|reasoning|thought process))\s*:?\s*$"
)
_FINAL_ANSWER_HEADER = re.compile(
    r"(?im)^\s*(?:#{1,6}\s*)?(?:\*\*)?(?:final answer|final response)(?:\*\*)?\s*:?\s*(.*)$"
)


def _user_facing_answer(content: object) -> str:
    """Remove explicit model reasoning and return only a final response."""
    if not isinstance(content, str):
        return ""

    text = content.strip()
    reasoning_header = _REASONING_HEADER.search(text)
    if reasoning_header:
        final_header = _FINAL_ANSWER_HEADER.search(text, reasoning_header.end())
        if not final_header:
            # Do not expose analysis if the model failed to produce a final answer.
            return ""
        text = f"{final_header.group(1)}\n{text[final_header.end():]}".strip()

    # Some models delimit private reasoning with tags instead of a heading.
    text = re.sub(r"(?is)<(?:think|analysis|reasoning)>.*?</(?:think|analysis|reasoning)>", "", text).strip()
    final_header = _FINAL_ANSWER_HEADER.match(text)
    if final_header:
        text = f"{final_header.group(1)}\n{text[final_header.end():]}".strip()
    return text


class RagService:
    def __init__(
        self,
        db: Session,
        settings: Optional[Settings] = None,
        retrieval_svc: Optional[RetrievalService] = None,
        conversation_svc: Optional[ConversationService] = None,
        web_search_svc: Optional[WebSearchService] = None,
        llm: Optional[BaseChatModel] = None
    ):
        self.db = db
        self.settings = settings or get_settings()
        self.retrieval_svc = retrieval_svc or RetrievalService(db, settings=self.settings)
        self.conversation_svc = conversation_svc or ConversationService(db, settings=self.settings)
        self.web_search_svc = web_search_svc or get_web_search_service()
        self.llm = llm or get_llm(self.settings, temperature=0.1, max_tokens=1800)

    async def generate_response(self, request: ChatRequest) -> ChatResponse:
        """
        Orchestrates grounded response generation across requested mode and source mode.
        """
        # 1. Setup conversation session
        conv = self.conversation_svc.get_or_create_conversation(request.conversation_id)
        conv_id = conv.id

        # 2. Record user query
        self.conversation_svc.add_user_message(
            conversation_id=conv_id,
            query=request.query,
            mode=request.mode,
            source_mode=request.source_mode
        )

        # 3. Contextualize query for multi-turn conversational follow-ups
        effective_query = self.conversation_svc.contextualize_query(conv_id, request.query)

        # 4. Retrieve context based on source_mode
        doc_sources: List[SourceReference] = []
        web_sources: List[WebSourceReference] = []

        if request.source_mode in ["documents_only", "documents_and_web"]:
            broad_request = request.mode == "summarize" or bool(re.search(
                r"\b(all|every|entire|whole|complete|comprehensive|overview|summari[sz]e)\b|"
                r"\b(core|key|main)\s+concepts?\b|\bmain\s+ideas?\b",
                request.query,
                flags=re.IGNORECASE,
            ))
            retrieval_top_k = (
                min(40, max(self.settings.TOP_K, 30))
                if broad_request
                else min(20, max(self.settings.TOP_K, 8))
            )
            retrieval_res = self.retrieval_svc.search(
                query=effective_query,
                document_ids=request.document_ids,
                top_k=retrieval_top_k
            )
            doc_sources = retrieval_res.results

        if request.source_mode in ["web_only", "documents_and_web"]:
            web_sources = await self.web_search_svc.search(
                query=request.query,
                max_results=4
            )

        # 5. Anti-hallucination check for documents_only
        if request.source_mode == "documents_only":
            if not doc_sources:
                grounded_msg = "I couldn't find this information in your uploaded documents."
                self.conversation_svc.add_assistant_message(
                    conversation_id=conv_id,
                    answer=grounded_msg,
                    mode=request.mode,
                    source_mode=request.source_mode,
                    sources=[]
                )
                return ChatResponse(
                    conversation_id=conv_id,
                    query=request.query,
                    answer=grounded_msg,
                    mode=request.mode,
                    source_mode=request.source_mode,
                    is_grounded=False,
                    document_sources=[],
                    web_sources=[],
                    structured_data=None,
                    fallback_used=False
                )

        # 6. Build prompt based on mode
        prompt_text = self._build_prompt_for_mode(
            mode=request.mode,
            query=request.query,
            doc_sources=doc_sources,
            web_sources=web_sources,
            source_mode=request.source_mode,
            explanation_style=request.explanation_style or "normal"
        )

        # 7. Execute LLM call with robust fallback
        answer = ""
        structured_data = None
        fallback_used = False

        try:
            llm_response = self.llm.invoke(prompt_text)
            answer = _user_facing_answer(llm_response.content)
            if not answer:
                logger.warning("LLM returned reasoning without a final answer; using grounded fallback.")
                fallback_used = True
                answer, structured_data = self._generate_deterministic_fallback(
                    mode=request.mode,
                    query=request.query,
                    doc_sources=doc_sources,
                    web_sources=web_sources
                )
        except Exception as e:
            logger.error(f"Upstream LLM generation failed: {e}", exc_info=True)
            fallback_used = True
            answer, structured_data = self._generate_deterministic_fallback(
                mode=request.mode,
                query=request.query,
                doc_sources=doc_sources,
                web_sources=web_sources
            )

        # Extract structured data for evidence mode if LLM was used
        if request.mode == "evidence" and not structured_data:
            structured_data = {
                "inquiry": request.query,
                "evidence_items": [
                    {
                        "document": s.filename,
                        "page": s.page_number,
                        "chunk_id": s.chunk_id,
                        "passage": s.snippet,
                        "relevance_score": s.relevance_score,
                        "supports_inquiry": True
                    }
                    for s in doc_sources
                ]
            }

        # 8. Record assistant message in database
        self.conversation_svc.add_assistant_message(
            conversation_id=conv_id,
            answer=answer,
            mode=request.mode,
            source_mode=request.source_mode,
            sources=doc_sources
        )

        return ChatResponse(
            conversation_id=conv_id,
            query=request.query,
            answer=answer,
            mode=request.mode,
            source_mode=request.source_mode,
            is_grounded=len(doc_sources) > 0 or len(web_sources) > 0,
            document_sources=doc_sources,
            web_sources=web_sources,
            structured_data=structured_data,
            fallback_used=fallback_used
        )

    def _build_prompt_for_mode(
        self,
        mode: str,
        query: str,
        doc_sources: List[SourceReference],
        web_sources: List[WebSourceReference],
        source_mode: str,
        explanation_style: str
    ) -> str:
        # Determine system instruction header
        if source_mode == "documents_and_web":
            sys_header = SYSTEM_WEB_AND_DOCS_PROMPT
        elif source_mode == "web_only":
            sys_header = SYSTEM_WEB_ONLY_PROMPT
        else:
            sys_header = SYSTEM_GROUNDING_PROMPT

        # Build context blocks
        doc_context = build_context_block([s.model_dump() for s in doc_sources])
        web_context = build_web_context_block([w.model_dump() for w in web_sources])

        combined_context = ""
        if source_mode == "documents_and_web":
            combined_context = f"=== UPLOADED STUDY MATERIAL CONTEXT ===\n{doc_context}\n\n=== EXTERNAL WEB SEARCH CONTEXT ===\n{web_context}"
        elif source_mode == "web_only":
            combined_context = web_context
        else:
            combined_context = doc_context

        if mode == "ask":
            return f"""{sys_header}

QUESTION:
{query}

RETRIEVED CONTEXT:
{combined_context}

ANSWER:"""

        elif mode == "explain":
            return EXPLAIN_PROMPT.format(
                system_instruction=sys_header,
                query=query,
                style=explanation_style,
                context=combined_context
            )

        elif mode == "summarize":
            return SUMMARIZE_PROMPT.format(
                system_instruction=sys_header,
                query=query,
                context=combined_context
            )

        elif mode == "compare":
            return COMPARE_PROMPT.format(
                system_instruction=sys_header,
                query=query,
                context=combined_context
            )

        elif mode == "evidence":
            return EVIDENCE_PROMPT.format(
                system_instruction=sys_header,
                query=query,
                context=combined_context
            )

        elif mode == "quiz":
            return f"""{sys_header}
Generate a quiz question for: {query}
Context: {combined_context}"""

        else:
            raise InvalidModeError(mode, allowed=["ask", "explain", "summarize", "compare", "evidence", "quiz"])

    def _generate_deterministic_fallback(
        self,
        mode: str,
        query: str,
        doc_sources: List[SourceReference],
        web_sources: List[WebSourceReference]
    ) -> (str, Optional[Dict]):
        """
        Deterministic fallback when OpenRouter is unreachable or rate limited.
        Never hallucinates facts; synthesizes directly from retrieved passages.
        """
        if not doc_sources and not web_sources:
            return "I couldn't find this information in your uploaded documents.", None

        broad_request = mode == "summarize" or bool(re.search(
            r"\b(all|every|entire|whole|complete|comprehensive|overview|summari[sz]e)\b|"
            r"\b(core|key|main)\s+concepts?\b|\bmain\s+ideas?\b",
            query,
            flags=re.IGNORECASE,
        ))

        if broad_request and doc_sources:
            concept_points = []
            seen = set()
            for source in doc_sources:
                sentence = re.split(r"(?<=[.!?])\s+", source.snippet.strip(), maxsplit=1)[0]
                sentence = sentence.strip(" \t\r\n-•")
                if len(sentence) < 25:
                    sentence = source.snippet.strip()[:400]
                key = " ".join(sentence.lower().split())
                if not sentence or key in seen:
                    continue
                seen.add(key)
                concept_points.append(
                    f"{len(concept_points) + 1}. {sentence} "
                    f"[Doc: {source.filename}, Page: {source.page_number}]"
                )
                if len(concept_points) >= 15:
                    break

            if concept_points:
                return (
                    "## Concepts represented in the retrieved excerpts\n\n"
                    + "\n\n".join(concept_points)
                    + "\n\nThis list is limited to the retrieved passages; it may not cover every concept in the full document."
                ), None

        if mode == "compare":
            doc_map: Dict[str, List[str]] = {}
            for s in doc_sources:
                doc_map.setdefault(s.filename, []).append(f"p.{s.page_number}: {s.snippet[:120]}...")
            
            comparison_lines = ["### Document Comparison (Deterministic Passage Extraction)\n"]
            for doc_name, passages in doc_map.items():
                comparison_lines.append(f"**Document: {doc_name}**")
                for p in passages:
                    comparison_lines.append(f"- {p}")
            return "\n".join(comparison_lines), None

        if mode == "evidence":
            items = [
                {
                    "document": s.filename,
                    "page": s.page_number,
                    "chunk_id": s.chunk_id,
                    "passage": s.snippet,
                    "relevance_score": s.relevance_score,
                    "supports_inquiry": True
                }
                for s in doc_sources
            ]
            text = (
                f"Found {len(doc_sources)} relevant evidence passages for '{query}' in your uploaded documents. "
                f"See structured evidence details."
            )
            return text, {"inquiry": query, "evidence_items": items}

        # Default ask / explain fallback: clearly formatted source extracts.
        snippets_text = "\n\n".join(
            f"{idx}. **{source.filename}, page {source.page_number}**\n\n> {source.snippet}"
            for idx, source in enumerate(doc_sources[:3], 1)
        )
        fallback_msg = f"## Relevant passages for: {query}\n\n{snippets_text}"
        return fallback_msg, None

    async def stream_chat(self, request: ChatRequest) -> AsyncGenerator[str, None]:
        """
        FastAPI streaming generator using Server-Sent Events (SSE).
        Yields chunked tokens, followed by a final JSON payload of sources.
        """
        import json
        response = await self.generate_response(request)
        
        # Stream text words in small realistic chunks
        words = response.answer.split(" ")
        for i in range(0, len(words), 3):
            chunk = " ".join(words[i:i + 3]) + " "
            yield f"data: {json.dumps({'type': 'token', 'text': chunk})}\n\n"
            
        final_meta = {
            "type": "done",
            "conversation_id": response.conversation_id,
            "is_grounded": response.is_grounded,
            "document_sources": [s.model_dump() for s in response.document_sources],
            "web_sources": [w.model_dump() for w in response.web_sources],
            "fallback_used": response.fallback_used
        }
        yield f"data: {json.dumps(final_meta)}\n\n"
