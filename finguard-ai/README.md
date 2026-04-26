# FinGuard AI

An intelligent personal finance guardian powered by ontology-based reasoning, expert systems, PyTorch survival analysis, and constraint satisfaction planning — with a full-stack FastAPI + React frontend.

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| AI Modules | Python (OWL Ontology, Experta Rete, PyTorch, python-constraint) |
| Backend API | FastAPI + Uvicorn |
| Frontend | React 18 + Vite + Recharts + Tailwind CSS |
| Unit Tests | pytest + FastAPI TestClient (26 tests) |
| E2E Tests | Playwright (5 tests, Chromium) |

---

## 🧠 AI Modules

| Module | Algorithm | Description |
|---|---|---|
| `ontology_engine.py` | OWL Ontology + Bayesian Priors | Classifies vendor/payee into financial categories with regret probability |
| `decision_coach.py` | Experta (Rete forward-chaining) | Rule-based expert system that issues SPEND / PAUSE / AVOID decisions |
| `survival_engine.py` | PyTorch MLP + Synthetic Data | Predicts financial survival days (cash-flow runway) |
| `csp_planner.py` | python-constraint CSP solver | Generates an optimal emergency daily budget given hard constraints |

---

## ⚙️ Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd finguard-ai
```

### 2. Backend — Python environment

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 3. Frontend — Node environment

```bash
cd frontend
npm install
cd ..
```

### 4. Install Playwright browsers

```bash
cd frontend
npx playwright install chromium
cd ..
```

---

## ▶️ Running the Application

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Running Tests

### Backend unit + integration tests (26 tests)
```bash
pytest tests/test_api.py -v
```

### Playwright E2E tests (5 tests — requires both servers running via Playwright webServer)
```bash
cd frontend
npx playwright test tests/e2e.spec.js
```

---

## 📁 Project Structure

```
finguard-ai/
├── api/                        # FastAPI backend
│   ├── main.py                 # App entry point, CORS, middleware
│   ├── routes/
│   │   ├── onboarding.py       # POST /api/onboard, POST /api/upload-csv
│   │   ├── dashboard.py        # GET  /api/dashboard
│   │   ├── transaction.py      # POST /api/evaluate, POST /api/confirm
│   │   ├── planner.py          # GET  /api/emergency-budget
│   │   └── health.py           # GET  /api/health
│   ├── models/schemas.py       # Pydantic request/response models
│   └── state/session_store.py  # In-memory session store (asyncio.Lock)
│
├── modules/                    # Core AI modules
│   ├── ontology_engine.py      # Vendor classification + regret scoring
│   ├── decision_coach.py       # Experta rule engine → SPEND/PAUSE/AVOID
│   ├── survival_engine.py      # PyTorch cash-flow survival predictor
│   └── csp_planner.py          # CSP emergency budget solver
│
├── frontend/                   # React + Vite frontend
│   ├── src/
│   │   ├── api/client.js       # Axios + fetch API client
│   │   ├── context/            # SessionContext (global state)
│   │   ├── pages/              # Onboarding, Dashboard, TransactionSimulator,
│   │   │                       # EmergencyPlanner, About
│   │   └── components/         # MetricCard, DecisionCard, Charts, Sidebar…
│   ├── tests/e2e.spec.js       # Playwright E2E suite
│   └── playwright.config.js
│
├── tests/
│   ├── test_api.py             # 26 FastAPI integration tests
│   └── test_survival.py        # PyTorch model unit tests
│
├── data/
│   └── sample_transactions.csv # Sample bank statement for testing
└── requirements.txt
```

---

## Requirements

- Python 3.10+
- Node.js 18+
- See `requirements.txt` and `frontend/package.json` for full dependency lists


