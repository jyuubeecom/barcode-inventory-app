"use strict";

(function () {
  let manualSearchInput = null;
  let manualStatus = null;
  let manualNoResults = null;
  let manualTopics = [];

  document.addEventListener("DOMContentLoaded", initializeManualFeature);

  function initializeManualFeature() {
    const showButton = document.querySelector("#show-manual-button");
    const backButton = document.querySelector("#back-home-from-manual");
    const clearButton = document.querySelector("#manual-search-clear");

    manualSearchInput = document.querySelector("#manual-search-input");
    manualStatus = document.querySelector("#manual-search-status");
    manualNoResults = document.querySelector("#manual-no-results");
    manualTopics = Array.from(document.querySelectorAll("#manual-topic-list .manual-topic"));

    if (!showButton || !document.querySelector("#manual-screen")) return;

    createManualStyle();

    showButton.addEventListener("click", openManualScreen);
    if (backButton) backButton.addEventListener("click", closeManualScreen);

    if (manualSearchInput) {
      manualSearchInput.addEventListener("input", filterManualTopics);
      manualSearchInput.addEventListener("search", filterManualTopics);
    }

    if (clearButton) {
      clearButton.addEventListener("click", function () {
        if (manualSearchInput) {
          manualSearchInput.value = "";
          manualSearchInput.focus();
        }
        filterManualTopics();
      });
    }

    filterManualTopics();
  }

  function openManualScreen() {
    document.querySelectorAll("main > section").forEach(function (section) {
      section.hidden = true;
    });

    const screen = document.querySelector("#manual-screen");
    if (!screen) return;

    screen.hidden = false;
    filterManualTopics();
    screen.scrollIntoView({ behavior: "smooth", block: "start" });

    window.setTimeout(function () {
      if (manualSearchInput) manualSearchInput.focus();
    }, 150);
  }

  function closeManualScreen() {
    const screen = document.querySelector("#manual-screen");
    if (screen) screen.hidden = true;

    if (window.inventoryApp && typeof window.inventoryApp.showScreen === "function") {
      window.inventoryApp.showScreen("home");
    } else {
      const home = document.querySelector("#home");
      if (home) home.hidden = false;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function filterManualTopics() {
    const query = normalizeManualText(manualSearchInput ? manualSearchInput.value : "");
    const tokens = query.split(/\s+/).filter(Boolean);
    let visibleCount = 0;

    manualTopics.forEach(function (topic) {
      const summary = topic.querySelector("summary");
      const searchableText = normalizeManualText(
        [
          summary ? summary.textContent : "",
          topic.textContent || "",
          topic.dataset.manualKeywords || ""
        ].join(" ")
      );

      const matches = tokens.length === 0 || tokens.every(function (token) {
        return searchableText.includes(token);
      });

      topic.hidden = !matches;

      if (matches) {
        visibleCount += 1;
        if (tokens.length > 0) topic.open = true;
      } else {
        topic.open = false;
      }
    });

    if (manualNoResults) manualNoResults.hidden = visibleCount !== 0;

    if (manualStatus) {
      if (tokens.length === 0) {
        manualStatus.textContent = `すべての項目を表示しています（${manualTopics.length}件）。`;
      } else {
        manualStatus.textContent = `「${manualSearchInput.value.trim()}」の検索結果：${visibleCount}件`;
      }
    }
  }

  function normalizeManualText(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[　・／/、。,.!?！？:：()（）\[\]［］「」『』]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function createManualStyle() {
    if (document.querySelector("#manual-feature-style")) return;

    const style = document.createElement("style");
    style.id = "manual-feature-style";
    style.textContent = `
      #show-manual-button {
        background-color: #455a64 !important;
      }

      #manual-screen[hidden] {
        display: none !important;
      }

      #manual-screen {
        max-width: 1080px;
        margin: 0 auto 32px;
        padding: 24px;
        background: #ffffff;
        border: 1px solid #d7e1ea;
        border-radius: 14px;
        box-shadow: 0 4px 16px rgba(31, 54, 77, 0.08);
      }

      .manual-heading {
        padding-bottom: 18px;
        border-bottom: 2px solid #90caf9;
      }

      .manual-kicker {
        display: block;
        margin-bottom: 4px;
        color: #546e7a;
        font-weight: 700;
        letter-spacing: 0.08em;
      }

      #manual-screen h2 {
        margin: 0 0 8px;
        color: #1565c0;
      }

      .manual-heading p {
        margin: 0;
        color: #455a64;
        line-height: 1.75;
      }

      .manual-search-card {
        margin-top: 20px;
        padding: 18px;
        background: #f3f8fd;
        border: 2px solid #90caf9;
        border-radius: 12px;
      }

      .manual-search-card label {
        display: block;
        margin-bottom: 8px;
        color: #123b63;
        font-size: 17px;
        font-weight: 700;
      }

      .manual-search-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
      }

      #manual-search-input {
        width: 100%;
        min-height: 48px;
        margin: 0;
        font-size: 16px;
      }

      #manual-search-clear {
        min-height: 48px;
        margin: 0;
        padding: 10px 18px;
        background: #607d8b;
      }

      .manual-search-status {
        margin: 10px 0 0;
        color: #455a64;
        font-weight: 700;
      }

      .manual-topic-list {
        display: grid;
        gap: 12px;
        margin-top: 18px;
      }

      .manual-topic {
        overflow: hidden;
        border: 1px solid #cfd8dc;
        border-radius: 10px;
        background: #ffffff;
      }

      .manual-topic[hidden] {
        display: none !important;
      }

      .manual-topic summary {
        position: relative;
        padding: 16px 48px 16px 18px;
        cursor: pointer;
        color: #123b63;
        background: #f7fafc;
        font-size: 17px;
        font-weight: 700;
        list-style: none;
      }

      .manual-topic summary::-webkit-details-marker {
        display: none;
      }

      .manual-topic summary::after {
        content: "+";
        position: absolute;
        top: 50%;
        right: 18px;
        transform: translateY(-50%);
        color: #1565c0;
        font-size: 24px;
      }

      .manual-topic[open] summary {
        background: #eaf4fd;
        border-bottom: 1px solid #d7e1ea;
      }

      .manual-topic[open] summary::after {
        content: "−";
      }

      .manual-topic-body {
        padding: 16px 20px 18px;
        color: #263238;
        line-height: 1.75;
      }

      .manual-topic-body ol {
        margin: 0;
        padding-left: 24px;
      }

      .manual-topic-body li + li {
        margin-top: 7px;
      }

      .manual-note {
        margin: 14px 0 0;
        padding: 12px 14px;
        background: #fff8e1;
        border-left: 5px solid #ffb300;
        border-radius: 6px;
      }

      .manual-no-results {
        margin-top: 18px;
        padding: 20px;
        text-align: center;
        color: #455a64;
        background: #f5f5f5;
        border-radius: 10px;
      }

      .manual-no-results[hidden] {
        display: none !important;
      }

      .manual-back-button {
        width: 100%;
        margin-top: 22px;
        background: #546e7a;
      }

      @media (max-width: 700px) {
        #manual-screen {
          padding: 14px;
          border-radius: 0;
        }

        .manual-search-row {
          grid-template-columns: 1fr;
        }

        #manual-search-clear {
          width: 100%;
        }

        .manual-topic summary {
          padding: 15px 44px 15px 14px;
          font-size: 16px;
        }

        .manual-topic-body {
          padding: 14px;
        }
      }
    `;
    document.head.appendChild(style);
  }
})();
