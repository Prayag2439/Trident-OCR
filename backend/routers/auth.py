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
        cursor.execute("SELECT id, email, password, name, role FROM users WHERE email = ?", (req.email,))
        user = cursor.fetchone()
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid credentials")
            
        if user["password"] != req.password:
            raise HTTPException(status_code=401, detail="Invalid credentials")
            
        user_name = user["name"] if "name" in user.keys() and user["name"] else user["email"].split("@")[0].capitalize()
        user_role = user["role"] if "role" in user.keys() and user["role"] else ("admin" if user["email"] == "admin@optimo.com" else "employee")

        return {
            "token": "trident-auth-valid-token-optimo-2026",
            "user": {
                "id": str(user["id"]),
                "email": user["email"],
                "name": user_name,
                "role": user_role
            }
        }
