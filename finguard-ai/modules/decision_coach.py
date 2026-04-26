"""
modules/decision_coach.py
--------------------------
FinGuard AI — Decision Coach (Forward-Chaining Rule Engine)

Implements a Rete-inspired, salience-ordered rule engine that mirrors the
experta/pyknow API while remaining compatible with Python 3.10+.
"""

from __future__ import annotations

import collections
import collections.abc
from dataclasses import dataclass
from typing import Optional

# ── Python 3.10+ patch: experta uses removed collections.* aliases ─────────────
for _attr in ("Callable", "Mapping", "MutableMapping", "Sequence",
              "MutableSequence", "Iterator", "Iterable"):
    if not hasattr(collections, _attr):
        setattr(collections, _attr, getattr(collections.abc, _attr))

try:
    from frozendict import frozendict as _fd  # noqa: F401 – experta needs it
except ImportError:
    pass


# ══════════════════════════════════════════════════════════════════════════════
# Minimal experta-compatible engine (pure Python, Python 3.13 safe)
# ══════════════════════════════════════════════════════════════════════════════

def Rule(*_pattern_args, salience: int = 0):
    """Decorator that registers a method as a forward-chaining rule."""
    def decorator(fn):
        fn._is_rule    = True
        fn._salience   = salience
        return fn
    return decorator


class _EngMeta(type):
    def __new__(mcs, name, bases, ns):
        rules = [
            (v._salience, k, v)
            for k, v in ns.items()
            if callable(v) and getattr(v, "_is_rule", False)
        ]
        for base in bases:
            rules += getattr(base, "_rules", [])
        ns["_rules"] = sorted(rules, key=lambda x: -x[0])
        return super().__new__(mcs, name, bases, ns)


class Fact:
    """Base class for all Facts."""
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            object.__setattr__(self, k, v)

    def get(self, key, default=None):
        return getattr(self, key, default)


class KnowledgeEngine(metaclass=_EngMeta):
    """Salience-ordered forward-chaining engine."""

    def __init__(self):
        self._facts: list[Fact] = []
        self.decision: Optional[str] = None
        self.reason:   str = ""
        self.commitment_device: bool = False

    def declare(self, fact: Fact) -> None:
        self._facts.append(fact)

    def reset(self) -> None:
        self._facts.clear()
        self.decision = None
        self.reason   = ""
        self.commitment_device = False

    def run(self) -> None:
        for _sal, _name, rule_fn in self.__class__._rules:
            if self.decision is not None:
                break
            rule_fn(self)

    def _get(self, fact_type: type) -> Optional[Fact]:
        for f in self._facts:
            if isinstance(f, fact_type):
                return f
        return None


# ══════════════════════════════════════════════════════════════════════════════
# Fact definitions
# ══════════════════════════════════════════════════════════════════════════════

class FinancialState(Fact):
    """balance, daily_target, monthly_income, fixed_expenses,
    days_until_month_end, override_counts"""


class TransactionFact(Fact):
    """amount, category, regret_probability, impulse_flag, late_night_flag,
    hour, survival_days_before, survival_days_after, survival_delta"""


class OntologyResult(Fact):
    """category, regret_probability, necessity_score, impulse_flag,
    foreign_flag"""


# ══════════════════════════════════════════════════════════════════════════════
# Decision result
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class DecisionResult:
    decision:          str    # "SPEND" | "PAUSE" | "AVOID"
    reason:            str
    nudge_text:        str
    opportunity_cost:  dict
    commitment_device: bool
    confidence:        str    # "high" | "medium" | "low"


# ══════════════════════════════════════════════════════════════════════════════
# Rule engine
# ══════════════════════════════════════════════════════════════════════════════

class FinGuardCoach(KnowledgeEngine):
    """Nine salience-ordered rules that evaluate a proposed transaction."""

    # Rule 1 — Insufficient funds
    @Rule(salience=100)
    def rule_insufficient_funds(self):
        t = self._get(TransactionFact)
        f = self._get(FinancialState)
        if t and f and t.amount > f.balance:
            self.decision = "AVOID"
            self.reason   = "Insufficient funds"

    # Rule 1.5 — Medical Emergency (Always allow if funds exist)
    @Rule(salience=95)
    def rule_medical_essential(self):
        t = self._get(TransactionFact)
        if t and t.category == "MedicalEssential":
            self.decision = "SPEND"
            self.reason   = "Medical and health essentials are always approved"

    # Rule 2 — Critical survival + high regret
    @Rule(salience=90)
    def rule_critical_survival(self):
        t = self._get(TransactionFact)
        if t and t.survival_days_after < 3 and t.regret_probability > 0.50:
            self.decision = "AVOID"
            self.reason   = "Critical financial runway with high regret risk"

    # Rule 3 — Low survival + very high regret
    @Rule(salience=85)
    def rule_low_survival_high_regret(self):
        t = self._get(TransactionFact)
        if t and t.survival_days_after < 5 and t.regret_probability > 0.70:
            self.decision = "AVOID"
            self.reason   = "Low runway with very high regret probability"

    # Rule 4 — Late-night craving + short runway
    @Rule(salience=80)
    def rule_late_night_craving(self):
        t = self._get(TransactionFact)
        if t and t.survival_days_after < 7 and t.category == "LateNightCraving":
            self.decision = "PAUSE"
            self.reason   = "Late-night craving with tight runway"
            self.commitment_device = True

    # Rule 5 — Exceeds daily target
    @Rule(salience=75)
    def rule_exceeds_daily_target(self):
        t = self._get(TransactionFact)
        f = self._get(FinancialState)
        if t and f and f.daily_target and t.amount > f.daily_target * 1.5:
            self.decision = "PAUSE"
            self.reason   = "Exceeds daily target"

    # Rule 6 — Late-night impulse
    @Rule(salience=70)
    def rule_late_night_impulse(self):
        t = self._get(TransactionFact)
        if t and t.impulse_flag and (t.hour >= 22 or t.hour < 4):
            self.decision = "PAUSE"
            self.reason   = "Late-night impulse purchase"
            self.commitment_device = True

    # Rule 7 — Foreign transaction
    @Rule(salience=60)
    def rule_foreign_transaction(self):
        o = self._get(OntologyResult)
        if o and o.foreign_flag:
            self.decision = "PAUSE"
            self.reason   = "Foreign transaction detected"

    # Rule 8 — Healthy finances, low regret
    @Rule(salience=50)
    def rule_healthy_spend(self):
        t = self._get(TransactionFact)
        if t and t.survival_days_before > 20 and t.regret_probability < 0.30:
            self.decision = "SPEND"
            self.reason   = "Healthy financial position"

    # Rule 9 — Default fallback
    @Rule(salience=10)
    def rule_default(self):
        t = self._get(TransactionFact)
        if t:
            self.decision = "SPEND" if t.survival_days_after > 10 else "PAUSE"
            self.reason   = "Default assessment"
        else:
            self.decision = "PAUSE"
            self.reason   = "Insufficient data"


# ══════════════════════════════════════════════════════════════════════════════
# Override softening
# ══════════════════════════════════════════════════════════════════════════════

def apply_override_softening(
    category: str,
    override_counts: dict,
    regret_probability: float,
) -> float:
    """
    Reduce regret probability based on past user overrides (learning loop).
    Up to 3 × −10%; floor = 0.70 × original.
    """
    n          = min(override_counts.get(category, 0), 3)
    softened   = regret_probability * (0.90 ** n)
    floor_val  = regret_probability * 0.70
    return max(softened, floor_val)


# ══════════════════════════════════════════════════════════════════════════════
# Opportunity cost engine
# ══════════════════════════════════════════════════════════════════════════════

def compute_opportunity_cost(amount_inr: float) -> dict:
    """Return relatable rupee equivalents."""
    meals      = round(amount_inr / 120, 1)
    work_hours = round(amount_inr / 150, 1)
    return {
        "meals":      f"{meals} meals",
        "work_hours": f"{work_hours} hours of work",
        "raw_meals":  meals,
        "raw_hours":  work_hours,
    }


# ══════════════════════════════════════════════════════════════════════════════
# Nudge text generator
# ══════════════════════════════════════════════════════════════════════════════

_DISTRESS_KEYWORDS = frozenset(
    {"desperate", "need help", "can't afford", "cannot afford",
     "help me", "no money", "broke"}
)


def generate_nudge(
    decision: str,
    category: str,
    survival_delta: float,
    regret_probability: float,
    opportunity_cost: dict,
    commitment_device: bool,
    amount: float = 0.0,
    daily_target: float = 0.0,
    payee: str = "",
) -> str:
    """Build a context-aware nudge message for the given decision."""
    # Distress detection → empathy-first
    if any(kw in payee.lower() for kw in _DISTRESS_KEYWORDS):
        return (
            "It sounds like things are tough right now. "
            "Let's look at your options together. "
            "Support is available — please reach out before making a "
            "financial decision under stress."
        )

    oc_str     = f"Equivalent to {opportunity_cost['meals']} and {opportunity_cost['work_hours']}."
    regret_pct = int(regret_probability * 100)

    if decision == "AVOID":
        return (
            f"This purchase reduces your runway by {survival_delta:.1f} day(s). "
            f"You regret {category} purchases {regret_pct}% of the time. "
            f"{oc_str}"
        )

    if decision == "PAUSE":
        if category == "LateNightCraving":
            msg = (
                f"Late-night purchases in this category are regretted "
                f"{regret_pct}% of the time."
            )
            if commitment_device:
                msg += " A 48-hour wait has been set."
        elif daily_target and amount > daily_target * 1.5:
            over = round(amount - daily_target, 0)
            msg = (
                f"This exceeds your daily target by ₹{over:.0f}. "
                "Consider splitting the purchase across days."
            )
        else:
            msg = (
                f"Take a moment to reflect. "
                f"This category carries a {regret_pct}% regret rate."
            )
        return f"{msg} {oc_str}"

    return f"You're on track. Enjoy this purchase. {oc_str}"


# ══════════════════════════════════════════════════════════════════════════════
# Main interface
# ══════════════════════════════════════════════════════════════════════════════

def evaluate_transaction(
    balance: float,
    transaction_amount: float,
    daily_target: float,
    ontology_result: dict,
    survival_result: dict,
    override_counts: dict,
    days_until_month_end: int,
    hour: int,
    payee: str = "",
) -> DecisionResult:
    """
    Run the full forward-chaining pipeline and return a DecisionResult.

    Parameters
    ----------
    balance              : current account balance (₹)
    transaction_amount   : amount being evaluated (₹)
    daily_target         : safe-to-spend per day (₹)
    ontology_result      : dict from OntologyEngine.classify_vendor()
    survival_result      : dict from SurvivalEngine.predict() or math fallback
    override_counts      : {category: n_overrides}
    days_until_month_end : calendar days remaining in the month
    hour                 : local hour 0–23
    payee                : vendor name (used for distress detection)
    """
    category          = ontology_result.get("category",           "GenericPurchase")
    regret_prob       = ontology_result.get("regret_probability",  0.35)
    impulse_flag      = ontology_result.get("impulse_flag",        False)
    foreign_flag      = ontology_result.get("foreign_flag",        False)
    necessity_score   = ontology_result.get("necessity_score",     0.50)

    # Override softening (learning loop)
    regret_prob = apply_override_softening(category, override_counts, regret_prob)

    days_before = float(survival_result.get("survival_days_before", 30.0))
    days_after  = float(survival_result.get("survival_days_after",  25.0))
    delta       = float(survival_result.get("survival_delta",        5.0))
    late_night  = (hour >= 22 or hour < 4)

    # Instantiate and run engine
    coach = FinGuardCoach()
    coach.reset()
    coach.declare(FinancialState(
        balance=balance,
        daily_target=daily_target,
        monthly_income=0.0,
        fixed_expenses=0.0,
        days_until_month_end=days_until_month_end,
        override_counts=override_counts,
    ))
    coach.declare(TransactionFact(
        amount=transaction_amount,
        category=category,
        regret_probability=regret_prob,
        impulse_flag=impulse_flag,
        late_night_flag=late_night,
        hour=hour,
        survival_days_before=days_before,
        survival_days_after=days_after,
        survival_delta=delta,
    ))
    coach.declare(OntologyResult(
        category=category,
        regret_probability=regret_prob,
        necessity_score=necessity_score,
        impulse_flag=impulse_flag,
        foreign_flag=foreign_flag,
    ))
    coach.run()

    decision          = coach.decision          or "PAUSE"
    reason            = coach.reason            or "Default assessment"
    commitment_device = coach.commitment_device

    opp_cost = compute_opportunity_cost(transaction_amount)
    nudge    = generate_nudge(
        decision=decision,
        category=category,
        survival_delta=delta,
        regret_probability=regret_prob,
        opportunity_cost=opp_cost,
        commitment_device=commitment_device,
        amount=transaction_amount,
        daily_target=daily_target,
        payee=payee,
    )

    confidence = (
        "high"   if decision == "AVOID" and days_after < 5 else
        "medium" if decision in ("AVOID", "PAUSE")          else
        "low"
    )

    return DecisionResult(
        decision=decision,
        reason=reason,
        nudge_text=nudge,
        opportunity_cost=opp_cost,
        commitment_device=commitment_device,
        confidence=confidence,
    )
