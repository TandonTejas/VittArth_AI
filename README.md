# VittArth AI

An intelligent personal finance guardian powered by ontology-based reasoning, expert systems, and PyTorch survival analysis — with a full-stack FastAPI + React frontend.

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| AI Modules | Python (JSON-backed ontology, custom rule engine, PyTorch) |
| Backend API | FastAPI + Uvicorn |
| Frontend | React 19 + Vite + Recharts + Tailwind CSS |

---

## 🧠 AI Modules

| Module | Algorithm | Description |
|---|---|---|
| `ontology_engine.py` | JSON Ontology + Bayesian Priors | Classifies vendor/payee into financial categories with regret probability |
| `decision_coach.py` | Custom forward-chaining rules | Rule-based expert system that issues SPEND / PAUSE / AVOID decisions |
| `survival_engine.py` | PyTorch MLP | Predicts financial survival days (cash-flow runway) |

---

## ⚙️ Setup

### 1. Clone the repository

```bash
git clone https://github.com/TandonTejas/VittArth_AI.git
cd VittArth_AI
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

---

## ▶️ Running the Application

Open **two terminals**:

**Terminal 1 — Backend:**
```bash
python api/run.py
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📁 Project Structure

```
VittArth_AI/
├── api/                        # FastAPI backend
│   ├── main.py                 # App entry point, CORS, middleware
│   ├── routes/
│   │   ├── onboarding.py       # POST /api/onboard, POST /api/upload-csv
│   │   ├── dashboard.py        # GET  /api/dashboard
│   │   ├── transaction.py      # POST /api/evaluate, POST /api/confirm
│   │   └── health.py           # GET  /api/health
│   ├── models/schemas.py       # Pydantic request/response models
│   └── state/session_store.py  # In-memory session store (asyncio.Lock)
│
├── modules/                    # Core AI modules
│   ├── ontology_engine.py      # Vendor classification + regret scoring
│   ├── decision_coach.py       # Custom rule engine → SPEND/PAUSE/AVOID
│   └── survival_engine.py      # PyTorch cash-flow survival predictor
│
├── frontend/                   # React + Vite frontend
│   ├── src/
│   │   ├── api/client.js       # Axios + fetch API client
│   │   ├── context/            # SessionContext (global state)
│   │   ├── pages/              # Onboarding, Dashboard, TransactionSimulator, About
│   │   └── components/         # MetricCard, DecisionCard, Charts, Sidebar…
│
├── data/
│   └── category_mappings.json  # Learned user category overrides
└── requirements.txt
```

---

## Requirements

- Python 3.10+
- Node.js 18+
- See `requirements.txt` and `frontend/package.json` for full dependency lists
