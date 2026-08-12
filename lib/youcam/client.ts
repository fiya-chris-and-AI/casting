import { youcamConfig } from "./config";

export class YouCamApiError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "YouCamApiError";
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

async function youcamFetch(path: string, init: RequestInit, retries = 2): Promise<unknown> {
  const url = path.startsWith("http") ? path : `${youcamConfig.baseUrl}${path}`;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await withTimeout(
        fetch(url, {
          ...init,
          headers: {
            Authorization: `Bearer ${youcamConfig.apiKey}`,
            "Content-Type": "application/json",
            ...init.headers,
          },
        }),
        youcamConfig.requestTimeoutMs,
        `YouCam ${init.method ?? "GET"} ${path}`,
      );

      const text = await res.text();
      const body = text ? JSON.parse(text) : null;

      if (!res.ok) {
        throw new YouCamApiError(`YouCam API error ${res.status} on ${path}`, res.status, body);
      }

      return body;
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === retries;
      const isRetryable = err instanceof YouCamApiError ? err.httpStatus >= 500 : true;
      if (isLastAttempt || !isRetryable) throw lastError;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

export interface UploadedFile {
  fileId: string;
  contentType: string;
}

interface FileUploadEntry {
  file_id: string;
  requests?: { url: string; method?: string; headers?: Record<string, string> }[];
}

interface FileUploadResponse {
  data?: { files?: FileUploadEntry[] };
  files?: FileUploadEntry[];
}

export async function uploadFile(bytes: Buffer, fileName: string, contentType: string): Promise<UploadedFile> {
  const createRes = (await youcamFetch("/s2s/v2.0/file", {
    method: "POST",
    body: JSON.stringify({
      files: [{ content_type: contentType, file_name: fileName, file_size: bytes.length }],
    }),
  })) as FileUploadResponse;

  const fileEntry = createRes?.data?.files?.[0] ?? createRes?.files?.[0];
  if (!fileEntry) {
    throw new YouCamApiError("File upload response missing file entry", 502, createRes);
  }

  const uploadRequest = fileEntry.requests?.[0];
  if (!uploadRequest?.url) {
    throw new YouCamApiError("File upload response missing presigned URL", 502, createRes);
  }

  const putRes = await withTimeout(
    fetch(uploadRequest.url, {
      method: uploadRequest.method ?? "PUT",
      headers: uploadRequest.headers ?? { "Content-Type": contentType },
      body: new Blob([new Uint8Array(bytes)], { type: contentType }),
    }),
    youcamConfig.requestTimeoutMs,
    "YouCam file PUT",
  );

  if (!putRes.ok) {
    throw new YouCamApiError(`File upload PUT failed with ${putRes.status}`, putRes.status, await putRes.text());
  }

  return { fileId: fileEntry.file_id, contentType };
}

export interface TaskResult {
  taskId: string;
  status: "success" | "error" | "processing" | "unknown";
  results: unknown;
  raw: unknown;
}

interface TaskEnvelope {
  data?: { task_id?: string; task_status?: string; results?: unknown };
  task_id?: string;
  task_status?: string;
  results?: unknown;
}

export async function startTask(taskPath: string, payload: Record<string, unknown>): Promise<string> {
  const res = (await youcamFetch(taskPath, {
    method: "POST",
    body: JSON.stringify(payload),
  })) as TaskEnvelope;
  const taskId = res?.data?.task_id ?? res?.task_id;
  if (!taskId) {
    throw new YouCamApiError("Task start response missing task_id", 502, res);
  }
  return taskId;
}

export async function pollTask(
  taskPath: string,
  taskId: string,
  opts: { intervalMs?: number; maxAttempts?: number } = {},
): Promise<TaskResult> {
  const intervalMs = opts.intervalMs ?? 2000;
  const maxAttempts = opts.maxAttempts ?? 60;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = (await youcamFetch(`${taskPath}/${taskId}`, { method: "GET" })) as TaskEnvelope;
    const data = res?.data ?? res;
    const status = data?.task_status as TaskResult["status"] | undefined;

    if (status === "success") {
      return { taskId, status, results: data.results, raw: res };
    }
    if (status === "error") {
      return { taskId, status, results: data.results ?? null, raw: res };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return { taskId, status: "unknown", results: null, raw: null };
}

export async function runTask(
  taskPath: string,
  payload: Record<string, unknown>,
  pollOpts?: { intervalMs?: number; maxAttempts?: number },
): Promise<TaskResult> {
  const taskId = await startTask(taskPath, payload);
  return pollTask(taskPath, taskId, pollOpts);
}
