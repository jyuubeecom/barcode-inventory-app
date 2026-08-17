"use strict";

const CACHE_NAME = "barcode-inventory-app-v101";
const APP_FILES = [
  "./", "./index.html", "./style.css?v=101", "./storage.js?v=65",
  "./app.js?v=101", "./product-history.js?v=101", "./inventory.js?v=97", "./transfer-list.js?v=81",
  "./libs/barcode-detector-zxing-adapter.js?v=31",
  "./libs/ZXING-LICENSE.txt",
  "./scanner.js?v=88", "./stocktaking.js?v=80",
  "./stocktaking-history.js?v=33", "./stocktaking-transfer.js?v=80",
  "./csv.js?v=90", "./csv-import.js?v=75", "./csv-update.js?v=74",
  "./sales-plan.js?v=95", "./sales-actual.js?v=71", "./purchase-required.js?v=59", "./low-shipment.js?v=45",
  "./shipping-schedule.js?v=58", "./shipping-arrival.js?v=52", "./barcode-print.js?v=89",
  "./backup.js?v=73", "./restore.js?v=72", "./location-management.js?v=100",
  "./home-dashboard.js?v=96", "./app-settings.js?v=99", "./pwa.js?v=31", "./manifest.json",
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

  const isAppCode =
    request.mode === "navigate" ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith("/index.html");

  if (isAppCode) {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then(function (response) {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request.mode === "navigate" ? "./index.html" : request, copy);
            });
          }
          return response;
        })
        .catch(function () {
          if (request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return caches.match(request);
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) return cached;

      return fetch(request).then(function (response) {
        if (!response || response.status !== 200) return response;

        const copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, copy);
        });
        return response;
      });
    })
  );
});
