"use strict";

// 同じドメインの桜花・本番版・テスト版のキャッシュを分ける。
const CACHE_PREFIX = "barcode-inventory-app:" + encodeURIComponent(self.registration.scope) + ":";
const CACHE_NAME = CACHE_PREFIX + "v2933-stock-plan-validation-3";
const APP_FILES = [
  "./", "./index.html", "./style.css?v=108", "./storage.js?v=269",
  "./normal-shipment.js?v=226",
  "./manual.js?v=207",
  "./backorder-list.js?v=216",
  "./app.js?v=280", "./natural-stock-search.js?v=275", "./product-history.js?v=107", "./inventory.js?v=195", "./transfer-list.js?v=195", "./location-stock-report.js?v=258",
  "./libs/barcode-detector-zxing-adapter.js?v=31",
  "./libs/ZXING-LICENSE.txt",
  "./scanner.js?v=241", "./stocktaking.js?v=202",
  "./stocktaking-history.js?v=35", "./stocktaking-transfer.js?v=201",
  "./csv.js?v=90", "./csv-import.js?v=215", "./csv-update.js?v=74",
  "./sales-plan.js?v=2923", "./sales-actual.js?v=267", "./purchase-required.js?v=238", "./order-remaining.js?v=120", "./low-shipment.js?v=226", "./seasonal-trend.js?v=235",
  "./shipping-schedule.js?v=243", "./dedicated-product.js?v=215", "./shipping-arrival.js?v=118", "./barcode-print.js?v=142",
  "./disposal-list.js?v=246", "./backup.js?v=269", "./restore.js?v=269", "./location-management.js?v=100",
  "./processing-sheet.js?v=211",
  "./processing-conversion.js?v=213",
  "./single-stock-check.js?v=241", "./customer-master.js?v=270", "./server-test.js?v=292", "./server-csv-import.js?v=292", "./server-account-settings.js?v=2922", "./server-company-master-preview.js?v=2931", "./server-stock-csv-preview.js?v=29331", "./server-product-list.js?v=287", "./home-dashboard.js?v=269", "./app-settings.js?v=270", "./home-alerts.js?v=267", "./pwa.js?v=31", "./manifest.json",
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
          return name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME
            ? caches.delete(name) : Promise.resolve(false);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const scopeUrl = new URL(self.registration.scope);
  // APIや別アプリの応答（認証付き在庫を含む）はキャッシュしない。
  if (url.origin !== scopeUrl.origin || !url.pathname.startsWith(scopeUrl.pathname)) return;
  if (/\.php$/i.test(url.pathname) || request.headers?.has("Authorization")) return;

  const isAppCode =
    request.mode === "navigate" ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith("/manifest.json") ||
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
            return caches.match("./index.html", { cacheName: CACHE_NAME });
          }
          return caches.match(request, { cacheName: CACHE_NAME });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request, { cacheName: CACHE_NAME }).then(function (cached) {
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
