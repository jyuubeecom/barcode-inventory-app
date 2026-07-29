"use strict";

const CACHE_NAME =
  "barcode-inventory-app-v3";

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./storage.js",
  "./app.js",
  "./inventory.js",
  "./scanner.js",
  "./stocktaking.js",
  "./stocktaking-history.js",
  "./csv.js",
  "./csv-import.js",
  "./csv-update.js",
  "./pwa.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener(
  "install",
  function (event) {
    event.waitUntil(
      caches
        .open(CACHE_NAME)
        .then(
          function (cache) {
            return cache.addAll(
              APP_FILES
            );
          }
        )
        .then(
          function () {
            return self.skipWaiting();
          }
        )
    );
  }
);

self.addEventListener(
  "activate",
  function (event) {
    event.waitUntil(
      caches
        .keys()
        .then(
          function (cacheNames) {
            return Promise.all(
              cacheNames.map(
                function (cacheName) {
                  if (
                    cacheName !==
                    CACHE_NAME
                  ) {
                    return caches.delete(
                      cacheName
                    );
                  }

                  return Promise.resolve(
                    false
                  );
                }
              )
            );
          }
        )
        .then(
          function () {
            return self.clients.claim();
          }
        )
    );
  }
);

self.addEventListener(
  "fetch",
  function (event) {
    const request =
      event.request;

    if (
      request.method !== "GET"
    ) {
      return;
    }

    const requestUrl =
      new URL(request.url);

    if (
      requestUrl.origin !==
      self.location.origin
    ) {
      return;
    }

    if (
      request.mode ===
      "navigate"
    ) {
      event.respondWith(
        fetch(request)
          .then(
            function (response) {
              const responseCopy =
                response.clone();

              caches
                .open(CACHE_NAME)
                .then(
                  function (cache) {
                    cache.put(
                      "./index.html",
                      responseCopy
                    );
                  }
                );

              return response;
            }
          )
          .catch(
            function () {
              return caches.match(
                "./index.html"
              );
            }
          )
      );

      return;
    }

    event.respondWith(
      caches
        .match(request)
        .then(
          function (cachedResponse) {
            if (cachedResponse) {
              return cachedResponse;
            }

            return fetch(request)
              .then(
                function (networkResponse) {
                  if (
                    !networkResponse ||
                    networkResponse.status !== 200
                  ) {
                    return networkResponse;
                  }

                  const responseCopy =
                    networkResponse.clone();

                  caches
                    .open(CACHE_NAME)
                    .then(
                      function (cache) {
                        cache.put(
                          request,
                          responseCopy
                        );
                      }
                    );

                  return networkResponse;
                }
              );
          }
        )
    );
  }
);