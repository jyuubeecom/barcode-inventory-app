"use strict";

const ZXING_SCRIPT_URL =
  "https://unpkg.com/@zxing/browser@0.2.1";

const showBarcodeLookupButton =
  document.querySelector(
    "#show-barcode-lookup-button"
  );

const barcodeLookupScreen =
  document.querySelector(
    "#barcode-lookup"
  );

const barcodeLookupForm =
  document.querySelector(
    "#barcode-lookup-form"
  );

const barcodeLookupCodeInput =
  document.querySelector(
    "#barcode-lookup-code"
  );

const barcodeLookupMessage =
  document.querySelector(
    "#barcode-lookup-message"
  );

const cancelBarcodeLookupButton =
  document.querySelector(
    "#cancel-barcode-lookup-button"
  );

let cameraScannerScreen = null;
let cameraScannerVideo = null;
let cameraScannerMessage = null;
let cameraScannerResult = null;
let cameraStartButton = null;
let cameraRetryButton = null;
let cameraTorchButton = null;
let cameraManualButton = null;
let cameraCancelButton = null;

let barcodeReader = null;
let cameraControls = null;
let barcodeDetected = false;
let torchEnabled = false;
let cameraScannerMode = "normal";
let cameraAutoStartTimer = null;
let cameraCandidateValue = "";
let cameraCandidateCount = 0;
let cameraCandidateStartedAt = 0;
let cameraBarcodeProcessing = false;

const CAMERA_REQUIRED_CONFIRMATIONS = 2;
const CAMERA_CONFIRMATION_WINDOW_MS = 1800;

document.addEventListener(
  "DOMContentLoaded",
  initializeScanner
);

function initializeScanner() {
  createCameraScannerButton();
  createCameraScannerScreen();
  createCameraScannerStyle();

  showBarcodeLookupButton.addEventListener(
    "click",
    openBarcodeLookupScreen
  );

  barcodeLookupForm.addEventListener(
    "submit",
    handleBarcodeLookup
  );

  cancelBarcodeLookupButton.addEventListener(
    "click",
    closeBarcodeLookupScreen
  );

  barcodeLookupCodeInput.addEventListener(
    "input",
    function () {
      barcodeLookupMessage.textContent =
        "登録済みの商品を検索します。";
    }
  );

  window.addEventListener(
    "pagehide",
    stopCameraScan
  );
}

function createCameraScannerButton() {
  const existingCameraButton =
    document.querySelector(
      "#show-camera-scanner-button"
    );

  if (existingCameraButton) {
    existingCameraButton.removeEventListener(
      "click",
      openCameraScannerScreen
    );

    existingCameraButton.addEventListener(
      "click",
      openCameraScannerScreen
    );

    return;
  }

  const cameraButton =
    document.createElement("button");

  cameraButton.id =
    "show-camera-scanner-button";

  cameraButton.type = "button";

  cameraButton.textContent =
    "カメラでバーコードを読み取る";

  cameraButton.addEventListener(
    "click",
    openCameraScannerScreen
  );

  showBarcodeLookupButton.parentElement.insertBefore(
    cameraButton,
    showBarcodeLookupButton
  );
}

function createCameraScannerScreen() {
  if (
    document.querySelector(
      "#camera-scanner"
    )
  ) {
    cameraScannerScreen =
      document.querySelector(
        "#camera-scanner"
      );

    return;
  }

  cameraScannerScreen =
    document.createElement("section");

  cameraScannerScreen.id =
    "camera-scanner";

  cameraScannerScreen.hidden = true;

  cameraScannerScreen.innerHTML = `
    <h2>バーコード読み取り画面</h2>

    <p>
      商品のバーコードをカメラの中央に合わせてください。
    </p>

    <div class="scanner-camera-area">
      <video
        id="camera-scanner-video"
        playsinline
        muted
      ></video>

      <div class="scanner-guide">
        <span></span>
      </div>
    </div>

    <p id="camera-scanner-message">
      「カメラを開始する」を押してください。
    </p>

    <div>
      <label for="camera-scanner-result">
        読み取り結果
      </label>

      <input
        id="camera-scanner-result"
        type="text"
        readonly
        placeholder="読み取り結果が表示されます"
      >
    </div>

    <button
      id="camera-start-button"
      type="button"
    >
      カメラを開始する
    </button>

    <button
      id="camera-retry-button"
      type="button"
    >
      読み取りをやり直す
    </button>

    <button
      id="camera-torch-button"
      type="button"
      disabled
    >
      ライトを点灯
    </button>

    <button
      id="camera-manual-button"
      type="button"
    >
      手入力に切り替える
    </button>

    <button
      id="camera-cancel-button"
      type="button"
    >
      キャンセル
    </button>
  `;

  const mainElement =
    document.querySelector("main");

  mainElement.appendChild(
    cameraScannerScreen
  );

  cameraScannerVideo =
    document.querySelector(
      "#camera-scanner-video"
    );

  cameraScannerMessage =
    document.querySelector(
      "#camera-scanner-message"
    );

  cameraScannerResult =
    document.querySelector(
      "#camera-scanner-result"
    );

  cameraStartButton =
    document.querySelector(
      "#camera-start-button"
    );

  cameraRetryButton =
    document.querySelector(
      "#camera-retry-button"
    );

  cameraTorchButton =
    document.querySelector(
      "#camera-torch-button"
    );

  cameraManualButton =
    document.querySelector(
      "#camera-manual-button"
    );

  cameraCancelButton =
    document.querySelector(
      "#camera-cancel-button"
    );

  cameraStartButton.addEventListener(
    "click",
    startCameraScan
  );

  cameraRetryButton.addEventListener(
    "click",
    startCameraScan
  );

  cameraTorchButton.addEventListener(
    "click",
    toggleCameraTorch
  );

  cameraManualButton.addEventListener(
    "click",
    switchToManualLookup
  );

  cameraCancelButton.addEventListener(
    "click",
    closeCameraScannerScreen
  );
}

function createCameraScannerStyle() {
  if (
    document.querySelector(
      "#camera-scanner-style"
    )
  ) {
    return;
  }

  const styleElement =
    document.createElement("style");

  styleElement.id =
    "camera-scanner-style";

  styleElement.textContent = `
    .scanner-camera-area {
      position: relative;
      width: 100%;
      max-width: 700px;
      margin: 15px auto;
      overflow: hidden;
      border-radius: 12px;
      background-color: #000000;
    }

    #camera-scanner-video {
      display: block;
      width: 100%;
      min-height: 280px;
      max-height: 520px;
      background-color: #000000;
      object-fit: cover;
    }

    .scanner-guide {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 85%;
      height: 35%;
      transform: translate(-50%, -50%);
      border: 4px solid #ffffff;
      border-radius: 12px;
      box-shadow:
        0 0 0 9999px rgba(0, 0, 0, 0.35);
      pointer-events: none;
    }

    .scanner-guide span {
      position: absolute;
      top: 50%;
      left: 5%;
      width: 90%;
      height: 3px;
      background-color: #f44336;
      transform: translateY(-50%);
    }

    #camera-scanner-message {
      padding: 12px;
      border-radius: 8px;
      background-color: #e3f2fd;
      font-weight: bold;
      text-align: center;
    }

    #camera-scanner-result {
      margin-bottom: 12px;
      font-weight: bold;
    }

    #camera-torch-button {
      background-color: #ef6c00;
    }

    #camera-torch-button:disabled {
      background-color: #90a4ae;
      cursor: not-allowed;
    }

    #camera-manual-button {
      background-color: #546e7a;
    }

    #camera-cancel-button {
      background-color: #c62828;
    }

    @media (max-width: 700px) {
      #camera-scanner button {
        width: 100%;
        margin: 6px 0;
      }

      #camera-scanner-video {
        min-height: 330px;
      }

      .scanner-guide {
        width: 90%;
        height: 28%;
      }
    }
  `;

  document.head.appendChild(
    styleElement
  );
}

function openCameraScannerScreen() {
  openCameraScanner(
    "normal"
  );
}

function openCameraScannerForStocktaking() {
  openCameraScanner(
    "stocktaking"
  );
}

function openCameraScanner(mode) {
  cameraScannerMode =
    mode === "stocktaking"
      ? "stocktaking"
      : "normal";

  stopCameraScan();
  hideAllMainScreens();

  cameraScannerScreen.hidden = false;

  cameraScannerResult.value = "";

  const isStocktakingMode =
    cameraScannerMode ===
    "stocktaking";

  cameraScannerMessage.textContent =
    isStocktakingMode
      ? "棚卸用カメラを自動で起動しています。"
      : "カメラを自動で起動しています。";

  cameraTorchButton.disabled = true;
  cameraTorchButton.textContent =
    "ライトを点灯";

  cameraStartButton.textContent =
    "カメラを再開する";

  cameraRetryButton.textContent =
    "読み取りをやり直す";

  cameraManualButton.textContent =
    isStocktakingMode
      ? "棚卸商品を手入力で検索"
      : "手入力に切り替える";

  cameraCancelButton.textContent =
    isStocktakingMode
      ? "棚卸画面へ戻る"
      : "キャンセル";

  torchEnabled = false;
  barcodeDetected = false;

  scrollCameraScannerIntoView();

  cameraAutoStartTimer =
    window.setTimeout(
      function () {
        cameraAutoStartTimer =
          null;

        if (cameraScannerScreen.hidden) {
          return;
        }

        startCameraScan();
      },
      180
    );
}

function scrollCameraScannerIntoView() {
  window.requestAnimationFrame(
    function () {
      window.requestAnimationFrame(
        function () {
          if (
            !cameraScannerScreen ||
            cameraScannerScreen.hidden
          ) {
            return;
          }

          const header =
            document.querySelector(
              "header"
            );

          const headerOffset =
            header
              ? header.getBoundingClientRect()
                  .height + 8
              : 8;

          const targetTop = Math.max(
            0,
            window.scrollY +
              cameraScannerScreen
                .getBoundingClientRect()
                .top -
              headerOffset
          );

          window.scrollTo({
            top: targetTop,
            behavior: "auto"
          });
        }
      );
    }
  );
}

async function startCameraScan() {
  stopCameraScan();

  barcodeDetected = false;
  torchEnabled = false;
  cameraCandidateValue = "";
  cameraCandidateCount = 0;
  cameraCandidateStartedAt = 0;
  cameraBarcodeProcessing = false;

  cameraScannerResult.value = "";

  cameraTorchButton.disabled = true;
  cameraTorchButton.textContent =
    "ライトを点灯";

  cameraScannerMessage.textContent =
    "カメラを準備しています。";

  cameraStartButton.disabled = true;
  cameraRetryButton.disabled = true;

  try {
    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      throw new Error(
        "CAMERA_SECURE_CONTEXT_REQUIRED"
      );
    }

    await loadZxingLibrary();

    barcodeReader =
      new ZXingBrowser
        .BrowserMultiFormatReader();

    const videoConstraints = {
      audio: false,
      video: {
        facingMode: {
          ideal: "environment"
        },
        width: {
          ideal: 1280
        },
        height: {
          ideal: 720
        }
      }
    };

    cameraControls =
      await barcodeReader
        .decodeFromConstraints(
          videoConstraints,
          cameraScannerVideo,
          handleCameraDecode
        );

    if (
      cameraControls &&
      typeof cameraControls.switchTorch ===
        "function"
    ) {
      cameraTorchButton.disabled = false;
    }

    cameraScannerMessage.textContent =
      "バーコードを白い枠の中央に合わせてください。";
  } catch (error) {
    console.error(error);

    showCameraErrorMessage(error);
    stopCameraScan();
  } finally {
    cameraStartButton.disabled = false;
    cameraRetryButton.disabled = false;
  }
}

function handleCameraDecode(
  result,
  error,
  controls
) {
  if (
    !result ||
    barcodeDetected ||
    cameraBarcodeProcessing
  ) {
    return;
  }

  const detectedText =
    getResultText(result);

  if (detectedText === "") {
    return;
  }

  const now = Date.now();
  const isSameCandidate =
    cameraCandidateValue ===
      detectedText &&
    now - cameraCandidateStartedAt <=
      CAMERA_CONFIRMATION_WINDOW_MS;

  if (isSameCandidate) {
    cameraCandidateCount += 1;
  } else {
    cameraCandidateValue =
      detectedText;

    cameraCandidateCount = 1;
    cameraCandidateStartedAt = now;
  }

  cameraScannerResult.value =
    detectedText;

  if (
    cameraCandidateCount <
    CAMERA_REQUIRED_CONFIRMATIONS
  ) {
    cameraScannerMessage.textContent =
      `読み取り確認中：${detectedText}　` +
      "カメラを動かさず、そのまま合わせてください。";

    return;
  }

  barcodeDetected = true;
  cameraBarcodeProcessing = true;

  cameraScannerMessage.textContent =
    `読み取り成功：${detectedText}`;

  if (
    controls &&
    typeof controls.stop === "function"
  ) {
    controls.stop();
  }

  cameraControls = null;

  Promise.resolve(
    processBarcodeValue(
      detectedText,
      "camera"
    )
  ).finally(
    function () {
      cameraBarcodeProcessing = false;
    }
  );
}

function getResultText(result) {
  if (
    result &&
    typeof result.getText === "function"
  ) {
    return normalizeBarcodeValue(
      result.getText()
    );
  }

  return normalizeBarcodeValue(
    result.text
  );
}

async function toggleCameraTorch() {
  if (
    !cameraControls ||
    typeof cameraControls.switchTorch !==
      "function"
  ) {
    alert(
      "この端末またはカメラでは、ライトを操作できません。"
    );

    return;
  }

  try {
    await cameraControls.switchTorch();

    torchEnabled = !torchEnabled;

    cameraTorchButton.textContent =
      torchEnabled
        ? "ライトを消灯"
        : "ライトを点灯";
  } catch (error) {
    console.error(error);

    alert(
      "ライトを切り替えられませんでした。"
    );
  }
}

function stopCameraScan() {
  if (
    cameraAutoStartTimer !==
    null
  ) {
    window.clearTimeout(
      cameraAutoStartTimer
    );

    cameraAutoStartTimer =
      null;
  }

  if (
    cameraControls &&
    typeof cameraControls.stop ===
      "function"
  ) {
    try {
      cameraControls.stop();
    } catch (error) {
      console.error(error);
    }
  }

  cameraControls = null;

  if (
    cameraScannerVideo &&
    cameraScannerVideo.srcObject
  ) {
    const tracks =
      cameraScannerVideo
        .srcObject
        .getTracks();

    tracks.forEach(function (track) {
      track.stop();
    });

    cameraScannerVideo.srcObject = null;
  }

  cameraTorchButton.disabled = true;
  torchEnabled = false;

  cameraTorchButton.textContent =
    "ライトを点灯";
}

function closeCameraScannerScreen() {
  const returnMode =
    cameraScannerMode;

  stopCameraScan();

  cameraScannerScreen.hidden = true;

  cameraScannerResult.value = "";

  cameraScannerMode = "normal";

  if (
    returnMode === "stocktaking" &&
    window.stocktakingApp &&
    typeof window.stocktakingApp.returnFromScanner ===
      "function"
  ) {
    window.stocktakingApp.returnFromScanner(
      false
    );

    return;
  }

  window.inventoryApp.showScreen("home");
}

function switchToManualLookup() {
  const returnMode =
    cameraScannerMode;

  stopCameraScan();

  cameraScannerScreen.hidden = true;

  cameraScannerMode = "normal";

  if (
    returnMode === "stocktaking" &&
    window.stocktakingApp &&
    typeof window.stocktakingApp.returnFromScanner ===
      "function"
  ) {
    window.stocktakingApp.returnFromScanner(
      true
    );

    return;
  }

  openBarcodeLookupScreen();
}

function openBarcodeLookupScreen() {
  cameraScannerMode = "normal";

  stopCameraScan();
  hideAllMainScreens();

  cameraScannerScreen.hidden = true;
  barcodeLookupScreen.hidden = false;

  barcodeLookupForm.reset();

  barcodeLookupMessage.textContent =
    "登録済みの商品を検索します。";

  barcodeLookupCodeInput.focus();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function closeBarcodeLookupScreen() {
  barcodeLookupScreen.hidden = true;

  barcodeLookupForm.reset();

  window.inventoryApp.showScreen("home");
}

async function handleBarcodeLookup(event) {
  event.preventDefault();

  const enteredCode =
    normalizeBarcodeValue(
      barcodeLookupCodeInput.value
    );

  if (enteredCode === "") {
    alert(
      "社内コードまたはJANコードを入力してください。"
    );

    barcodeLookupCodeInput.focus();
    return;
  }

  barcodeLookupMessage.textContent =
    "商品を検索しています。";

  await processBarcodeValue(
    enteredCode,
    "manual"
  );
}

async function processBarcodeValue(
  barcodeValue,
  inputMethod
) {
  const enteredCode =
    normalizeBarcodeValue(
      barcodeValue
    );

  if (enteredCode === "") {
    alert(
      "バーコード番号を確認できませんでした。"
    );

    return;
  }

  if (cameraScannerMode === "stocktaking") {
    await processStocktakingBarcodeValue(
      enteredCode
    );

    return;
  }

  try {
    let savedProducts =
      await getAllProducts();

    let matchingProducts =
      findMatchingProductsByBarcode(
        savedProducts,
        enteredCode
      );

    if (
      matchingProducts.length === 0 &&
      inputMethod === "camera"
    ) {
      await waitForMilliseconds(250);

      savedProducts =
        await getAllProducts();

      matchingProducts =
        findMatchingProductsByBarcode(
          savedProducts,
          enteredCode
        );
    }

    if (matchingProducts.length > 1) {
      stopCameraScan();

      const message =
        "社内コードまたはJANコードが複数の商品に一致しました。";

      barcodeLookupMessage.textContent =
        message;

      cameraScannerMessage.textContent =
        message;

      alert(
        `${message}\n\n` +
        "商品一覧から登録内容を確認してください。"
      );

      return;
    }

    if (matchingProducts.length === 1) {
      stopCameraScan();

      const selectedProduct =
        matchingProducts[0];

      cameraScannerScreen.hidden = true;
      barcodeLookupScreen.hidden = true;

      window.inventoryApp.openDetailScreen(
        selectedProduct.internalCode
      );

      return;
    }

    stopCameraScan();

    const registrationConfirmed =
      window.confirm(
        "このバーコードは登録されていません。\n\n" +
        `バーコード番号：${enteredCode}\n\n` +
        "商品登録画面を開きますか？"
      );

    if (!registrationConfirmed) {
      if (inputMethod === "camera") {
        cameraScannerMessage.textContent =
          "未登録のバーコードです。読み取りをやり直せます。";

        cameraScannerScreen.hidden = false;
      } else {
        barcodeLookupMessage.textContent =
          "未登録の社内コード・JANコードです。";

        barcodeLookupCodeInput.focus();
        barcodeLookupCodeInput.select();
      }

      return;
    }

    openRegisterScreenWithJanCode(
      enteredCode
    );
  } catch (error) {
    console.error(error);

    barcodeLookupMessage.textContent =
      "商品を検索できませんでした。";

    cameraScannerMessage.textContent =
      "商品を検索できませんでした。";

    alert(
      "商品データを検索できませんでした。\n" +
      "もう一度確認してください。"
    );
  }
}

async function processStocktakingBarcodeValue(
  enteredCode
) {
  if (
    !window.stocktakingApp ||
    typeof window.stocktakingApp.handleBarcode !==
      "function"
  ) {
    cameraScannerMessage.textContent =
      "棚卸画面とバーコード読取を接続できませんでした。";

    alert(
      "棚卸画面とバーコード読取を接続できませんでした。\n\n" +
      "画面を更新して、もう一度棚卸を開いてください。"
    );

    return;
  }

  try {
    const result =
      await window.stocktakingApp.handleBarcode(
        enteredCode
      );

    if (
      result &&
      result.success
    ) {
      stopCameraScan();

      cameraScannerScreen.hidden = true;
      cameraScannerMode = "normal";

      return;
    }

    const message =
      result && result.message
        ? result.message
        : "棚卸対象の商品を確認できませんでした。";

    cameraScannerMessage.textContent =
      `${message} 「読み取りをやり直す」を押してください。`;

    alert(message);
  } catch (error) {
    console.error(error);

    cameraScannerMessage.textContent =
      "棚卸商品を確認できませんでした。";

    alert(
      "棚卸商品を確認できませんでした。\n\n" +
      "もう一度読み取ってください。"
    );
  }
}

function openRegisterScreenWithJanCode(
  janCode
) {
  const productForm =
    document.querySelector(
      "#product-form"
    );

  const internalCodeInput =
    document.querySelector(
      "#internal-code"
    );

  const stockInput =
    document.querySelector("#stock");

  const minStockInput =
    document.querySelector(
      "#min-stock"
    );

  const janCodeInput =
    document.querySelector("#jan-code");

  productForm.reset();

  stockInput.value = 0;
  minStockInput.value = 0;
  janCodeInput.value = janCode;

  cameraScannerScreen.hidden = true;
  barcodeLookupScreen.hidden = true;

  window.inventoryApp.showScreen(
    "register"
  );

  internalCodeInput.focus();
}

function hideAllMainScreens() {
  const allScreens =
    document.querySelectorAll(
      "main > section"
    );

  allScreens.forEach(function (screen) {
    screen.hidden = true;
  });
}

function normalizeBarcodeValue(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(
      /[\u0000-\u001F\u007F-\u009F\u200B-\u200D\u2060\uFEFF]/g,
      ""
    )
    .replace(/\s+/g, "")
    .trim();
}

function findMatchingProductsByBarcode(
  products,
  enteredCode
) {
  const normalizedEnteredCode =
    normalizeBarcodeValue(
      enteredCode
    );

  return products.filter(
    function (product) {
      const savedInternalCode =
        normalizeBarcodeValue(
          product.internalCode
        );

      const savedJanCode =
        normalizeBarcodeValue(
          product.janCode
        );

      return (
        savedInternalCode ===
          normalizedEnteredCode ||
        areEquivalentJanCodes(
          savedJanCode,
          normalizedEnteredCode
        )
      );
    }
  );
}

function areEquivalentJanCodes(
  savedJanCode,
  scannedCode
) {
  if (
    savedJanCode === "" ||
    scannedCode === ""
  ) {
    return false;
  }

  if (savedJanCode === scannedCode) {
    return true;
  }

  const savedIsNumeric =
    /^\d+$/.test(savedJanCode);

  const scannedIsNumeric =
    /^\d+$/.test(scannedCode);

  if (!savedIsNumeric || !scannedIsNumeric) {
    return false;
  }

  return (
    savedJanCode.length === 13 &&
    savedJanCode.startsWith("0") &&
    savedJanCode.slice(1) === scannedCode
  ) || (
    scannedCode.length === 13 &&
    scannedCode.startsWith("0") &&
    scannedCode.slice(1) === savedJanCode
  );
}

function waitForMilliseconds(milliseconds) {
  return new Promise(
    function (resolve) {
      window.setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}

function loadZxingLibrary() {
  if (window.ZXingBrowser) {
    return Promise.resolve();
  }

  return new Promise(
    function (resolve, reject) {
      const existingScript =
        document.querySelector(
          "script[data-zxing-browser]"
        );

      if (existingScript) {
        existingScript.addEventListener(
          "load",
          resolve,
          {
            once: true
          }
        );

        existingScript.addEventListener(
          "error",
          reject,
          {
            once: true
          }
        );

        return;
      }

      const script =
        document.createElement("script");

      script.src = ZXING_SCRIPT_URL;
      script.async = true;

      script.dataset.zxingBrowser =
        "true";

      script.addEventListener(
        "load",
        function () {
          if (window.ZXingBrowser) {
            resolve();
            return;
          }

          reject(
            new Error(
              "ZXING_LIBRARY_NOT_FOUND"
            )
          );
        }
      );

      script.addEventListener(
        "error",
        function () {
          reject(
            new Error(
              "ZXING_LIBRARY_LOAD_FAILED"
            )
          );
        }
      );

      document.head.appendChild(script);
    }
  );
}

function showCameraErrorMessage(error) {
  const errorName =
    error && error.name
      ? error.name
      : "";

  const errorMessage =
    error && error.message
      ? error.message
      : "";

  if (
    errorMessage ===
    "CAMERA_SECURE_CONTEXT_REQUIRED"
  ) {
    cameraScannerMessage.textContent =
      "カメラを使用できる方法でアプリが開かれていません。";

    alert(
      "カメラを使用できません。\n\n" +
      "index.htmlを直接開かず、Live Serverから起動してください。"
    );

    return;
  }

  if (
    errorName === "NotAllowedError" ||
    errorName === "SecurityError"
  ) {
    cameraScannerMessage.textContent =
      "カメラの使用が許可されていません。";

    alert(
      "カメラの使用が許可されていません。\n\n" +
      "ブラウザーのカメラ許可を「許可」に変更してください。\n\n" +
      getStocktakingManualGuidance()
    );

    return;
  }

  if (
    errorName === "NotFoundError" ||
    errorName === "DevicesNotFoundError"
  ) {
    cameraScannerMessage.textContent =
      "使用できるカメラが見つかりません。";

    alert(
      "使用できるカメラが見つかりません。\n\n" +
      "カメラ付きの端末で確認してください。"
    );

    return;
  }

  if (
    errorName === "NotReadableError" ||
    errorName === "TrackStartError"
  ) {
    cameraScannerMessage.textContent =
      "カメラを起動できませんでした。";

    alert(
      "ほかのアプリがカメラを使用している可能性があります。\n\n" +
      "カメラアプリやビデオ会議アプリを閉じてください。"
    );

    return;
  }

  if (
    errorMessage ===
      "ZXING_LIBRARY_LOAD_FAILED" ||
    errorMessage ===
      "ZXING_LIBRARY_NOT_FOUND"
  ) {
    cameraScannerMessage.textContent =
      "バーコード読み取り機能を読み込めませんでした。";

    alert(
      "バーコード読み取り機能を読み込めませんでした。\n\n" +
      "インターネット接続を確認してください。"
    );

    return;
  }

  cameraScannerMessage.textContent =
    "カメラを起動できませんでした。";

  alert(
    "カメラを起動できませんでした。\n\n" +
    "ブラウザーのカメラ設定を確認してください。\n\n" +
    getStocktakingManualGuidance()
  );
}

function getStocktakingManualGuidance() {
  if (
    cameraScannerMode ===
    "stocktaking"
  ) {
    return (
      "読み取れない場合は、" +
      "「棚卸商品を手入力で検索」を押してください。"
    );
  }

  return (
    "読み取れない場合は、" +
    "「手入力に切り替える」を押してください。"
  );
}

window.barcodeScanner = {
  openForStocktaking:
    openCameraScannerForStocktaking
};
