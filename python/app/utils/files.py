import os
import re
import uuid
from pathlib import Path
import tempfile


def result_dir():
    override = os.environ.get("RESULT_DIR")
    path = Path(override) if override else Path(tempfile.gettempdir()) / "handwriting-results"
    path.mkdir(parents=True, exist_ok=True)
    return path


def new_result_id():
    return uuid.uuid4().hex


def is_result_id(result_id):
    return bool(re.fullmatch(r"[a-f0-9]{32}", result_id or ""))


def write_result(result_id, text):
    path = result_dir() / f"{result_id}.txt"
    path.write_text(text, encoding="utf-8")
    return path


def read_result(result_id):
    if not is_result_id(result_id):
        raise FileNotFoundError(result_id)
    path = result_dir() / f"{result_id}.txt"
    with path.open("r", encoding="utf-8") as handle:
        return handle.read()


def write_processed(result_id, data):
    path = result_dir() / f"{result_id}.png"
    path.write_bytes(data)
    return path


def processed_path(result_id):
    if not is_result_id(result_id):
        raise FileNotFoundError(result_id)
    path = result_dir() / f"{result_id}.png"
    if not path.is_file():
        raise FileNotFoundError(result_id)
    return path
