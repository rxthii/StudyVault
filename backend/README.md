# StudyVault — Smart Document Knowledge Assistant Backend

A production-quality Python backend for **StudyVault**, an AI-powered document knowledge assistant engineered specifically for university students. StudyVault empowers students to index course materials (lecture slides, textbooks, lab manuals) and ask complex conceptual questions with **strict anti-hallucination guarantees**, **transparent source traceability**, **active-recall flashcard generation**, and **exam quizzes**.

---

## 1. Project Overview & Differentiator

Unlike generic AI chatbots that blend internet knowledge or invent plausible-sounding facts, StudyVault is built on a core foundational principle:
> **Every single document-grounded answer must be directly traceable to the student's uploaded study material.**

### Key Capabilities:
- **Multi-Document Ingestion**: Upload, validate, and parse multiple PDF and TXT files simultaneously.
- **Configurable Vector Storage**: Vectors are stored in a Pinecone Serverless vector database with detailed metadata (document ID, filename, chunk ID, page number, snippet).
- **Strict Grounding & Anti-Hallucination**: When external web search is off, StudyVault refuses to hallucinate facts. If context is insufficient, it responds: *"I couldn't find this information in your uploaded documents."*
- **Dynamic Knowledge Scoping (Link / Unlink)**: Temporarily unlink documents from active retrieval without deleting them or their vector embeddings.
- **Multi-Turn Conversational Memory**: Understands context in follow-up queries (e.g., *"Explain that more simply"* or *"What experiment demonstrates it?"*) while maintaining document grounding.
- **Specialized AI Modes**:
  - `ask`: Standard grounded Q&A with direct citations.
  - `explain`: Concept explanation with configurable depth (`normal`, `simple`/ELI5, `step_by_step`).
  - `summarize`: Structured executive summaries with key formulas and takeaways.
  - `compare`: Cross-document analysis highlighting similarities, divergences, and contradictions.
  - `evidence`: Deep passage extraction ranking supporting and refuting evidence.
  - `quiz`: Grounded multiple-choice exam generation with answer keys and explanations.
- **Active-Recall Flashcards**: Automated flashcard generation with review status tracking (`known`, `review_again`).
- **Controlled Web Search Toggle**: Explicitly switch between `documents_only`, `web_only`, and `documents_and_web` with isolated source labeling.
- **Real-Time Streaming**: Server-Sent Events (SSE) token streaming via `/api/chat/stream`.
- **Deterministic LLM Fallback**: If upstream LLM services face outages or rate limits, the system provides deterministic summaries directly from retrieved text chunks without crashing.

---

## 2. Architecture

```
                                  +-----------------------------+
                                  |     FastAPI REST API        |
                                  |   (Swagger Docs at /docs)   |
                                  +--------------+--------------+
                                                 |
             +--------------------+--------------+--------------+--------------------+
             |                    |                             |                    |
      [Documents API]        [Chat & RAG]                 [Retrieval API]     [Flashcards & Quiz]
             |                    |                             |                    |
             v                    v                             v                    v
      +--------------+    +---------------+               +------------+      +--------------+
      |  Ingestion   |    |  RAG Engine   |               | Retrieval  |      | Generators   |
      |   Service    |    |   Service     |               |  Service   |      |   Service    |
      +-------+------+    +-------+-------+               +-----+------+      +-------+------+
              |                   |                             |                     |
     +--------+--------+          |                             |                     |
     | Text Extraction |          |                             |                     |
     | & LangChain     |          |                             |                     |
     | Chunking        |          |                             |                     |
     +--------+--------+          |                             |                     |
              |                   |                             |                     |
              v                   v                             v                     v
     +-----------------+  +----------------+            +---------------+     +--------------+
     | LangChain Embed |  | OpenRouter LLM |            | Pinecone DB   |     | SQLite DB    |
     | (multilingual-  |  | (LangChain     |            | (Metadata     |     | (Metadata,   |
     |  e5-large /     |  |  ChatOpenAI)   |            |  filtering by |     |  history,    |
     |  Inference)     |  +----------------+            |  active docs) |     |  cards, quiz)|
     +-----------------+                                +---------------+     +--------------+
```

---

## 3. Tech Stack

- **Language & Framework**: Python 3.12+, FastAPI, Uvicorn
- **Data Validation & Settings**: Pydantic V2, Pydantic Settings
- **RAG & AI Orchestration**: LangChain, LangChain Core, LangChain Community, LangChain OpenAI
- **Text Processing**: LangChain Text Splitters (`RecursiveCharacterTextSplitter`), `pypdf`
- **Vector Database**: Pinecone (Pinecone Client 10.0+)
- **LLM Integration**: OpenRouter AI via LangChain `ChatOpenAI`
- **Embedding Provider**: Configurable LangChain embeddings (Pinecone Inference `multilingual-e5-large` 1024-dim, OpenAI, or Mock)
- **Application Database**: SQLite via SQLAlchemy 2.0
- **Web Search**: DuckDuckGo / Tavily abstraction layer
- **Testing**: Pytest, Pytest-Asyncio, HTTPX

---

## 4. Suggested Project Structure

```
studyvault/
├── app/
│   ├── main.py                     # FastAPI app, CORS, routes, exception handlers, lifespan
│   ├── api/
│   │   ├── health.py               # GET /api/health, GET /api/status
│   │   ├── documents.py            # Upload, list, inspect, link/unlink, delete
│   │   ├── retrieval.py            # POST /api/retrieval/search, GET /api/retrieval/stats
│   │   ├── chat.py                 # POST /api/chat, POST /api/chat/stream, history
│   │   ├── flashcards.py           # Generation, listing, deck view, review tracking
│   │   ├── quiz.py                 # Generation, inspection, grading submission
│   │   ├── sources.py              # GET /api/sources/... and /api/documents/.../page/...
│   │   └── search.py               # POST /api/search/web
│   ├── core/
│   │   ├── config.py               # Pydantic Settings and validation
│   │   ├── logging.py              # Structured application logger
│   │   └── errors.py               # Centralized exception handlers and custom error types
│   ├── database/
│   │   ├── database.py             # SQLAlchemy engine, session maker, get_db dependency
│   │   └── repositories.py         # Repositories for Documents, Chunks, Messages, Flashcards
│   ├── models/
│   │   ├── document.py             # Document and DocumentChunk tables
│   │   ├── conversation.py         # Conversation and Message tables
│   │   ├── flashcard.py            # FlashcardSet and Flashcard tables
│   │   └── quiz.py                 # Quiz and QuizQuestion tables
│   ├── schemas/                    # Pydantic V2 request & response schemas
│   ├── ai/
│   │   ├── openrouter.py           # OpenRouter LLM factory and Mock Chat Model
│   │   ├── embeddings.py           # Configurable Pinecone/OpenAI/Mock embeddings
│   │   ├── prompts.py              # Anti-hallucination grounding prompts
│   │   └── generators.py           # Quiz and Flashcard generation with deterministic fallbacks
│   ├── vectorstore/
│   │   ├── pinecone_client.py      # Pinecone client, vector upsert, and index stats
│   │   └── retriever.py            # Pinecone retriever with active document metadata filtering
│   └── services/                   # Business logic and domain service abstractions
├── data/
│   └── uploads/                    # Local storage for uploaded files
├── tests/                          # 21 unit & integration tests covering all services
├── .env.example                    # Sample environment template
├── .gitignore                      # Safe git ignores (credentials and databases excluded)
├── requirements.txt                # Complete pip dependencies
├── README.md                       # Complete documentation
└── run.py                          # Application entry point runner
```

---

## 5. Prerequisites & Setup

### Requirements
- **Python**: Version 3.12 or newer.
- **Pinecone Account**: Free Serverless API key and index (name: `studyvault`, dimension: `1024`, metric: `cosine`).
- **OpenRouter Account**: Free or paid API key.

### Step 1: Clone and Set Up Virtual Environment
```bash
# Clone repository or navigate to studyvault
cd studyvault

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On macOS / Linux:
source venv/bin/activate
```

### Step 2: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 3: Configure Environment Variables
Create a `.env` file in the project root based on `.env.example`:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```ini
# OpenRouter LLM Configuration
OPENROUTER_API_KEY=sk-or-v1-your-openrouter-key-here
OPENROUTER_MODEL=nvidia/nemotron-3.5-lightning:free

# Pinecone Vector Database Configuration
PINECONE_API_KEY=pcsk_your-pinecone-api-key-here
PINECONE_INDEX_NAME=studyvault
PINECONE_ENVIRONMENT=
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1

# Embedding Configuration
# Options: "pinecone" (uses Pinecone Inference multilingual-e5-large 1024-dim), "openai", "mock"
EMBEDDING_PROVIDER=pinecone
EMBEDDING_MODEL=multilingual-e5-large

# Application Database
DATABASE_URL=sqlite:///./studyvault.db

# Web Search Configuration (Optional external knowledge search)
WEB_SEARCH_API_KEY=
WEB_SEARCH_PROVIDER=duckduckgo

# General Settings
APP_ENV=development
TOP_K=5
MAX_FILE_SIZE_MB=25
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173
```

---

## 6. Running the Application

### Option 1: Using the Runner Script
```bash
python run.py
```

### Option 2: Using Uvicorn Directly
```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Once running, access the interactive Swagger API documentation at:
- **Swagger UI**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)

---

## 7. Running Tests

The test suite runs completely offline without requiring live API keys or incurring Pinecone costs, using isolated mocks and an in-memory SQLite database:

```bash
python -m pytest tests -v
```

All 21 unit and integration tests will execute and pass:
- Document upload validation, text & PDF parsing, corrupted file handling
- Document linking and unlinking
- Pinecone active-document metadata filtering
- Strict anti-hallucination "not found" responses
- AI chat modes (`ask`, `explain`, `summarize`, `compare`, `evidence`)
- Multi-turn conversational memory
- Flashcard and quiz generation and grading
- Centralized exception handling

---

## 8. API Endpoints Documentation

### System
- `GET /api/health`: Health status.
- `GET /api/status`: Real-time status of SQLite, Pinecone, OpenRouter, and embeddings. **Never leaks credentials.**

### Documents
- `POST /api/documents/upload`: Upload one or multiple PDF/TXT files (`multipart/form-data`).
- `GET /api/documents`: List all uploaded documents (supports `?linked=true` and `?status=ready`).
- `GET /api/documents/{document_id}`: View document metadata and chunk count.
- `GET /api/documents/{document_id}/content`: View extracted text chunks.
- `PATCH /api/documents/{document_id}/link`: Link or unlink document (`{"linked": true|false}`).
- `DELETE /api/documents/{document_id}`: Permanently delete document from SQLite and Pinecone vectors.

### Retrieval
- `POST /api/retrieval/search`: Test semantic retrieval with custom `query`, `document_ids`, and `top_k`.
- `GET /api/retrieval/stats`: Vector index statistics and count of active linked documents.

### Chat & RAG
- `POST /api/chat`: Main grounded AI endpoint.
  - Parameters: `query`, `conversation_id`, `mode` (`ask`, `explain`, `summarize`, `compare`, `evidence`, `quiz`), `document_ids`, `source_mode` (`documents_only`, `web_only`, `documents_and_web`).
- `POST /api/chat/stream`: Real-time Server-Sent Events (SSE) streaming.
- `GET /api/chat/history/{conversation_id}`: Multi-turn message history.
- `DELETE /api/chat/history/{conversation_id}`: Clear conversation history.

### Flashcards
- `POST /api/flashcards/generate`: Create flashcards (`count`: 5/10/20, `difficulty`: easy/medium/hard).
- `GET /api/flashcards`: List all flashcard decks.
- `GET /api/flashcards/{flashcard_set_id}`: Retrieve a deck and its cards.
- `DELETE /api/flashcards/{flashcard_set_id}`: Delete a flashcard deck.
- `POST /api/flashcards/{flashcard_id}/review`: Record student review (`status`: `known` or `review_again`).

### Quizzes
- `POST /api/quiz/generate`: Generate multiple-choice quiz (`question_count`, `difficulty`).
- `GET /api/quiz/{quiz_id}`: Retrieve student view of quiz (answers hidden).
- `POST /api/quiz/{quiz_id}/submit`: Submit answers; returns score, percentage, correct answers, explanations, and document source citations.

### Sources & Evidence
- `GET /api/sources/{document_id}/{chunk_id}`: Retrieve exact source text passage for a citation.
- `GET /api/documents/{document_id}/page/{page_number}`: Retrieve passages from a specific page.

### Web Search
- `POST /api/search/web`: Search external web sources through the configurable provider abstraction.

---

## 9. Key Architectural Concepts

### Document Linking vs. Unlinking vs. Deletion
- **Unlink (`PATCH /api/documents/{id}/link` with `linked=false`)**:
  The document and its vector embeddings remain stored in Pinecone and SQLite. However, when retrieval is performed, the query filter `{"document_id": {"$in": active_ids}}` strictly excludes this document from the search space.
- **Link (`PATCH /api/documents/{id}/link` with `linked=true`)**:
  Restores the document to the active retrieval scope instantly without re-embedding or re-indexing.
- **Delete (`DELETE /api/documents/{id}`)**:
  Permanently deletes the document record and chunks from SQLite, removes the physical file from `data/uploads/`, and purges all associated vector embeddings from the Pinecone index.

### Grounding & Anti-Hallucination
When `source_mode` is set to `documents_only` (default):
1. Query is contextualized against previous dialogue turns.
2. Vectors are retrieved from Pinecone filtered strictly by currently active/linked documents.
3. If no chunks exceed the relevance threshold or no active documents match, the system returns:
   > *"I couldn't find this information in your uploaded documents."*
4. The system never falls back to general training memory.

### Web Search Integration
When the student explicitly selects `documents_and_web` or `web_only`:
- The AI explicitly separates citations:
  - `### FROM YOUR STUDY MATERIAL` (grounded in uploaded notes with document and page citations).
  - `### FROM THE WEB` (supplementary online material with URLs).
- External web knowledge is never mixed or attributed to uploaded study material.

---

## 10. Example API Requests & Responses

### 1. Upload a Document
**Request:**
```bash
curl -X POST "http://127.0.0.1:8000/api/documents/upload" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "files=@Physics_Lecture_1.pdf"
```

**Response (201 Created):**
```json
{
  "message": "Successfully uploaded 1 documents.",
  "documents": [
    {
      "document_id": "7f8b9e10-c1a2-4d3e-9f0a-1b2c3d4e5f6a",
      "filename": "Physics_Lecture_1.pdf",
      "status": "ready",
      "file_size": 154200,
      "error_message": null
    }
  ],
  "uploaded_count": 1,
  "failed_count": 0
}
```

### 2. Ask a Grounded Question
**Request:**
```bash
curl -X POST "http://127.0.0.1:8000/api/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is Newton second law and what equation defines it?",
    "mode": "ask",
    "source_mode": "documents_only"
  }'
```

**Response (200 OK):**
```json
{
  "conversation_id": "8a3b2c1d-0e4f-4a5b-9c8d-7e6f5a4b3c2d",
  "query": "What is Newton second law and what equation defines it?",
  "answer": "According to your uploaded documents, Newton's second law defines force as the product of mass and acceleration, represented by the equation F = m * a [Doc: Physics_Lecture_1.pdf, Page: 3].",
  "mode": "ask",
  "source_mode": "documents_only",
  "is_grounded": true,
  "document_sources": [
    {
      "document_id": "7f8b9e10-c1a2-4d3e-9f0a-1b2c3d4e5f6a",
      "filename": "Physics_Lecture_1.pdf",
      "page_number": 3,
      "chunk_id": "7f8b9e10-c1a2-4d3e-9f0a-1b2c3d4e5f6a_chunk_5",
      "relevance_score": 0.92,
      "snippet": "Newton's second law defines force as the product of mass and acceleration: F = m * a."
    }
  ],
  "web_sources": [],
  "structured_data": null,
  "fallback_used": false
}
```

### 3. Generate Active-Recall Flashcards
**Request:**
```bash
curl -X POST "http://127.0.0.1:8000/api/flashcards/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "count": 5,
    "difficulty": "medium"
  }'
```

**Response (201 Created):**
```json
{
  "id": "fc-set-123",
  "title": "StudyVault Flashcards (Medium)",
  "difficulty": "medium",
  "count": 5,
  "created_at": "2026-10-08T00:15:00Z",
  "cards": [
    {
      "id": "card-001",
      "set_id": "fc-set-123",
      "question": "What is Newton's second law of motion?",
      "answer": "Force is equal to the product of mass and acceleration (F = m * a).",
      "document_id": "7f8b9e10-c1a2-4d3e-9f0a-1b2c3d4e5f6a",
      "document_name": "Physics_Lecture_1.pdf",
      "page_number": 3,
      "source_chunk_id": "7f8b9e10-c1a2-4d3e-9f0a-1b2c3d4e5f6a_chunk_5",
      "review_status": "unreviewed",
      "created_at": "2026-10-08T00:15:00Z"
    }
  ]
}
```

---

## 11. Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| `[401 UNAUTHENTICATED] Invalid API key` from Pinecone | Invalid or placeholder Pinecone key in `.env` | Ensure `PINECONE_API_KEY` is your genuine Pinecone Serverless key (`pcsk_...`). |
| `IndexModel.dimension could not be determined` | Pinecone index not created or empty | In Pinecone 10.0, index dimension is 1024. Pinecone Inference `multilingual-e5-large` is pre-configured to match this. |
| OpenRouter rate limit (429) | Shared free tier model traffic | StudyVault includes automatic deterministic fallback. You can also configure a dedicated model or API key in `OPENROUTER_MODEL`. |
| "I couldn't find this information in your uploaded documents" | Document unlinked or question not covered | Verify that the document is active (`PATCH /api/documents/{id}/link` with `{"linked": true}`) and contains relevant text. |
