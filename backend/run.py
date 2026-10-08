import uvicorn
import os
from dotenv import load_dotenv

# Load local environment if present
load_dotenv()

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "127.0.0.1")
    reload = os.getenv("APP_ENV", "development") == "development"
    print(f"Starting StudyVault Backend on http://{host}:{port} (Swagger docs: http://{host}:{port}/docs)...")
    uvicorn.run("app.main:app", host=host, port=port, reload=reload)
