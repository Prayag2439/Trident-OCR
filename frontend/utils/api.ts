import { SavedChallan, SavedCanvasChallan, CanvasProcessResponse } from "@/types/ocr";

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
}

const API_BASE = getApiBaseUrl();

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

export async function fetchChallans(userId?: string, role = "admin"): Promise<SavedChallan[]> {
  const params = new URLSearchParams();
  if (userId) params.append("user_id", userId);
  if (role) params.append("role", role);
  const url = `${API_BASE}/api/v1/challans/${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url);
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

// ─── Canvas Scribble API ────────────────────────────────────────────────────

export async function processCanvasChallan(
  imageBase64: string,
  userId = "admin",
  role = "admin",
  creatorName = "Admin"
): Promise<CanvasProcessResponse> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/canvas-challans/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_base64: imageBase64,
      user_id: userId,
      role: role,
      creator_name: creatorName
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to process canvas challan: ${errText}`);
  }
  return res.json();
}

export async function fetchCanvasChallans(
  userId?: string,
  role = "admin"
): Promise<SavedCanvasChallan[]> {
  const base = getApiBaseUrl();
  const params = new URLSearchParams();
  if (userId) params.append("user_id", userId);
  if (role) params.append("role", role);

  const url = `${base}/api/canvas-challans/${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch canvas challans");
  return res.json();
}

export async function fetchSingleCanvasChallan(id: string): Promise<SavedCanvasChallan> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/canvas-challans/${id}`);
  if (!res.ok) throw new Error("Failed to fetch single canvas challan");
  return res.json();
}

export async function updateCanvasChallan(
  id: string,
  updates: Partial<SavedCanvasChallan>
): Promise<void> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/canvas-challans/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update canvas challan");
}

export async function deleteCanvasChallan(id: string): Promise<void> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/canvas-challans/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete canvas challan");
}

