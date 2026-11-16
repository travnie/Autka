// Compatibility for released clients; no credentials, catalogue or duplicated API logic.
export default {
  fetch(request, env) {
    if (!env?.API || typeof env.API.fetch !== "function") {
      console.error("legacy_api_binding_missing");
      return Response.json({ error: "service_unavailable" }, { status: 503 });
    }
    return env.API.fetch(request);
  },
};
