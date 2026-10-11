import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from google import genai
from google.genai.errors import APIError
from pydantic import BaseModel, Field

from security import analyze_prompt


load_dotenv()

DEFAULT_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4173",
    "https://apurvakathale1-alt.github.io",
]
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", ",".join(DEFAULT_ORIGINS)).split(",")
    if origin.strip()
]
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

app = FastAPI(title="PromptShield API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)


class RemovedItem(BaseModel):
    type: str
    value: str


class ChatResponse(BaseModel):
    allowed: bool
    sanitized: bool
    response: str
    reason: str = ""
    removed: list[RemovedItem] = Field(default_factory=list)


@app.get("/")
@app.get("/health")
def health():
    return {
        "status": "PromptShield Backend Running",
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
    }


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="Message cannot be empty.")

    analysis = analyze_prompt(message)
    if analysis["threats"]:
        threat_names = ", ".join(item["type"] for item in analysis["threats"])
        return ChatResponse(
            allowed=False,
            sanitized=False,
            response="⛔ PromptShield blocked this message. It was not sent to AI.",
            reason=threat_names,
            removed=analysis["threats"],
        )

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="AI chat is not configured. Set GEMINI_API_KEY on the backend host.",
        )

    try:
        client = genai.Client(api_key=api_key)
        result = await client.aio.models.generate_content(
            model=MODEL_NAME,
            contents=analysis["clean"],
        )
    except APIError as error:
        raise HTTPException(
            status_code=502,
            detail="The AI provider could not complete this request. Please try again.",
        ) from error

    if not result.text:
        raise HTTPException(
            status_code=502,
            detail="The AI provider returned an empty response. Please try again.",
        )

    return ChatResponse(
        allowed=True,
        sanitized=bool(analysis["removed"]),
        response=result.text,
        reason="Personal information was redacted before sending." if analysis["removed"] else "",
        removed=analysis["removed"],
    )
