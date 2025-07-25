// === frontend/src/serviceWorker.js ===
// Enhanced Service Worker for SafeStreets Bangladesh PWA
// Optimized for 8000+ users with offline support

const CACHE_VERSION = 'v2.0.0';
const CACHE_NAMES = {
  static: `static-${CACHE_VERSION}`,
  dynamic: `dynamic-${CACHE_VERSION}`,
  images: `images-${CACHE_VERSION}`,
  api: `api-${CACHE_VERSION}`,
  maps: `maps-${CACHE_VERSION}`
};

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/css/main.css',
  '/static/js/bundle.js',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// API endpoints to cache
const CACHEABLE_API_PATTERNS = [
  /\/api\/safezones$/,
  /\/api\/reports\?.*status=approved/,
  /\/api\/analytics\/public/,
  /\/api\/maps\/tiles/
];

// Cache strategies
const CACHE_STRATEGIES = {
  cacheFirst: [
    /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
    /\.(?:woff|woff2|ttf|otf)$/,
    /\.(?:css|js)$/
  ],
  networkFirst: [
    /\/api\//,
    /\/socket\.io\//
  ],
  staleWhileRevalidate: [
    /\/manifest\.json$/,
    /\/$/
  ]
};

// Cache expiration times (in seconds)
const CACHE_EXPIRATION = {
  api: 300, // 5 minutes
  images: 86400, // 24 hours
  maps: 3600, // 1 hour
  dynamic: 600 // 10 minutes
};

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAMES.static)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!Object.values(CACHE_NAMES).includes(cacheName)) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-HTTP(S) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Determine caching strategy
  const strategy = getCacheStrategy(request);
  
  event.respondWith(
    executeStrategy(strategy, request)
      .catch(() => {
        // Fallback to offline page for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
        throw new Error('Network request failed');
      })
  );
});

// Get appropriate cache strategy
function getCacheStrategy(request) {
  const url = request.url;

  // Check cache-first patterns
  for (const pattern of CACHE_STRATEGIES.cacheFirst) {
    if (pattern.test(url)) {
      return 'cacheFirst';
    }
  }

  // Check network-first patterns
  for (const pattern of CACHE_STRATEGIES.networkFirst) {
    if (pattern.test(url)) {
      return 'networkFirst';
    }
  }

  // Check stale-while-revalidate patterns
  for (const pattern of CACHE_STRATEGIES.staleWhileRevalidate) {
    if (pattern.test(url)) {
      return 'staleWhileRevalidate';
    }
  }

  // Default strategy
  return 'networkFirst';
}

// Execute caching strategy
async function executeStrategy(strategy, request) {
  switch (strategy) {
    case 'cacheFirst':
      return cacheFirst(request);
    case 'networkFirst':
      return networkFirst(request);
    case 'staleWhileRevalidate':
      return staleWhileRevalidate(request);
    default:
      return fetch(request);
  }
}

// Cache-first strategy
async function cacheFirst(request) {
  const cached = await caches.match(request);
  
  if (cached) {
    // Check if cache is expired
    const cacheTime = cached.headers.get('sw-cache-time');
    if (cacheTime && isCacheExpired(cacheTime, CACHE_EXPIRATION.images)) {
      // Refresh cache in background
      refreshCache(request);
    }
    return cached;
  }

  const response = await fetch(request);
  
  if (response.ok) {
    const cache = await getCacheForRequest(request);
    const responseToCache = response.clone();
    
    // Add cache timestamp
    const headers = new Headers(responseToCache.headers);
    headers.set('sw-cache-time', Date.now());
    
    const modifiedResponse = new Response(responseToCache.body, {
      status: responseToCache.status,
      statusText: responseToCache.statusText,
      headers
    });
    
    cache.put(request, modifiedResponse);
  }

  return response;
}

// Network-first strategy
async function networkFirst(request) {
  try {
    const response = await fetchWithTimeout(request, 5000);
    
    if (response.ok) {
      const cache = await getCacheForRequest(request);
      
      // Cache API responses if they match patterns
      if (shouldCacheApiResponse(request)) {
        const responseToCache = response.clone();
        cache.put(request, responseToCache);
      }
    }

    return response;
  } catch (error) {
    // Fallback to cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  
  // Return cached version immediately
  if (cached) {
    // Refresh cache in background
    refreshCache(request);
    return cached;
  }

  // No cache, fetch from network
  return fetch(request);
}

// Fetch with timeout
function fetchWithTimeout(request, timeout = 5000) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    )
  ]);
}

// Refresh cache in background
async function refreshCache(request) {
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await getCacheForRequest(request);
      cache.put(request, response);
    }
  } catch (error) {
    console.error('[SW] Cache refresh failed:', error);
  }
}

// Get appropriate cache for request
async function getCacheForRequest(request) {
  const url = request.url;

  if (/\.(png|jpg|jpeg|svg|gif|webp)$/.test(url)) {
    return caches.open(CACHE_NAMES.images);
  }

  if (url.includes('/api/')) {
    return caches.open(CACHE_NAMES.api);
  }

  if (url.includes('/maps/')) {
    return caches.open(CACHE_NAMES.maps);
  }

  return caches.open(CACHE_NAMES.dynamic);
}

// Check if API response should be cached
function shouldCacheApiResponse(request) {
  const url = request.url;
  
  for (const pattern of CACHEABLE_API_PATTERNS) {
    if (pattern.test(url)) {
      return true;
    }
  }

  return false;
}

// Check if cache is expired
function isCacheExpired(cacheTime, maxAge) {
  const age = (Date.now() - parseInt(cacheTime)) / 1000;
  return age > maxAge;
}

// Background sync for offline reports
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reports') {
    event.waitUntil(syncOfflineReports());
  }
});

// Sync offline reports
async function syncOfflineReports() {
  const db = await openIndexedDB();
  const reports = await getOfflineReports(db);

  for (const report of reports) {
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(report)
      });

      if (response.ok) {
        await deleteOfflineReport(db, report.id);
        
        // Notify user of successful sync
        self.registration.showNotification('Report Synced', {
          body: 'Your offline report has been submitted successfully',
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png'
        });
      }
    } catch (error) {
      console.error('[SW] Sync failed for report:', report.id);
    }
  }
}

// IndexedDB operations
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SafeStreetsDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('offline-reports')) {
        db.createObjectStore('offline-reports', { keyPath: 'id' });
      }
    };
  });
}

// Get offline reports
function getOfflineReports(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offline-reports'], 'readonly');
    const store = transaction.objectStore('offline-reports');
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Delete offline report
function deleteOfflineReport(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offline-reports'], 'readwrite');
    const store = transaction.objectStore('offline-reports');
    const request = store.delete(id);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Push notification handling
self.addEventListener('push', (event) => {
  const options = {
    body: 'New safety alert in your area',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'view',
        title: 'View Alert'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('SafeStreets Alert', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/alerts')
    );
  }
});

// Message handling for cache updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});