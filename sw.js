const CACHE_NAME = 'ahavatfit-v7'; // Force update to clear stale code
const urlsToCache = [
  '/',
  '/index.html',
  '/index.js',
  '/index.css',
  '/manifest.json',
  '/cookbook.json',
  '/workouts.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png'
];

self.addEventListener('install', event => {
  // Force the waiting service worker to become the active service worker.
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        // The addAll() method is atomic: if any of the files fail to be downloaded, the entire operation fails.
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Delete old caches
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of clients
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Determine if the request is for the core application shell or data.
  const isAppShellOrData = request.mode === 'navigate' || (
    url.origin === self.location.origin && (
      url.pathname === '/' ||
      url.pathname.endsWith('.html') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.json')
    )
  );

  // Use a Network First, falling back to Cache strategy for the app shell and data.
  // This ensures the user always has the latest version of the app if they are online.
  if (isAppShellOrData) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // If the fetch is successful, cache the new response for offline use.
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // If the network fails (user is offline), serve the cached version.
          return caches.match(request);
        })
    );
    return;
  }

  // Use a Cache First strategy for all other static assets (fonts, images).
  // These are less critical to update and benefit from fast loading from cache.
  event.respondWith(
    caches.match(request)
      .then(response => {
        // Return the cached version if found.
        if (response) {
          return response;
        }
        // If not in cache, fetch from the network, cache it, and then return it.
        return fetch(request).then(networkResponse => {
           if (networkResponse.ok) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseToCache);
              });
           }
          return networkResponse;
        });
      })
  );
});


// --- PUSH NOTIFICATION LISTENERS ---

self.addEventListener('push', event => {
  let data = { title: 'AhavatFit', body: 'Новое уведомление!', tag: 'general' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.error('Push event data parsing error:', e);
    }
  }

  const options = {
    body: data.body,
    icon: '/images/icon-192x192.png',
    badge: '/images/icon-192x192.png', // For Android
    vibrate: [100, 50, 100],
    tag: data.tag,
    data: {
      url: self.location.origin, // URL to open on click
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});


self.addEventListener('notificationclick', event => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const urlToOpen = event.notification.data.url || '/';
      
      // Check if there's already a window open with the target URL
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});