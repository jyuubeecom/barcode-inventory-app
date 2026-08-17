"use strict";

/*
  v108 専用商品
  ・商品状態が「専用商品」の商品は通常の在庫管理には残す
  ・船便別の商品振り分け候補からは除外する
  ・すでに保存済みの過去の船積データは自動削除しない
*/

document.addEventListener(
  "DOMContentLoaded",
  initializeDedicatedProductFeature
);

let dedicatedProductInternalCodes =
  new Set();

let dedicatedProductRefreshTimer =
  null;

function initializeDedicatedProductFeature() {
  refreshDedicatedProductCodes();

  const allocationBody =
    document.querySelector(
      "#shipping-allocation-table-body"
    );

  if (allocationBody) {
    const observer =
      new MutationObserver(
        function () {
          scheduleDedicatedProductRefresh();
        }
      );

    observer.observe(
      allocationBody,
      {
        childList: true,
        subtree: true
      }
    );
  }

  document.addEventListener(
    "click",
    function (event) {
      const target =
        event.target instanceof Element
          ? event.target
          : null;

      if (!target) {
        return;
      }

      if (
        target.closest(
          "#show-shipping-schedule-button, " +
          "#show-shipping-allocation-button, " +
          "#jump-shipping-allocation-button"
        )
      ) {
        window.setTimeout(
          refreshDedicatedProductCodes,
          0
        );
      }
    }
  );

  document
    .querySelector(
      "#shipping-allocation-schedule"
    )
    ?.addEventListener(
      "change",
      function () {
        window.setTimeout(
          refreshDedicatedProductCodes,
          0
        );
      }
    );

  document
    .querySelector(
      "#shipping-allocation-search"
    )
    ?.addEventListener(
      "input",
      scheduleDedicatedProductRefresh
    );
}

function scheduleDedicatedProductRefresh() {
  if (dedicatedProductRefreshTimer) {
    window.clearTimeout(
      dedicatedProductRefreshTimer
    );
  }

  dedicatedProductRefreshTimer =
    window.setTimeout(
      function () {
        dedicatedProductRefreshTimer =
          null;

        refreshDedicatedProductCodes();
      },
      80
    );
}

async function refreshDedicatedProductCodes() {
  if (
    typeof getAllProducts !== "function"
  ) {
    return;
  }

  try {
    const products =
      await getAllProducts();

    dedicatedProductInternalCodes =
      new Set(
        (Array.isArray(products)
          ? products
          : []
        )
          .filter(
            isDedicatedProduct
          )
          .map(
            function (product) {
              return String(
                product.internalCode || ""
              ).trim();
            }
          )
          .filter(Boolean)
      );

    removeDedicatedProductsFromShippingAllocation();
  } catch (error) {
    console.error(
      "専用商品の船積除外判定エラー",
      error
    );
  }
}

function isDedicatedProduct(product) {
  const status =
    String(
      product &&
        product.productStatus ||
        ""
    )
      .normalize("NFKC")
      .trim()
      .toLowerCase();

  return (
    status === "専用商品" ||
    status === "専用" ||
    status === "dedicated" ||
    status === "exclusive"
  );
}

function removeDedicatedProductsFromShippingAllocation() {
  const body =
    document.querySelector(
      "#shipping-allocation-table-body"
    );

  if (!body) {
    return;
  }

  body
    .querySelectorAll("tr")
    .forEach(
      function (row) {
        const firstCell =
          row.querySelector("td");

        if (!firstCell) {
          return;
        }

        const internalCode =
          String(
            firstCell.textContent || ""
          ).trim();

        if (
          dedicatedProductInternalCodes.has(
            internalCode
          )
        ) {
          row.remove();
        }
      }
    );
}
