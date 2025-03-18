const CACHE_NAME = 'shib-tracker-v1';
const CACHE_URLS = [
    '/',
    '/index.html',
    '/styles.css',
    '/script.js',
    'shiba-inu-shib-logo.png',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CACHE_URLS))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});