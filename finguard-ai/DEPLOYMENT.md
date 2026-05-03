# 🚀 Deployment Guide: FinGuard AI

This document provides step-by-step instructions for deploying the FinGuard AI project using **Railway** (Backend/Unified) and **Render** (Frontend).

---

## 🛠 Prerequisites

1.  **GitHub Repository**: Ensure your project is pushed to a GitHub repository.
2.  **Accounts**: Create accounts on [Railway.app](https://railway.app/) and [Render.com](https://render.com/).
3.  **Project Structure**:
    ```text
    / (Project Root)
    ├── api/                # FastAPI Backend
    ├── frontend/           # Vite/React Frontend
    ├── modules/            # Core AI Logic
    └── requirements.txt    # Python Dependencies
    ```

---

## 🚄 Option 1: Unified Deployment (Railway)
*Recommended for simplicity. The backend will serve the built frontend.*

### 1. Prepare the project
Ensure `requirements.txt` is in the root directory (one level above `api/`).

### 2. Configure Railway
1.  Go to [Railway.app](https://railway.app/) and click **New Project** > **Deploy from GitHub repo**.
2.  Select your repository.
3.  **CRITICAL**: Go to **Settings** > **General** > **Root Directory** and set it to `finguard-ai`.
4.  **Automatic Detection (Railpack)**: I have added a `railpack.json` file. Railway's builder specifically requires this to detect that you need **both** Node.js (for the frontend) and Python (for the backend).
5.  **Variables**: Ensure these are set in the **Variables** tab:
    *   `PORT`: `8000`
    *   `FG_API_HOST`: `0.0.0.0`
    *   `FG_API_PORT`: `8000`

> [!TIP]
> The `railpack.json` file forces the builder to provide both `python` and `node` providers, even though your `package.json` is tucked away in the `frontend` folder.

### 3. Verify
Railway will provide a URL (e.g., `https://finguard-production.up.railway.app`). Since the backend is configured to serve static files from `frontend/dist`, visiting this URL will load the app.

---

## 🏗 Option 2: Split Deployment (Railway Backend + Render Frontend)
*Best for performance and scaling.*

### Part A: Backend (Railway)
1.  Deploy the project to Railway.
2.  **Build Command**: `pip install -r requirements.txt`
3.  **Start Command**: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`
4.  Copy your Railway deployment URL.

### Part B: Frontend (Render)
1.  Go to [Render.com](https://render.com/) and click **New +** > **Static Site**.
2.  Connect your GitHub repo.
3.  Configure the build settings:
    *   **Root Directory**: `frontend`
    *   **Build Command**: `npm install && npm run build`
    *   **Publish Directory**: `dist`
4.  Add **Environment Variables**:
    *   `VITE_API_BASE`: `https://your-railway-url.up.railway.app/api`
5.  Click **Create Static Site**.

---

## 🔒 Security & CORS Configuration

If you use **Option 2**, you MUST update `api/main.py` to allow the Render URL in CORS:

```python
# In api/main.py
app.add_middleware(CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://your-frontend-url.onrender.com", # Add your Render URL here
    ],
    ...
)
```

---

## 📋 Post-Deployment Checklist

*   [ ] Verify the `/api/health` endpoint is reachable.
*   [ ] Check the Browser Console for any CORS errors.
*   [ ] Ensure all AI modules (`modules/`) are correctly imported.
*   [ ] Confirm the `data/` and `models/` directories exist (if they contain large files, consider using Git LFS).
