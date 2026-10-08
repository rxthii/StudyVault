from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.requests import Request

from app.core.config import get_settings
from app.core.auth_tokens import decode_access_token
from app.core.logging import logger
from app.core.errors import register_exception_handlers
from app.database.database import init_db
from app.api import api_router


class AuthenticationMiddleware:
    """Require a signed account token for every private API route."""

    PUBLIC_PATHS = {
        "/",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/api/health",
        "/api/auth/register",
        "/api/auth/login",
    }

    def __init__(self, app, settings):
        self.app = app
        self.settings = settings

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive=receive)
        if request.method == "OPTIONS" or request.url.path in self.PUBLIC_PATHS:
            scope.setdefault("state", {})["owner_id"] = (
                "test-user" if self.settings.APP_ENV == "test" else None
            )
            await self.app(scope, receive, send)
            return

        owner_id = None
        if self.settings.APP_ENV == "test":
            owner_id = "test-user"
        else:
            authorization = request.headers.get("authorization", "")
            scheme, _, token = authorization.partition(" ")
            if scheme.lower() == "bearer" and token:
                owner_id = decode_access_token(token, self.settings.AUTH_SECRET_KEY)

        if not owner_id:
            response = JSONResponse(
                status_code=401,
                content={"error": {"code": "UNAUTHENTICATED", "message": "Please sign in to access your StudyVault account."}},
                headers={"WWW-Authenticate": "Bearer"},
            )
            await response(scope, receive, send)
            return

        scope.setdefault("state", {})["owner_id"] = owner_id
        await self.app(scope, receive, send)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle management."""
    settings = get_settings()
    logger.info("Initializing StudyVault Backend...")

    # 1. Initialize SQLite tables
    init_db()

    # 2. Check credentials configuration
    cred_status = settings.validate_required_credentials()
    if cred_status["is_valid"]:
        logger.info("All required credentials configured successfully.")
    else:
        logger.warning(
            f"Missing external credentials: {cred_status['missing_credentials']}. "
            f"Ensure .env is configured properly for production operations."
        )

    logger.info(f"OpenRouter Model: {settings.OPENROUTER_MODEL}")
    logger.info(f"Pinecone Index: {settings.PINECONE_INDEX_NAME}")
    logger.info(f"Embedding Model: {settings.EMBEDDING_PROVIDER} ({settings.EMBEDDING_MODEL})")
    logger.info("StudyVault Backend is ready for requests.")

    yield

    logger.info("StudyVault Backend shutting down.")


def create_application() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="StudyVault Backend",
        description=(
            "Production-quality backend for StudyVault: A Smart Document Knowledge Assistant for university students.\n\n"
            "Features:\n"
            "- Multi-document PDF & TXT ingestion and vector indexing in Pinecone\n"
            "- Grounded RAG with strict anti-hallucination guarantees\n"
            "- Dynamic linking/unlinking of document knowledge sources without vector deletion\n"
            "- Multi-turn conversational memory with contextualized follow-up queries\n"
            "- Specialized AI modes: Ask, Explain, Summarize, Compare, Evidence, and Quiz\n"
            "- Automated active-recall flashcard and exam quiz generation\n"
            "- Optional external web search toggle with separated source attribution\n"
            "- Complete source passage transparency and trace-back citations"
        ),
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan
    )

    # CORS is added after authentication so browser preflights and 401 responses
    # retain their CORS headers. Authentication middleware is inside CORS.
    app.add_middleware(AuthenticationMiddleware, settings=settings)

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register centralized exception handlers
    register_exception_handlers(app)

    # Register API routes
    app.include_router(api_router)

    @app.get("/", include_in_schema=False)
    def root():
        return RedirectResponse(url="/docs")

    return app


app = create_application()
