const MS_IDENTITY_PATH = "/.well-known/microsoft-identity-association.json";
const MS_IDENTITY_BODY = JSON.stringify({
  associatedApplications: [
    { applicationId: "324d18c2-0525-41e3-9fb7-ebae8c08c9f0" },
  ],
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === MS_IDENTITY_PATH) {
      return new Response(MS_IDENTITY_BODY, {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=300",
        },
      });
    }
    return env.ASSETS.fetch(request);
  },
};
