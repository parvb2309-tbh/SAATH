import os
import tempfile
from pathlib import Path

import pytest

# Isolated database and no Gemini key, so tests always exercise the offline engine.
_tmp = Path(tempfile.mkdtemp()) / "test.db"
os.environ["SAATH_DB"] = str(_tmp)
os.environ["GEMINI_API_KEY"] = ""


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from app.main import app
    with TestClient(app) as c:
        yield c
