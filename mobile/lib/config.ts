// Single source of truth for domain-dependent values in the mobile app.
// Change ROOT_DOMAIN when migrating (e.g., freesurf.tools → free.surf).
export const ROOT_DOMAIN = "freesurf.tools";
export const URLS = {
  home: `https://${ROOT_DOMAIN}`,
  privacy: `https://${ROOT_DOMAIN}/privacy`,
  terms: `https://${ROOT_DOMAIN}/terms`,
};
export const TTS_WORKER_URL = `https://reader.${ROOT_DOMAIN}`;

// RevenueCat Google Play public SDK key for THIS app (Reader). Replace the placeholder
// with the key from RevenueCat's Reader (Google Play) app entry before shipping.
export const REVENUECAT_ANDROID_KEY = "goog_IChuCQBXFVGjFQCLNzqLaxsDfdS";
