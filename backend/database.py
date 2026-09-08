import sqlite3
import json
import os
from contextlib import contextmanager

DB_FILE = os.getenv("DB_FILE", "/app/data/challans.db")

def add_column_if_not_exists(cursor, table: str, column: str, col_type: str):
    cursor.execute(f"PRAGMA table_info({table})")
    cols = [r[1] for r in cursor.fetchall()]
    if column not in cols:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")

def init_db():
    """Initializes the database schema if it doesn't exist."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS challans (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                source TEXT,
                preview_image_base64 TEXT,
                user_id TEXT,
                creator_name TEXT,
                role TEXT DEFAULT 'admin',
                saved_at TEXT NOT NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                name TEXT,
                role TEXT NOT NULL DEFAULT 'employee'
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS canvas_challans (
                id TEXT PRIMARY KEY,
                challan_no TEXT,
                date TEXT,
                your_order_no TEXT,
                order_date TEXT,
                party_name TEXT,
                address TEXT,
                gstin TEXT,
                items TEXT,
                customer_signature TEXT,
                authorised_signatory TEXT,
                preview_image_base64 TEXT,
                raw_ocr_text TEXT,
                user_id TEXT,
                role TEXT,
                creator_name TEXT,
                saved_at TEXT NOT NULL
            )
        """)
        
        # Add column migrations for existing databases
        add_column_if_not_exists(cursor, "users", "name", "TEXT")
        add_column_if_not_exists(cursor, "users", "role", "TEXT DEFAULT 'employee'")
        add_column_if_not_exists(cursor, "challans", "user_id", "TEXT")
        add_column_if_not_exists(cursor, "challans", "creator_name", "TEXT")
        add_column_if_not_exists(cursor, "challans", "role", "TEXT DEFAULT 'admin'")
        add_column_if_not_exists(cursor, "canvas_challans", "creator_name", "TEXT")
        add_column_if_not_exists(cursor, "canvas_challans", "vehicle_no", "TEXT")
        add_column_if_not_exists(cursor, "canvas_challans", "eway_bill_no", "TEXT")
        add_column_if_not_exists(cursor, "canvas_challans", "remarks", "TEXT")
        add_column_if_not_exists(cursor, "canvas_challans", "computed_weight_mt", "TEXT")
        add_column_if_not_exists(cursor, "canvas_challans", "total_weight_override", "TEXT")
        add_column_if_not_exists(cursor, "canvas_challans", "total_value_incl_tax", "TEXT")
        add_column_if_not_exists(cursor, "canvas_challans", "extra_fields", "TEXT")

        # Seed/update users: admin@optimo.com, ravindra@optimo.com, pavan@optimo.com
        users_to_seed = [
            ("admin@optimo.com", "CTPL@2026", "Admin", "admin"),
            ("ravindra@optimo.com", "CTPL@2026", "Ravindra", "employee"),
            ("pavan@optimo.com", "CTPL@2026", "Pavan", "employee"),
        ]
        for email, pwd, name, role in users_to_seed:
            cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
            row = cursor.fetchone()
            if not row:
                cursor.execute(
                    "INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)",
                    (email, pwd, name, role)
                )
            else:
                cursor.execute(
                    "UPDATE users SET password = ?, name = ?, role = ? WHERE email = ?",
                    (pwd, name, role, email)
                )
            
        conn.commit()

@contextmanager
def get_db():
    """Context manager for SQLite database connections."""
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

# Initialize on module import
init_db()

def insert_canvas_challan(record: dict) -> dict:
    with get_db() as conn:
        cursor = conn.cursor()
        items_json = record.get("items")
        if isinstance(items_json, (list, dict)):
            items_json = json.dumps(items_json)
        elif items_json is None:
            items_json = "[]"

        cursor.execute(
            """
            INSERT INTO canvas_challans (
                id, challan_no, date, your_order_no, order_date, vehicle_no, eway_bill_no, party_name, address,
                gstin, items, computed_weight_mt, total_weight_override, total_value_incl_tax, remarks, extra_fields,
                customer_signature, authorised_signatory,
                preview_image_base64, raw_ocr_text, user_id, role, creator_name, saved_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record["id"],
                record.get("challan_no", ""),
                record.get("date", ""),
                record.get("your_order_no", ""),
                record.get("order_date", ""),
                record.get("vehicle_no", ""),
                record.get("eway_bill_no", ""),
                record.get("party_name", ""),
                record.get("address", ""),
                record.get("gstin", ""),
                items_json,
                record.get("computed_weight_mt", "0.000"),
                record.get("total_weight_override", ""),
                record.get("total_value_incl_tax", ""),
                record.get("remarks", ""),
                record.get("extra_fields", ""),
                record.get("customer_signature", ""),
                record.get("authorised_signatory", ""),
                record.get("preview_image_base64", ""),
                record.get("raw_ocr_text", ""),
                record.get("user_id", "admin@optimo.com"),
                record.get("role", "admin"),
                record.get("creator_name", "Admin"),
                record.get("saved_at", "")
            )
        )
        conn.commit()
        return record

def get_canvas_challans(user_id: str = None, role: str = "admin") -> list:
    with get_db() as conn:
        cursor = conn.cursor()
        if role == "admin" or not user_id:
            cursor.execute("SELECT * FROM canvas_challans ORDER BY saved_at DESC")
        else:
            cursor.execute("SELECT * FROM canvas_challans WHERE user_id = ? ORDER BY saved_at DESC", (user_id,))
        rows = cursor.fetchall()
        result = []
        for row in rows:
            try:
                items = json.loads(row["items"]) if row["items"] else []
            except Exception:
                items = []
            
            creator = ""
            try:
                creator = row["creator_name"]
            except Exception:
                creator = ""
            if not creator:
                creator = row["user_id"] or "Admin"

            r_keys = row.keys()
            result.append({
                "id": row["id"],
                "challan_no": row["challan_no"],
                "date": row["date"],
                "your_order_no": row["your_order_no"],
                "order_date": row["order_date"],
                "vehicle_no": row["vehicle_no"] if "vehicle_no" in r_keys else "",
                "eway_bill_no": row["eway_bill_no"] if "eway_bill_no" in r_keys else "",
                "party_name": row["party_name"],
                "address": row["address"],
                "gstin": row["gstin"],
                "items": items,
                "computed_weight_mt": row["computed_weight_mt"] if "computed_weight_mt" in r_keys else "0.000",
                "total_weight_override": row["total_weight_override"] if "total_weight_override" in r_keys else "",
                "total_value_incl_tax": row["total_value_incl_tax"] if "total_value_incl_tax" in r_keys else "",
                "remarks": row["remarks"] if "remarks" in r_keys else "",
                "extra_fields": row["extra_fields"] if "extra_fields" in r_keys else "",
                "customer_signature": row["customer_signature"],
                "authorised_signatory": row["authorised_signatory"],
                "preview_image_base64": row["preview_image_base64"],
                "raw_ocr_text": row["raw_ocr_text"],
                "user_id": row["user_id"],
                "role": row["role"],
                "creator_name": creator,
                "saved_at": row["saved_at"]
            })
        return result

def get_canvas_challan_by_id(challan_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM canvas_challans WHERE id = ?", (challan_id,))
        row = cursor.fetchone()
        if not row:
            return None
        try:
            items = json.loads(row["items"]) if row["items"] else []
        except Exception:
            items = []
        
        creator = ""
        try:
            creator = row["creator_name"]
        except Exception:
            creator = ""
        if not creator:
            creator = row["user_id"] or "Admin"

        r_keys = row.keys()
        return {
            "id": row["id"],
            "challan_no": row["challan_no"],
            "date": row["date"],
            "your_order_no": row["your_order_no"],
            "order_date": row["order_date"],
            "vehicle_no": row["vehicle_no"] if "vehicle_no" in r_keys else "",
            "eway_bill_no": row["eway_bill_no"] if "eway_bill_no" in r_keys else "",
            "party_name": row["party_name"],
            "address": row["address"],
            "gstin": row["gstin"],
            "items": items,
            "computed_weight_mt": row["computed_weight_mt"] if "computed_weight_mt" in r_keys else "0.000",
            "total_weight_override": row["total_weight_override"] if "total_weight_override" in r_keys else "",
            "total_value_incl_tax": row["total_value_incl_tax"] if "total_value_incl_tax" in r_keys else "",
            "remarks": row["remarks"] if "remarks" in r_keys else "",
            "extra_fields": row["extra_fields"] if "extra_fields" in r_keys else "",
            "customer_signature": row["customer_signature"],
            "authorised_signatory": row["authorised_signatory"],
            "preview_image_base64": row["preview_image_base64"],
            "raw_ocr_text": row["raw_ocr_text"],
            "user_id": row["user_id"],
            "role": row["role"],
            "creator_name": creator,
            "saved_at": row["saved_at"]
        }

def update_canvas_challan(challan_id: str, updates: dict) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        allowed_fields = [
            "challan_no", "date", "your_order_no", "order_date", "vehicle_no", "eway_bill_no",
            "party_name", "address", "gstin", "items", "computed_weight_mt", "total_weight_override",
            "total_value_incl_tax", "remarks", "extra_fields",
            "customer_signature", "authorised_signatory",
            "preview_image_base64", "raw_ocr_text", "creator_name", "saved_at"
        ]
        fields = []
        values = []
        for k, v in updates.items():
            if k in allowed_fields:
                fields.append(f"{k} = ?")
                if k == "items" and isinstance(v, (list, dict)):
                    values.append(json.dumps(v))
                else:
                    values.append(v)
        if not fields:
            return False
        values.append(challan_id)
        cursor.execute(f"UPDATE canvas_challans SET {', '.join(fields)} WHERE id = ?", tuple(values))
        conn.commit()
        return cursor.rowcount > 0

def delete_canvas_challan(challan_id: str) -> bool:
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM canvas_challans WHERE id = ?", (challan_id,))
        conn.commit()
        return cursor.rowcount > 0

