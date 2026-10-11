# PromptShield

PromptShield is a React app built with Vite.

## Run locally

```sh
npm install
npm run dev
```

## Deploy to GitHub Pages

The GitHub Actions workflow builds and deploys the app to
`https://apurvakathale1-alt.github.io/prompt_shield/` whenever changes are pushed
to the `main` branch. You can also start a deployment manually from the
repository's **Actions** tab using **Deploy to GitHub Pages**.

The repository must have GitHub Pages enabled with **GitHub Actions** as its
build and deployment source.

## AI Chat backend

The AI Chat page uses a FastAPI backend hosted separately from GitHub Pages.
To deploy it, connect this repository to Render and select **New > Blueprint**;
Render reads the root `render.yaml` and creates the `promptshield-api` service.
Set `GEMINI_API_KEY` in the Render service's environment settings. Never put the
real key in frontend code or commit it to the repository. The backend can be
run locally with `uvicorn main:app --reload --port 8000` from `backend/` after
installing `backend/requirements.txt` and copying `.env.example` to `.env`.
After the initial Render setup, pushes to `main` automatically update both the
Pages frontend and the Render backend.

The Pages build uses `https://promptshield-api.onrender.com` by default. If
Render assigns a different URL, set the GitHub Actions repository variable
`VITE_CHAT_API_URL` to that backend URL and redeploy the Pages workflow. The
backend allows the published GitHub Pages origin and local Vite development
origins on ports 5173, 4173, and 5175 by default. On Render's free plan, the
service may take a short time to wake after inactivity.

### Run the backend locally on Windows

From PowerShell, run:

```powershell
Set-Location C:\Users\Apurva\Desktop\PromptShield\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
notepad .env
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

In `.env`, replace the `GEMINI_API_KEY` example value with the key from Google
AI Studio, keep `GEMINI_MODEL=gemini-3.8-flash`, save the file, and keep the
backend terminal running. Then open
`http://localhost:8000/health`; `gemini_configured` should be `true`. The
`.env` file is ignored by Git. If the frontend is running on `localhost:5175`,
that origin is already included in the local and Render CORS configuration.
