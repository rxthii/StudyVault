# StudyVault

StudyVault is a document-grounded study assistant. It connects a React frontend to a FastAPI backend for document search, chat, quizzes, and flashcards.

## Features

- Email and password accounts with separate document libraries and study history
- Upload and manage PDF and TXT study documents
- Ask questions and get answers grounded in linked documents
- Inspect source passages and page references
- Generate quizzes and active-recall flashcards
- Compare documents, summarize material, and optionally use web search

## Requirements

- Python 3.12+
- Node.js and npm
- An OpenRouter API key
- A Pinecone API key and index configured for the embedding model

## Run locally

### Backend

In PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Add your OpenRouter and Pinecone credentials to `backend/.env`, then start the API:

```powershell
python run.py
```

The API runs at `http://127.0.0.1:8000`; Swagger docs are at `http://127.0.0.1:8000/docs`.

### Frontend

Open a second terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`. By default, the frontend connects to `http://127.0.0.1:8000`. To change that, copy `frontend/.env.example` to `frontend/.env` and edit `VITE_API_BASE_URL`.

Create an account on the sign-in screen. Your documents, chats, quizzes, and flashcards are scoped to that account. Documents uploaded before accounts were added are left private from all accounts; upload them again after signing in.

## Deploy with Render

The root `render.yaml` defines the frontend and backend as a Render Blueprint. Push this repository to a private GitHub repository, then in Render choose **New → Blueprint** and connect it. Provide `OPENROUTER_API_KEY` and `PINECONE_API_KEY` in Render's secret prompts.

The backend configuration includes a persistent disk for the SQLite database and uploaded files. This requires a paid backend service; review Render's displayed price before creating the services. Render generates the private account-token signing key automatically. The deployed database starts empty, so upload documents again after deployment.

More deployment details are in [DEPLOY.md](DEPLOY.md).

## Keep credentials private

Do not commit `.env` files, API keys, local databases, or uploaded documents. The repository's `.gitignore` excludes them; keep credentials in the backend's local `.env` for development and in Render's environment settings for deployment.
