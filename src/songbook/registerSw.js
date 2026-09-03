// Registers the service worker that precaches the app shell + library so the
// songbook keeps working with the device in airplane mode. Production only.
if (typeof navigator !== "undefined" && "serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js").catch(() => { /* offline support unavailable */ });
  });
}
