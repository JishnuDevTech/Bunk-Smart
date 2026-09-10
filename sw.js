const CACHE_NAME = 'bunk-smart-v3-shell';
const APP_SHELL = [
  './', './index.html', './dashboard.html', './css/global.css', './css/dashboard.css',
  './css/attendance.css', './css/insights.css', './css/challenges.css',
  './js/dashboard.js', './js/firebase.js', './assets/bunk-smart-mark.svg', './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
  )));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
