from __future__ import annotations

import json
import os
import re
import threading
import unicodedata
import warnings
from dataclasses import dataclass
from datetime import datetime
from difflib import SequenceMatcher
from typing import Any, Optional, Dict, List, Tuple

import pandas as pd
from modules.survival_engine import estimate_variable_daily_spend, _parse_statement_dates

try:
    from rapidfuzz import fuzz, process
except ImportError:  # pragma: no cover - local fallback when rapidfuzz is absent
    fuzz = None
    process = None


# ---------------------------------------------------------------------------
# 1. India spending ontology - loaded from ontology_flags.json
# ---------------------------------------------------------------------------

_HERE = os.path.dirname(os.path.abspath(__file__))
_ONTOLOGY_PATH = os.path.normpath(os.path.join(_HERE, "..", "ontology_flags.json"))
_CATEGORY_MAPPING_PATH = os.path.normpath(os.path.join(_HERE, "..", "data", "category_mappings.json"))
_MAPPING_LOCK = threading.Lock()

FALLBACK_CATEGORY = "miscellaneous:uncategorized"
_REQUIRED_TRANSACTION_COLUMNS = {"Date", "Amount", "Payee", "TransactionType"}


def _load_ontology_json() -> dict:
    try:
        with open(_ONTOLOGY_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as exc:
        warnings.warn(f"[OntologyEngine] Could not load {_ONTOLOGY_PATH}: {exc}")
        return {}


def _ascii_fold(value: str) -> str:
    return (
        unicodedata.normalize("NFKD", str(value))
        .encode("ascii", "ignore")
        .decode("ascii")
    )


def _slugify(value: Any, fallback: str = "unknown") -> str:
    text = _ascii_fold(str(value or "")).lower()
    text = re.sub(r"[^a-z0-9]+", "_", text).strip("_")
    return text or fallback


_NOISE_TOKENS = {
    "upi", "pos", "neft", "imps", "rtgs", "txn", "tx", "ref", "rrn",
    "utr", "a", "c", "ac", "account", "bank", "india", "pvt", "private",
    "ltd", "limited", "com", "www", "in", "on", "by", "at", "to", "from",
}
_STRICT_TOKEN_TERMS = {"bnpl", "simpl", "slice"}
_BNPL_EVIDENCE_RE = re.compile(
    r"\b(?:bnpl|simpl|lazypay|zestmoney|slice|pay\s+later|postpaid|"
    r"credit\s+line|cred\s+cash|repayment|emi)\b",
    re.I,
)


def _normalize_text(value: Any) -> str:
    text = _ascii_fold(str(value or "")).lower()
    text = re.sub(r"@[\w.-]+", " ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    tokens = [tok for tok in text.split() if tok not in _NOISE_TOKENS]
    return " ".join(tokens)


def _compact(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _sorted_token_key(value: str) -> str:
    return "_".join(sorted(_slugify(value).split("_")))


def normalize_category_mapping_key(value: Any) -> str:
    text = re.sub(r"([a-z])([A-Z])", r"\1 \2", str(value or ""))
    return _normalize_text(text).strip()


def _mapping_key_variants(value: Any) -> list[str]:
    normalized = normalize_category_mapping_key(value)
    if not normalized:
        return []
    compact = _compact(normalized)
    sorted_key = _sorted_token_key(normalized).replace("_", " ")
    acronym = "".join(token[0] for token in normalized.split() if token)
    return _unique([
        normalized,
        compact if len(compact) >= 3 else "",
        sorted_key if sorted_key != normalized else "",
        acronym if len(acronym) >= 2 else "",
    ])


def _load_category_mappings() -> dict[str, str]:
    try:
        with open(_CATEGORY_MAPPING_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return {}
        return {
            normalize_category_mapping_key(k): canonical_category(v)
            for k, v in data.items()
            if normalize_category_mapping_key(k) and v
        }
    except FileNotFoundError:
        return {}
    except Exception as exc:
        warnings.warn(f"[OntologyEngine] Could not load {_CATEGORY_MAPPING_PATH}: {exc}")
        return {}


def _save_category_mappings(mappings: dict[str, str]) -> None:
    os.makedirs(os.path.dirname(_CATEGORY_MAPPING_PATH), exist_ok=True)
    clean = {
        key: canonical_category(value)
        for key, value in sorted(mappings.items())
        if key and value
    }
    with open(_CATEGORY_MAPPING_PATH, "w", encoding="utf-8") as f:
        json.dump(clean, f, indent=2, sort_keys=True)


def learn_category_mapping(vendor_name: Any, category: str) -> dict:
    selected = canonical_category(category)
    variants = _mapping_key_variants(vendor_name)
    if not variants:
        return {"updated": False, "mapping_key": "", "aliases": []}
    with _MAPPING_LOCK:
        mappings = _load_category_mappings()
        changed = False
        for key in variants:
            if mappings.get(key) != selected:
                mappings[key] = selected
                changed = True
        if changed:
            _save_category_mappings(mappings)
    return {"updated": changed, "mapping_key": variants[0], "aliases": variants}


def match_category_mapping(vendor_name: Any) -> Optional[tuple[str, str, str]]:
    variants = _mapping_key_variants(vendor_name)
    if not variants:
        return None
    mappings = _load_category_mappings()
    for key in variants:
        if key in mappings:
            return key, mappings[key], "mapping_alias"

    normalized = variants[0]
    compact = _compact(normalized)
    best_key = None
    best_score = 0.0
    for key in mappings:
        if not key:
            continue
        key_compact = _compact(key)
        if len(key_compact) >= 3 and (key_compact in compact or compact in key_compact):
            return key, mappings[key], "mapping_compact"
        score = SequenceMatcher(None, normalized, key).ratio() * 100.0
        if score > best_score:
            best_key = key
            best_score = score
    if best_key and best_score >= 88:
        return best_key, mappings[best_key], "mapping_fuzzy"
    return None


def _as_terms(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        terms: list[str] = []
        for item in value:
            terms.extend(_as_terms(item))
        return terms
    if isinstance(value, dict):
        return []
    term = str(value).strip()
    return [term] if term else []


def _as_flags(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        flags: list[str] = []
        for item in value:
            flags.extend(_as_flags(item))
        return flags
    if isinstance(value, dict):
        return []
    return [part for part in re.split(r"[\s,]+", str(value).strip()) if part]


def _unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value and value not in seen:
            seen.add(value)
            result.append(value)
    return result


def _collect_flags(node: dict) -> list[str]:
    rules = node.get("classification_rules") or {}
    return _unique(_as_flags(node.get("flags")) + _as_flags(rules.get("flags")))


def _amount_hints(*nodes: dict) -> dict:
    hints: dict[str, Any] = {}
    for node in nodes:
        rules = node.get("classification_rules") or {}
        for source in (node.get("amount_hints"), rules.get("amount_hints")):
            if isinstance(source, dict):
                hints.update(source)
    return hints


def _parse_amount(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = re.sub(r"[^\d.\-]", "", str(value))
    try:
        return float(cleaned) if cleaned else 0.0
    except ValueError:
        return 0.0


def _path_matches_category(path: str, category: str) -> bool:
    top, _, sub = category.partition(":")
    path_l = path.lower()
    return top in path_l or (sub and sub in path_l)


def _is_non_ascii(value: str) -> bool:
    return any(ord(ch) > 127 for ch in value or "")


def _has_required_category_evidence(category: str, normalized_payee: str) -> bool:
    """Protect narrow financial categories from generic/fuzzy payment text."""
    category = canonical_category(category)
    if category != "financial_services:bnpl":
        return True
    return bool(_BNPL_EVIDENCE_RE.search(normalized_payee or ""))


@dataclass(frozen=True)
class OntologyEntry:
    term: str
    raw_term: str
    category: str
    source: str
    weight: float
    is_regex: bool = False

    @property
    def specificity(self) -> int:
        return len(self.term.split()) * 10 + len(self.term)


@dataclass
class MatchResult:
    category: str
    matched_term: Optional[str]
    confidence: float
    match_type: str
    source: str
    review_required: bool = False


_TOP_BASE_REGRET = {
    "food_and_dining": 0.35,
    "transportation": 0.18,
    "housing_rent": 0.05,
    "healthcare": 0.08,
    "education": 0.12,
    "shopping_retail": 0.50,
    "entertainment": 0.55,
    "subscriptions": 0.38,
    "telecom": 0.12,
    "financial_services": 0.15,
    "travel": 0.42,
    "personal_care": 0.38,
    "social_gifting": 0.35,
    "transfers": 0.18,
    "business_freelance": 0.22,
    "pets": 0.22,
    "government_payments": 0.08,
    "childcare": 0.12,
    "agriculture": 0.18,
    "hidden_expenses": 0.35,
    "illegal_unusual": 0.90,
    "miscellaneous": 0.35,
}

_SUB_REGRET_OVERRIDES = {
    "food_delivery": 0.72,
    "restaurants_cafes": 0.40,
    "groceries": 0.08,
    "alcohol": 0.70,
    "sweets_snacks": 0.55,
    "rent": 0.02,
    "home_loan_emi": 0.02,
    "electricity_bill": 0.03,
    "water_bill": 0.03,
    "gas_lpg": 0.04,
    "society_maintenance": 0.04,
    "home_internet": 0.08,
    "pharmacy": 0.03,
    "doctor_consultation": 0.05,
    "hospital_inpatient": 0.04,
    "diagnostics": 0.05,
    "school_college_fees": 0.04,
    "coaching": 0.15,
    "ecommerce": 0.58,
    "clothing": 0.55,
    "electronics": 0.45,
    "luxury": 0.75,
    "jewellery": 0.42,
    "gift_cards": 0.50,
    "movies": 0.30,
    "gaming": 0.60,
    "fantasy_sports": 0.70,
    "lottery_gambling": 0.85,
    "nightlife": 0.65,
    "video_streaming": 0.35,
    "music_streaming": 0.25,
    "gaming_subscriptions": 0.55,
    "dating_apps": 0.50,
    "prepaid_recharge": 0.10,
    "postpaid_bill": 0.08,
    "loan_emi": 0.03,
    "credit_card_payment": 0.05,
    "mutual_fund": 0.05,
    "stock_trading": 0.35,
    "insurance_premiums": 0.06,
    "crypto": 0.78,
    "bnpl": 0.45,
    "govt_savings": 0.04,
    "tax_payments": 0.04,
    "cash_withdrawal": 0.30,
    "refunds": 0.05,
}

_TOP_BASE_NECESSITY = {
    "food_and_dining": 0.45,
    "transportation": 0.65,
    "housing_rent": 0.90,
    "healthcare": 0.88,
    "education": 0.78,
    "shopping_retail": 0.35,
    "entertainment": 0.20,
    "subscriptions": 0.35,
    "telecom": 0.72,
    "financial_services": 0.62,
    "travel": 0.32,
    "personal_care": 0.45,
    "social_gifting": 0.35,
    "transfers": 0.55,
    "business_freelance": 0.65,
    "pets": 0.55,
    "government_payments": 0.82,
    "childcare": 0.82,
    "agriculture": 0.72,
    "hidden_expenses": 0.35,
    "illegal_unusual": 0.02,
    "miscellaneous": 0.35,
}

_SUB_NECESSITY_OVERRIDES = {
    "food_delivery": 0.30,
    "restaurants_cafes": 0.30,
    "groceries": 0.88,
    "canteen_mess": 0.72,
    "packaged_water": 0.75,
    "alcohol": 0.05,
    "sweets_snacks": 0.20,
    "ride_hailing": 0.58,
    "auto_rickshaw": 0.66,
    "metro_train": 0.78,
    "intercity_bus": 0.72,
    "train_railway": 0.70,
    "fuel": 0.72,
    "rent": 0.95,
    "home_loan_emi": 0.95,
    "electricity_bill": 0.92,
    "water_bill": 0.92,
    "gas_lpg": 0.90,
    "society_maintenance": 0.82,
    "home_internet": 0.70,
    "pharmacy": 0.92,
    "doctor_consultation": 0.90,
    "hospital_inpatient": 0.96,
    "diagnostics": 0.88,
    "fitness": 0.48,
    "nutrition": 0.42,
    "school_college_fees": 0.92,
    "books": 0.72,
    "stationery": 0.68,
    "ecommerce": 0.35,
    "clothing": 0.42,
    "electronics": 0.40,
    "luxury": 0.08,
    "jewellery": 0.18,
    "movies": 0.12,
    "gaming": 0.10,
    "fantasy_sports": 0.05,
    "lottery_gambling": 0.02,
    "nightlife": 0.08,
    "video_streaming": 0.22,
    "music_streaming": 0.24,
    "dating_apps": 0.15,
    "prepaid_recharge": 0.78,
    "postpaid_bill": 0.82,
    "loan_emi": 0.88,
    "credit_card_payment": 0.82,
    "mutual_fund": 0.70,
    "insurance_premiums": 0.84,
    "crypto": 0.08,
    "bnpl": 0.62,
    "tax_payments": 0.90,
    "family_support": 0.78,
    "p2p": 0.50,
    "salary_payment": 0.90,
    "cash_withdrawal": 0.50,
    "refunds": 0.90,
}

LEGACY_CATEGORY_ALIASES = {
    "LateNightCraving": "food_and_dining:food_delivery",
    "EssentialGrocery": "food_and_dining:groceries",
    "RestaurantDining": "food_and_dining:restaurants_cafes",
    "StreamingSubscription": "subscriptions:video_streaming",
    "ImpulseEntertainment": "entertainment:movies",
    "ImpulseClothing": "shopping_retail:clothing",
    "SocialPressure": "social_gifting:gifts",
    "Travel": "travel:holiday_packages",
    "HealthWellness": "healthcare:fitness",
    "Utilities": "housing_rent:electricity_bill",
    "Savings": "financial_services:mutual_fund",
    "MedicalEssential": "healthcare:pharmacy",
    "GenericPurchase": FALLBACK_CATEGORY,
    "Generic": FALLBACK_CATEGORY,
}


def canonical_category(category: Optional[str]) -> str:
    if not category:
        return FALLBACK_CATEGORY
    return LEGACY_CATEGORY_ALIASES.get(category, category)


def category_label(category: str) -> str:
    key = canonical_category(category)
    meta = CATEGORY_META.get(key)
    if meta:
        return str(meta.get("subcategory_name") or meta.get("category_name") or key)
    label = key.split(":", 1)[-1]
    return label.replace("_", " ").title()


def _derive_regret_prior(category: str, flags: list[str]) -> float:
    top, _, sub = category.partition(":")
    flag_set = set(flags)
    if flag_set.intersection({"illegal", "illegal_in_most_states", "PMLA_trigger"}):
        return 0.92
    if "speculative_asset" in flag_set:
        return 0.78
    base = _SUB_REGRET_OVERRIDES.get(sub, _TOP_BASE_REGRET.get(top, 0.35))
    if flag_set.intersection({"sensitive_category", "age_restricted", "regulatory_restricted"}):
        base = max(base, 0.65)
    return float(min(max(base, 0.01), 0.95))


def _derive_necessity_score(category: str, flags: list[str]) -> float:
    top, _, sub = category.partition(":")
    flag_set = set(flags)
    if flag_set.intersection({"illegal", "illegal_in_most_states", "PMLA_trigger"}):
        return 0.01
    base = _SUB_NECESSITY_OVERRIDES.get(sub, _TOP_BASE_NECESSITY.get(top, 0.35))
    if "speculative_asset" in flag_set:
        base = min(base, 0.10)
    if "age_restricted" in flag_set:
        base = min(base, 0.12)
    return float(min(max(base, 0.0), 1.0))


def _build_ontology_index(ontology_data: dict) -> dict:
    entries: list[OntologyEntry] = []
    category_meta: dict[str, dict] = {}
    category_flags: dict[str, list[str]] = {}
    mcc_map: dict[str, str] = {}
    top_aliases: dict[str, str] = {}
    sub_aliases: dict[str, dict[str, str]] = {}

    def add_top_alias(top_slug: str, value: str) -> None:
        slug = _slugify(value)
        top_aliases[slug] = top_slug
        top_aliases[_compact(slug)] = top_slug
        top_aliases[_sorted_token_key(slug)] = top_slug
        for token in slug.split("_"):
            if len(token) >= 4:
                top_aliases.setdefault(token, top_slug)

    def add_sub_alias(top_slug: str, key: str, value: str) -> None:
        slug = _slugify(value)
        sub_aliases.setdefault(top_slug, {})[slug] = key
        sub_aliases[top_slug][_compact(slug)] = key
        sub_aliases[top_slug][_sorted_token_key(slug)] = key

    def register_term(
        raw_term: str,
        category: str,
        source: str,
        weight: float,
        is_regex: bool = False,
    ) -> None:
        if not raw_term:
            return
        term = _normalize_text(raw_term)
        if not is_regex and len(term) < 2:
            return
        if not is_regex and term in {"payment", "purchase", "online", "transaction"}:
            return
        entries.append(OntologyEntry(term, str(raw_term), category, source, weight, is_regex))

    categories = ontology_data.get("categories", [])

    for cat in categories:
        top_slug = _slugify(cat.get("slug") or cat.get("name"))
        add_top_alias(top_slug, top_slug)
        add_top_alias(top_slug, cat.get("name", top_slug))

        for mcc in _as_terms(cat.get("mcc_codes")):
            mcc_map[str(mcc)] = f"{top_slug}:_root"

        top_flags = _collect_flags(cat)
        root_key = f"{top_slug}:_root"
        category_meta[root_key] = {
            "category_key": root_key,
            "top_slug": top_slug,
            "sub_slug": "_root",
            "category_name": cat.get("name", top_slug),
            "subcategory_name": "General",
            "flags": top_flags,
            "amount_hints": _amount_hints(cat),
            "icon": cat.get("icon"),
            "color": cat.get("color"),
            "is_root": True,
        }

        rules = cat.get("classification_rules") or {}
        for term in _as_terms(rules.get("primary_keywords")):
            register_term(term, root_key, "top_keyword", 1.2)
        for pattern in _as_terms(rules.get("upi_narration_patterns")):
            register_term(pattern, root_key, "top_upi_regex", 1.5, is_regex=True)
            register_term(pattern.strip(".*"), root_key, "top_upi_keyword", 1.4)
        for pattern in _as_terms(rules.get("sms_patterns")):
            register_term(pattern.strip(".*"), root_key, "top_sms_pattern", 1.2)

        for sub in cat.get("subcategories", []):
            sub_slug = _slugify(sub.get("slug") or sub.get("name"), "general")
            key = f"{top_slug}:{sub_slug}"
            add_sub_alias(top_slug, key, sub_slug)
            add_sub_alias(top_slug, key, sub.get("name", sub_slug))

            sub_flags = _unique(top_flags + _collect_flags(sub))
            for ssub in sub.get("sub_subcategories", []):
                sub_flags = _unique(sub_flags + _collect_flags(ssub))

            category_meta[key] = {
                "category_key": key,
                "top_slug": top_slug,
                "sub_slug": sub_slug,
                "category_name": cat.get("name", top_slug),
                "subcategory_name": sub.get("name", sub_slug),
                "description": sub.get("description") or cat.get("description", ""),
                "flags": sub_flags,
                "amount_hints": _amount_hints(cat, sub),
                "icon": cat.get("icon"),
                "color": cat.get("color"),
                "is_root": False,
            }
            category_flags[key] = sub_flags

            for mcc in _as_terms(cat.get("mcc_codes")) + _as_terms(sub.get("mcc_codes")):
                mcc_map[str(mcc)] = key

            register_term(sub.get("name", ""), key, "subcategory_name", 2.2)
            for term in _as_terms(sub.get("merchant_examples")):
                register_term(term, key, "merchant", 4.2)
            for term in _as_terms(sub.get("upi_patterns")):
                register_term(term, key, "upi_pattern", 4.0)
            for term in _as_terms(sub.get("keywords")):
                register_term(term, key, "keyword", 3.0)
            for term in _as_terms(sub.get("examples")):
                register_term(term, key, "example", 1.2)

            for ssub in sub.get("sub_subcategories", []):
                register_term(ssub.get("name", ""), key, "sub_subcategory_name", 2.8)
                for term in _as_terms(ssub.get("merchant_examples")):
                    register_term(term, key, "sub_merchant", 4.4)
                for term in _as_terms(ssub.get("keywords")):
                    register_term(term, key, "sub_keyword", 3.6)
                for term in _as_terms(ssub.get("examples")):
                    register_term(term, key, "sub_example", 1.4)

    def resolve_json_path(path: str) -> str:
        parts = [_slugify(part) for part in str(path).split(".") if part]
        if not parts:
            return FALLBACK_CATEGORY
        top_slug = top_aliases.get(parts[0]) or top_aliases.get(_compact(parts[0]))
        if not top_slug:
            top_slug = top_aliases.get(_sorted_token_key(parts[0]))
        if not top_slug:
            return FALLBACK_CATEGORY
        if len(parts) == 1:
            return f"{top_slug}:_root"
        if top_slug == "subscriptions" and parts[1] in {"streaming_audio", "audio_streaming"}:
            return "subscriptions:music_streaming"
        if top_slug == "subscriptions" and parts[1] in {"streaming_video", "video_streaming"}:
            return "subscriptions:video_streaming"
        if top_slug == "shopping_retail" and parts[1] in {"e_commerce", "ecommerce"}:
            return "shopping_retail:ecommerce"
        sub_lookup = sub_aliases.get(top_slug, {})
        sub_key = (
            sub_lookup.get(parts[1])
            or sub_lookup.get(_compact(parts[1]))
            or sub_lookup.get(_sorted_token_key(parts[1]))
        )
        if not sub_key and top_slug == "transfers" and parts[1] == "upi_transfer":
            sub_key = "transfers:p2p"
        return sub_key or f"{top_slug}:_root"

    global_patterns = (
        ontology_data.get("global_classification_rules", {})
        .get("upi_narration_patterns", {})
    )
    for term, path in global_patterns.items():
        key = resolve_json_path(path)
        source = "payment_app" if term.lower() in {"paytm", "phonepe", "gpay"} else "global_upi"
        weight = 1.5 if source == "payment_app" else 4.5
        register_term(term, key, source, weight)

    supplemental_aliases = {
        "reliance fresh": "food_and_dining:groceries",
        "reliance smart": "food_and_dining:groceries",
        "chaayos": "food_and_dining:restaurants_cafes",
        "chai point": "food_and_dining:restaurants_cafes",
        "apollo hospital": "healthcare:hospital_inpatient",
        "apollo hospitals": "healthcare:hospital_inpatient",
        "cred": "financial_services:credit_card_payment",
    }
    for term, key in supplemental_aliases.items():
        if key in category_meta:
            register_term(term, key, "supplemental_alias", 4.0)

    if FALLBACK_CATEGORY not in category_meta:
        category_meta[FALLBACK_CATEGORY] = {
            "category_key": FALLBACK_CATEGORY,
            "top_slug": "miscellaneous",
            "sub_slug": "uncategorized",
            "category_name": "Miscellaneous & Uncategorized",
            "subcategory_name": "Uncategorized",
            "flags": ["review_required"],
            "amount_hints": {},
            "is_root": False,
        }
        category_flags[FALLBACK_CATEGORY] = ["review_required"]

    regret_priors = {
        key: _derive_regret_prior(key, meta.get("flags", []))
        for key, meta in category_meta.items()
    }
    necessity_scores = {
        key: _derive_necessity_score(key, meta.get("flags", []))
        for key, meta in category_meta.items()
    }

    for alias, target in LEGACY_CATEGORY_ALIASES.items():
        regret_priors[alias] = regret_priors.get(target, 0.35)
        necessity_scores[alias] = necessity_scores.get(target, 0.35)

    best_term_map: dict[str, OntologyEntry] = {}
    for entry in entries:
        prev = best_term_map.get(entry.term)
        if prev is None or (entry.weight, entry.specificity) > (prev.weight, prev.specificity):
            best_term_map[entry.term] = entry

    return {
        "entries": entries,
        "category_meta": category_meta,
        "category_flags": category_flags,
        "mcc_map": mcc_map,
        "regret_priors": regret_priors,
        "necessity_scores": necessity_scores,
        "vendor_map": {term: entry.category for term, entry in best_term_map.items()},
        "vendor_keys": list(best_term_map.keys()),
    }


_ONTOLOGY_DATA = _load_ontology_json()
_INDEX = _build_ontology_index(_ONTOLOGY_DATA)

CATEGORY_META: Dict[str, dict] = _INDEX["category_meta"]
_CATEGORY_FLAGS: Dict[str, List[str]] = _INDEX["category_flags"]
_MCC_MAP: Dict[str, str] = _INDEX["mcc_map"]
REGRET_PRIORS: Dict[str, float] = _INDEX["regret_priors"]
NECESSITY_SCORES: Dict[str, float] = _INDEX["necessity_scores"]
VENDOR_MAP: Dict[str, str] = _INDEX["vendor_map"]
VENDOR_KEYS: List[str] = _INDEX["vendor_keys"]
ONTOLOGY: Dict = _ONTOLOGY_DATA


# ---------------------------------------------------------------------------
# 2. Bayesian regret model
# ---------------------------------------------------------------------------

class BayesianRegret:
    def __init__(self, prior_mean: float):
        prior = min(max(float(prior_mean), 0.01), 0.99)
        self.alpha = prior * 10
        self.beta = (1 - prior) * 10

    def update(self, regret_event: bool):
        if regret_event:
            self.alpha += 1
        else:
            self.beta += 1

    def mean(self) -> float:
        return self.alpha / (self.alpha + self.beta)


# Backwards-compatible name used by dashboard.py
DEFAULT_PRIORS = REGRET_PRIORS


# ---------------------------------------------------------------------------
# 3. User profile
# ---------------------------------------------------------------------------

class UserProfile:
    def __init__(self, monthly_income: float = 50000, daily_target_spend: Optional[float] = None):
        self.monthly_income = monthly_income
        self.daily_target_spend = daily_target_spend if daily_target_spend is not None else (monthly_income / 30.0)

    def spending_ratio(self, amount: float) -> float:
        return amount / max(self.monthly_income, 1)


# ---------------------------------------------------------------------------
# 4. Runtime engine
# ---------------------------------------------------------------------------

class SmartOntologyEngine:
    def __init__(self, user_profile: UserProfile):
        self.user = user_profile
        self.transactions: List[dict] = []
        self.regret_models: Dict[str, BayesianRegret] = {
            cat: BayesianRegret(prior)
            for cat, prior in REGRET_PRIORS.items()
        }

    def _term_match_type(self, normalized_payee: str, term: str) -> Optional[str]:
        if not normalized_payee or not term:
            return None
        padded_payee = f" {normalized_payee} "
        padded_term = f" {term} "
        if normalized_payee == term:
            return "exact"
        if padded_term in padded_payee:
            return "phrase"
        if term in _STRICT_TOKEN_TERMS:
            return None
        compact_payee = _compact(normalized_payee)
        compact_term = _compact(term)
        if len(compact_term) >= 5 and compact_term in compact_payee:
            return "compact"
        if len(term) >= 4 and term in normalized_payee:
            return "substring"
        return None

    def _score_entry(
        self,
        entry: OntologyEntry,
        payee: str,
        normalized_payee: str,
        amount: float,
        ts: Optional[datetime],
    ) -> Optional[tuple[float, str]]:
        match_type: Optional[str]
        if entry.is_regex:
            try:
                if not re.search(entry.raw_term, payee, flags=re.IGNORECASE):
                    return None
                match_type = "regex"
            except re.error:
                match_type = self._term_match_type(normalized_payee, entry.term)
                if not match_type:
                    return None
        else:
            match_type = self._term_match_type(normalized_payee, entry.term)
            if not match_type:
                return None

        base_by_type = {
            "exact": 0.92,
            "phrase": 0.86,
            "compact": 0.82,
            "substring": 0.76,
            "regex": 0.84,
        }
        source_boost = min(entry.weight * 0.018, 0.09)
        length_boost = min(len(entry.term) / 120.0, 0.04)
        amount_boost = self._amount_hint_boost(entry.category, amount)
        time_boost = self._time_hint_boost(entry.category, ts)
        score = base_by_type[match_type] + source_boost + length_boost + amount_boost + time_boost
        subscription_tokens = {
            "subscription", "membership", "renewal", "monthly", "annual",
            "pro", "plus", "one", "premium",
        }
        payee_tokens = set(normalized_payee.split())
        if payee_tokens.intersection(subscription_tokens):
            if entry.category.startswith("subscriptions:"):
                score += 0.07
            elif entry.category.startswith("food_and_dining:"):
                score -= 0.05
        return score, match_type

    def _amount_hint_boost(self, category: str, amount: float) -> float:
        if amount <= 0:
            return 0.0
        hints = CATEGORY_META.get(category, {}).get("amount_hints") or {}
        min_v = hints.get("min")
        max_v = hints.get("max")
        try:
            if min_v is not None and amount < float(min_v) * 0.5:
                return -0.03
            if max_v is not None and amount > float(max_v) * 1.5:
                return -0.03
            if (min_v is None or amount >= float(min_v)) and (max_v is None or amount <= float(max_v)):
                return 0.04
        except (TypeError, ValueError):
            return 0.0
        return 0.0

    def _time_hint_boost(self, category: str, ts: Optional[datetime]) -> float:
        if ts is None:
            return 0.0
        top, _, sub = canonical_category(category).partition(":")
        if ts.hour >= 22 or ts.hour < 4:
            if sub in {"food_delivery", "alcohol", "sweets_snacks", "nightlife", "gaming"}:
                return 0.03
            if top == "entertainment":
                return 0.02
        return 0.0

    def _best_fuzzy_match(self, normalized_payee: str) -> Optional[tuple[str, float]]:
        if not normalized_payee or not VENDOR_KEYS:
            return None
        if process is not None and fuzz is not None:
            result = process.extractOne(normalized_payee, VENDOR_KEYS, scorer=fuzz.token_set_ratio)
            if not result:
                return None
            term, score, _ = result
            return str(term), float(score)

        best_term = None
        best_score = 0.0
        for term in VENDOR_KEYS:
            score = SequenceMatcher(None, normalized_payee, term).ratio() * 100.0
            if score > best_score:
                best_term = term
                best_score = score
        return (best_term, best_score) if best_term else None

    def _match_vendor(
        self,
        payee: str,
        amount: float = 0.0,
        ts: Optional[datetime] = None,
        mcc_code: Optional[str] = None,
    ) -> MatchResult:
        mapped = match_category_mapping(payee)
        if mapped:
            key, category, source = mapped
            return MatchResult(
                category=category,
                matched_term=key,
                confidence=0.98,
                match_type=source,
                source="category_correction",
                review_required=False,
            )

        if mcc_code and str(mcc_code) in _MCC_MAP:
            return MatchResult(_MCC_MAP[str(mcc_code)], str(mcc_code), 0.88, "mcc", "mcc_code")

        normalized_payee = _normalize_text(payee)
        candidates: list[tuple[float, int, float, OntologyEntry, str]] = []
        generic_payment_categories = {"transfers:wallet_topup", "transfers:p2p"}

        for entry in _INDEX["entries"]:
            scored = self._score_entry(entry, payee, normalized_payee, amount, ts)
            if scored is None:
                continue
            score, match_type = scored
            if entry.source == "payment_app":
                has_specific_match = any(
                    other.category not in generic_payment_categories
                    and other.term != entry.term
                    and self._term_match_type(normalized_payee, other.term)
                    for other in _INDEX["entries"]
                    if not other.is_regex
                )
                if has_specific_match:
                    score -= 0.12
            if not _has_required_category_evidence(entry.category, normalized_payee):
                continue
            candidates.append((score, entry.specificity, entry.weight, entry, match_type))

        if candidates:
            score, _specificity, _weight, entry, match_type = max(
                candidates,
                key=lambda item: (item[0], item[1], item[2], len(item[3].term)),
            )
            review_required = score < 0.60 or entry.category.endswith(":_root")
            return MatchResult(
                category=entry.category,
                matched_term=entry.raw_term,
                confidence=round(max(0.0, min(score, 0.99)), 3),
                match_type=match_type,
                source=entry.source,
                review_required=review_required,
            )

        fuzzy_match = self._best_fuzzy_match(normalized_payee)
        if fuzzy_match:
            term, score = fuzzy_match
            if score >= 86:
                category = VENDOR_MAP[term]
                if _has_required_category_evidence(category, normalized_payee):
                    confidence = min(0.84, score / 100.0)
                    return MatchResult(
                        category=category,
                        matched_term=term,
                        confidence=round(confidence, 3),
                        match_type="fuzzy",
                        source="fuzzy_keyword",
                        review_required=confidence < 0.60,
                    )

        return MatchResult(
            category=FALLBACK_CATEGORY,
            matched_term=None,
            confidence=0.25,
            match_type="fallback",
            source="fallback",
            review_required=True,
        )

    def match_vendor(self, payee: str) -> Tuple[Optional[str], str]:
        match = self._match_vendor(payee)
        return match.matched_term, match.category

    def time_factor(self, ts: Optional[datetime], category: str = FALLBACK_CATEGORY) -> float:
        if ts is None:
            return 1.0
        top, _, sub = canonical_category(category).partition(":")
        if top in {"housing_rent", "healthcare", "education", "government_payments", "childcare"}:
            return 1.0
        if ts.hour >= 22 or ts.hour < 4:
            if sub in {
                "food_delivery", "alcohol", "sweets_snacks", "nightlife",
                "gaming", "fantasy_sports", "lottery_gambling", "luxury",
            }:
                return 1.22
            necessity = NECESSITY_SCORES.get(canonical_category(category), 0.35)
            if necessity <= 0.35:
                return 1.18
            if necessity < 0.55:
                return 1.12
            return 1.05
        if 18 <= ts.hour < 22 and top in {"food_and_dining", "shopping_retail", "entertainment"}:
            return 1.08
        return 1.0

    def amount_factor(self, amount: float, category: str = FALLBACK_CATEGORY) -> float:
        ratio = self.user.spending_ratio(amount)
        necessity = NECESSITY_SCORES.get(category, 0.35)
        if necessity >= 0.80:
            if ratio > 0.30:
                return 1.025
            if ratio > 0.15:
                return 1.015
            return 0.99 + min(ratio * 0.05, 0.01)
        if ratio > 0.20:
            return 1.65
        if ratio > 0.12:
            return 1.42
        if ratio > 0.07:
            return 1.27
        if ratio > 0.035:
            return 1.13
        if ratio < 0.005:
            return 0.92
        return 0.98 + min(ratio * 3.0, 0.12)

    def detect_streak(self, category: str) -> bool:
        recent = [t for t in self.transactions if t["category"] == category][-5:]
        return len(recent) >= 3

    def spending_history_factor(self, category: str, amount: float, ts: Optional[datetime]) -> float:
        category = canonical_category(category)
        if not self.transactions:
            return 1.0

        same_category = [t for t in self.transactions if canonical_category(t.get("category")) == category]
        if not same_category:
            return 0.96 if NECESSITY_SCORES.get(category, 0.35) >= 0.80 else 1.0

        factor = 1.0
        avg_same = sum(float(t.get("amount", 0.0) or 0.0) for t in same_category) / max(len(same_category), 1)
        if avg_same > 0:
            ratio_to_avg = amount / avg_same
            if ratio_to_avg >= 3.0:
                factor += 0.18
            elif ratio_to_avg >= 1.8:
                factor += 0.10
            elif ratio_to_avg <= 0.50:
                factor -= 0.05

        recent_same = same_category[-8:]
        if len(recent_same) >= 4 and NECESSITY_SCORES.get(category, 0.35) < 0.80:
            factor += min(0.18, len(recent_same) * 0.025)

        if ts is not None:
            same_hour = [
                t for t in same_category[-12:]
                if getattr(t.get("ts"), "hour", None) == ts.hour
            ]
            if len(same_hour) >= 2 and NECESSITY_SCORES.get(category, 0.35) < 0.80:
                factor += 0.06

        return min(max(factor, 0.86), 1.28)

    def regret_probability(
        self,
        category: str,
        amount: float,
        ts: Optional[datetime],
        streak: bool = False,
    ) -> tuple[float, dict]:
        category = canonical_category(category)
        model = self.regret_models.get(category, BayesianRegret(REGRET_PRIORS.get(category, 0.35)))
        base = model.mean()
        t_factor = self.time_factor(ts, category)
        a_factor = self.amount_factor(amount, category)
        h_factor = self.spending_history_factor(category, amount, ts)
        necessity = NECESSITY_SCORES.get(category, 0.35)

        # Budget factor: based on daily target spend
        budget_factor = 1.0
        if necessity >= 0.80:
            budget_factor = 1.0
        elif self.user.daily_target_spend > 0:
            if amount < self.user.daily_target_spend:
                budget_factor = 0.92  # Reduce regret if below daily spend
            else:
                budget_factor = 1.08  # Increase regret if above daily spend

        regret = base * t_factor * a_factor * h_factor * budget_factor

        if streak and NECESSITY_SCORES.get(category, 0.35) < 0.80:
            regret *= 1.15

        regret = min(max(regret, 0.01), 0.99)
        return regret, {
            "base_regret": round(base, 3),
            "time_factor": t_factor,
            "amount_factor": a_factor,
            "history_factor": round(h_factor, 3),
            "budget_factor": budget_factor,
            "streak": streak,
        }

    def classify(
        self,
        payee: str,
        amount: float,
        ts: Optional[datetime],
        mcc_code: Optional[str] = None,
    ) -> dict:
        match = self._match_vendor(payee, amount=amount, ts=ts, mcc_code=mcc_code)
        category = canonical_category(match.category)
        meta = CATEGORY_META.get(category, CATEGORY_META[FALLBACK_CATEGORY])

        streak = self.detect_streak(category)
        regret, explanation = self.regret_probability(category, amount, ts, streak=streak)
        result = {
            "payee": payee,
            "normalized_payee": _normalize_text(payee),
            "amount": amount,
            "ts": ts,
            "category": category,
            "category_name": meta.get("category_name"),
            "subcategory_name": meta.get("subcategory_name"),
            "regret": round(regret, 3),
            "confidence": match.confidence,
            "review_required": match.review_required,
            "match_type": match.match_type,
            "flags": meta.get("flags", []),
            "necessity_score": NECESSITY_SCORES.get(category, 0.35),
            "explanation": {
                "matched_keyword": match.matched_term,
                "match_source": match.source,
                **explanation,
            },
        }

        self.transactions.append(result)
        return result

    def detect_duplicate(self, payee: str, amount: float, ts: datetime, window_days: int = 5) -> bool:
        normalized = _normalize_text(payee)
        for tx in self.transactions:
            tx_ts = tx.get("ts")
            if tx_ts is None:
                continue
            if not isinstance(tx_ts, datetime):
                try:
                    tx_ts = pd.to_datetime(tx_ts).to_pydatetime()
                except Exception:
                    continue
            diff_days = abs((ts - tx_ts).days)
            if diff_days > window_days:
                continue
            diff_amt = abs(float(amount) - float(tx.get("amount", 0.0)))
            amount_tolerance = max(5.0, abs(float(amount)) * 0.01)
            same_payee = tx.get("normalized_payee") == normalized
            if same_payee and diff_amt <= amount_tolerance:
                return True
        return False

    def load_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        missing = _REQUIRED_TRANSACTION_COLUMNS - set(df.columns)
        if missing:
            missing_cols = ", ".join(sorted(missing))
            raise ValueError(f"Transaction data is missing required column(s): {missing_cols}")

        work = df.copy()
        work["Date"] = _parse_statement_dates(work["Date"])
        work["Amount"] = work["Amount"].map(_parse_amount)

        results = []
        for _, row in work.iterrows():
            res = self.classify(
                str(row.get("Payee", "")),
                float(row.get("Amount", 0.0)),
                row.get("Date") if pd.notna(row.get("Date")) else None,
            )
            results.append(res)

        return pd.DataFrame(results)


# ---------------------------------------------------------------------------
# 5. Adapter for API
# ---------------------------------------------------------------------------

class OntologyEngine:
    """JSON-backed adapter used by the API and tests."""

    def __init__(self, monthly_income: float = 50000, daily_target_spend: Optional[float] = None):
        self.smart_engine = SmartOntologyEngine(UserProfile(monthly_income, daily_target_spend))
        self.knowledge_graph = [
            {
                "category": key,
                "name": value.get("subcategory_name"),
                "parent": value.get("category_name"),
                "flags": value.get("flags", []),
            }
            for key, value in CATEGORY_META.items()
        ]
        self._override_counts: dict[str, int] = {}

    def load_transactions(self, df: pd.DataFrame) -> dict:
        res_df = self.smart_engine.load_dataframe(df)

        if "category" not in df.columns:
            df["category"] = ""
        if "category_confidence" not in df.columns:
            df["category_confidence"] = 0.0
        if "category_review_required" not in df.columns:
            df["category_review_required"] = False

        for idx, row in res_df.iterrows():
            if idx in df.index:
                df.at[idx, "category"] = row["category"]
                df.at[idx, "category_confidence"] = row["confidence"]
                df.at[idx, "category_review_required"] = row["review_required"]

        total = len(res_df)
        debit_mask = pd.Series([True] * len(df), index=df.index)
        if "TransactionType" in df.columns:
            debit_mask = df["TransactionType"].astype(str).str.lower().eq("debit")
        debit_df = df[debit_mask].copy()

        categories = list(res_df["category"].dropna().unique()) if total > 0 else []
        category_counts = (
            debit_df["category"].value_counts().to_dict()
            if not debit_df.empty and "category" in debit_df.columns
            else {}
        )

        avg_daily_spend = estimate_variable_daily_spend(debit_df, fallback=0.0)

        top_category = None
        if not debit_df.empty:
            category_totals = debit_df.groupby("category")["Amount"].sum()
            if not category_totals.empty:
                top_category = category_totals.idxmax()

        debit_count = int(debit_mask.sum()) if len(df) else 0
        avg_confidence = float(res_df["confidence"].mean()) if not res_df.empty else 0.0
        review_count = int(res_df["review_required"].sum()) if not res_df.empty else 0
        quality = "sufficient" if debit_count >= 30 and avg_confidence >= 0.55 else "sparse"

        return {
            "total_transactions": total,
            "categories": categories,
            "category_counts": category_counts,
            "avg_daily_spend": avg_daily_spend,
            "top_category": top_category,
            "data_quality": quality,
            "avg_classification_confidence": round(avg_confidence, 3),
            "review_required_count": review_count,
        }

    def classify_vendor(
        self,
        payee: str,
        timestamp: Optional[datetime] = None,
        amount: float = 0.0,
        mcc_code: Optional[str] = None,
    ) -> dict:
        if timestamp is None:
            timestamp = datetime.now()
        res = self.smart_engine.classify(payee, amount, timestamp, mcc_code=mcc_code)
        category = canonical_category(res["category"])
        flags = list(res.get("flags", []))
        flag_set = set(flags)
        necessity = float(res.get("necessity_score", NECESSITY_SCORES.get(category, 0.35)))
        regret = float(res["regret"])
        impulse = (
            necessity < 0.55 and regret >= 0.55
        ) or bool(flag_set.intersection({
            "sensitive_category",
            "age_restricted",
            "speculative_asset",
            "regulatory_restricted",
            "illegal",
            "illegal_in_most_states",
        }))
        if necessity >= 0.80 and not flag_set.intersection({"illegal", "illegal_in_most_states"}):
            impulse = False

        foreign_flag = (
            _is_non_ascii(payee)
            or category in {"travel:forex", "telecom:international_roaming", "transfers:international_transfer"}
            or bool(re.search(r"\b(usd|eur|gbp|jpy|forex|foreign|international|swift)\b", payee, re.I))
        )

        return {
            "category": category,
            "category_label": category_label(category),
            "category_name": res.get("category_name"),
            "subcategory_name": res.get("subcategory_name"),
            "regret_probability": regret,
            "necessity_score": round(necessity, 3),
            "impulse_flag": impulse,
            "age_restricted": "age_restricted" in flag_set,
            "flags": flags,
            "foreign_flag": foreign_flag,
            "late_night_flag": res["explanation"]["time_factor"] > 1.0,
            "confidence": res.get("confidence", 0.25),
            "review_required": res.get("review_required", True),
            "matched_keyword": res["explanation"].get("matched_keyword"),
            "match_type": res.get("match_type", "fallback"),
        }

    def classify_as_category(
        self,
        payee: str,
        category: str,
        timestamp: Optional[datetime] = None,
        amount: float = 0.0,
    ) -> dict:
        if timestamp is None:
            timestamp = datetime.now()
        canonical = canonical_category(category)
        meta = CATEGORY_META.get(canonical, CATEGORY_META[FALLBACK_CATEGORY])
        flags = list(meta.get("flags", []))
        necessity = float(NECESSITY_SCORES.get(canonical, 0.35))
        streak = self.smart_engine.detect_streak(canonical)
        regret, explanation = self.smart_engine.regret_probability(canonical, amount, timestamp, streak=streak)
        flag_set = set(flags)
        impulse = (
            necessity < 0.55 and regret >= 0.55
        ) or bool(flag_set.intersection({
            "sensitive_category",
            "age_restricted",
            "speculative_asset",
            "regulatory_restricted",
            "illegal",
            "illegal_in_most_states",
        }))
        if necessity >= 0.80 and not flag_set.intersection({"illegal", "illegal_in_most_states"}):
            impulse = False
        foreign_flag = (
            _is_non_ascii(payee)
            or canonical in {"travel:forex", "telecom:international_roaming", "transfers:international_transfer"}
            or bool(re.search(r"\b(usd|eur|gbp|jpy|forex|foreign|international|swift)\b", payee, re.I))
        )
        return {
            "category": canonical,
            "category_label": category_label(canonical),
            "category_name": meta.get("category_name"),
            "subcategory_name": meta.get("subcategory_name"),
            "regret_probability": round(regret, 3),
            "necessity_score": round(necessity, 3),
            "impulse_flag": impulse,
            "age_restricted": "age_restricted" in flag_set,
            "flags": flags,
            "foreign_flag": foreign_flag,
            "late_night_flag": explanation.get("time_factor", 1.0) > 1.0,
            "confidence": 1.0,
            "review_required": False,
            "matched_keyword": normalize_category_mapping_key(payee),
            "match_type": "manual_override",
        }

    def check_double_charge(self, payee: str, amount: float, date: datetime) -> bool:
        return self.smart_engine.detect_duplicate(payee, amount, date)

    def get_category_regret_profile(self) -> dict:
        profile = {}
        for cat, model in self.smart_engine.regret_models.items():
            base = model.mean()
            overrides = self._override_counts.get(cat, 0)
            adjusted = base * (0.90 ** min(overrides, 3))
            profile[cat] = {
                "label": category_label(cat),
                "override_count": overrides,
                "base_regret_probability": round(base, 4),
                "adjusted_regret_probability": round(adjusted, 4),
            }
        return profile

    def add_override(self, category: str) -> None:
        canonical = canonical_category(category)
        self._override_counts[canonical] = self._override_counts.get(canonical, 0) + 1
        if category != canonical:
            self._override_counts[category] = self._override_counts.get(category, 0) + 1
