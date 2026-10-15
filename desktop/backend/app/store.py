"""Clair Desktop — persistance JSON (historique, réglages).

Fichiers sous backend/data/, créés au premier appel. Aucune donnée personnelle
n'est collectée : tout reste sur la machine de la commerçante.
"""
from __future__ import annotations

import json
import os
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
HISTORY_PATH = os.path.join(DATA_DIR, "history.json")
SETTINGS_PATH = os.path.join(DATA_DIR, "settings.json")

_lock = threading.Lock()

DEFAULT_SETTINGS = {
    "lang": "fr",
    "voice": True,
    "sound": True,
    "notifications": True,
    "offlineMode": False,
}


def _read(path: str, fallback):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return fallback


def _write(path: str, data) -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def list_history() -> list[dict[str, Any]]:
    with _lock:
        return _read(HISTORY_PATH, [])


def add_entry(entry: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        items = _read(HISTORY_PATH, [])
        full = {
            "id": entry.get("id") or uuid.uuid4().hex[:12],
            "at": entry.get("at") or now_iso(),
            **{k: v for k, v in entry.items() if k not in ("id", "at")},
        }
        items.insert(0, full)
        _write(HISTORY_PATH, items[:300])
    return full


def update_entry(entry_id: str, patch: dict[str, Any]) -> dict[str, Any] | None:
    with _lock:
        items = _read(HISTORY_PATH, [])
        for e in items:
            if e["id"] == entry_id:
                e.update(patch)
                e["resolved"] = True
                _write(HISTORY_PATH, items)
                return e
    return None


def delete_entry(entry_id: str) -> bool:
    with _lock:
        items = _read(HISTORY_PATH, [])
        before = len(items)
        items = [e for e in items if e["id"] != entry_id]
        _write(HISTORY_PATH, items)
        return len(items) < before


def clear_history() -> None:
    with _lock:
        _write(HISTORY_PATH, [])


def get_settings() -> dict[str, Any]:
    with _lock:
        return {**DEFAULT_SETTINGS, **_read(SETTINGS_PATH, {})}


def update_settings(patch: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        merged = {**DEFAULT_SETTINGS, **_read(SETTINGS_PATH, {}), **patch}
        _write(SETTINGS_PATH, merged)
    return merged
