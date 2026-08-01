// Single source of truth for domain-dependent values in the mobile app.
// Change ROOT_DOMAIN when migrating (e.g., freesurf.tools → free.surf).
export const ROOT_DOMAIN = "freesurf.tools";
export const URLS = {
  home: `https://${ROOT_DOMAIN}`,
  privacy: `https://${ROOT_DOMAIN}/privacy`,
  terms: `https://${ROOT_DOMAIN}/terms`,
};
export const TTS_WORKER_URL = `https://reader.${ROOT_DOMAIN}`;
