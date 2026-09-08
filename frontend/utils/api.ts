import { SavedChallan, SavedCanvasChallan, CanvasProcessResponse } from "@/types/ocr";

export function getApiBaseUrl(): string {
  // 1. Environment variable configured by DevOps (.env, .env.production, etc.)
  const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  // 2. User-configured override stored in localStorage
  if (typeof window !== "undefined") {
    const custom = localStorage.getItem("trident_server_url");
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, "");
    }

    const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.();
    if (!isCapacitor) {
      // Local development fallback for localhost
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        return "http://localhost:8000";
      }
      // On web browser, dynamically use the current domain origin
      if (window.location.origin) {
        return window.location.origin;
      }
    }
  }

  // 3. Default fallback for mobile app
  return "https://trident-challan.corecotechnologies.com";
}

export function setApiBaseUrl(url: string): void {
  if (typeof window !== "undefined") {
    if (url && url.trim()) {
      localStorage.setItem("trident_server_url", url.trim().replace(/\/+$/, ""));
    } else {
      localStorage.removeItem("trident_server_url");
    }
  }
}

export async function login(email: string, password: string): Promise<{ token: string }> {
  const base = getApiBaseUrl();
  const response = await fetch(`${base}/api/v1/auth/login`, {
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
  const base = getApiBaseUrl();
  const params = new URLSearchParams();
  if (userId) params.append("user_id", userId);
  if (role) params.append("role", role);
  const url = `${base}/api/v1/challans/${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch challans");
  return res.json();
}

export async function createChallan(challan: SavedChallan): Promise<void> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/challans/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(challan),
  });
  if (!res.ok) throw new Error("Failed to create challan");
}

export async function updateChallan(id: string, challan: SavedChallan): Promise<void> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/challans/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: challan.data,
      source: challan.source,
      previewImageBase64: challan.previewImageBase64,
      savedAt: challan.savedAt,
    }),
  });
  if (!res.ok) throw new Error("Failed to update challan");
}

export async function deleteChallan(id: string): Promise<void> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/challans/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete challan");
}

export async function migrateLegacyChallans(challans: SavedChallan[]): Promise<void> {
  if (!challans.length) return;
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/v1/challans/migrate`, {
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

