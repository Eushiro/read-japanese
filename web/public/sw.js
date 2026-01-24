/**
 * Service Worker for SanLang
 * Caches audio and images for offline playback and faster loads
 */

const CACHE_NAME = "sanlang-media-v1";

// File types to cache
const CACHEABLE_EXTENSIONS = [".wav", ".mp3", ".ogg", ".webm", ".png", ".jpg", ".jpeg", ".webp", ".gif"];

// Domains to cache from
const CACHEABLE_DOMAINS = [
  "pub-a72e469260eb41338f5ac3e285511e47.r2.dev", // R2 public URL
  "r2.cloudflarestorage.com",
];

/**
 * Check if a request should be cached
 */
function shouldCache(request) {
  const url = new URL(request.url);

  // Check if it's from a cacheable domain
  const isCacheableDomain = CACHEABLE_DOMAINS.some((domain) => url.hostname.includes(domain));
  if (!isCacheableDomain) return false;

  // Check if it's a cacheable file type
  const isCacheableFile = CACHEABLE_EXTENSIONS.some((ext) => url.pathname.toLowerCase().endsWith(ext));
  return isCacheableFile;
}

/**
 * Install event - set up cache
 */
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker");
  self.skipWaiting();
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith("sanlang-") && name !== CACHE_NAME)
          .map((name) => {
            console.log("[SW] Deleting old cache:", name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

/**
 * Fetch event - serve from cache or network
 * Strategy: Cache-first for media files
 */
self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") return;

  // Only handle cacheable requests
  if (!shouldCache(event.request)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Try cache first
      const cachedResponse = await cache.match(event.request);
      if (cachedResponse) {
        console.log("[SW] Cache hit:", event.request.url);
        return cachedResponse;
      }

      // Fetch from network
      console.log("[SW] Cache miss, fetching:", event.request.url);
      try {
        const networkResponse = await fetch(event.request);

        // Only cache successful responses
        if (networkResponse.ok) {
          // Clone the response before caching (response can only be consumed once)
          cache.put(event.request, networkResponse.clone());
        }

        return networkResponse;
      } catch (error) {
        console.error("[SW] Fetch failed:", error);
        throw error;
      }
    })
  );
});

/**
 * Message handler for cache management
 */
self.addEventListener("message", (event) => {
  if (event.data.type === "CLEAR_CACHE") {
    caches.delete(CACHE_NAME).then(() => {
      console.log("[SW] Cache cleared");
      event.ports[0].postMessage({ success: true });
    });
  }

  if (event.data.type === "GET_CACHE_SIZE") {
    caches.open(CACHE_NAME).then(async (cache) => {
      const keys = await cache.keys();
      event.ports[0].postMessage({ count: keys.length });
    });
  }
});
