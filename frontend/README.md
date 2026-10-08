# StudyVault — Smart Document Knowledge Assistant (Frontend)

> *"Your documents. Your knowledge. Verifiable answers."*

StudyVault is an academic AI research and study assistant for students. It connects to your existing Python FastAPI backend (`http://127.0.0.1:8000`) and provides mathematical, verifiable document grounding with interactive citation inspections, flashcards, quizzes, and knowledge scope controls.

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Backend URL
Create a `.env` file in the root directory (based on `.env.example`):
```bash
cp .env.example .env
```
Inside `.env`, verify your FastAPI backend URL (defaults to `http://127.0.0.1:8000`):
```env
VITE_API_BASE_URL="http://127.0.0.1:8000"
```
*(Note: You can also adjust or test this live at runtime from the in-app **System Status & Configuration** tab without restarting).*

### 3. Start the Frontend Dev Server
```bash
npm run dev
```

### 4. Local Frontend URL
Open your browser at:
```
http://localhost:3000
```

---

## 🔒 Security Compliance
- **No API Keys in Frontend**: Pinecone and OpenRouter credentials remain strictly on your Python FastAPI backend. The frontend never contains or requires `OPENROUTER_API_KEY` or `PINECONE_API_KEY`.
- **CORS Configuration**: Your FastAPI backend is already configured to allow `http://localhost:3000` and `http://127.0.0.1:3000`.

---

## 🛠️ Feature Modules & Architecture

1. **Dashboard (`src/pages/DashboardPage.tsx`)**
   - High-level study metrics (Total Documents, Active Knowledge, Vector embeddings in Pinecone, Flashcard decks).
   - Quick action shortcuts and recent document feeds.
   - Quick ask query input.

2. **AI Research Chat (`src/pages/ChatPage.tsx`)**
   - **Knowledge Scope (Left)**: Active document checkboxes to filter retrieval to specific documents.
   - **Conversation Stream (Center)**: Full support for Server-Sent Events (SSE) via `POST /api/chat/stream` with word-by-word streaming and fallback to `POST /api/chat`.
   - **Sources Panel (Right)**: Visually distinguishes **Document Sources** (with page, relevance %, snippet, and `[View Evidence]` button) from **Web Sources**.
   - **Mode Selector**: `Ask`, `Explain` (normal, simple, step-by-step), `Summarize`, `Compare`, `Find Evidence`, and `Quiz`.
   - **Web Search Toggle**: Prominent toggle defaulting to OFF (`documents_only`), switchable to `documents_and_web`.
   - **Anti-Hallucination Guard**: Explicit "🔎 NOT FOUND IN YOUR DOCUMENTS" state when answers cannot be grounded in uploaded notes.
   - **Follow-up Context**: Preserves `conversation_id` across turns with `[New Chat]` button.

3. **Knowledge Library (`src/pages/DocumentsPage.tsx`)**
   - Upload multiple PDF and TXT files simultaneously via `POST /api/documents/upload`.
   - Displays file size, chunk count, creation date, and status (`ready`, `processing`, `failed`).
   - Clear distinction: **Unlink ≠ Delete**. Unlinking preserves the document in SQLite and Pinecone while excluding it from retrieval queries.
   - Full chunk viewer modal via `GET /api/documents/{id}/content`.

4. **Flashcards (`src/pages/FlashcardsPage.tsx`)**
   - Generate spaced recall decks with custom count (5/10/20) and difficulty (`easy`, `medium`, `hard`).
   - Interactive flip cards with question on front, answer and document page citation on back.
   - Review tracking buttons: `[Know It]` and `[Review Again]` calling `POST /api/flashcards/{card_id}/review`.

5. **Adaptive Quiz (`src/pages/QuizPage.tsx`)**
   - Multiple choice tests generated from active documents (`POST /api/quiz/generate`).
   - One question at a time stepper with answer selection.
   - Instant scoring (`POST /api/quiz/{id}/submit`) with percentage, question-by-question breakdown, explanations, and verifiable evidence sources.

6. **System Status & Settings (`src/pages/SettingsPage.tsx`)**
   - Real-time connection indicator against `GET /api/health` and `GET /api/status`.
   - SQLite, Pinecone, and LLM configuration monitors.
   - Live URL tester and reset capabilities.

7. **Evidence Drawer (`src/components/chat/EvidenceDrawer.tsx`)**
   - Deep inspection of verified passages, surrounding page context, and exact vector chunk IDs (`GET /api/sources/{doc_id}/{chunk_id}` and `GET /api/documents/{doc_id}/page/{page_number}`).
