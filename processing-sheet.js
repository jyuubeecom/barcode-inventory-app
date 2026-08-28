"use strict";

(function () {
  document.addEventListener("DOMContentLoaded", initializeProcessingSheet);

  function initializeProcessingSheet() {
    const showButton = document.querySelector("#show-processing-sheet-button");
    const screen = document.querySelector("#processing-sheet-screen");
    const printButton = document.querySelector("#print-processing-sheet-button");
    const backButton = document.querySelector("#back-home-from-processing-sheet");

    if (!showButton || !screen) return;

    createProcessingSheetStyle();

    showButton.addEventListener("click", function () {
      document.querySelectorAll("main > section").forEach(function (section) {
        section.hidden = true;
      });

      screen.hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    if (printButton) {
      printButton.addEventListener("click", printProcessingSheet);
    }

    if (backButton) {
      backButton.addEventListener("click", function () {
        screen.hidden = true;

        if (
          window.inventoryApp &&
          typeof window.inventoryApp.showScreen === "function"
        ) {
          window.inventoryApp.showScreen("home");
        } else {
          const home = document.querySelector("#home");
          if (home) home.hidden = false;
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  function printProcessingSheet() {
    const paper = document.querySelector("#processing-sheet-paper");
    if (!paper) return;

    const printWindow = window.open("", "_blank", "width=900,height=1000");

    if (!printWindow) {
      window.alert(
        "印刷画面を開けませんでした。ブラウザのポップアップを許可してから、もう一度お試しください。"
      );
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>加工・商品切替 記入シート</title>
  <style>
    @page {
      size: 182mm 257mm;
      margin: 6mm;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #111111;
      font-family: "Yu Gothic", "Meiryo", sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-size: 8.7pt;
      line-height: 1.15;
    }

    .processing-paper {
      width: 100%;
      margin: 0;
      padding: 0;
      border: 1pt solid #111111;
    }

    .processing-paper-title {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 6mm;
      padding: 2.2mm 3mm 2mm;
      border-bottom: 0.8pt solid #111111;
    }

    .processing-paper-title h1 {
      margin: 0;
      font-size: 13pt;
      letter-spacing: 0.04em;
    }

    .processing-paper-title p {
      margin: 0;
      font-size: 7pt;
      white-space: nowrap;
    }

    .processing-table {
      width: 100%;
      table-layout: fixed;
      border-collapse: collapse;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .processing-table th,
    .processing-table td {
      height: 9.5mm;
      padding: 1.2mm 2mm;
      border-right: 0.5pt solid #777777;
      border-bottom: 0.5pt solid #777777;
      vertical-align: middle;
    }

    .processing-table th {
      width: 16%;
      font-size: 7.4pt;
      font-weight: 800;
      text-align: left;
      white-space: nowrap;
    }

    .processing-table td {
      width: 34%;
    }

    .processing-table tr > *:last-child {
      border-right: 0;
    }

    .processing-basic-table,
    .processing-confirm-table {
      border-bottom: 0.8pt solid #111111;
    }

    .processing-section {
      border-bottom: 0.8pt solid #111111;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .processing-section-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4mm;
      min-height: 6.5mm;
      padding: 1mm 2mm;
      background: #eeeeee;
      border-bottom: 0.6pt solid #111111;
      font-size: 9.5pt;
      font-weight: 800;
    }

    .processing-section-heading small {
      font-size: 6.8pt;
      font-weight: 500;
    }

    .processing-product-table .processing-quantity-row th,
    .processing-product-table .processing-quantity-row td {
      height: 13mm;
      font-size: 8.8pt;
    }

    .processing-arrow {
      padding: 0.7mm 0;
      text-align: center;
      font-size: 9.5pt;
      font-weight: 900;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .processing-loss-table th {
      width: 24%;
    }

    .processing-loss-table td {
      width: 76%;
    }

    .processing-notes {
      min-height: 18mm;
      padding: 1.2mm 2mm;
      border-bottom: 0.5pt solid #777777;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .processing-notes strong {
      display: block;
      margin-bottom: 0.7mm;
      font-size: 7.4pt;
    }

    .processing-note-line {
      display: block;
      height: 5mm;
      border-bottom: 0.6pt solid #111111;
    }

    .processing-footer-note {
      margin: 0;
      padding: 1.5mm 2.5mm;
      border-top: 0.8pt solid #111111;
      font-size: 6.8pt;
      font-weight: 700;
    }

    @media screen {
      body {
        padding: 16px;
      }
    }
  </style>
</head>
<body>
${paper.outerHTML}
<script>
  window.addEventListener("load", function () {
    window.setTimeout(function () {
      window.print();
    }, 200);
  });
<\/script>
</body>
</html>`);
    printWindow.document.close();
  }

  function createProcessingSheetStyle() {
    if (document.querySelector("#processing-sheet-feature-style")) return;

    const style = document.createElement("style");
    style.id = "processing-sheet-feature-style";
    style.textContent = `
      #processing-sheet-screen[hidden] {
        display: none !important;
      }

      #processing-sheet-screen {
        max-width: 1000px;
        margin: 0 auto 40px;
        padding: 24px;
      }

      .processing-screen-heading {
        margin-bottom: 18px;
        padding: 20px 22px;
        background: #ffffff;
        border: 1px solid #d7e1ea;
        border-radius: 14px;
        box-shadow: 0 4px 16px rgba(31, 54, 77, 0.08);
      }

      .processing-screen-heading h2 {
        margin: 0 0 8px;
        color: #1565c0;
      }

      .processing-screen-heading p {
        margin: 0;
        color: #455a64;
      }

      .processing-screen-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin: 18px 0;
      }

      #print-processing-sheet-button {
        background: #1565c0;
        color: #ffffff;
        font-weight: 800;
      }

      #back-home-from-processing-sheet {
        background: #607d8b;
        color: #ffffff;
      }

      .processing-preview-note {
        margin: 0 0 14px;
        padding: 12px 14px;
        background: #fff8e1;
        border-left: 5px solid #ffb300;
        color: #5d4037;
        border-radius: 8px;
      }

      .processing-paper-wrap {
        overflow: auto;
        padding: 20px;
        background: #e9eef3;
        border-radius: 14px;
      }

      .processing-paper {
        width: min(100%, 700px);
        margin: 0 auto;
        padding: 0;
        background: #ffffff;
        color: #111111;
        border: 2px solid #222222;
        box-shadow: 0 5px 18px rgba(0, 0, 0, 0.12);
        font-family: "Yu Gothic", "Meiryo", sans-serif;
      }

      .processing-paper-title {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 18px;
        padding: 18px 20px 14px;
        border-bottom: 2px solid #222222;
      }

      .processing-paper-title h1 {
        margin: 0;
        font-size: 28px;
      }

      .processing-paper-title p {
        margin: 0;
        font-size: 13px;
      }

      .processing-table {
        width: 100%;
        table-layout: fixed;
        border-collapse: collapse;
      }

      .processing-table th,
      .processing-table td {
        height: 60px;
        padding: 10px 12px;
        border-right: 1px solid #999999;
        border-bottom: 1px solid #999999;
        vertical-align: middle;
      }

      .processing-table th {
        width: 16%;
        background: #fafafa;
        font-size: 14px;
        text-align: left;
        white-space: nowrap;
      }

      .processing-table td {
        width: 34%;
      }

      .processing-table tr > *:last-child {
        border-right: 0;
      }

      .processing-basic-table,
      .processing-confirm-table {
        border-bottom: 2px solid #222222;
      }

      .processing-section {
        border-bottom: 2px solid #222222;
      }

      .processing-section-heading {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 10px 14px;
        background: #eeeeee;
        border-bottom: 1px solid #222222;
        font-size: 18px;
        font-weight: 900;
      }

      .processing-section-heading small {
        font-size: 12px;
        font-weight: 500;
      }

      .processing-product-table .processing-quantity-row th,
      .processing-product-table .processing-quantity-row td {
        height: 78px;
        font-size: 15px;
      }

      .processing-arrow {
        padding: 8px;
        text-align: center;
        font-size: 24px;
        font-weight: 900;
      }

      .processing-loss-table th {
        width: 24%;
      }

      .processing-loss-table td {
        width: 76%;
      }

      .processing-notes {
        min-height: 90px;
        padding: 10px 14px;
        border-bottom: 1px solid #999999;
      }

      .processing-notes strong {
        display: block;
        margin-bottom: 8px;
      }

      .processing-note-line {
        display: block;
        height: 28px;
        border-bottom: 1px solid #222222;
      }

      .processing-footer-note {
        margin: 0;
        padding: 12px 16px;
        font-size: 12px;
        font-weight: 800;
      }

      @media (max-width: 700px) {
        #processing-sheet-screen {
          padding: 12px;
        }

        .processing-paper-wrap {
          padding: 10px;
        }

        .processing-paper {
          min-width: 620px;
        }
      }
    `;

    document.head.appendChild(style);
  }
})();
