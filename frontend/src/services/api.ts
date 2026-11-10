import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

export type Schemas = components["schemas"];

export const api = createClient<paths>({ baseUrl: import.meta.env.VITE_API_URL ?? "" });

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

interface ErrorShape {
  detail?: { code?: string; message?: string } | unknown;
}

// Unwraps an openapi-fetch result into data, or throws a typed ApiError
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let result: { data?: T; error?: unknown; response: Response };
  try {
    result = await call;
  } catch {
    throw new ApiError("OFFLINE", "The server is not reachable. Start the backend and retry.", 0);
  }
  const { data, error, response } = result;
  if (error !== undefined || data === undefined) {
    const detail = (error as ErrorShape | undefined)?.detail as
      | { code?: string; message?: string }
      | undefined;
    const offline = response.status >= 500 && response.status < 600 && !detail?.code;
    throw new ApiError(
      offline ? "OFFLINE" : (detail?.code ?? "HTTP_ERROR"),
      offline
        ? "The server is not reachable. Start the backend and retry."
        : (detail?.message ?? `Request failed with status ${response.status}.`),
      response.status,
    );
  }
  return data;
}
