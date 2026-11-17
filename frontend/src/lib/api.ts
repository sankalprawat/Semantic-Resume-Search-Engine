import { Candidate, EvaluationDonePayload, TalentPool } from "@/types";

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";
const cleanApiUrl = rawApiUrl.replace(/\/+$/, "");
const API_BASE_URL = cleanApiUrl.endsWith("/api/v1") ? cleanApiUrl : `${cleanApiUrl}/api/v1`;

export interface HealthResponse {
  status: string;
  completion_model: string;
  embedding_model: string;
}

export interface UploadResponse {
  total_uploaded: number;
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE_URL}/health`, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch health info: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchPools(signal?: AbortSignal): Promise<TalentPool[]> {
  const res = await fetch(`${API_BASE_URL}/pools/`, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch talent pools: ${res.statusText}`);
  }
  return res.json();
}

export async function createPool(
  title: string,
  description?: string,
  signal?: AbortSignal
): Promise<TalentPool> {
  const res = await fetch(`${API_BASE_URL}/pools/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description }),
    signal,
  });
  if (!res.ok) {
    throw new Error(`Failed to create pool: ${res.statusText}`);
  }
  return res.json();
}

export async function seedSamplePool(signal?: AbortSignal): Promise<TalentPool> {
  const res = await fetch(`${API_BASE_URL}/pools/seed-sample`, {
    method: "POST",
    signal,
  });
  if (!res.ok) {
    throw new Error(`Failed to load sample talent pool: ${res.statusText}`);
  }
  return res.json();
}

export async function deletePool(poolId: string, signal?: AbortSignal): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/pools/${poolId}`, {
    method: "DELETE",
    signal,
  });
  if (!res.ok) {
    throw new Error(`Failed to delete pool: ${res.statusText}`);
  }
}

export async function fetchCandidates(
  poolId: string,
  signal?: AbortSignal
): Promise<Candidate[]> {
  const res = await fetch(`${API_BASE_URL}/pools/${poolId}/candidates`, {
    cache: "no-store",
    signal,
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch candidates: ${res.statusText}`);
  }
  return res.json();
}

export async function uploadResumes(
  poolId: string,
  files: File[],
  signal?: AbortSignal
): Promise<UploadResponse> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const res = await fetch(`${API_BASE_URL}/resumes/${poolId}/upload`, {
    method: "POST",
    body: formData,
    signal,
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Upload failed: ${res.statusText}`);
  }

  return res.json();
}

export function getCandidateResumeUrl(candidateId: string): string {
  return `${API_BASE_URL}/resumes/${candidateId}/file`;
}

export async function streamEvaluation(
  poolId: string,
  query: string,
  onToken: (token: string) => void,
  onDone: (data: EvaluationDonePayload) => void,
  onError: (error: string) => void,
  signal?: AbortSignal
): Promise<void> {
  try {
    const res = await fetch(`${API_BASE_URL}/pools/${poolId}/evaluate/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        top_k: 12,
        min_similarity: 0.2,
        temperature: 0.2,
      }),
      signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      onError(err.detail || `Server returned ${res.status}`);
      return;
    }

    if (!res.body) {
      onError("No response stream body received");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      if (signal?.aborted) {
        await reader.cancel();
        return;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (signal?.aborted) {
          await reader.cancel();
          return;
        }

        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.type === "token") {
              onToken(data.content);
            } else if (data.type === "done") {
              onDone(data as EvaluationDonePayload);
            } else if (data.type === "error") {
              onError(data.message || "Evaluation error");
            }
          } catch {
            // ignore non-json keepalives
          }
        }
      }
    }
  } catch (err: any) {
    if (err?.name === "AbortError" || signal?.aborted) {
      // Clean cancellation, do not surface as user error
      return;
    }
    onError(err.message || "Network error during evaluation stream");
  }
}
