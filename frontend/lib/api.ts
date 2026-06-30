import type {
  AnswerResponse,
  ProcessFileResponse,
  UploadResponse,
} from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function safeError(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    if (payload?.detail) {
      return typeof payload.detail === "string"
        ? payload.detail
        : JSON.stringify(payload.detail);
    }
  } catch {
    /* fall through */
  }
  return `${response.status} ${response.statusText}`;
}

export async function apiUpload(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/upload-file`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await safeError(res));
  return res.json();
}

export async function apiProcess(filename: string): Promise<ProcessFileResponse> {
  const res = await fetch(
    `${API_BASE_URL}/process-file?filename=${encodeURIComponent(filename)}`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error(await safeError(res));
  return res.json();
}

export async function apiAsk(query: string): Promise<AnswerResponse> {
  const res = await fetch(`${API_BASE_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(await safeError(res));
  return res.json();
}