from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from database import get_db

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/login")
def login(req: LoginRequest):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, email, password FROM users WHERE email = ?", (req.email,))
        user = cursor.fetchone()
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
            
        if user["password"] != req.password:
            raise HTTPException(status_code=401, detail="Invalid credentials")
            
        # Hardcoded token for simplicity as requested, in a real app this would be a JWT
        return {"token": "trident-auth-valid-token-optimo-2026"}
