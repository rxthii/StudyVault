from typing import Any, Dict, Optional
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from .logging import logger


class AppException(Exception):
    """Base application exception for StudyVault."""
    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_SERVER_ERROR",
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.details = details or {}


class ConfigurationError(AppException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code="CONFIGURATION_ERROR",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details=details
        )


class DocumentNotFoundError(AppException):
    def __init__(self, document_id: str):
        super().__init__(
            message=f"Document with ID '{document_id}' was not found.",
            code="DOCUMENT_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
            details={"document_id": document_id}
        )


class InvalidFileTypeError(AppException):
    def __init__(self, filename: str, allowed_types: Optional[list] = None):
        super().__init__(
            message=f"File '{filename}' has an unsupported file type. Allowed: {allowed_types or ['.pdf', '.txt']}",
            code="INVALID_FILE_TYPE",
            status_code=status.HTTP_400_BAD_REQUEST,
            details={"filename": filename}
        )


class FileTooLargeError(AppException):
    def __init__(self, filename: str, size_bytes: int, max_mb: int):
        super().__init__(
            message=f"File '{filename}' exceeds maximum allowed size of {max_mb} MB.",
            code="FILE_TOO_LARGE",
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            details={"filename": filename, "size_bytes": size_bytes, "max_mb": max_mb}
        )


class DocumentProcessingError(AppException):
    def __init__(self, message: str, document_id: Optional[str] = None):
        super().__init__(
            message=message,
            code="DOCUMENT_PROCESSING_FAILED",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            details={"document_id": document_id} if document_id else {}
        )


class PineconeServiceError(AppException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code="PINECONE_SERVICE_ERROR",
            status_code=status.HTTP_502_BAD_GATEWAY,
            details=details
        )


class LLMServiceError(AppException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code="LLM_SERVICE_ERROR",
            status_code=status.HTTP_502_BAD_GATEWAY,
            details=details
        )


class RetrievalError(AppException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            code="RETRIEVAL_FAILED",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details=details
        )


class ConversationNotFoundError(AppException):
    def __init__(self, conversation_id: str):
        super().__init__(
            message=f"Conversation '{conversation_id}' was not found.",
            code="CONVERSATION_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
            details={"conversation_id": conversation_id}
        )


class InvalidModeError(AppException):
    def __init__(self, mode: str, allowed: list):
        super().__init__(
            message=f"Invalid AI mode '{mode}'. Allowed modes: {allowed}",
            code="INVALID_MODE",
            status_code=status.HTTP_400_BAD_REQUEST,
            details={"mode": mode, "allowed": allowed}
        )


def register_exception_handlers(app: FastAPI) -> None:
    """Registers unified error handlers for all exceptions."""

    @app.exception_handler(AppException)
    async def app_exception_handler(request: Request, exc: AppException):
        logger.warning(f"AppException: code={exc.code} message={exc.message} path={request.url.path}")
        content = {
            "error": {
                "code": exc.code,
                "message": exc.message
            }
        }
        if exc.details:
            content["error"]["details"] = exc.details
        return JSONResponse(status_code=exc.status_code, content=content)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        logger.warning(f"Validation error on {request.url.path}: {exc.errors()}")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "The request body or parameters are invalid.",
                    "details": {"validation_errors": exc.errors()}
                }
            }
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        logger.warning(f"HTTP error {exc.status_code} on {request.url.path}: {exc.detail}")
        code_map = {
            404: "NOT_FOUND",
            405: "METHOD_NOT_ALLOWED",
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            403: "FORBIDDEN"
        }
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": code_map.get(exc.status_code, "HTTP_ERROR"),
                    "message": str(exc.detail)
                }
            }
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled server error on {request.url.path}: {str(exc)}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected server error occurred. Please try again."
                }
            }
        )
