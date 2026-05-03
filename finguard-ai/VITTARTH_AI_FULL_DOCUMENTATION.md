# VittArth AI — Comprehensive Technical Documentation
## Part 1: Project Overview, Architecture & File Breakdown

---

# 1. Project Overview

**VittArth AI** is a personal finance AI assistant built for the Indian market. Its core mission is to act as an **emotional interceptor** — it sits between you and your wallet and asks: *"Should you really spend this?"*

It is not a budgeting app. It is an **AI decision engine** that evaluates each proposed transaction through four different intelligent lenses before giving you a SPEND / PAUSE / AVOID verdict with a behavioral explanation.

### What it does in plain English:
1. You tell it your income, fixed expenses, and daily spending limit.
2. You upload your bank statement CSV so it learns your spending patterns.
3. Before every purchase, you enter the amount and vendor — or paste your bank SMS.
4. The system classifies the vendor, estimates regret probability, checks your financial runway, fires a rule engine, and tells you whether to go ahead or pause.
5. If you are in financial distress (< 7 days runway), an Emergency Budget Planner activates.

---

# 2. System Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)                     │
│  Onboarding → Dashboard → TransactionSimulator → EmergencyPlanner │
└───────────────────────────┬───────────────────────────────────┘
                            │  HTTP (Axios, /api/*)
┌───────────────────────────▼───────────────────────────────────┐
│                  BACKEND (FastAPI + Uvicorn)                    │
│  /api/health  /api/onboard  /api/upload-csv  /api/dashboard    │
│  /api/evaluate  /api/ingest-bank-message  /api/confirm         │
│  /api/correct-category  /api/categories  /api/emergency-budget │
└────────┬──────────────┬──────────────┬──────────────┬─────────┘
         │              │              │              │
    OntologyEngine  SurvivalEngine  DecisionCoach  CSPPlanner
    (Semantic Web)  (PyTorch DL)   (Rule Engine)  (Constraint)
         │              │
   ontology_flags.json  models/survival_model.pt
```

### State: In-Memory Session Store
There is **no database**. All user data lives in Python dictionaries held in RAM, keyed by a UUID session ID. Sessions expire after 2 hours.

---

# 3. Technology Stack

| Layer | Technology | Why Chosen |
|---|---|---|
| Backend framework | FastAPI | Async, auto-docs, Pydantic validation |
| ML runtime | PyTorch 2.x | Flexible neural net, Monte Carlo dropout |
| Data processing | Pandas + NumPy | Fast tabular data manipulation |
| Fuzzy matching | RapidFuzz | Fast Levenshtein-based vendor matching |
| Constraint solving | python-constraint | Backtracking CSP for budget allocation |
| Feature scaling | scikit-learn StandardScaler | Normalize features for neural net |
| Frontend | React 19 + Vite 8 | Fast HMR, modern JSX |
| Styling | Tailwind CSS v4 | Utility-first, rapid UI |
| Charts | Recharts | Declarative React chart library |
| HTTP client | Axios | Promise-based, interceptor support |
| Icons | Lucide React | Consistent SVG icon set |

---

# 4. Complete File Breakdown

## 4.1 Root Level

### `requirements.txt`
**Purpose:** Python dependency manifest.
**Key packages:**
- `fastapi`, `uvicorn`, `pydantic` — web server stack
- `torch`, `torchvision` — deep learning (SurvivalNet)
- `pandas`, `numpy`, `scikit-learn` — data pipeline
- `python-constraint` — CSP budget planner
- `rapidfuzz` — fuzzy vendor name matching
- `openpyxl` — Excel file parsing support
- `frozendict` — legacy experta compatibility (no longer used for rules)

### `app.py`
**Purpose:** Possibly a Streamlit prototype entry point from early development. Not used in production — the live server is started via `api/run.py` or `uvicorn api.main:app`.

---

## 4.2 Backend: `api/`

### `api/__init__.py`
Empty init file that makes `api/` a Python package, enabling `from api.routes import ...` imports.

### `api/main.py` — The FastAPI Application Root
**Purpose:** Assembles the full web server. This is the **single entry point** for all backend concerns.

**What it does:**
1. Creates the FastAPI app with title "VittArth AI API".
2. Registers a **lifespan** context manager — on startup it logs "API started" and launches a background coroutine `_expire_sessions()` that runs every 30 minutes, purging sessions older than 2 hours.
3. Adds **CORS middleware** allowing requests from `localhost:5173`, `localhost:3000`, and any `localhost:PORT`.
4. Adds a **security headers middleware** (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`) on every response.
5. Adds a **global exception handler** that catches unhandled exceptions and returns a JSON 500 response.
6. Mounts 5 API routers with prefix `/api`.
7. If `frontend/dist/` exists, serves the built React app as static files at `/`.

**Key interactions:** Imports from `api/routes/`, `api/state/session_store.py`.

### `api/run.py` — Development Server Launcher
**Purpose:** Convenience script to launch Uvicorn with correct settings.

**How it works:**
- Adds project root to `sys.path` so both `api/` and `modules/` are importable.
- Reads `FG_API_HOST` (default: 127.0.0.1), `FG_API_PORT` (default: 8001), `FG_API_RELOAD` (default: false) from environment variables.
- Calls `uvicorn.run("api.main:app", ...)`.

**How to run:** `python api/run.py` from project root.

---

## 4.3 Backend: `api/models/schemas.py` — All Pydantic Models

**Purpose:** Defines all request bodies and response shapes using Pydantic v2. Acts as the **contract** between frontend and backend.

### Request Models:

**`OnboardRequest`** — What the frontend sends when user fills the financial profile form:
- `monthly_income` (float, > 0)
- `fixed_expenses` (float, >= 0) — validated: cannot exceed income
- `daily_target` (float, > 0)
- `user_profile` (str, default "Standard")
- `current_balance` (float, >= 0)
- `days_until_month_end` (int, >= 0)

**`TransactionRequest`** — Evaluate a manual transaction:
- `session_id`, `amount`, `payee`, `date` (YYYY-MM-DD), `hour` (0–23)

**`BankMessageRequest`** — Raw SMS text to parse:
- `session_id`, `message` (10–3000 chars)

**`ConfirmTransactionRequest`** — User's decision on a pending transaction:
- `session_id`, `transaction_id`, `action` ("proceed" | "cancel")

**`CategoryCorrectionRequest`** — User corrects an AI-assigned category:
- `session_id`, `transaction_id`, `vendor_name`, `category`

**`CSVUploadRequest`** — Bank statement upload (base64 encoded):
- `session_id`, `filename`, `file_base64`

### Response Models:

**`EvaluationResponse`** — The main AI decision output:
- `decision` ("SPEND" | "PAUSE" | "AVOID" | "BLOCKED")
- `nudge_text` — human-readable behavioral nudge
- `opportunity_cost` — meal/work-hour equivalents
- `survival_before`, `survival_after`, `survival_delta` — runway in days
- `commitment_device` (bool) — whether a 48-hour wait is recommended
- `category`, `regret_probability`, `confidence_band`
- `forward_chain` — full rule trace (which rules fired and why)

**`DashboardResponse`** — Complete dashboard data:
- `balance`, `survival_days`, `daily_spend_rate`, `risk_tier`
- `category_breakdown` — pie chart data
- `daily_spend_history` — bar chart data (last 30 days)
- `moving_average_7d` — smoothed spend trend
- `category_regret_table` — regret scores per category

**`BudgetResponse`** — Emergency planner output:
- `active` (bool), `status` ("feasible"|"crisis")
- `daily_food`, `daily_travel`, `daily_discretionary`, `total_daily`
- `crisis_actions` — actionable list when no budget is feasible

---

## 4.4 Backend: `api/state/session_store.py` — The "Database"

**Purpose:** Provides an in-memory, thread-safe session store. This replaces a real database.

**Why in-memory?** VittArth AI was designed as a stateless, per-session tool. There is no user account system. Each onboarding creates a fresh UUID session that lives for 2 hours.

**Class: `SessionStore`**
- `sessions: dict[str, dict]` — maps UUID → session data dict
- `lock: asyncio.Lock` — protects concurrent access in the async FastAPI context

**Methods:**
- `create_session(onboard_data)` → UUID string. Initializes the session with financial profile, empty engines (ontology_engine=None, survival_engine=None), empty transactions_df, override_counts={}.
- `get_session(session_id)` → session dict. Raises HTTP 404 if not found.
- `update_session(session_id, **kwargs)` → merges kwargs into session dict.
- `delete_session(session_id)` → removes from dict.

**Session dict keys:**
```
monthly_income, fixed_expenses, daily_target, user_profile,
balance, days_until_month_end,
ontology_engine (OntologyEngine instance),
survival_engine (SurvivalEngine instance),
transactions_df (DataFrame),
variable_transactions_df (DataFrame),
variable_daily_spend_rate (float),
is_trained (bool),
override_counts (dict),
risk_tier ("Safe"|"Medium Risk"|"High Risk"),
pending_transactions (dict),
commitment_device_until (datetime|None),
ontology_stats (dict),
created_at (datetime)
```

**Global singleton:** `store = SessionStore()` — imported by all route files.

---

## 4.5 Backend Routes

### `api/routes/health.py` — Health Check
**Endpoint:** `GET /api/health`
**Returns:** `{"status": "ok", "version": "1.0.0"}`
**Purpose:** Used by frontend to verify the backend is running. Called on app startup.

---

### `api/routes/onboarding.py` — User Setup & CSV Upload

**`POST /api/onboard`**
- Receives `OnboardRequest`, calls `store.create_session()`, returns `session_id`.
- The session_id is stored in browser `localStorage` by the frontend.

**`GET /api/profile/{session_id}`**
- Returns current financial profile for the session.

**`PUT /api/profile`**
- Updates income/expenses/target/balance fields of a session.

**`POST /api/upload-csv`** — The most complex endpoint:
1. Decodes base64 file, validates extension (.csv/.xlsx/.xls).
2. Parses file with pandas (tries UTF-8 then latin-1 for CSV).
3. Validates required columns: `Date`, `Amount`, `Payee`, `TransactionType`.
4. Cleans `Amount` column: strips ₹/$,Rs characters, coerces to numeric.
5. Creates `OntologyEngine` instance with user's income/daily_target.
6. Calls `oe.load_transactions(df)` — classifies every row by category.
7. Calls `variable_expense_statement(df)` — filters out fixed expenses.
8. Calls `estimate_variable_daily_spend()` — computes daily spend rate.
9. Creates `SurvivalEngine`, calls `se.train(variable_df, balance, 0.0)` — trains neural net.
10. Stores all engines and DataFrames back into the session.
11. Returns `CSVUploadResponse` with stats and model training metrics.

---

### `api/routes/dashboard.py` — Analytics Dashboard

**`GET /api/dashboard?session_id=...`**

Reads from session and computes:
1. **Daily spend rate** — from recent 7-day variable expenses; falls back to daily_target if no data.
2. **Survival days** — `predict_mathematical(balance, daily_rate)`.
3. **Risk tier** — "High Risk" (< 7 days), "Medium Risk" (< 14 days), "Safe".
4. **Category breakdown** — groups debit transactions by category, computes % share and regret_prob from REGRET_PRIORS.
5. **Daily spend history** — last 30 days of variable expenses, grouped by date.
6. **7-day moving average** — rolling mean over daily history.
7. **Regret table** — per-category: count, avg_amount, regret_prob, override_count.

No AI models are called — this is pure analytics over the stored DataFrame.

---

### `api/routes/planner.py` — Emergency Budget

**`GET /api/emergency-budget?session_id=...`**

1. Computes current survival days with `predict_mathematical()`.
2. Calls `should_activate(survival_days, risk_tier)` — returns True if risk is "High Risk" OR survival < 7.
3. If not activated: returns `BudgetResponse(active=False)`.
4. If activated: creates `CSPPlanner`, calls `compute_budget(balance, fixed_remaining, days_until_month_end, is_remote)`.
5. Returns either a feasible budget split or a crisis action plan.

---

### `api/routes/transaction.py` — The Core AI Pipeline (595 lines)

This is the most important file — it orchestrates all four AI modules.

**`GET /api/categories`**
Returns all known ontology categories as a flat list with labels, parents, keys.

**`POST /api/evaluate`** — Main transaction analysis:
1. Sanitizes payee name (strips HTML tags, invisible chars, SQL injection chars).
2. Hard blocks if `amount > balance` — returns AVOID immediately.
3. Calls `OntologyEngine.classify_vendor(payee, timestamp, amount)` → category + regret_prob + flags.
4. Calls `SurvivalEngine.predict()` (or math fallback) → days_before, days_after, delta.
5. Calls `evaluate_transaction()` from `decision_coach.py` → SPEND/PAUSE/AVOID + nudge.
6. Stores as pending transaction with UUID.
7. Returns `EvaluationResponse`.

**`POST /api/ingest-bank-message`** — Parse SMS + auto-record:
1. Parses raw SMS text through 6 regex-based extractors: amount, payee, date, hour.
2. Classifies vendor with best-payee scoring across multiple merchant candidates.
3. Runs same AI pipeline as `/evaluate`.
4. **Auto-records** the transaction (updates balance, appends to DataFrame).
5. Returns `BankMessageIngestResponse` with parsed fields + decision.

**`POST /api/confirm`** — User decides to proceed or cancel:
- `action="proceed"`: deducts amount from balance, appends row to transactions_df, updates risk_tier.
- `action="cancel"`: removes from pending_transactions.

**`POST /api/correct-category`** — User overrides AI category:
1. Finds the pending or recorded transaction.
2. Calls `learn_category_mapping(vendor_name, new_category)` — saves to `data/category_mappings.json`.
3. Re-runs the full AI evaluation with the corrected category.
4. Updates the transaction record.
5. Returns updated `CategoryCorrectionResponse`.

**Bank message parsing (internal functions):**
- `_sanitize()` — strips HTML, zero-width chars, multiple spaces.
- `_parse_amount()` — scores number candidates by proximity to debit keywords, currency symbols; penalizes balance/reference numbers.
- `_parse_payee()` — extracts merchant name from "at/to" patterns, UPI VPA, POS descriptors; cleans noise tokens.
- `_parse_date()` — tries ISO, DD/MM/YYYY, and D-Mon-YYYY formats.
- `_parse_hour()` — extracts HH:MM AM/PM time.
# VittArth AI — Comprehensive Technical Documentation
## Part 2: AI/ML Modules Deep Dive

---

# 5. Module A: Ontology Engine (`modules/ontology_engine.py`)

## 5.1 What is an Ontology?

An ontology is a **structured knowledge graph** — a hierarchy of concepts and their relationships. In VittArth AI, the ontology defines the universe of all spending categories and what makes each one distinct.

**Simple explanation:** Imagine a giant decision tree that says: *"If the vendor name contains 'Swiggy', it belongs to food_and_dining:food_delivery. That category has a regret probability of 0.72, necessity score of 0.30, and an impulse flag."*

**Why ontology instead of a neural classifier?**
- **Deterministic and explainable** — you can trace exactly WHY a vendor was classified a certain way.
- **No training data needed** — the rules come from domain knowledge encoded in a JSON file.
- **Zero-shot generalisation** — a new vendor ("QuickBite") can be classified correctly if its name contains food delivery keywords.
- **Regulatory awareness** — flags like `illegal`, `PMLA_trigger`, `age_restricted` encode legal compliance directly.
- **Human-auditable** — a non-technical compliance officer can read the ontology JSON and understand every rule.

## 5.2 Ontology Data Source

The ontology is loaded from `ontology_flags.json` (at project root). This JSON file defines:
- **Top-level categories** (e.g., `food_and_dining`, `healthcare`, `entertainment`) — 22 categories.
- **Subcategories** with merchant examples, keywords, UPI patterns, MCC codes, flags, and amount hints.
- **Sub-subcategories** for finer classification.
- **Global UPI narration patterns** mapping payment app names to categories.

**Key structures per subcategory:**
```json
{
  "name": "Food Delivery",
  "slug": "food_delivery",
  "merchant_examples": ["Swiggy", "Zomato", "Dunzo"],
  "keywords": ["delivery", "order", "food app"],
  "upi_patterns": ["swiggy.*", "zomato@.*"],
  "amount_hints": {"min": 50, "max": 3000},
  "flags": ["impulse_risk", "late_night_risk"]
}
```

## 5.3 Index Building (`_build_ontology_index`)

At module import time (NOT per request), the ontology JSON is parsed and compiled into an in-memory index. This is an expensive one-time operation (~50ms) that enables O(n) fast lookups.

**Index structures built:**
1. **`entries: list[OntologyEntry]`** — flat list of all terms (keywords, merchant names, UPI patterns, regex patterns) with their category, source, weight, and is_regex flag.
2. **`category_meta: dict`** — maps category key → metadata (flags, amount_hints, icon, color, is_root).
3. **`mcc_map: dict`** — maps MCC code (merchant category code from banks) → category key.
4. **`regret_priors: dict`** — maps category → base regret probability (float 0–1).
5. **`necessity_scores: dict`** — maps category → necessity score (float 0–1).
6. **`vendor_map: dict`** — maps normalized term → best matching category.
7. **`vendor_keys: list`** — all normalized terms (used for fuzzy matching).

**Term weights by source type:**
| Source | Weight | Meaning |
|---|---|---|
| `sub_merchant` | 4.4 | Exact merchant example at sub-sub level |
| `merchant` | 4.2 | Merchant example at sub level |
| `upi_pattern` | 4.0 | UPI identifier pattern |
| `sub_keyword` | 3.6 | Keyword at sub-sub level |
| `keyword` | 3.0 | General keyword |
| `subcategory_name` | 2.2 | Category name itself |
| `top_upi_regex` | 1.5 | Top-level UPI regex |
| `top_keyword` | 1.2 | Top-level category keyword |

## 5.4 Vendor Classification Pipeline (`_match_vendor`)

When `classify_vendor("Swiggy Order", timestamp, amount=350)` is called:

**Step 1: User-correction override**
Checks `data/category_mappings.json` first. If the vendor was previously manually corrected, returns that with confidence 0.98 immediately. This is the learning loop.

**Step 2: MCC code lookup**
If a bank-provided MCC code is present, maps directly to category.

**Step 3: Ontology term matching**
Normalizes the payee: removes noise tokens (upi, pos, ref, txn), ASCII-folds Unicode, lowercases.
For each `OntologyEntry`, calls `_score_entry()`:

- **Match types and base scores:**
  - `exact` = 0.92 (normalized payee == term exactly)
  - `phrase` = 0.86 (term appears as whole phrase in payee)
  - `compact` = 0.82 (compact forms match, e.g. "swiggy" in "swiggyorder")
  - `substring` = 0.76 (term is substring of payee)
  - `regex` = 0.84 (regex pattern matches)

- **Score boosts added:**
  - `source_boost` = weight × 0.018 (up to +0.09)
  - `length_boost` = len(term)/120 (up to +0.04)
  - `amount_boost` = ±0.04 based on amount_hints (correct price range)
  - `time_boost` = +0.03 for late-night food/alcohol (10pm–4am)
  - `subscription_token_boost` = ±0.07 for subscription-related words

- Highest scoring candidate wins. If score < 0.60 or category ends in `:_root`, sets `review_required=True`.

**Step 4: Fuzzy fallback**
If no ontology match found, uses RapidFuzz `token_set_ratio` against all vendor_keys. If score ≥ 86, returns that category with `confidence = min(0.84, score/100)`.

**Step 5: Fallback**
Returns `miscellaneous:uncategorized` with confidence 0.25 and `review_required=True`.

## 5.5 Bayesian Regret Model (`BayesianRegret` class)

**Purpose:** Estimates the probability you will regret a purchase in this category.

**Mathematical model:** Beta-Binomial conjugate update.

- **Prior:** Each category has a prior regret probability (e.g., food_delivery = 0.72, grocery = 0.08).
- The prior is encoded as a Beta distribution: `alpha = prior × 10`, `beta = (1 - prior) × 10`.
- **Update:** When you override an AI recommendation (meaning you disagreed), the model updates: `alpha += 1` (for regret events) or `beta += 1` (for non-regret).
- **Posterior mean:** `alpha / (alpha + beta)` — this is the current regret estimate.

**Why Beta-Binomial?** Because regret is a binary outcome (you regret or you don't), and Beta is the conjugate prior for binomial probability. This gives a mathematically correct, closed-form posterior update with no re-training needed.

## 5.6 Regret Probability Computation

Final regret = `base × time_factor × amount_factor × history_factor × budget_factor × streak_factor`

| Factor | Description |
|---|---|
| `base` | Bayesian posterior mean for category |
| `time_factor` | 1.22x for late-night food/alcohol; 1.08x for evening shopping |
| `amount_factor` | 1.65x if amount > 20% of monthly income; 0.92x if tiny |
| `history_factor` | +18% if this amount is 3× your avg in this category |
| `budget_factor` | 0.92x if under daily target; 1.08x if over |
| `streak_factor` | ×1.15 if you've bought this category 3+ times recently |

**Clamped to [0.01, 0.99]** — never certainty in either direction.

## 5.7 Regret Priors by Category

```
food_delivery     = 0.72    (high — impulsive, convenience-driven)
grocery           = 0.08    (low — essential)
alcohol           = 0.70    (high)
luxury            = 0.75    (high)
crypto            = 0.78    (very high)
lottery_gambling  = 0.85    (very high)
pharmacy          = 0.03    (very low — medical necessity)
rent              = 0.02    (almost zero — unavoidable)
hospital          = 0.04    (very low)
school_fees       = 0.04    (very low)
mutual_fund       = 0.05    (low — beneficial)
insurance         = 0.06    (low)
```

## 5.8 Category Correction & Learning Loop

When a user says "that wasn't food delivery, it was groceries":
1. `learn_category_mapping(vendor_name, "food_and_dining:groceries")` is called.
2. Generates multiple key variants: normalized, compact, sorted-token, acronym.
3. Writes all variants to `data/category_mappings.json` under a thread lock.
4. Future calls to `match_vendor("BigBasket")` first check this file and return the corrected category with confidence 0.98.

---

# 6. Module B: Survival Engine (`modules/survival_engine.py`)

## 6.1 What It Does

The Survival Engine answers: **"How many days of financial runway do I have?"** — both before and after a proposed transaction.

It uses a **hybrid approach**: a PyTorch neural network (trained on synthetic data derived from real bank statements) blended 75/25 with a deterministic cash-flow equation.

## 6.2 Architecture: `SurvivalNet`

```
Input (6 features)
     │
Linear(6 → 64) → ReLU → Dropout(0.2)
     │
Linear(64 → 32) → ReLU
     │
Linear(32 → 1)
     │
Output: survival_days (float, 0–90)
```

**Shallow 3-layer regression network.** No convolutional or attention layers. Dropout(0.2) serves dual purpose: regularization during training, and **Monte Carlo uncertainty estimation** during inference.

## 6.3 The 6 Input Features

| Index | Feature | Description |
|---|---|---|
| 0 | `current_balance` | Account balance in ₹ |
| 1 | `transaction_amount` | Proposed spend in ₹ |
| 2 | `spending_volatility_7d` | Std-dev of daily spend over last 7 days |
| 3 | `day_of_month` | 1–31 (captures month-end pressure) |
| 4 | `category_encoding` | Integer index of top-level category (0–21) |
| 5 | `time_of_day_encoding` | `hour / 24.0` (float 0–1) |

All features are **StandardScaler normalized** before passing to the network.

## 6.4 Training Pipeline

Called once per user after CSV upload:

1. **Generate synthetic training data** (`generate_training_data`, 600 samples):
   - Estimates real `hist_daily_spend` from uploaded CSV.
   - Randomizes: balance ±50%, daily_spend with 30% noise, fixed remaining 0–100%, tx_amount 0–30% of balance.
   - Computes **ground truth**: `survival = (balance - tx_amount - fixed_remaining) / daily_spend`.
   - Adds Gaussian noise to features for robustness.

2. **StandardScaler fit** on training data (saved to `models/survival_scaler.pkl`).

3. **Train/val split:** 80/20.

4. **Training loop:** 100 epochs, Adam optimizer (lr=0.001), MSELoss.

5. **Validation:** Computes val_mse and val_mae on held-out 20%.

6. **Save:** `models/survival_model.pt` (weights) + `models/survival_scaler.pkl` (scaler + metadata).

Returns: `{val_mse, val_mae, epochs_trained, data_points_used}` — shown to user on onboarding.

## 6.5 Prediction with Monte Carlo Dropout

```python
torch.manual_seed(12345)
self.model.train()  # keeps dropout ACTIVE
mc_before, mc_after = [], []
for _ in range(20):  # 20 forward passes
    mc_before.append(model(before_tensor))
    mc_after.append(model(after_tensor))
model.eval()

model_before = mean(mc_before)   # point estimate
model_after  = mean(mc_after)
mc_std       = std(mc_after)     # uncertainty measure
```

**Why Monte Carlo Dropout?** Running the network 20 times with dropout active gives slightly different predictions each time. The mean is the best estimate; the std is a measure of uncertainty. If std > 3.0, the `confidence_band` is marked "wide" — meaning the prediction is unreliable.

## 6.6 Blending Neural + Mathematical

```python
days_before = 0.75 × math_before + 0.25 × model_before
days_after  = 0.75 × math_after  + 0.25 × model_after
```

**The cash-flow equation is the anchor** (75% weight):
```
survival = (balance - transaction - fixed_remaining) / daily_spend_rate
```

The neural network provides **shape** (it learns non-linear effects like category type and time of day) but cannot override the fundamental arithmetic. This prevents the ML model from producing nonsensical results like "spending ₹1000 increases your runway."

## 6.7 Variable Expense Filtering (`variable_expense_statement`)

Before computing daily spend rate, fixed expenses are stripped:
- Removes rows where category is `housing_rent:*` or `subscriptions:*`.
- Removes rows matching payee keywords: rent, emi, loan, netflix, spotify, insurance, electricity, water, gas.
- This prevents rent from inflating the "daily variable spend" estimate.

## 6.8 Mathematical Fallback (`predict_mathematical`)

When the neural model is not yet trained (first-time user before CSV upload):
```
survival = clip((balance - tx_amount - fixed_remaining) / daily_spend_rate, 0, 90)
```
This is always available and used as the 75% anchor even when the model IS trained.

---

# 7. Module C: Decision Coach (`modules/decision_coach.py`)

## 7.1 What It Is

A **forward-chaining rule engine** — a deterministic expert system that fires rules in priority order (salience) until one produces a decision.

**Why forward chaining?**
- Completely **transparent** — you can see exactly which rule fired.
- **Deterministic** — same inputs always give same output.
- **Auditable** — the `forward_chain` in the API response shows every rule and whether it matched.
- Appropriate for **regulatory compliance** — a bank or regulator can understand why a transaction was blocked.

## 7.2 Rule Engine Implementation

The engine implements an experta/pyknow-compatible API from scratch (to avoid Python 3.10+ compatibility issues with the original library).

**Core classes:**
- `Fact` — base class; all facts stored as object attributes.
- `FinancialState` — holds balance, daily_target, override_counts.
- `TransactionFact` — holds amount, category, regret_probability, impulse_flag, survival data.
- `OntologyResult` — holds necessity_score, flags, age_restricted, foreign_flag.
- `KnowledgeEngine` — the Rete-inspired engine; runs rules in salience order, stops at first decision.
- `_EngMeta` — metaclass that collects all `@Rule`-decorated methods at class definition time.

## 7.3 The Nine Rules (In Priority Order)

| Salience | Rule | Condition | Decision |
|---|---|---|---|
| 100 | R1 Insufficient Funds | `amount > balance` | AVOID |
| 98 | R1.2 Prohibited | flags include illegal/PMLA/corruption | AVOID |
| 95 | R1.5 Essential Guard | `necessity >= 0.85 AND regret < 0.35` | SPEND |
| 90 | R2 Critical Survival | `survival_after < 3 AND regret > 0.50` | AVOID |
| 85 | R3 Low Survival High Regret | `survival_after < 5 AND regret > 0.70` | AVOID |
| 80 | R4 Late Night Craving | `survival_after < 7 AND late_food AND late_night` | PAUSE |
| 75 | R5 Exceeds Daily Target | `amount > daily_target × 1.5` | PAUSE |
| 70 | R6 Late Night Impulse | `impulse_flag AND hour >= 22 or < 4` | PAUSE |
| 60 | R7 Foreign Transaction | `foreign_flag = True` | PAUSE |
| 58 | R7.5 Sensitive Category | flags include age_restricted/speculative | PAUSE |
| 50 | R8 Healthy Finances | `survival_before > 20 AND regret < 0.30` | SPEND |
| 10 | R9 Default | fallback | SPEND if survival_after > 10, else PAUSE |

**Example walkthrough — Midnight Swiggy order:**
- `payee = "Swiggy"`, `amount = 450`, `hour = 23`, `balance = 3500`, `survival_after = 5.2`
- Rule R1: 450 < 3500 → no match
- Rule R1.2: no illegal flags → no match
- Rule R1.5: necessity=0.30, regret=0.72 → necessity < 0.85, no match
- Rule R2: survival_after=5.2 > 3 → no match
- Rule R3: survival_after=5.2 > 5 → no match
- Rule R4: survival_after=5.2 < 7 ✓, category=food_delivery (late_food) ✓, hour=23 (late_night) ✓ → **PAUSE + commitment_device=True**
- Engine stops. Decision = PAUSE.

## 7.4 Override Softening (Learning Loop)

Each time a user overrides a PAUSE/AVOID (proceeds anyway), their `override_counts[category]` increments.

```python
softened = regret_probability × (0.90 ^ min(n_overrides, 3))
floor_val = regret_probability × 0.70
result = max(softened, floor_val)
```

After 3 overrides in a category, regret is reduced by up to 30% — the system learns you consistently make this category of purchase without regret.

## 7.5 Nudge Text Generator

Context-aware behavioral messages:
- **Distress detection:** If payee contains keywords like "desperate", "no money", "broke" → empathy-first response.
- **AVOID nudge:** Shows survival delta, regret percentage, opportunity cost.
- **PAUSE nudge:** Shows regret rate; if commitment device, adds "48-hour wait set."
- **SPEND nudge:** Positive affirmation with opportunity cost context.

## 7.6 Opportunity Cost Engine

Converts rupee amounts to relatable equivalents:
```python
meals      = amount / 120   # ₹120 = one meal estimate
work_hours = amount / 150   # ₹150 = one hour of work estimate
```
Returns strings like "3.5 meals" and "2.1 hours of work."

---

# 8. Module D: CSP Planner (`modules/csp_planner.py`)

## 8.1 What Is a CSP?

A **Constraint Satisfaction Problem** is a mathematical framework for finding values for variables that satisfy a set of hard constraints. The CSP solver uses **backtracking search** — it tries values, backtracks when constraints are violated, and finds a feasible solution.

## 8.2 Problem Formulation

**Variables:**
- `daily_food` — ₹ for food (domain: 0 to min(1000, budget), step ₹10)
- `daily_travel` — ₹ for travel (or locked to 0 for remote workers)
- `daily_discretionary` — ₹ for everything else

**Hard constraints:**
1. `food + travel + discretionary ≤ available_daily_budget`
2. `food + travel + discretionary ≥ available_daily_budget × 0.80` (use at least 80% of budget)
3. `food ≥ ₹80` (physiological minimum — you must eat)

**Activation condition:** Only shown when survival < 7 days OR risk_tier = "High Risk".

## 8.3 Crisis Mode

If `available_daily_budget < ₹80` (can't afford the food minimum), the CSP cannot find a solution. Returns a structured **crisis escalation plan** with 6 actionable steps:
1. Contact family/friends for emergency support.
2. Freeze all non-essential subscriptions.
3. List liquidatable assets.
4. Explore emergency gig work (Swiggy delivery, Dunzo).
5. Contact bank about overdraft/personal loan.
6. Check government schemes (PM-JAY, PMGKAY).
# VittArth AI — Comprehensive Technical Documentation
## Part 3: Frontend, Data Flow & Execution Lifecycle

---

# 9. Frontend Architecture

## 9.1 Technology Stack

| Technology | Version | Role |
|---|---|---|
| React | 19.x | UI component library |
| Vite | 8.x | Build tool + dev server |
| Tailwind CSS | v4 | Utility-first styling |
| React Router DOM | v7 | Client-side routing |
| Recharts | 3.x | Declarative chart components |
| Axios | 1.x | HTTP client |
| Lucide React | 1.x | SVG icon set |

## 9.2 Entry Points

### `frontend/index.html`
The single HTML file. Loads `src/main.jsx` as an ES module. Contains `<div id="root">`.

### `frontend/src/main.jsx`
```jsx
ReactDOM.createRoot(document.getElementById('root')).render(
  <SessionProvider>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </SessionProvider>
)
```
Wraps the entire app in `SessionProvider` (global state) and `BrowserRouter` (routing).

### `frontend/vite.config.js`
- Registers `@vitejs/plugin-react` and `@tailwindcss/vite`.
- Proxies all `/api/*` requests to `http://localhost:8001` (backend) in development.
- Supports `VITE_SKIP_HMR` and `VITE_API_TARGET` environment variables.

---

## 9.3 Global State: `SessionContext.jsx`

**Purpose:** React Context that holds the user's session state across all pages.

**State variables:**
- `sessionId` — the UUID from backend, persisted in `localStorage` as `fg_session`.
- `balance` — current account balance (updated after confirms).
- `riskTier` — "Safe" | "Medium Risk" | "High Risk".
- `isOnboarded` — whether user has completed onboarding.
- `survivalDays` — current runway estimate.
- `overrideCounts` — per-category override history.

**`useEffect`:** Syncs `sessionId` to `localStorage` on every change. On page reload, `useState` initializer reads from `localStorage` — so the session survives browser refreshes within the 2-hour server window.

**`useSession()` hook:** All pages and components consume state via this hook.

---

## 9.4 API Client: `src/api/client.js`

**Purpose:** Single-file abstraction over all backend API calls.

**Setup:**
```js
const api = axios.create({ baseURL: 'http://localhost:8000/api' })
```
(In dev, Vite proxies `/api` → backend:8001, so the actual base URL in dev doesn't matter.)

**Error handler:** Extracts `response.data.detail` or `.error` from API error responses and throws a unified Error object.

**Exported functions:**
| Function | HTTP Call | Purpose |
|---|---|---|
| `onboard(data)` | POST /onboard | Create session |
| `getDashboard(sid)` | GET /dashboard | Fetch analytics |
| `evaluateTransaction(data)` | POST /evaluate | AI decision |
| `confirmTransaction(data)` | POST /confirm | Commit spend |
| `ingestBankMessage(data)` | POST /ingest-bank-message | Parse SMS |
| `getCategories()` | GET /categories | Category list |
| `correctCategory(data)` | POST /correct-category | Override category |
| `getProfile(sid)` | GET /profile/:id | Fetch profile |
| `updateProfile(data)` | PUT /profile | Update profile |
| `uploadCSV(sessionId, file)` | POST /upload-csv | Train model |

**CSV Upload special handling:** Reads file with `FileReader.readAsDataURL()`, strips the `data:...;base64,` prefix, sends raw base64 string.

---

## 9.5 Routing: `App.jsx`

**Routes:**
- `/` → redirect to `/onboarding`
- `/onboarding` → `<Onboarding />` (no auth required)
- `/dashboard` → `<Protected><Dashboard /></Protected>`
- `/simulate` → `<Protected><TransactionSimulator /></Protected>`
- `/about` → `<Protected><About /></Protected>`

**`Protected` component:**
- Reads `sessionId` from context.
- If null: redirects to `/onboarding`.
- If present: renders `<Sidebar>` + `<RiskTierBanner>` + `<main>{children}</main>` layout.
- Adds animated background "orbs" (blurred radial gradient circles) as a design element.

---

# 10. Frontend Pages — Deep Analysis

## 10.1 `Onboarding.jsx` (567 lines)

**Purpose:** 2-step wizard that creates a session and trains the AI model.

### Step 1 — Financial Profile Form:
- Fields: Monthly Income, Rent/EMI, Subscriptions, Other Fixed Expenses, Daily Target, User Profile.
- **Live computation:** `totalFixed = rent + subscriptions + other_fixed`; `spendableBalance = income - totalFixed`.
- Spendable Balance auto-updates in real-time with a `useEffect` watching `spendableBalance`.
- Validation: Shows warning if `totalFixed > monthlyIncome`.
- Submit calls `onboard(data)` → receives `session_id` → stores in context + localStorage → advances to Step 2.

### Step 2 — Bank Statement Upload:
- **Drag-and-drop zone** with visual feedback (`dragging` state changes border color and background).
- Also supports click-to-upload via hidden `<input type="file">`.
- "Analyze" button calls `uploadCSV(sessionId, file)`:
  - File is base64-encoded in the browser.
  - Backend trains the SurvivalNet on your spending data.
- **CSV Result display:** Shows transaction count, top category, avg daily spend, fixed rows ignored, data quality.
- Shows sparse data warning if data_quality === "Sparse".
- "Go to Dashboard" sets `isOnboarded=true` and navigates.

### Intro Animation (`BouncingBallIntro`):
- Plays once before the form appears.
- A ₹ symbol ball drops from above and physically "squashes" each word ("WE", "MAKE", "SHIFT", "HAPPEN").
- Uses CSS transitions for ball position + `scaleX`/`scaleY` transforms for squash-and-stretch physics.
- After all words, ball rolls off screen right, panel fades out.
- Implemented with an async sequence using `setTimeout` promises, cancelled via cleanup function.

---

## 10.2 `Dashboard.jsx` (254 lines)

**Purpose:** Analytics overview of spending health.

### Data Loading:
- On mount: calls `getDashboard(sessionId)`.
- Updates global context: `setBalance`, `setRiskTier`, `setSurvivalDays`.
- If session not found (404): clears localStorage and redirects to onboarding.

### Visual Features:
- **Progress Bar:** Thin horizontal bar at top tracks scroll position (0–100% of page height).
- **Scroll Reveal:** `IntersectionObserver` adds `.visible` class to `.reveal` elements as they enter viewport — triggers CSS fade-in animations.
- **Marquee Strip:** Horizontally scrolling text band ("AI-Powered Decisions ✦ Track Every Rupee...").
- **Floating SVGs:** Decorative ₹ coin, shield, upward-arrow SVGs that float with CSS animation.

### Metric Cards (4 across):
1. **Current Balance** — raw ₹ value.
2. **Survival Days** — with trend arrow (↑ Safe / ⚠ Watch / ↓ Critical based on 14/7 thresholds).
3. **Daily Spend Rate** — vs daily_target (shows "Over target" / "On target").
4. **Days Until Month End** — calendar countdown.

### Charts (using Recharts):
1. **`SpendingBarChart`** — bar chart of daily spend for last 30 days; red reference line for daily_target.
2. **`CategoryPieChart`** — pie chart of category spend breakdown with regret_prob color coding.
3. **`MovingAverageChart`** — line chart overlaying raw daily spend + 7-day moving average.
4. **`CategoryRegretTable`** — sortable table: category, transaction count, avg amount, regret probability, override count.

---

## 10.3 `TransactionSimulator.jsx` (345 lines)

**Purpose:** The main user interaction — evaluate a transaction before spending.

### Two Modes:
1. **Analysis Mode** — Manual form entry (amount, payee, date, hour).
2. **Message Mode** — Paste raw bank SMS for auto-parse + immediate record.

### Analysis Mode Flow:
1. User fills `TransactionForm` → calls `handleEvaluate(form)`.
2. `evaluateTransaction(data)` → API → returns decision + nudge + survival data.
3. `DecisionCard` renders: color-coded SPEND/PAUSE/AVOID badge, nudge text, survival before/after gauge, forward chain table.
4. User can "Proceed" or "Cancel":
   - Proceed on AVOID: shows `confirmModal` ("Are you sure?") before committing.
   - Confirm proceed: calls `confirmTransaction({action: "proceed"})` → updates balance + survival in context.
   - Cancel: calls `confirmTransaction({action: "cancel"})` → removes from pending.

### Message Mode Flow:
1. User pastes bank SMS into textarea.
2. `handleMessageIngest(message)` → `ingestBankMessage(data)` → backend parses SMS + runs full AI pipeline + **auto-records** the transaction.
3. Updates balance and survival in context immediately.
4. Shows toast notification ("Recorded Swiggy · ₹350") for 2.4 seconds.
5. `CategoryCorrection` component shown — user can override the auto-classified category.

### Category Correction:
- `handleCategoryUpdate(newCategory)` → calls `correctCategory(data)`.
- Re-runs AI pipeline with corrected category.
- Updates `result` state so `DecisionCard` re-renders with new decision.

---

## 10.4 `EmergencyPlanner.jsx` (104 lines)

**Purpose:** CSP-driven emergency budget allocation.

### Load Logic:
- Calls `getEmergencyBudget(sessionId)` on mount.
- If `data.active === false`: shows "You're Safe" empty state with survival_days.
- If `data.status === "crisis"`: shows red crisis mode header + `CrisisChecklist` with 6 actions.
- If `data.status === "feasible"`: shows budget breakdown.

### Budget Display:
- **`BudgetDonutChart`** — donut chart: food (green), travel (blue), discretionary (amber).
- 3 metric rows: Food/Travel/Discretionary with daily amount and % of total budget.
- Bottom banner: "Following this plan extends your runway to X days."

---

## 10.5 `About.jsx`

**Purpose:** Explains the four AI modules to users in plain language with visual cards.
Contains static content with animated cards describing: Ontology Engine, Bayesian Model, Neural Survival Engine, CSP Planner.

---

# 11. Complete Execution Flow

## 11.1 System Startup

### Backend:
```
python api/run.py
  → sys.path setup
  → uvicorn.run("api.main:app", port=8001)
  → FastAPI lifespan starts
  → asyncio task: _expire_sessions() launched
  → ontology_engine.py MODULE LEVEL executes:
      _load_ontology_json()        # reads ontology_flags.json
      _build_ontology_index()      # builds all 7 index structures
      CATEGORY_META, REGRET_PRIORS, VENDOR_MAP populated
  → All 5 routers registered
  → Static file serving configured
  → Server ready at 127.0.0.1:8001
```

### Frontend:
```
npm run dev
  → Vite reads vite.config.js
  → Plugin chain: React + Tailwind CSS v4
  → Bundling starts; dependencies pre-optimized
  → Dev server at localhost:5173
  → Proxy rule: /api/* → http://localhost:8001
  → Browser opens
  → main.jsx: SessionProvider + BrowserRouter + App mount
  → SessionContext: reads localStorage for fg_session
  → App.jsx: Routes rendered
  → / → redirect to /onboarding
  → Onboarding.jsx renders
  → BouncingBallIntro plays
```

## 11.2 End-to-End Transaction Request Lifecycle

```
User types: payee="Zomato", amount=450, date=today, hour=22
    │
    ▼
TransactionSimulator.handleEvaluate(form)
    │
    ▼
api/client.js: evaluateTransaction({session_id, amount=450, payee="Zomato", date, hour=22})
    │  POST /api/evaluate
    ▼
api/routes/transaction.py: evaluate()
    ├── get_session(session_id) → session dict
    ├── amount > balance? → no
    ├── _sanitize("Zomato") → "Zomato"
    ├── datetime.strptime(date).replace(hour=22)
    │
    ├── OntologyEngine.classify_vendor("Zomato", ts, amount=450)
    │     ├── match_category_mapping("Zomato") → check category_mappings.json → miss
    │     ├── normalize_text("Zomato") → "zomato"
    │     ├── Score all OntologyEntries:
    │     │     "zomato" → OntologyEntry(term="zomato", category="food_and_dining:food_delivery", weight=4.2)
    │     │     phrase match → base=0.86 + source_boost + time_boost(late night) = ~0.92
    │     ├── BayesianRegret.mean() for food_delivery → 0.72 (prior)
    │     ├── time_factor = 1.22 (hour=22, food_delivery)
    │     ├── amount_factor = 0.98 (₹450, not very high)
    │     ├── regret = 0.72 × 1.22 × 0.98 = 0.86
    │     └── Returns: {category: "food_and_dining:food_delivery",
    │                   regret_probability: 0.86, necessity_score: 0.30,
    │                   impulse_flag: True, late_night_flag: True}
    │
    ├── SurvivalEngine.predict(balance, 450, df, "food_and_dining:food_delivery", 22)
    │     ├── prepare_features(balance, 0, df, ...) → f_before
    │     ├── prepare_features(balance, 450, df, ...) → f_after
    │     ├── scaler.transform(f_before), scaler.transform(f_after)
    │     ├── 20 MC dropout passes each → mean_before, mean_after, std
    │     ├── math_before = (balance - 0) / daily_rate
    │     ├── math_after  = (balance - 450) / daily_rate
    │     ├── days_before = 0.75×math_before + 0.25×mean_before
    │     ├── days_after  = 0.75×math_after  + 0.25×mean_after
    │     └── Returns: {survival_days_before: 8.5, survival_days_after: 7.1, delta: 1.4}
    │
    ├── evaluate_transaction(balance, 450, daily_target, ont, surv, overrides, days, 22)
    │     ├── apply_override_softening("food_and_dining:food_delivery", {}, 0.86) → 0.86
    │     ├── VittArthCoach.reset()
    │     ├── coach.declare(FinancialState(balance, daily_target, ...))
    │     ├── coach.declare(TransactionFact(amount=450, survival_after=7.1, late_night=True, ...))
    │     ├── coach.declare(OntologyResult(necessity=0.30, flags=[...]))
    │     ├── coach.run():
    │     │     R1: 450 < balance → skip
    │     │     R1.2: no illegal flags → skip
    │     │     R1.5: necessity=0.30 < 0.85 → skip
    │     │     R2: survival_after=7.1 > 3 → skip
    │     │     R3: survival_after=7.1 > 5 → skip
    │     │     R4: survival=7.1 < 7? NO → skip  [just barely passes]
    │     │     R5: 450 > daily_target×1.5? depends on target
    │     │     R6: impulse_flag=True AND hour=22 ≥ 22 → MATCH → PAUSE + commitment_device=True
    │     └── Returns: DecisionResult(decision=PAUSE, reason="Late-night impulse purchase",
    │                  nudge_text="Late-night purchases regretted 86% of the time. A 48-hour wait has been set.",
    │                  commitment_device=True, forward_chain={...all 12 rules with status})
    │
    ├── Generate UUID transaction_id
    ├── Store in session["pending_transactions"]
    └── Return EvaluationResponse → JSON
         │
         ▼
api/client.js returns response.data
    │
    ▼
TransactionSimulator: setResult(r)
    │
    ▼
DecisionCard renders:
  - Orange "PAUSE" badge
  - Nudge: "Late-night purchases regretted 86%..."
  - Survival: Before 8.5 days → After 7.1 days (delta -1.4)
  - Forward chain accordion: 12 rules, R6 highlighted as "fired"
  - "Proceed" and "Cancel" buttons
```

---

# 12. Data Flow Summary

## 12.1 Where Data Originates
- **User input:** Onboarding form (income, expenses, target).
- **Bank statement CSV:** Historical transactions (Date, Amount, Payee, Type).
- **Bank SMS:** Real-time transaction notifications pasted by user.
- **Manual entry:** Transaction simulator form (amount, payee, date, hour).

## 12.2 How Data Moves Through the System

```
User Input
   → Frontend form → validation → api/client.js → POST request
   → FastAPI route handler → Pydantic validation → session fetch
   → AI module pipeline (Ontology → Survival → DecisionCoach)
   → Session update (balance, risk, transactions)
   → JSON response → api/client.js → React state update
   → Re-render with new data
```

## 12.3 State Management

**Server-side state (Python dicts):**
- Full session data including ML model instances (OntologyEngine, SurvivalEngine).
- The trained PyTorch model lives as an object attribute in memory per session.
- DataFrames with all transactions (raw + annotated with category).

**Client-side state (React + localStorage):**
- `sessionId` — bridge between browser and server session.
- `balance`, `riskTier`, `survivalDays` — cached from last dashboard/confirm call.
- `isOnboarded` — controls routing guard.

**Persistence (disk):**
- `models/survival_model.pt` — most recently trained SurvivalNet weights.
- `models/survival_scaler.pkl` — scaler + training metadata.
- `data/category_mappings.json` — user category corrections (grows over time).

---

# 13. Architectural Justifications

## Why Ontology over Deep Learning for classification?
- **Low data:** Users may upload only 20–50 transactions. Deep learning needs thousands.
- **Explainability:** Every classification shows which keyword matched. Regulators and users can audit.
- **Speed:** No GPU needed; index lookup is microseconds.
- **Domain encoding:** Flags like `PMLA_trigger`, `illegal`, `age_restricted` encode compliance directly.

## Why Bayesian Regret instead of a trained classifier?
- **Prior knowledge:** We know food delivery has high regret probability from behavioral research.
- **Incremental learning:** Bayesian update is O(1) — no retraining needed.
- **No training data required:** Works from day 1 with zero user history.
- **Uncertainty-aware:** The Beta distribution captures uncertainty, not just a point estimate.

## Why Forward Chaining for decisions?
- **Auditability:** The `forward_chain` in every response shows exactly which rule fired.
- **Priority control:** Higher-salience rules override lower ones deterministically.
- **Domain expert input:** Business rules (must have ≥ ₹80/day food) are readable by non-engineers.
- **Debuggability:** Every rule is a named method; failures are trivial to trace.

## Why PyTorch for survival prediction?
- **Non-linear relationships:** Neural nets capture interactions between balance, category, volatility, time.
- **Monte Carlo Dropout:** Built-in uncertainty quantification without separate architecture.
- **Transfer learning ready:** Model weights can be fine-tuned with new data.
- **Flexibility:** Feature engineering (6 input features) is easily extendable.

## Why CSP for emergency budgeting?
- **Hard constraints:** The food minimum (₹80) is a hard physiological constraint, not a preference. CSP is designed for hard constraints.
- **Discrete domains:** Budget amounts are in ₹10 steps — finite, discrete, perfect for backtracking.
- **Feasibility detection:** The CSP either finds a solution or proves none exists — triggering crisis mode.

## Why in-memory sessions instead of a database?
- **Simplicity:** No database setup, migration, or ORM needed.
- **ML model storage:** Storing a PyTorch model object in a database is impractical.
- **Prototype-appropriate:** For a demo/MVP, RAM is sufficient.
- **Tradeoff:** Sessions are lost on server restart; no persistence across restarts.

## Why FastAPI?
- **Async support:** All route handlers are `async def`, supporting concurrent requests.
- **Pydantic integration:** Request/response validation is automatic.
- **Auto-documentation:** `/docs` endpoint gives Swagger UI for free.
- **Performance:** Comparable to Node.js; far faster than Flask.

## Why React + Vite?
- **Vite:** Near-instant HMR (hot module replacement) during development.
- **React 19:** Concurrent features, hook-based state management.
- **Ecosystem:** Recharts for charts, Lucide for icons — mature, maintained libraries.

---

# 14. Known Limitations & Missing Features

| Issue | Description |
|---|---|
| No persistence | Server restart loses all sessions and trained models |
| No authentication | Any client can create sessions; no user accounts |
| Single user per session | Sessions are not shared; no multi-device sync |
| Synthetic training data | SurvivalNet trains on generated data, not pure real historical data |
| No real-time data | No bank API integration; user must paste SMS manually |
| `/api/correct-category` was previously 404 | Was a missing endpoint; now implemented |
| Sparse data fallback | < 30 transactions → data_quality = "sparse" → Bayesian priors dominate |
| No model versioning | If ontology_flags.json changes, saved model may mismatch |
| Session memory leak risk | Very active users with large CSVs accumulate large DataFrames in RAM |
