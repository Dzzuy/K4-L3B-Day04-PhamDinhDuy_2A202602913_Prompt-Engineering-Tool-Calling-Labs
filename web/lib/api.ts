import type { ChatResponse, DatasetInfo } from "./types";

async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return parseError(data.detail || data.message || response.statusText);
  } catch {
    return response.statusText;
  }
}

function parseError(text: unknown): string {
  if (typeof text === "string") return text;
  if (Array.isArray(text)) return text.map((item) => JSON.stringify(item)).join("; ");
  return "Request failed";
}

export async function uploadCsv(file: File): Promise<DatasetInfo> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/upload", { method: "POST", body });
  if (!response.ok) {
    throw new Error(parseError(await readError(response)));
  }
  return response.json();
}

export async function fetchDatasets(): Promise<any[]> {
  const response = await fetch("/api/datasets");
  if (!response.ok) throw new Error("Failed to fetch datasets");
  return response.json();
}

export async function fetchDatasetDetail(id: string): Promise<any> {
  const response = await fetch(`/api/dataset/${id}`);
  if (!response.ok) throw new Error("Failed to fetch dataset detail");
  return response.json();
}

export async function sendChat(
  datasetId: string,
  message: string,
  sessionId?: string
): Promise<ChatResponse> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataset_id: datasetId, message, session_id: sessionId }),
  });
  if (!response.ok) {
    throw new Error(parseError(await readError(response)));
  }
  return response.json();
}

export async function confirmMask(
  datasetId: string,
  columns: string[],
  confirmationToken: string
) {
  const response = await fetch("/api/mask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dataset_id: datasetId,
      columns,
      confirmation_token: confirmationToken,
    }),
  });
  if (!response.ok) {
    throw new Error(parseError(await readError(response)));
  }
  return response.json();
}

export async function fetchHealth(): Promise<{ artifact_version?: string; version?: string }> {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) return {};
    return response.json();
  } catch {
    return {};
  }
}
