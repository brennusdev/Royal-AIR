import { isIP } from "node:net";
import type { FastifyInstance } from "fastify";

const maximumRequestBytes = 1_048_576;

export function resolveVercelApiPath(requestUrl: string): string | null {
  const url = new URL(requestUrl);
  const paths = url.searchParams.getAll("__api_path");
  if (paths.length !== 1) {
    return null;
  }

  const pathname = paths[0];
  if (!pathname || !pathname.startsWith("/api/v1/")) {
    return null;
  }
  url.searchParams.delete("__api_path");
  return `${pathname}${url.search}`;
}

export async function handleVercelApiRequest(
  app: FastifyInstance,
  request: Request,
  apiPath: string
): Promise<Response> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maximumRequestBytes) {
    return Response.json({ error: "Request body is too large." }, { status: 413 });
  }

  let payload: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD" && request.body) {
    payload = await request.text();
    if (new TextEncoder().encode(payload).byteLength > maximumRequestBytes) {
      return Response.json({ error: "Request body is too large." }, { status: 413 });
    }
  }

  const headers: Record<string, string> = {};
  for (const [name, value] of request.headers) {
    if (["connection", "content-length", "host", "transfer-encoding"].includes(name.toLowerCase())) {
      continue;
    }
    headers[name] = value;
  }

  const forwardedIp = request.headers.get("x-forwarded-for");
  const result = await app.inject({
    method: request.method,
    url: apiPath,
    headers,
    ...(payload === undefined ? {} : { payload }),
    remoteAddress: forwardedIp && isIP(forwardedIp) ? forwardedIp : "127.0.0.1"
  });
  const responseHeaders = new Headers();
  for (const [name, value] of Object.entries(result.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        responseHeaders.append(name, item);
      }
    } else if (typeof value === "string") {
      responseHeaders.append(name, value);
    }
  }
  const body = result.statusCode === 204 || result.statusCode === 304 ? null : result.body;
  return new Response(body, { status: result.statusCode, headers: responseHeaders });
}
