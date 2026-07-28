"use strict";

let stocktakingStartButton = null;
let stocktakingSetupScreen = null;
let stocktakingActiveScreen = null;

let stocktakingSetupForm = null;
let stocktakingDateInput = null;
let stocktakingPersonInput = null;
let stocktakingLocationInput = null;

let activeStocktakingId = null;
let activeStocktakingDate = null;
let activeStocktakingPerson = null;
let activeStocktakingLocation = null;
let activeStocktakingStatus = null;
let activeStocktakingStartedAt = null;

let cancelStocktakingSetupButton = null;
let backHomeFromStocktakingButton = null;
let deleteStocktakingButton = null;

document.addEventListener(
  "DOMContentLoaded",
  initializeStocktaking
);

function initializeStocktaking() {
  createStocktakingStartButton();
  createStocktakingScreens();
  createStocktakingStyle();
}

function createStocktakingStartButton() {
  if (
    document.querySelector(
      "#show-stocktaking-button"
    )
  ) {
    return;
  }

  const historyButton =
    document.querySelector(
      "#show-history-button"
    );

  stocktakingStartButton =
    document.createElement("button");

  stocktakingStartButton.id =
    "show-stocktaking-button";

  stocktakingStartButton.type =
    "button";

  stocktakingStartButton.textContent =
    "棚卸を開始する";

  stocktakingStartButton.addEventListener(
    "click",
    openStocktakingStart
  );

  historyButton.parentElement.appendChild(
    stocktakingStartButton
  );
}

function createStocktakingScreens() {
  const mainElement =
    document.querySelector("main");

  stocktakingSetupScreen =
    document.createElement("section");

  stocktakingSetupScreen.id =
    "stocktaking-setup";

  stocktakingSetupScreen.hidden = true;

  stocktakingSetupScreen.innerHTML = `
    <h2>棚卸開始画面</h2>

    <p>
      棚卸日、担当者、保管場所を入力してください。
    </p>

    <form id="stocktaking-setup-form">
      <div>
        <label for="stocktaking-date">
          棚卸日（必須）
        </label>

        <input
          id="stocktaking-date"
          type="date"
          required
        >
      </div>

      <div>
        <label for="stocktaking-person">
          担当者（必須）
        </label>

        <input
          id="stocktaking-person"
          type="text"
          placeholder="例：テスト担当者"
          required
        >
      </div>

      <div>
        <label for="stocktaking-location">
          保管場所
        </label>

        <input
          id="stocktaking-location"
          type="text"
          placeholder="例：架空倉庫A"
        >

        <small>
          空欄の場合は、すべての保管場所を対象にします。
        </small>
      </div>

      <button type="submit">
        この内容で棚卸を開始する
      </button>

      <button
        id="cancel-stocktaking-setup-button"
        type="button"
      >
        キャンセル
      </button>
    </form>
  `;

  stocktakingActiveScreen =
    document.createElement("section");

  stocktakingActiveScreen.id =
    "stocktaking-active";

  stocktakingActiveScreen.hidden = true;

  stocktakingActiveScreen.innerHTML = `
    <h2>棚卸中</h2>

    <p class="stocktaking-notice">
      棚卸を開始しました。
    </p>

    <table>
      <tbody>
        <tr>
          <th>棚卸日</th>
          <td id="active-stocktaking-date"></td>
        </tr>

        <tr>
          <th>担当者</th>
          <td id="active-stocktaking-person"></td>
        </tr>

        <tr>
          <th>保管場所</th>
          <td id="active-stocktaking-location"></td>
        </tr>

        <tr>
          <th>状態</th>
          <td id="active-stocktaking-status"></td>
        </tr>

        <tr>
          <th>開始日時</th>
          <td id="active-stocktaking-started-at"></td>
        </tr>
      </tbody>
    </table>

    <p>
      次の作業で、商品を選んで実在庫を入力する画面を追加します。
    </p>

    <button
      id="back-home-from-stocktaking-button"
      type="button"
    >
      ホームへ戻る
    </button>

    <button
      id="delete-stocktaking-button"
      type="button"
    >
      この棚卸を取り消す
    </button>
  `;

  mainElement.appendChild(
    stocktakingSetupScreen
  );

  mainElement.appendChild(
    stocktakingActiveScreen
  );

  stocktakingSetupForm =
    document.querySelector(
      "#stocktaking-setup-form"
    );

  stocktakingDateInput =
    document.querySelector(
      "#stocktaking-date"
    );

  stocktakingPersonInput =
    document.querySelector(
      "#stocktaking-person"
    );

  stocktakingLocationInput =
    document.querySelector(
      "#stocktaking-location"
    );

  cancelStocktakingSetupButton =
    document.querySelector(
      "#cancel-stocktaking-setup-button"
    );

  backHomeFromStocktakingButton =
    document.querySelector(
      "#back-home-from-stocktaking-button"
    );

  deleteStocktakingButton =
    document.querySelector(
      "#delete-stocktaking-button"
    );

  activeStocktakingDate =
    document.querySelector(
      "#active-stocktaking-date"
    );

  activeStocktakingPerson =
    document.querySelector(
      "#active-stocktaking-person"
    );

  activeStocktakingLocation =
    document.querySelector(
      "#active-stocktaking-location"
    );

  activeStocktakingStatus =
    document.querySelector(
      "#active-stocktaking-status"
    );

  activeStocktakingStartedAt =
    document.querySelector(
      "#active-stocktaking-started-at"
    );

  stocktakingSetupForm.addEventListener(
    "submit",
    handleStocktakingStart
  );

  cancelStocktakingSetupButton.addEventListener(
    "click",
    returnHomeFromStocktaking
  );

  backHomeFromStocktakingButton.addEventListener(
    "click",
    returnHomeFromStocktaking
  );

  deleteStocktakingButton.addEventListener(
    "click",
    handleDeleteStocktaking
  );
}

function createStocktakingStyle() {
  if (
    document.querySelector(
      "#stocktaking-style"
    )
  ) {
    return;
  }

  const styleElement =
    document.createElement("style");

  styleElement.id =
    "stocktaking-style";

  styleElement.textContent = `
    #show-stocktaking-button {
      background-color: #6a1b9a;
    }

    #stocktaking-active table {
      width: 100%;
      margin-bottom: 20px;
      border-collapse: collapse;
    }

    #stocktaking-active th,
    #stocktaking-active td {
      padding: 12px;
      border: 1px solid #cfd8dc;
      text-align: left;
    }

    #stocktaking-active th {
      width: 180px;
      background-color: #6a1b9a;
      color: #ffffff;
    }

    .stocktaking-notice {
      padding: 14px;
      border-radius: 8px;
      background-color: #ede7f6;
      color: #4a148c;
      font-size: 18px;
      font-weight: bold;
    }

    #delete-stocktaking-button {
      background-color: #c62828;
    }

    @media (max-width: 700px) {
      #stocktaking-setup button,
      #stocktaking-active button {
        width: 100%;
        margin: 6px 0;
      }

      #stocktaking-active th {
        width: 120px;
      }
    }
  `;

  document.head.appendChild(
    styleElement
  );
}

async function openStocktakingStart() {
  try {
    const openStocktakings =
      await getOpenStocktakingSessions();

    openStocktakings.sort(
      function (
        stocktakingA,
        stocktakingB
      ) {
        return (
          new Date(
            stocktakingB.startedAt
          ).getTime() -
          new Date(
            stocktakingA.startedAt
          ).getTime()
        );
      }
    );

    if (openStocktakings.length > 0) {
      const latestStocktaking =
        openStocktakings[0];

      const resumeConfirmed =
        window.confirm(
          "進行中の棚卸があります。\n\n" +
          `棚卸日：${latestStocktaking.stocktakingDate}\n` +
          `担当者：${latestStocktaking.person}\n` +
          `保管場所：${latestStocktaking.location}\n\n` +
          "この棚卸を開きますか？"
        );

      if (resumeConfirmed) {
        showActiveStocktaking(
          latestStocktaking
        );

        return;
      }
    }
  } catch (error) {
    console.error(error);

    alert(
      "進行中の棚卸を確認できませんでした。"
    );
  }

  showStocktakingSetupScreen();
}

function showStocktakingSetupScreen() {
  hideAllMainScreensForStocktaking();

  stocktakingSetupScreen.hidden = false;

  stocktakingSetupForm.reset();

  stocktakingDateInput.value =
    getTodayDateText();

  stocktakingPersonInput.focus();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

async function handleStocktakingStart(
  event
) {
  event.preventDefault();

  const stocktakingDate =
    stocktakingDateInput.value;

  const person =
    stocktakingPersonInput.value.trim();

  const enteredLocation =
    stocktakingLocationInput.value.trim();

  const location =
    enteredLocation === ""
      ? "すべての保管場所"
      : enteredLocation;

  if (stocktakingDate === "") {
    alert(
      "棚卸日を入力してください。"
    );

    stocktakingDateInput.focus();
    return;
  }

  if (person === "") {
    alert(
      "担当者を入力してください。"
    );

    stocktakingPersonInput.focus();
    return;
  }

  const confirmationMessage =
    "この内容で棚卸を開始しますか？\n\n" +
    `棚卸日：${stocktakingDate}\n` +
    `担当者：${person}\n` +
    `保管場所：${location}`;

  const isConfirmed =
    window.confirm(
      confirmationMessage
    );

  if (!isConfirmed) {
    return;
  }

  const startedAt =
    new Date().toISOString();

  const stocktaking = {
    id: createStocktakingId(),
    stocktakingDate:
      stocktakingDate,
    person: person,
    location: location,
    status: "進行中",
    startedAt: startedAt,
    confirmedAt: "",
    items: []
  };

  try {
    await saveStocktakingSession(
      stocktaking
    );

    showActiveStocktaking(
      stocktaking
    );

    alert(
      "棚卸を開始しました。"
    );
  } catch (error) {
    console.error(error);

    alert(
      "棚卸開始情報を保存できませんでした。"
    );
  }
}

function showActiveStocktaking(
  stocktaking
) {
  activeStocktakingId =
    stocktaking.id;

  activeStocktakingDate.textContent =
    stocktaking.stocktakingDate;

  activeStocktakingPerson.textContent =
    stocktaking.person;

  activeStocktakingLocation.textContent =
    stocktaking.location;

  activeStocktakingStatus.textContent =
    stocktaking.status;

  activeStocktakingStartedAt.textContent =
    formatStocktakingDateTime(
      stocktaking.startedAt
    );

  hideAllMainScreensForStocktaking();

  stocktakingActiveScreen.hidden = false;

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function returnHomeFromStocktaking() {
  stocktakingSetupScreen.hidden = true;
  stocktakingActiveScreen.hidden = true;

  window.inventoryApp.showScreen(
    "home"
  );
}

async function handleDeleteStocktaking() {
  if (!activeStocktakingId) {
    alert(
      "取り消す棚卸が見つかりません。"
    );

    return;
  }

  const isConfirmed =
    window.confirm(
      "この棚卸を取り消しますか？\n\n" +
      "開始情報は削除されます。"
    );

  if (!isConfirmed) {
    return;
  }

  try {
    await deleteStocktakingSession(
      activeStocktakingId
    );

    activeStocktakingId = null;

    alert(
      "棚卸を取り消しました。"
    );

    returnHomeFromStocktaking();
  } catch (error) {
    console.error(error);

    alert(
      "棚卸を取り消せませんでした。"
    );
  }
}

function hideAllMainScreensForStocktaking() {
  const allScreens =
    document.querySelectorAll(
      "main > section"
    );

  allScreens.forEach(
    function (screen) {
      screen.hidden = true;
    }
  );
}

function getTodayDateText() {
  const today = new Date();

  const year =
    today.getFullYear();

  const month =
    String(
      today.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      today.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatStocktakingDateTime(
  dateTimeText
) {
  const date =
    new Date(dateTimeText);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "記録なし";
  }

  return date.toLocaleString(
    "ja-JP"
  );
}

function createStocktakingId() {
  const randomText =
    Math.random()
      .toString(36)
      .slice(2, 10);

  return (
    `stocktaking-${Date.now()}-${randomText}`
  );
}