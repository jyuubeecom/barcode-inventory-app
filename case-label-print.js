"use strict";

(function () {
  const button = document.querySelector("#print-case-label-button");
  if (!button) return;

  const fields = [
    ["社内コード", "#detail-internal-code", 5, createCode128Svg],
    ["商品コード", "#detail-product-code", 3, createCode128Svg],
    ["JANコード", "#detail-jan-code", 2, value => createJanSvg(value.replace(/\s+/g, ""))]
  ];

  button.addEventListener("click", function () {
    const codes = fields.map(function ([, selector]) {
      return document.querySelector(selector).textContent.trim() || "未登録";
    });
    const preview = window.open("", "_blank");
    if (!preview) {
      window.alert("印刷画面を開けませんでした。ポップアップを許可してからもう一度お試しください。");
      return;
    }

    // 印刷文書を先に作り、コードの文字列は下で textContent に設定する。
    preview.document.open();
    preview.document.write(`<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ケースラベル（B5横）</title>
<style>
  @page { size: 257mm 182mm; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px; background: #edf1f5; color: #000; font-family: "Yu Gothic UI", Meiryo, sans-serif; }
  .controls, main { max-width: 237mm; margin: 0 auto; }
  .controls { padding-bottom: 16px; }
  button { padding: 10px 22px; font: inherit; font-weight: bold; border: 0; border-radius: 6px; background: #1565c0; color: white; cursor: pointer; }
  main { background: white; border: 1px solid; aspect-ratio: 237 / 161; container-type: inline-size; display: grid; grid-template-rows: var(--row-heights); }
  .row { position: relative; display: flex; flex-direction: column; justify-content: center; text-align: center; gap: 1cqw; min-width: 0; padding: 1cqw 5cqw; }
  .row + .row { border-top: 1px solid; }
  .caption { font-size: 3.5cqw; font-weight: bold; }
  .code { font: 700 var(--code-size)/1.1 Arial, "Yu Gothic", Meiryo, sans-serif; white-space: pre; }
  .case-barcode { position: absolute; right: 2cqw; bottom: 1cqw; height: 5cqw; background: white; }
  @media print {
    body { padding: 0; background: white; }
    .controls { display: none; }
    main { width: 237mm; height: 161mm; aspect-ratio: auto; break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="controls">
    <button type="button">印刷する</button>
    <p>印刷設定で「B5（JIS）」「横向き」「倍率100%」を確認してください。</p>
  </div>
  <main aria-label="ケースラベル"></main>
</body>
</html>`);
    preview.document.close();

    const doc = preview.document;
    const label = doc.querySelector("main");
    label.style.setProperty("--row-heights", fields.map(([, , weight]) => `minmax(0, ${weight}fr)`).join(" "));
    const measurement = doc.createElement("canvas").getContext("2d");
    measurement.font = '700 100px Arial, "Yu Gothic", Meiryo, sans-serif';
    fields.forEach(function ([caption, , weight, createBarcode], index) {
      const row = doc.createElement("div");
      row.className = "row";
      const heading = doc.createElement("div");
      heading.className = "caption";
      heading.textContent = caption;
      const code = doc.createElement("div");
      code.className = "code";
      code.textContent = codes[index];
      row.append(heading, code);
      const template = doc.createElement("template");
      template.innerHTML = createBarcode(codes[index]);
      const barcode = template.content.querySelector("svg");
      let textWidth = 89;
      if (barcode) {
        const units = barcode.viewBox.baseVal.width;
        const barcodeWidth = Math.min(24, units * 0.16);
        // 左右に同じ余白を確保して、文字の中心を保つ。
        textWidth = Math.min(textWidth, 100 - 2 * (barcodeWidth + 3));
        barcode.setAttribute("class", "case-barcode");
        barcode.setAttribute("aria-label", caption + "のバーコード");
        barcode.style.width = barcodeWidth + "cqw";
        row.appendChild(barcode);
      }
      const widthAt100px = measurement.measureText(code.textContent).width;
      code.style.setProperty("--code-size", Math.min(2.8 * weight, textWidth * 100 / widthAt100px) + "cqw");
      label.append(row);
    });

    doc.querySelector("button").addEventListener("click", function () {
      preview.print();
    });
    preview.focus();
  });
})();
