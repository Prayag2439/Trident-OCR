from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Union
import json
from database import get_db

router = APIRouter(prefix="/api/v1/challans", tags=["Challans"])

class ChallanCreate(BaseModel):
    id: str
    data: Dict[Any, Any]
    source: Optional[str] = "manual"
    previewImageBase64: Optional[str] = None
    userId: Optional[Union[str, int]] = "admin@optimo.com"
    creatorName: Optional[str] = "Admin"
    role: Optional[str] = "admin"
    savedAt: str

class ChallanUpdate(BaseModel):
    data: Dict[Any, Any]
    source: Optional[str] = None
    previewImageBase64: Optional[str] = None
    savedAt: str

@router.get("/")
def get_challans(user_id: Optional[str] = None, role: Optional[str] = "admin"):
    """Fetch saved challans from SQLite filtered by role/user_id."""
    with get_db() as conn:
        cursor = conn.cursor()
        if role == "admin" or not user_id:
            cursor.execute("SELECT * FROM challans ORDER BY saved_at DESC")
        else:
            cursor.execute("SELECT * FROM challans WHERE user_id = ? ORDER BY saved_at DESC", (user_id,))
        rows = cursor.fetchall()
        
        result = []
        for row in rows:
            creator = ""
            try:
                creator = row["creator_name"]
            except Exception:
                creator = ""
            if not creator:
                try:
                    creator = row["user_id"]
                except Exception:
                    creator = ""
            if not creator:
                creator = "Admin"

            result.append({
                "id": row["id"],
                "data": json.loads(row["data"]),
                "source": row["source"] or "manual",
                "previewImageBase64": row["preview_image_base64"],
                "userId": row["user_id"] if "user_id" in row.keys() else "admin@optimo.com",
                "creatorName": creator,
                "role": row["role"] if "role" in row.keys() else "admin",
                "savedAt": row["saved_at"]
            })
        return result

@router.post("/")
def create_challan(challan: ChallanCreate):
    """Create a new challan in SQLite."""
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO challans (id, data, source, preview_image_base64, user_id, creator_name, role, saved_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    challan.id,
                    json.dumps(challan.data),
                    challan.source or "manual",
                    challan.previewImageBase64,
                    challan.userId or "admin@optimo.com",
                    challan.creatorName or "Admin",
                    challan.role or "admin",
                    challan.savedAt
                )
            )
            conn.commit()
            return {"success": True, "id": challan.id}
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=str(e))

@router.put("/{challan_id}")
def update_challan(challan_id: str, challan: ChallanUpdate):
    """Update an existing challan in SQLite."""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Build update query dynamically based on provided fields
        fields = ["data = ?", "saved_at = ?"]
        values = [json.dumps(challan.data), challan.savedAt]
        
        if challan.source is not None:
            fields.append("source = ?")
            values.append(challan.source)
            
        if challan.previewImageBase64 is not None:
            fields.append("preview_image_base64 = ?")
            values.append(challan.previewImageBase64)
            
        values.append(challan_id)
        
        try:
            cursor.execute(
                f"""
                UPDATE challans
                SET {", ".join(fields)}
                WHERE id = ?
                """,
                tuple(values)
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Challan not found")
            conn.commit()
            return {"success": True}
        except HTTPException:
            raise
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{challan_id}")
def delete_challan(challan_id: str):
    """Delete a challan from SQLite."""
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("DELETE FROM challans WHERE id = ?", (challan_id,))
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Challan not found")
            conn.commit()
            return {"success": True}
        except HTTPException:
            raise
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=str(e))

@router.post("/migrate")
def migrate_challans(challans: List[ChallanCreate]):
    """Batch insert legacy localStorage challans into SQLite."""
    inserted = 0
    with get_db() as conn:
        cursor = conn.cursor()
        try:
            for challan in challans:
                # Check if exists to prevent duplicates
                cursor.execute("SELECT id FROM challans WHERE id = ?", (challan.id,))
                if cursor.fetchone():
                    continue
                    
                cursor.execute(
                    """
                    INSERT INTO challans (id, data, source, preview_image_base64, saved_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        challan.id,
                        json.dumps(challan.data),
                        challan.source,
                        challan.previewImageBase64,
                        challan.savedAt
                    )
                )
                inserted += 1
            conn.commit()
            return {"success": True, "inserted": inserted}
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=str(e))
