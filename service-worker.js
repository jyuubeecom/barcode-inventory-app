
"use strict";

const CACHE_NAME = "barcode-inventory-app-v50";
const APP_FILES = [
  "./", "./index.html", "./style.css", "./storage.js?v=47",
  "./app.js?v=46", "./inventory.js",
  "./libs/barcode-detector-zxing-adapter.js?v=31",
  "./libs/ZXING-LICENSE.txt",
  "./scanner.js?v=31", "./stocktaking.js?v=31",
  "./stocktaking-history.js?v=33", "./stocktaking-transfer.js?v=31",
  "./csv.js?v=31", "./csv-import.js?v=31", "./csv-update.js?v=31",
  "./sales-plan.js?v=37", "./sales-actual.js?v=39", "./purchase-required.js?v=46", "./low-shipment.js?v=45", "./shipping-schedule.js?v=47", "./barcode-print.js?v=50", "./backup.js?v=48", "./restore.js?v=48", "./location-management.js?v=32",
  "./home-dashboard.js?v=42", "./pwa.js?v=31", "./manifest.json",
  "./icons/icon-192.png", "./icons/icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (names) {
        return Promise.all(names.map(function (name) {
          return name === CACHE_NAME ? Promise.resolve(false) : caches.delete(name);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put("./index.html", copy); });
          return response;
        })
        .catch(function () { return caches.match("./index.html"); })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (!response || response.status !== 200) return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
        return response;
      });
    })
  );
});
