from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
from database import get_db

router = APIRouter(prefix="/api/v1/challans", tags=["Challans"])

class ChallanCreate(BaseModel):
    id: str
    data: Dict[Any, Any]
    source: Optional[str] = "manual"
    previewImageBase64: Optional[str] = None
    savedAt: str

class ChallanUpdate(BaseModel):
    data: Dict[Any, Any]
    source: Optional[str] = None
    previewImageBase64: Optional[str] = None
    savedAt: str

@router.get("/")
def get_challans():
    """Fetch all saved challans from SQLite."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM challans ORDER BY saved_at DESC")
        rows = cursor.fetchall()
        
        result = []
        for row in rows:
            result.append({
                "id": row["id"],
                "data": json.loads(row["data"]),
                "source": row["source"],
                "previewImageBase64": row["preview_image_base64"],
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
