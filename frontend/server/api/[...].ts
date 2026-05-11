import { joinURL } from "ufo";

/**
 * Proxy relative urls to be prefixed with the backendUrl.
 */
export default defineEventHandler(async (event) => {
  // Get Backend URL from RuntimeConfig
  const { backendUrl } = useRuntimeConfig();

  // Strip the /api/ from the given path
  const path = event.path.replace(/^\/api\//, "");

  // Create the new target, by appending the path provided by the user to the backendUrl
  const target = joinURL(backendUrl, path);

  // Proxy the url
  return proxyRequest(event, target);
});
