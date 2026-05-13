"""FastAPI application entry point.

Logic has been moved to core/main.py for architectural consistency.
"""

from core.main import app

__all__ = ["app"]
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=7821, reload=True)