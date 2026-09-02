import { SavedChallan, ChallanData } from "@/types/ocr";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function login(email: string, password: string):Promise<{token: string}> {
  const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error("Invalid credentials");
  }
  return response.json();
}

export async function fetchChallans(): Promise<SavedChallan[]> {
  const res = await fetch(`${API_BASE}/api/v1/challans/`);
  if (!res.ok) throw new Error("Failed to fetch challans");
  return res.json();
}

export async function createChallan(challan: SavedChallan): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/challans/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(challan),
  });
  if (!res.ok) throw new Error("Failed to create challan");
}

export async function updateChallan(id: string, challan: SavedChallan): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/challans/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: challan.data,
      source: challan.source,
      previewImageBase64: challan.previewImageBase64,
      savedAt: challan.savedAt
    }),
  });
  if (!res.ok) throw new Error("Failed to update challan");
}

export async function deleteChallan(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/challans/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete challan");
}

export async function migrateLegacyChallans(challans: SavedChallan[]): Promise<void> {
  if (!challans.length) return;
  const res = await fetch(`${API_BASE}/api/v1/challans/migrate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(challans),
  });
  if (!res.ok) throw new Error("Failed to migrate legacy challans");
}
