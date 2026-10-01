/**
 * An upstream feed misbehaved (HTTP error, or HTML where JSON was
 * expected, e.g. a Cloudflare page from SGPokeMap). Expected now and
 * then, so the logger prints it as one WARN line without a stack.
 */
export class UpstreamError extends Error {
  name = "UpstreamError";
}

/**
 * Parse a fetch response as JSON, throwing UpstreamError on a non-2xx
 * status or a body that isn't JSON instead of a bare SyntaxError
 */
export async function readJson<T>(
  response: Response,
  url: string,
): Promise<T> {
  const host = new URL(url).host;
  if (!response.ok) {
    throw new UpstreamError(
      `${host} returned HTTP ${response.status} for ${url}`,
    );
  }
  const body = await response.text();
  try {
    return JSON.parse(body) as T;
  } catch {
    const type = response.headers.get("content-type") ?? "no type";
    throw new UpstreamError(
      `${host} returned ${type}, not JSON (HTTP ${response.status})`,
    );
  }
}

const NETWORK_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET",
]);

function errorCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  const { code, cause } = error as { code?: unknown; cause?: unknown };
  if (typeof code === "string") return code;
  return errorCode(cause);
}

/**
 * True for failures caused by the network or an upstream service rather
 * than by the bot: timeouts, DNS, resets, undici's "fetch failed",
 * node-fetch's FetchError (Telegraf) and UpstreamError
 */
export function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error instanceof UpstreamError) return true;
  if (error.name === "AbortError" || error.name === "TimeoutError") {
    return true;
  }
  const code = errorCode(error);
  if (code && NETWORK_CODES.has(code)) return true;
  return error instanceof TypeError && error.message === "fetch failed";
}

/** One-line description: "TypeError: fetch failed (ETIMEDOUT)" */
export function describeError(error: Error): string {
  const code = errorCode(error);
  const suffix = code && !error.message.includes(code) ? ` (${code})` : "";
  return `${error.name}: ${error.message}${suffix}`;
}
