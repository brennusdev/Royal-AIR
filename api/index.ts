import { createVercelFetchHandler } from "../apps/api/src/vercel-function.js";

export default {
  fetch: createVercelFetchHandler()
};
