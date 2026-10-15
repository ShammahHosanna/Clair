"""Clair Desktop — API REST Flask.

Routes :
  GET  /api/health          état du service
  POST /api/analyze         analyse un SMS (moteur R1–R7) et l'enregistre
  POST /api/analyze/demo    analyse avec le SMS de démonstration (signalé démo)
  GET  /api/history         derniers résultats
  PATCH /api/history/<id>   met à jour une entrée (ex. preuve finale solde)
  DELETE /api/history/<id>  supprime une entrée
  DELETE /api/history       efface tout l'historique
  GET  /api/settings        préférences
  PUT  /api/settings        met à jour les préférences
  GET  /api/demo/sms        SMS fictifs du mode démonstration

RÈGLE (section 6 du cahier des charges) : aucune réponse n'affirme
« paiement confirmé ». Le verdict vert signifie « cohérent », jamais « reçu ».
"""
from __future__ import annotations

from flask import Blueprint, jsonify, request

from .engine import analyze
from . import store

bp = Blueprint("api", __name__, url_prefix="/api")

DEMO_SMS_OK = (
    "MTN MoMo\n"
    "Vous avez reçu 5 000 FCFA de 2376XX12345\n"
    "Transaction ID: MP26091.1423.A12345"
)
DEMO_SMS_FORGED = (
    "MTN MoMo\n"
    "Vous avez reçu 1 500 FCFA de 2376XX12345\n"
    "Transaction ID: MP26091.1423.A98765\n"
    "URGENT : erreur de transfert, renvoyez vite."
)


@bp.get("/health")
def health():
    return jsonify({"status": "ok", "service": "clair-desktop-api", "version": "1.0.0"})


@bp.post("/analyze")
def analyze_route():
    payload = request.get_json(silent=True) or {}
    sms = (payload.get("sms") or "").strip()
    if not sms or len(sms) < 8:
        return jsonify({"error": "invalid_sms",
                        "message": "Collez le SMS complet (au moins 8 caractères)."}), 400

    expected = payload.get("expectedAmount")
    if expected is not None:
        try:
            expected = int(expected)
        except (TypeError, ValueError):
            return jsonify({"error": "invalid_amount",
                            "message": "Le montant attendu doit être un entier."}), 400
        if expected < 0:
            return jsonify({"error": "invalid_amount",
                            "message": "Le montant attendu doit être positif."}), 400

    sender = payload.get("senderAnswer", "unknown")
    if sender not in ("yes", "no", "unknown"):
        sender = "unknown"
    lang = payload.get("lang", "fr")

    result = analyze(sms, expected, sender, store.list_history(), lang)
    is_demo = bool(payload.get("demo", False))
    entry = store.add_entry({
        "verdict": result.verdict,
        "amount": expected if expected is not None else result.sms_amount,
        "smsAmount": result.sms_amount,
        "txId": result.tx_id,
        "sms": sms,
        "balanceOk": None,
        "resolved": False,
        "isDemo": is_demo or payload.get("senderAnswer") == "__demo__",
    })
    resp = result.to_dict()
    resp["entry"] = entry
    resp["verdictWord"] = {"coherent": "COHÉRENT", "suspect": "SUSPECT",
                           "fraude": "DANGER"}[result.verdict]
    resp["disclaimer"] = ("Ce résultat ne confirme pas la réception de l'argent. "
                          "Vérifiez le solde de votre compte Mobile Money avant de "
                          "remettre la marchandise.")
    return jsonify(resp)


@bp.post("/analyze/demo")
def analyze_demo():
    payload = request.get_json(silent=True) or {}
    scenario = str(payload.get("scenario", "ok"))
    sms = {"ok": DEMO_SMS_OK, "forged": DEMO_SMS_FORGED}.get(scenario, DEMO_SMS_OK)
    expected = 5000
    if scenario == "forged":
        sender = "no"
    else:
        sender = "yes"
    result = analyze(sms, expected, sender, store.list_history(), "fr")
    entry = store.add_entry({
        "verdict": result.verdict,
        "amount": expected,
        "smsAmount": result.sms_amount,
        "txId": result.tx_id,
        "sms": sms,
        "balanceOk": None,
        "resolved": False,
        "isDemo": True,  # toujours signalé : SMS fictifs du mode démo
    })
    resp = result.to_dict()
    resp["entry"] = entry
    resp["verdictWord"] = {"coherent": "COHÉRENT", "suspect": "SUSPECT",
                           "fraude": "DANGER"}[result.verdict]
    resp["disclaimer"] = ("SMS de démonstration fictif. Ce résultat ne confirme "
                          "aucune réception d'argent.")
    return jsonify(resp)


@bp.get("/demo/sms")
def demo_sms():
    return jsonify({
        "note": "SMS fictifs, à utiliser avec l'étiquette « Exemple de démonstration ».",
        "ok": DEMO_SMS_OK,
        "forged": DEMO_SMS_FORGED,
    })


@bp.get("/history")
def history_route():
    return jsonify(store.list_history())


@bp.patch("/history/<entry_id>")
def history_patch(entry_id):
    patch = request.get_json(silent=True) or {}
    allowed = {k: patch[k] for k in ("balanceOk", "note") if k in patch}
    if not allowed:
        return jsonify({"error": "no_fields", "message": "Rien à mettre à jour."}), 400
    updated = store.update_entry(entry_id, allowed)
    if not updated:
        return jsonify({"error": "not_found", "message": "Entrée introuvable."}), 404
    return jsonify(updated)


@bp.delete("/history/<entry_id>")
def history_delete(entry_id):
    if not store.delete_entry(entry_id):
        return jsonify({"error": "not_found", "message": "Entrée introuvable."}), 404
    return jsonify({"status": "deleted"})


@bp.delete("/history")
def history_clear():
    store.clear_history()
    return jsonify({"status": "cleared"})


@bp.get("/settings")
def settings_route():
    return jsonify(store.get_settings())


@bp.put("/settings")
def settings_put():
    patch = request.get_json(silent=True) or {}
    allowed = {k: patch[k] for k in ("lang", "voice", "sound", "notifications", "offlineMode")
               if k in patch}
    return jsonify(store.update_settings(allowed))
