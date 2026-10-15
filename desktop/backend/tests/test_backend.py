"""Tests du backend Flask (pytest).

Couvre : moteur de règles (R1–R7), API analyze/history/settings,
règle d'honnêteté (jamais « confirmé »).

Lancement : cd desktop/backend && python -m pytest tests -q
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import create_app  # noqa: E402
from app import engine, store  # noqa: E402


@pytest.fixture()
def client(tmp_path, monkeypatch):
    # isoler les fichiers de données dans tmp_path
    monkeypatch.setattr(store, "DATA_DIR", str(tmp_path))
    monkeypatch.setattr(store, "HISTORY_PATH", os.path.join(str(tmp_path), "history.json"))
    monkeypatch.setattr(store, "SETTINGS_PATH", os.path.join(str(tmp_path), "settings.json"))
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


SMS_OK = ("MTN MoMo\nVous avez reçu 5 000 FCFA de 2376XX12345\n"
          "Transaction ID: MP26091.1423.A12345\nLe 14/10/2026 à 14:02.")
SMS_FORGED = ("MTN MoMo\nVous avez reçu 1 500 FCFA de 2376XX12345\n"
              "Transaction ID: MP26091.1423.B98765\nURGENT : erreur, renvoyez vite.")


# ---------- moteur ----------

def test_parse_amount():
    assert engine.parse_amount("5 000 FCFA") == 5000
    assert engine.parse_amount("5\u00a0000") == 5000
    assert engine.parse_amount("aucun") is None


def test_extract_tx_id_not_truncated():
    assert engine.extract_transaction_id(SMS_OK) == "MP26091.1423.A12345"
    assert engine.extract_transaction_id("bonjour") is None


def test_extract_time():
    assert engine.extract_time("à 14:02") == (14, 2)
    assert engine.extract_time("à 14 h 05") == (14, 5)
    assert engine.extract_time("rien") is None


def test_engine_coherent():
    r = engine.analyze(SMS_OK, 5000, "yes", [], "fr", now_hour=14, now_min=5)
    assert r.verdict == engine.VERDICT_OK
    assert r.tx_id == "MP26091.1423.A12345"


def test_engine_forged_is_fraude():
    r = engine.analyze(SMS_FORGED, 5000, "yes", [], "fr", now_hour=14, now_min=5)
    # R3 échoue (dur) → fraude
    assert r.verdict == engine.VERDICT_DANGER
    r3 = next(x for x in r.results if x.rule == "R3")
    assert r3.passed is False


def test_engine_sender_no_is_fraude():
    r = engine.analyze(SMS_OK, 5000, "no", [], "fr", now_hour=14, now_min=5)
    assert r.verdict == engine.VERDICT_DANGER


def test_engine_unknown_sender_is_suspect():
    r = engine.analyze(SMS_OK, 5000, "unknown", [], "fr", now_hour=14, now_min=5)
    assert r.verdict == engine.VERDICT_WARN


def test_engine_duplicate():
    hist = [{"id": "x", "txId": "MP26091.1423.A12345", "at": "2026-10-14T12:00:00"}]
    r = engine.analyze(SMS_OK, 5000, "yes", hist, "fr", now_hour=14, now_min=5)
    assert r.verdict == engine.VERDICT_DANGER
    assert r.duplicate is not None


def test_engine_old_time_is_suspect():
    r = engine.analyze(SMS_OK, 5000, "yes", [], "fr", now_hour=15, now_min=0)
    # SMS à 14:02, lu à 15:00 → souple → suspect
    assert r.verdict == engine.VERDICT_WARN


def test_seven_rules_always():
    r = engine.analyze(SMS_OK, 5000, "yes", [], "fr", now_hour=14, now_min=5)
    assert len({x.rule for x in r.results}) == 7


# ---------- API ----------

def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.get_json()["status"] == "ok"


def test_analyze_ok_and_disclaimer(client):
    # SMS sans heure : R4 non applicable, pas de dépendance à l'horloge du test
    sms_no_time = SMS_OK.replace("\nLe 14/10/2026 à 14:02.", "")
    res = client.post("/api/analyze", json={
        "sms": sms_no_time, "expectedAmount": 5000, "senderAnswer": "yes"})
    assert res.status_code == 200
    body = res.get_json()
    assert body["verdict"] == "coherent"
    assert "ne confirme pas" in body["disclaimer"]
    # jamais de « confirmé »
    assert "confirmé" not in body["verdictWord"].lower()
    assert body["entry"]["isDemo"] is False


def test_analyze_invalid(client):
    res = client.post("/api/analyze", json={"sms": "court"})
    assert res.status_code == 400
    res = client.post("/api/analyze", json={"sms": SMS_OK, "expectedAmount": "abc"})
    assert res.status_code == 400


def test_analyze_demo_flagged(client):
    res = client.post("/api/analyze/demo", json={"scenario": "ok"})
    assert res.status_code == 200
    assert res.get_json()["entry"]["isDemo"] is True
    assert "fictif" in res.get_json()["disclaimer"].lower()


def test_history_flow(client):
    client.post("/api/analyze", json={"sms": SMS_OK, "expectedAmount": 5000,
                                      "senderAnswer": "yes"})
    res = client.get("/api/history")
    items = res.get_json()
    assert len(items) == 1
    eid = items[0]["id"]
    res = client.patch(f"/api/history/{eid}", json={"balanceOk": True})
    assert res.get_json()["resolved"] is True
    res = client.delete(f"/api/history/{eid}")
    assert res.status_code == 200
    assert client.get("/api/history").get_json() == []


def test_settings_roundtrip(client):
    res = client.put("/api/settings", json={"lang": "en"})
    assert res.get_json()["lang"] == "en"
    assert client.get("/api/settings").get_json()["lang"] == "en"


def test_index_served(client, tmp_path):
    # sans build front : la route index doit au moins ne pas planter
    res = client.get("/api/health")
    assert res.status_code == 200
