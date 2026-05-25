from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from jose import jwt
from datetime import datetime, timedelta
import json, os, hashlib

router = APIRouter()

SECRET_KEY = "voltarisos-secret-2026"
ALGORITHM = "HS256"
USERS_FILE = "users.json"

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    company: str
    color: str = "#4ade80"

def hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def load_users():
    if not os.path.exists(USERS_FILE):
        return []
    with open(USERS_FILE) as f:
        return json.load(f)

def save_users(users):
    with open(USERS_FILE, "w") as f:
        json.dump(users, f, indent=2)

def create_token(data: dict):
    expire = datetime.utcnow() + timedelta(hours=24)
    data.update({"exp": expire})
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)

@router.post("/auth/register")
def register(req: RegisterRequest):
    users = load_users()
    if any(u["email"] == req.email for u in users):
        raise HTTPException(400, "Email já registado")
    user = {
        "id": len(users) + 1,
        "email": req.email,
        "password": hash_pw(req.password),
        "company": req.company,
        "color": req.color,
        "role": "installer"
    }
    users.append(user)
    save_users(users)
    return {"message": "Conta criada"}

@router.post("/auth/login")
def login(req: LoginRequest):
    users = load_users()
    user = next((u for u in users if u["email"] == req.email), None)
    if not user or user["password"] != hash_pw(req.password):
        raise HTTPException(401, "Credenciais inválidas")
    token = create_token({"sub": user["email"], "company": user["company"], "color": user["color"]})
    return {"token": token, "company": user["company"], "color": user["color"]}