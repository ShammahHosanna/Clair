"""Clair Desktop — moteur de règles (portage Python du moteur JS).

Analyse la cohérence d'un SMS de paiement Mobile Money.
PRINCIPE D'HONNETETE (section 6 du cahier des charges) : le moteur détecte des
incohérences, il ne confirme jamais un paiement. R8 (preuve finale, solde)
n'est PAS automatisable : c'est une étape humaine.
"""
from __future__ import annotations

import json
import os
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any

RULES_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "rules.json")

VERDICT_OK = "coherent"
VERDICT_WARN = "suspect"
VERDICT_DANGER = "fraude"


def _load_rules() -> dict[str, Any]:
    with open(RULES_PATH, encoding="utf-8") as f:
        return json.load(f)


RULES = _load_rules()


def normalize(text: str) -> str:
    """Minuscules + tout type d'espace retiré (5 000 → 5000), virgules -> ''."""
    t = unicodedata.normalize("NFKC", text or "")
    t = t.replace("\u00a0", "").replace("\u202f", "").replace(",", "")
    return t


def parse_amount(raw: str | None) -> int | None:
    if raw is None:
        return None
    cleaned = normalize(raw).replace(" ", "")
    m = re.search(r"\d+(?:\.\d+)?", cleaned)
    if not m:
        return None
    return round(float(m.group(0)))


def extract_amount(sms: str) -> int | None:
    """Montant reçu dans le SMS (motifs alignés sur le moteur mobile)."""
    raw = sms or ""
    patterns = [
        r"(?:mnt|montant|amount|somme|received|re[cç]u[a-z]*|[vV]ous\s+(?:avez\s+)?re[cç]u)\s*[:\s'=|]*\s*(\d[\d .]{0,11})\s*(?:fcfa?|xaf|xof)?",
        r"(\d[\d .]{0,11})\s*fcfa",
    ]
    for p in patterns:
        m = re.search(p, raw, re.IGNORECASE)
        if m:
            v = parse_amount(m.group(1))
            if v is not None:
                return v
    m = re.search(r"\b(\d[\d .]{1,9})\s*f(?:cfa?|\b)", raw, re.IGNORECASE)
    if m:
        return parse_amount(m.group(1))
    return None


def extract_transaction_id(sms: str) -> str | None:
    re_full = re.compile(
        r"(?:trans(?:action)?[\s_-]*(?:id|number|no|ref(?:erence)?[\s_-]*)?|"
        r"ref(?:erence)?[\s_-]*(?:id|number|no)?)[\s:_.#-]*"
        r"([A-Z0-9](?:[A-Z0-9./-]{4,18})[A-Z0-9])",
        re.IGNORECASE,
    )
    m = re_full.search(sms or "")
    if not m:
        return None
    return m.group(1).rstrip("./-").upper()


def extract_time(sms: str) -> tuple[int, int] | None:
    m = re.search(r"(\d{1,2})\s*[:h]\s*(\d{2})", sms or "", re.IGNORECASE)
    if not m:
        return None
    h, mn = int(m.group(1)), int(m.group(2))
    if h > 23 or mn > 59:
        return None
    return h, mn


def is_fresh(time_pair: tuple[int, int] | None, window_min: int = 10,
             now_hour: int | None = None, now_min: int | None = None) -> bool | None:
    """R4 : fraîcheur. None = pas d'heure lisible → règle non applicable."""
    if time_pair is None:
        return None
    if now_hour is None:
        from datetime import datetime
        h, mn = datetime.now().hour, datetime.now().minute
    else:
        h, mn = now_hour, now_min
    now_total = h * 60 + mn
    sms_total = time_pair[0] * 60 + time_pair[1]
    return ((now_total - sms_total) % 1440) <= window_min or sms_total == now_total == 0


def find_trap_words(sms: str, lang: str = "fr") -> list[str]:
    s = normalize(sms or "").lower()
    lists = RULES.get("trapWords", {})
    merged = list(lists.get(lang, [])) + list(lists.get("fr", [])) + list(lists.get("en", []))
    seen, found = set(), []
    for w in merged:
        word = w.lstrip(".")
        if word and word not in seen:
            seen.add(word)
            if word in s or re.search(rf"\b{re.escape(word)}\w*", s):
                found.append(w)
    return found


def find_anomalies(sms: str) -> list[str]:
    s = sms or ""
    found = []
    if re.search(r"fcfa?\s*fcfa", s, re.IGNORECASE):
        found.append("devise-doublé")
    if re.search(r"\d{1,3}(?:[ .]\d{3})+(?:[ .]\d{3}){3,}", s):
        found.append("format-montant-inhabituel")
    if re.search(r"\d,\d", s) and re.search(r"\d\.\d\d", s):
        found.append("virgule-et-point-mêlés")
    return found


@dataclass
class RuleResult:
    rule: str            # R1..R7
    kind: str            # 'hard' | 'soft'
    passed: bool | None  # None = non applicable
    key: str             # clé i18n de l'explication
    detail: dict[str, Any] = field(default_factory=dict)


@dataclass
class Analysis:
    verdict: str                         # coherent | suspect | fraude
    results: list[RuleResult]
    tx_id: str | None
    sms_amount: int | None
    duplicate: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "verdict": self.verdict,
            "results": [
                {"rule": r.rule, "kind": r.kind, "passed": r.passed,
                 "key": r.key, "detail": r.detail}
                for r in self.results
            ],
            "txId": self.tx_id,
            "smsAmount": self.sms_amount,
            "duplicate": self.duplicate,
        }


def analyze(sms: str, expected_amount: int | None, sender_answer: str = "unknown",
            history: list[dict[str, Any]] | None = None, lang: str = "fr",
            now_hour: int | None = None, now_min: int | None = None) -> Analysis:
    """Exécute R1..R7 (annexe C du cahier des charges).

    Logique de décision : échec dur → fraude ; sinon échec souple → suspect ;
    sinon cohérent. Jamais « confirmé » : l'écran suivant est toujours R8.
    """
    results: list[RuleResult] = []
    hard_rules_cfg = RULES.get("hardRules", {})
    window = hard_rules_cfg.get("freshWindowMinutes", 10)

    tx_id = extract_transaction_id(sms)
    sms_amount = extract_amount(sms)
    time_pair = extract_time(sms)

    # R1 — identifiant présent et lisible
    results.append(RuleResult(
        "R1", "hard", tx_id is not None,
        "r1-pass" if tx_id else "r1-fail",
        {"txId": tx_id},
    ))

    # R2 — expéditeur (réponse utilisateur)
    if sender_answer == "no":
        results.append(RuleResult("R2", "hard", False, "r2-fail"))
    elif sender_answer == "unknown":
        results.append(RuleResult("R2", "soft", False, "r2-unknown"))
    else:
        results.append(RuleResult("R2", "soft", True, "r2-pass"))

    # R3 — montant
    if expected_amount is None:
        results.append(RuleResult("R3", "hard", True, "r3-na"))
    elif sms_amount is None:
        results.append(RuleResult("R3", "hard", True, "r3-unknown"))
    elif abs(sms_amount - expected_amount) < 1:
        results.append(RuleResult("R3", "hard", True, "r3-pass", {"smsAmount": sms_amount}))
    else:
        results.append(RuleResult(
            "R3", "hard", False, "r3-fail",
            {"expectedAmount": expected_amount, "smsAmount": sms_amount},
        ))

    # R4 — fraîcheur
    fresh = is_fresh(time_pair, window, now_hour, now_min)
    results.append(RuleResult(
        "R4", "soft", fresh is None or bool(fresh),
        "r4-unknown" if fresh is None else ("r4-pass" if fresh else "r4-fail"),
        {"time": time_pair},
    ))

    # R5 — doublon
    dup = None
    if tx_id and history:
        dup = next((e for e in history if (e.get("txId") or "").upper() == tx_id), None)
    if dup:
        results.append(RuleResult("R5", "hard", False, "r5-fail", {"duplicate": dup}))
    elif tx_id:
        results.append(RuleResult("R5", "soft", True, "r5-pass"))

    # R6 — mots-pièges
    traps = find_trap_words(sms, lang)
    results.append(RuleResult(
        "R6", "soft", not traps,
        "r6-fail" if traps else "r6-pass", {"words": traps},
    ))

    # R7 — anomalies de mise en forme
    anomalies = find_anomalies(sms)
    results.append(RuleResult(
        "R7", "soft", not anomalies,
        "r7-fail" if anomalies else "r7-pass", {"words": anomalies},
    ))

    verdict = VERDICT_OK
    if any(r.kind == "hard" and r.passed is False for r in results):
        verdict = VERDICT_DANGER
    elif any(r.kind == "soft" and r.passed is False for r in results):
        verdict = VERDICT_WARN

    return Analysis(verdict, results, tx_id, sms_amount, dup)
