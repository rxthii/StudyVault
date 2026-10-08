from typing import Any, List, Optional
from langchain_core.messages import BaseMessage, AIMessage
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.outputs import ChatResult, ChatGeneration
from langchain_openai import ChatOpenAI
from app.core.config import Settings, get_settings
from app.core.logging import logger
from app.core.errors import ConfigurationError, LLMServiceError


class MockChatModel(BaseChatModel):
    """Deterministic mock chat model for unit testing and offline development."""
    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[Any] = None,
        **kwargs: Any
    ) -> ChatResult:
        user_text = messages[-1].content if messages else ""
        
        # Check if context was provided in the prompt
        prompt_full = " ".join([m.content for m in messages])
        if "retrieved uploaded-document context" in prompt_full and "No relevant documents found" in prompt_full:
            reply = "I couldn't find this information in your uploaded documents."
        elif "No context available" in prompt_full:
            reply = "I couldn't find this information in your uploaded documents."
        else:
            reply = f"Grounded response based on uploaded documents for: '{user_text[:60]}...'"
            
        gen = ChatGeneration(message=AIMessage(content=reply))
        return ChatResult(generations=[gen])

    @property
    def _llm_type(self) -> str:
        return "mock-chat"


def get_llm(
    settings: Optional[Settings] = None,
    temperature: float = 0.1,
    streaming: bool = False,
    max_tokens: int = 1500
) -> BaseChatModel:
    """
    Returns configured LangChain Chat model for OpenRouter AI.
    Falls back gracefully to MockChatModel during tests or when keys are absent.
    """
    settings = settings or get_settings()

    if settings.APP_ENV == "test" or settings.OPENROUTER_MODEL == "mock":
        return MockChatModel()

    api_key = settings.OPENROUTER_API_KEY
    if not settings.is_valid_credential(api_key):
        logger.warning("Valid OPENROUTER_API_KEY not found; falling back to MockChatModel.")
        return MockChatModel()

    try:
        return ChatOpenAI(
            model=settings.OPENROUTER_MODEL,
            openai_api_key=api_key,
            openai_api_base=settings.OPENROUTER_BASE_URL,
            temperature=temperature,
            max_tokens=max_tokens,
            streaming=streaming,
            default_headers={
                "HTTP-Referer": "https://studyvault.local",
                "X-Title": "StudyVault Student Assistant"
            }
        )
    except Exception as e:
        logger.error(f"Failed to initialize ChatOpenAI for OpenRouter: {e}")
        raise LLMServiceError(f"Could not initialize OpenRouter client: {str(e)}")
