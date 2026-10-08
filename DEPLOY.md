# Deploy StudyVault with Render

This repository is configured as a Render Blueprint. It creates a static frontend and a FastAPI backend, wires their URLs together, and stores SQLite plus uploaded documents on the backend's persistent disk.

## Before deploying

- Push this project to a GitHub repository. Keep it **private** unless you deliberately want the source code to be public.
- Have your OpenRouter API key and Pinecone API key ready. Add them in Render's secret prompts; do not place them in `render.yaml` or commit a `.env` file. Render generates the private account-token signing key automatically.
- The backend needs a paid Render plan for its persistent disk. The frontend static site is free. Render shows the compute and storage price before you create the services; review it before confirming.

## Deploy

1. In Render, choose **New → Blueprint** and connect this GitHub repository.
2. Review the two services in `render.yaml`. Keep the backend disk and paid plan enabled so the database and uploaded PDFs survive restarts and redeploys.
3. Enter `OPENROUTER_API_KEY` and `PINECONE_API_KEY` when Render prompts for them.
4. Review the final cost, then create the Blueprint. Render builds both services and links the frontend to the backend automatically.
5. Open the frontend service URL. The backend Swagger page is at the backend URL plus `/docs`.

Create an account from the deployed frontend. Each account has its own documents, chats, quizzes, and flashcards. The deployed backend starts with a new SQLite database; local PDFs and database files are intentionally excluded from Git.
