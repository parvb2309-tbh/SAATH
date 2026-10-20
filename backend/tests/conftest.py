import os
import tempfile
from pathlib import Path

import pytest

# Isolated database and no Gemini key, so tests always exercise the offline engine.
_tmp = Path(tempfile.mkdtemp()) / "test.db"
os.environ["UDAAN_DB"] = str(_tmp)
os.environ["GEMINI_API_KEY"] = ""



@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from app.main import app
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def login(client):
    """login("admin") -> request headers for that demo account."""
    def _login(role):
        token = client.post(f"/api/auth/demo/{role}").json()["token"]
        return {"Authorization": f"Bearer {token}"}
    return _login
