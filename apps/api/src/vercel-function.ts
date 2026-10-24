import { loadEnvironment } from "./config.js";
import { createPlatformRuntime } from "./platform-runtime.js";
import { handleVercelApiRequest, resolveVercelApiPath } from "./vercel-adapter.js";

export function createVercelFetchHandler(): (request: Request) => Promise<Response> {
  let runtimePromise: ReturnType<typeof createPlatformRuntime> | undefined;

  return async (request) => {
    const apiPath = resolveVercelApiPath(request.url);
    if (!apiPath) {
      return Response.json({ error: "Not found." }, { status: 404 });
    }

    runtimePromise ??= createPlatformRuntime(loadEnvironment());
    const { app } = await runtimePromise;
    return handleVercelApiRequest(app, request, apiPath);
  };
}
