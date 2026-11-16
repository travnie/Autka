// Compatibility for released clients; no credentials, catalogue or duplicated API logic.
export default {
  fetch(request, env) {
    return env.API.fetch(request);
  },
};
