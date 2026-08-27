"use strict";

let stocktakingHistorySessions = [];
let stocktakingHistoryScreen = null;
let stocktakingHistoryDetailScreen = null;
let stocktakingHistoryBody = null;
let stocktakingHistoryCount = null;
let stocktakingHistoryDetailBody = null;
let currentStocktakingHistoryDetailSession = null;

document.addEventListener(
  "DOMContentLoaded",
  initializeStocktakingHistory
);

function initializeStocktakingHistory() {
  createStocktakingHistoryButton();
  createStocktakingHistoryScreens();
  createStocktakingHistoryStyle();
}

function createStocktakingHistoryButton() {
  if (
    document.querySelector(
      "#show-stocktaking-history-button"
    )
  ) {
    return;
  }

  const referenceButton =
    document.querySelector(
      "#show-stocktaking-button"
    ) ||
    document.querySelector(
      "#show-history-button"
    );

  if (!referenceButton) {
    return;
  }

  const button =
    document.createElement("button");

  button.id =
    "show-stocktaking-history-button";

  button.type = "button";

  button.textContent =
    "棚卸履歴を見る";

  button.addEventListener(
    "click",
    openStocktakingHistoryScreen
  );

  referenceButton.parentElement.appendChild(
    button
  );
}

function createStocktakingHistoryScreens() {
  const existingHistoryScreen =
    document.querySelector(
      "#stocktaking-history"
    );

  const existingDetailScreen =
    document.querySelector(
      "#stocktaking-history-detail"
    );

  if (existingHistoryScreen) {
    existingHistoryScreen.remove();
  }

  if (existingDetailScreen) {
    existingDetailScreen.remove();
  }

  const main =
    document.querySelector("main");

  stocktakingHistoryScreen =
    document.createElement("section");

  stocktakingHistoryScreen.id =
    "stocktaking-history";

  stocktakingHistoryScreen.hidden =
    true;

  stocktakingHistoryScreen.innerHTML = `
    <h2>棚卸履歴</h2>

    <p
      id="stocktaking-history-count"
      class="stocktaking-history-message"
    >
      棚卸履歴を読み込んでいます。
    </p>

    <div class="stocktaking-history-table-area">
      <table class="stocktaking-history-table">
        <thead>
          <tr>
            <th>棚卸日</th>
            <th>状態</th>
            <th>担当者</th>
            <th>登録保管場所</th>
            <th>対象商品</th>
            <th>確認済み</th>
            <th>差異あり</th>
            <th>在庫反映</th>
            <th>確定日時</th>
            <th>操作</th>
          </tr>
        </thead>

        <tbody id="stocktaking-history-body">
          <tr>
            <td colspan="10">
              棚卸履歴を読み込んでいます。
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <button
      id="back-home-from-stocktaking-history"
      type="button"
    >
      ホームへ戻る
    </button>
  `;

  stocktakingHistoryDetailScreen =
    document.createElement("section");

  stocktakingHistoryDetailScreen.id =
    "stocktaking-history-detail";

  stocktakingHistoryDetailScreen.hidden =
    true;

  stocktakingHistoryDetailScreen.innerHTML = `
    <h2>棚卸履歴の詳細</h2>

    <table class="stocktaking-history-info-table">
      <tbody
        id="stocktaking-history-detail-info"
      ></tbody>
    </table>

    <div
      id="stocktaking-history-detail-summary"
      class="stocktaking-history-summary"
    ></div>

    <div class="stocktaking-history-table-area">
      <table class="stocktaking-history-items-table">
        <thead>
          <tr>
            <th>結果</th>
            <th>社内コード</th>
            <th>商品コード</th>
            <th>商品名</th>
            <th>JANコード</th>
            <th>保管場所</th>
            <th>場所別実在庫</th>
            <th>登録在庫</th>
            <th>実在庫合計</th>
            <th>差異</th>
            <th>メモ</th>
          </tr>
        </thead>

        <tbody
          id="stocktaking-history-detail-body"
        ></tbody>
      </table>
    </div>

    <button
      id="export-stocktaking-submission-button"
      type="button"
    >
      この棚卸の提出ファイルを出力
    </button>

    <button
      id="cancel-stocktaking-history-button"
      type="button"
    >
      この棚卸を取り消す
    </button>

    <button
      id="back-to-stocktaking-history"
      type="button"
    >
      棚卸履歴一覧へ戻る
    </button>

    <button
      id="back-home-from-stocktaking-history-detail"
      type="button"
    >
      ホームへ戻る
    </button>
  `;

  main.appendChild(
    stocktakingHistoryScreen
  );

  main.appendChild(
    stocktakingHistoryDetailScreen
  );

  stocktakingHistoryBody =
    document.querySelector(
      "#stocktaking-history-body"
    );

  stocktakingHistoryCount =
    document.querySelector(
      "#stocktaking-history-count"
    );

  stocktakingHistoryDetailBody =
    document.querySelector(
      "#stocktaking-history-detail-body"
    );

  document.querySelector(
    "#back-home-from-stocktaking-history"
  ).addEventListener(
    "click",
    returnHomeFromStocktakingHistory
  );

  document.querySelector(
    "#back-to-stocktaking-history"
  ).addEventListener(
    "click",
    returnToStocktakingHistoryList
  );

  document.querySelector(
    "#back-home-from-stocktaking-history-detail"
  ).addEventListener(
    "click",
    returnHomeFromStocktakingHistory
  );

  document.querySelector(
    "#cancel-stocktaking-history-button"
  ).addEventListener(
    "click",
    cancelCurrentStocktakingHistory
  );

  document.querySelector(
    "#export-stocktaking-submission-button"
  ).addEventListener(
    "click",
    function () {
      if (
        !currentStocktakingHistoryDetailSession
      ) {
        alert(
          "出力する棚卸履歴が見つかりません。"
        );

        return;
      }

      if (
        currentStocktakingHistoryDetailSession.status === "取消" ||
        currentStocktakingHistoryDetailSession.status === "無効"
      ) {
        alert(
          "取り消し済みの棚卸は提出ファイルを出力できません。"
        );

        return;
      }

      if (
        !window.stocktakingTransferApp ||
        typeof window.stocktakingTransferApp.exportSession !==
          "function"
      ) {
        alert(
          "棚卸提出ファイルの出力機能を開けませんでした。\n\n画面を更新して、もう一度お試しください。"
        );

        return;
      }

      window.stocktakingTransferApp.exportSession(
        currentStocktakingHistoryDetailSession
      );
    }
  );
}

function createStocktakingHistoryStyle() {
  const existingStyle =
    document.querySelector(
      "#stocktaking-history-style"
    );

  if (existingStyle) {
    existingStyle.remove();
  }

  const style =
    document.createElement("style");

  style.id =
    "stocktaking-history-style";

  style.textContent = `
    #show-stocktaking-history-button {
      background-color: #455a64;
    }

    #stocktaking-history,
    #stocktaking-history-detail {
      scroll-margin-top: 90px;
    }

    .stocktaking-history-message {
      padding: 12px;
      border-radius: 8px;
      background-color: #e3f2fd;
      font-weight: bold;
    }

    .stocktaking-history-table-area {
      width: 100%;
      overflow-x: auto;
      margin-bottom: 20px;
    }

    .stocktaking-history-table,
    .stocktaking-history-items-table,
    .stocktaking-history-info-table {
      width: 100%;
      border-collapse: collapse;
    }

    .stocktaking-history-table,
    .stocktaking-history-items-table {
      min-width: 1300px;
    }

    .stocktaking-history-table th,
    .stocktaking-history-table td,
    .stocktaking-history-items-table th,
    .stocktaking-history-items-table td,
    .stocktaking-history-info-table th,
    .stocktaking-history-info-table td {
      padding: 10px;
      border: 1px solid #cfd8dc;
      text-align: left;
      vertical-align: middle;
    }

    .stocktaking-history-table th,
    .stocktaking-history-items-table th,
    .stocktaking-history-info-table th {
      background-color: #455a64;
      color: #ffffff;
      white-space: nowrap;
    }

    .stocktaking-history-info-table th {
      width: 190px;
    }

    .stocktaking-history-open-row {
      background-color: #fff8e1;
    }

    .stocktaking-history-completed-row {
      background-color: #e8f5e9;
    }

    .stocktaking-history-badge {
      display: inline-block;
      min-width: 82px;
      padding: 5px 9px;
      border-radius: 20px;
      text-align: center;
      font-weight: bold;
      white-space: nowrap;
    }

    .history-open,
    .history-surplus {
      background-color: #ffe0b2;
      color: #e65100;
    }

    .history-completed,
    .history-match {
      background-color: #c8e6c9;
      color: #1b5e20;
    }

    .history-cancelled {
      background-color: #eceff1;
      color: #b71c1c;
    }

    .history-shortage {
      background-color: #ffcdd2;
      color: #b71c1c;
    }

    .history-unchecked {
      background-color: #cfd8dc;
      color: #455a64;
    }

    .stocktaking-history-summary {
      display: grid;
      grid-template-columns:
        repeat(
          auto-fit,
          minmax(150px, 1fr)
        );
      gap: 10px;
      margin: 20px 0;
    }

    .stocktaking-history-summary p {
      margin: 0;
      padding: 12px;
      border-radius: 8px;
      background-color: #eceff1;
      text-align: center;
      font-weight: bold;
    }

    .stocktaking-history-detail-button {
      margin: 0;
      padding: 8px 12px;
      font-size: 15px;
      background-color: #1565c0;
      white-space: nowrap;
    }

    #export-stocktaking-submission-button {
      background-color: #00838f;
    }

    #cancel-stocktaking-history-button {
      background-color: #c62828;
      color: #ffffff;
      font-weight: bold;
    }

    #cancel-stocktaking-history-button:disabled {
      background-color: #b0bec5;
      color: #546e7a;
      cursor: not-allowed;
    }

    .stocktaking-history-cancelled-row {
      background-color: #f5f5f5;
      color: #607d8b;
    }

    @media (max-width: 700px) {
      #stocktaking-history > button,
      #stocktaking-history-detail > button {
        width: 100%;
        margin: 6px 0;
      }

      .stocktaking-history-info-table th {
        width: 125px;
      }

      .stocktaking-history-summary {
        grid-template-columns:
          repeat(
            2,
            minmax(0, 1fr)
          );
      }
    }
  `;

  document.head.appendChild(
    style
  );
}

async function openStocktakingHistoryScreen() {
  hideAllScreensForStocktakingHistory();

  stocktakingHistoryScreen.hidden =
    false;

  stocktakingHistoryCount.textContent =
    "棚卸履歴を読み込んでいます。";

  stocktakingHistoryBody.innerHTML = `
    <tr>
      <td colspan="10">
        棚卸履歴を読み込んでいます。
      </td>
    </tr>
  `;

  try {
    stocktakingHistorySessions =
      await loadAllStocktakingSessions();

    stocktakingHistorySessions.sort(
      function (
        sessionA,
        sessionB
      ) {
        return (
          getSessionTime(sessionB) -
          getSessionTime(sessionA)
        );
      }
    );

    displayStocktakingHistory();
  } catch (error) {
    console.error(error);

    stocktakingHistoryCount.textContent =
      "棚卸履歴を読み込めませんでした。";

    stocktakingHistoryBody.innerHTML = `
      <tr>
        <td colspan="10">
          棚卸履歴を読み込めませんでした。
        </td>
      </tr>
    `;

    alert(
      "棚卸履歴を読み込めませんでした。"
    );
  }

  moveToStocktakingHistorySection(
    stocktakingHistoryScreen
  );
}

function moveToStocktakingHistorySection(
  targetScreen
) {
  if (!targetScreen) {
    return;
  }

  window.setTimeout(
    function () {
      targetScreen.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    },
    50
  );
}

async function loadAllStocktakingSessions() {
  const database =
    await openDatabase();

  return new Promise(
    function (
      resolve,
      reject
    ) {
      const transaction =
        database.transaction(
          "stocktakings",
          "readonly"
        );

      const store =
        transaction.objectStore(
          "stocktakings"
        );

      const request =
        store.getAll();

      let sessions = [];

      request.onsuccess =
        function () {
          sessions =
            request.result;
        };

      transaction.oncomplete =
        function () {
          database.close();

          resolve(
            sessions
          );
        };

      transaction.onerror =
        function () {
          const error =
            transaction.error;

          database.close();

          reject(
            error
          );
        };
    }
  );
}

function displayStocktakingHistory() {
  stocktakingHistoryBody.innerHTML =
    "";

  stocktakingHistoryCount.textContent =
    `棚卸履歴：${stocktakingHistorySessions.length}件`;

  if (
    stocktakingHistorySessions.length ===
    0
  ) {
    stocktakingHistoryBody.innerHTML = `
      <tr>
        <td colspan="10">
          棚卸履歴はありません。
        </td>
      </tr>
    `;

    return;
  }

  stocktakingHistorySessions.forEach(
    function (session) {
      const counts =
        getSessionCounts(
          session
        );

      const row =
        document.createElement("tr");

      row.classList.add(
        session.status === "取消" ||
        session.status === "無効"
          ? "stocktaking-history-cancelled-row"
          : session.status === "確定済み"
            ? "stocktaking-history-completed-row"
            : "stocktaking-history-open-row"
      );

      appendTextCell(
        row,
        session.stocktakingDate ||
          "記録なし"
      );

      appendStocktakingHistoryStatusCell(
        row,
        session.status || "不明"
      );

      appendTextCell(
        row,
        session.person || "未登録"
      );

      appendTextCell(
        row,
        session.location || "未登録"
      );

      appendTextCell(
        row,
        `${counts.target}件`
      );

      appendTextCell(
        row,
        `${counts.checked}件`
      );

      appendTextCell(
        row,
        `${counts.shortage + counts.surplus}件`
      );

      appendTextCell(
        row,
        getReflectedText(
          session
        )
      );

      appendTextCell(
        row,
        session.confirmedAt
          ? formatHistoryDateTime(
              session.confirmedAt
            )
          : "未確定"
      );

      const actionCell =
        document.createElement("td");

      const detailButton =
        document.createElement(
          "button"
        );

      detailButton.type =
        "button";

      detailButton.textContent =
        "詳細を見る";

      detailButton.classList.add(
        "stocktaking-history-detail-button"
      );

      detailButton.addEventListener(
        "click",
        function () {
          openStocktakingHistoryDetail(
            session.id
          );
        }
      );

      actionCell.appendChild(
        detailButton
      );

      row.appendChild(
        actionCell
      );

      stocktakingHistoryBody.appendChild(
        row
      );
    }
  );
}

function openStocktakingHistoryDetail(
  sessionId
) {
  const session =
    stocktakingHistorySessions.find(
      function (item) {
        return (
          item.id ===
          sessionId
        );
      }
    );

  if (!session) {
    alert(
      "棚卸履歴が見つかりません。"
    );

    return;
  }

  currentStocktakingHistoryDetailSession =
    session;

  const counts =
    getSessionCounts(
      session
    );

  const infoBody =
    document.querySelector(
      "#stocktaking-history-detail-info"
    );

  const summary =
    document.querySelector(
      "#stocktaking-history-detail-summary"
    );

  infoBody.innerHTML = "";

  appendInfoRow(
    infoBody,
    "棚卸日",
    session.stocktakingDate ||
      "記録なし"
  );

  appendInfoRow(
    infoBody,
    "状態",
    session.status || "不明"
  );

  appendInfoRow(
    infoBody,
    "担当者",
    session.person || "未登録"
  );

  appendInfoRow(
    infoBody,
    "保管場所",
    session.location || "未登録"
  );

  appendInfoRow(
    infoBody,
    "開始日時",
    formatHistoryDateTime(
      session.startedAt
    )
  );

  appendInfoRow(
    infoBody,
    "確定日時",
    session.confirmedAt
      ? formatHistoryDateTime(
          session.confirmedAt
        )
      : "未確定"
  );

  appendInfoRow(
    infoBody,
    "現在庫への反映",
    getReflectedText(
      session
    )
  );

  if (session.cancelledAt) {
    appendInfoRow(
      infoBody,
      "取消日時",
      formatHistoryDateTime(
        session.cancelledAt
      )
    );
  }

  updateStocktakingHistoryDetailActions(
    session
  );

  summary.innerHTML = `
    <p>
      対象商品：
      <strong>${counts.target}</strong>件
    </p>

    <p>
      確認済み：
      <strong>${counts.checked}</strong>件
    </p>

    <p>
      未確認：
      <strong>${counts.unchecked}</strong>件
    </p>

    <p>
      差異なし：
      <strong>${counts.match}</strong>件
    </p>

    <p>
      在庫不足：
      <strong>${counts.shortage}</strong>件
    </p>

    <p>
      在庫過剰：
      <strong>${counts.surplus}</strong>件
    </p>
  `;

  displayStocktakingHistoryItems(
    session
  );

  stocktakingHistoryScreen.hidden =
    true;

  stocktakingHistoryDetailScreen.hidden =
    false;

  moveToStocktakingHistorySection(
    stocktakingHistoryDetailScreen
  );
}

function updateStocktakingHistoryDetailActions(
  session
) {
  const cancelButton =
    document.querySelector(
      "#cancel-stocktaking-history-button"
    );

  const exportButton =
    document.querySelector(
      "#export-stocktaking-submission-button"
    );

  if (!cancelButton || !exportButton) {
    return;
  }

  const isCancelled =
    session.status === "取消" ||
    session.status === "無効";

  exportButton.disabled =
    isCancelled;

  cancelButton.hidden =
    isCancelled;

  cancelButton.disabled =
    session.reflectedToInventory === true;

  cancelButton.title =
    session.reflectedToInventory === true
      ? "現在庫へ反映済みの棚卸は、この画面から直接取り消せません。"
      : "現在庫を変更せず、棚卸結果を取消状態にします。";
}

async function cancelCurrentStocktakingHistory() {
  const session =
    currentStocktakingHistoryDetailSession;

  if (!session) {
    alert(
      "取り消す棚卸履歴が見つかりません。"
    );

    return;
  }

  if (
    session.status === "取消" ||
    session.status === "無効"
  ) {
    alert(
      "この棚卸はすでに取り消されています。"
    );

    return;
  }

  if (session.reflectedToInventory === true) {
    const message =
      "この棚卸は現在庫へ反映済みです。\n\n" +
      "履歴だけを取り消すと現在庫と履歴が合わなくなるため、この画面からは取り消せません。";

    if (
      typeof showStocktakingNotice ===
      "function"
    ) {
      await showStocktakingNotice(
        message,
        {
          title: "取り消しできません",
          type: "warning",
          icon: "⚠"
        }
      );
    } else {
      alert(message);
    }

    return;
  }

  const message =
    "この棚卸を取り消しますか？\n\n" +
    `棚卸日：${session.stocktakingDate || "記録なし"}\n` +
    `担当者：${session.person || "未登録"}\n` +
    `保管場所：${session.location || "未登録"}\n\n` +
    "この棚卸は現在庫へ反映されていないため、現在庫は変更しません。\n" +
    "棚卸履歴は『取消』として残します。\n" +
    "同じ棚卸の取り込み済み提出データがある場合は、集約対象から外すため同時に削除します。";

  let confirmed = false;

  if (
    typeof showStocktakingConfirm ===
    "function"
  ) {
    confirmed =
      await showStocktakingConfirm(
        message,
        {
          title: "棚卸を取り消しますか？",
          type: "danger",
          icon: "✖",
          confirmText: "この棚卸を取り消す",
          cancelText: "戻る"
        }
      );
  } else {
    confirmed =
      window.confirm(message);
  }

  if (!confirmed) {
    return;
  }

  const cancelButton =
    document.querySelector(
      "#cancel-stocktaking-history-button"
    );

  if (cancelButton) {
    cancelButton.disabled = true;
  }

  try {
    const cancelledAt =
      new Date().toISOString();

    const cancelledSession = {
      ...session,
      status: "取消",
      cancelledAt: cancelledAt,
      updatedAt: cancelledAt,
      reflectedToInventory: false
    };

    await updateStocktakingSession(
      cancelledSession
    );

    const removedSubmissions =
      await removeLinkedStocktakingSubmissions(
        session.id
      );

    currentStocktakingHistoryDetailSession =
      cancelledSession;

    const resultMessage =
      "棚卸を取り消しました。\n\n" +
      "現在庫は変更していません。\n" +
      (
        removedSubmissions > 0
          ? `集約用の取り込み済み提出データも ${removedSubmissions}件 削除しました。`
          : "集約用の取り込み済み提出データはありませんでした。"
      );

    if (
      typeof showStocktakingNotice ===
      "function"
    ) {
      await showStocktakingNotice(
        resultMessage,
        {
          title: "棚卸を取り消しました",
          type: "success",
          icon: "✓"
        }
      );
    } else {
      alert(resultMessage);
    }

    await openStocktakingHistoryScreen();
  } catch (error) {
    console.error(error);

    const errorMessage =
      "棚卸を取り消せませんでした。\n\n" +
      "画面を更新して、もう一度お試しください。";

    if (
      typeof showStocktakingNotice ===
      "function"
    ) {
      await showStocktakingNotice(
        errorMessage,
        {
          title: "取り消しエラー",
          type: "danger",
          icon: "✖"
        }
      );
    } else {
      alert(errorMessage);
    }

    if (cancelButton) {
      cancelButton.disabled = false;
    }
  }
}

async function removeLinkedStocktakingSubmissions(
  sessionId
) {
  if (
    typeof getAllStocktakingSubmissions !==
      "function" ||
    typeof deleteStocktakingSubmission !==
      "function"
  ) {
    return 0;
  }

  const submissions =
    await getAllStocktakingSubmissions();

  const expectedSubmissionId =
    `stocktaking-submission-${sessionId}`;

  const targets =
    submissions.filter(
      function (submission) {
        const sourceSessionId =
          submission &&
          submission.stocktaking
            ? submission.stocktaking.sourceSessionId
            : "";

        return (
          submission.submissionId ===
            expectedSubmissionId ||
          String(sourceSessionId || "") ===
            String(sessionId || "")
        );
      }
    );

  for (const submission of targets) {
    await deleteStocktakingSubmission(
      submission.submissionId
    );
  }

  return targets.length;
}

function displayStocktakingHistoryItems(
  session
) {
  const items =
    Array.isArray(
      session.items
    )
      ? session.items
      : [];

  stocktakingHistoryDetailBody.innerHTML =
    "";

  if (items.length === 0) {
    stocktakingHistoryDetailBody.innerHTML = `
      <tr>
        <td colspan="11">
          この棚卸には商品データがありません。
        </td>
      </tr>
    `;

    return;
  }

  items.forEach(
    function (item) {
      const result =
        getItemResult(
          item
        );

      const row =
        document.createElement("tr");

      appendResultCell(
        row,
        result
      );

      appendTextCell(
        row,
        item.internalCode ||
          "未登録"
      );

      appendTextCell(
        row,
        item.productCode ||
          "未登録"
      );

      appendTextCell(
        row,
        item.productName ||
          "未登録"
      );

      appendTextCell(
        row,
        item.janCode ||
          "未登録"
      );

      appendTextCell(
        row,
        item.location ||
          "未登録"
      );

      appendTextCell(
        row,
        formatHistoryLocationBreakdown(
          item
        )
      );

      appendTextCell(
        row,
        getHistoryNumber(
          item.registeredStock
        )
      );

      appendTextCell(
        row,
        isItemChecked(item)
          ? getHistoryNumber(
              item.actualStock
            )
          : "未確認"
      );

      appendTextCell(
        row,
        formatItemDifference(
          item
        )
      );

      appendTextCell(
        row,
        item.memo || ""
      );

      stocktakingHistoryDetailBody.appendChild(
        row
      );
    }
  );
}

function formatHistoryLocationBreakdown(
  item
) {
  const entries =
    Array.isArray(
      item.locationBreakdown
    )
      ? item.locationBreakdown
      : [];

  const breakdownText =
    entries
      .filter(
        function (entry) {
          const location =
            String(
              entry.location || ""
            ).trim();

          const quantity =
            Number(
              entry.quantity
            );

          return (
            location !== "" &&
            Number.isInteger(
              quantity
            ) &&
            quantity >= 0
          );
        }
      )
      .map(
        function (entry) {
          return (
            `${String(entry.location).trim()}：` +
            `${Number(entry.quantity)}個`
          );
        }
      )
      .join(" / ");

  if (breakdownText !== "") {
    return breakdownText;
  }

  if (isItemChecked(item)) {
    return (
      `${item.location || "場所未登録"}：` +
      `${getHistoryNumber(item.actualStock)}個`
    );
  }

  return "未確認";
}

function appendTextCell(
  row,
  value
) {
  const cell =
    document.createElement("td");

  cell.textContent =
    value;

  row.appendChild(
    cell
  );
}

function appendStocktakingHistoryStatusCell(
  row,
  status
) {
  const cell =
    document.createElement("td");

  const badge =
    document.createElement("span");

  badge.classList.add(
    "stocktaking-history-badge"
  );

  if (status === "確定済み") {
    badge.classList.add("history-completed");
  } else if (status === "取消" || status === "無効") {
    badge.classList.add("history-cancelled");
  } else {
    badge.classList.add("history-open");
  }

  badge.textContent =
    status;

  cell.appendChild(
    badge
  );

  row.appendChild(
    cell
  );
}

function appendResultCell(
  row,
  result
) {
  const cell =
    document.createElement("td");

  const badge =
    document.createElement("span");

  badge.classList.add(
    "stocktaking-history-badge"
  );

  if (result === "差異なし") {
    badge.classList.add(
      "history-match"
    );
  } else if (
    result === "在庫不足"
  ) {
    badge.classList.add(
      "history-shortage"
    );
  } else if (
    result === "在庫過剰"
  ) {
    badge.classList.add(
      "history-surplus"
    );
  } else {
    badge.classList.add(
      "history-unchecked"
    );
  }

  badge.textContent =
    result;

  cell.appendChild(
    badge
  );

  row.appendChild(
    cell
  );
}

function appendInfoRow(
  body,
  label,
  value
) {
  const row =
    document.createElement("tr");

  const heading =
    document.createElement("th");

  const cell =
    document.createElement("td");

  heading.textContent =
    label;

  cell.textContent =
    value;

  row.appendChild(
    heading
  );

  row.appendChild(
    cell
  );

  body.appendChild(
    row
  );
}

function getSessionCounts(
  session
) {
  const items =
    Array.isArray(
      session.items
    )
      ? session.items
      : [];

  const checkedItems =
    items.filter(
      isItemChecked
    );

  return {
    target:
      items.length,

    checked:
      checkedItems.length,

    unchecked:
      items.length -
      checkedItems.length,

    match:
      checkedItems.filter(
        function (item) {
          return (
            getItemResult(item) ===
            "差異なし"
          );
        }
      ).length,

    shortage:
      checkedItems.filter(
        function (item) {
          return (
            getItemResult(item) ===
            "在庫不足"
          );
        }
      ).length,

    surplus:
      checkedItems.filter(
        function (item) {
          return (
            getItemResult(item) ===
            "在庫過剰"
          );
        }
      ).length
  };
}

function isItemChecked(
  item
) {
  return !(
    item.actualStock === "" ||
    item.actualStock === null ||
    item.actualStock === undefined
  );
}

function getItemResult(
  item
) {
  if (
    !isItemChecked(item)
  ) {
    return "未確認";
  }

  const savedResults = [
    "差異なし",
    "在庫不足",
    "在庫過剰"
  ];

  if (
    savedResults.includes(
      item.result
    )
  ) {
    return item.result;
  }

  const difference =
    getHistoryNumber(
      item.actualStock
    ) -
    getHistoryNumber(
      item.registeredStock
    );

  if (difference === 0) {
    return "差異なし";
  }

  return difference < 0
    ? "在庫不足"
    : "在庫過剰";
}

function formatItemDifference(
  item
) {
  if (
    !isItemChecked(item)
  ) {
    return "未確認";
  }

  const difference =
    getHistoryNumber(
      item.actualStock
    ) -
    getHistoryNumber(
      item.registeredStock
    );

  return difference > 0
    ? `＋${difference}`
    : String(difference);
}

function getReflectedText(
  session
) {
  if (
    session.status === "取消" ||
    session.status === "無効"
  ) {
    return "取消済み";
  }

  if (
    session.status !==
    "確定済み"
  ) {
    return "未確定";
  }

  return session.reflectedToInventory
    ? "反映済み"
    : "未反映";
}

function getHistoryNumber(
  value
) {
  const number =
    Number(value);

  if (
    Number.isInteger(number) &&
    number >= 0
  ) {
    return number;
  }

  return 0;
}

function getSessionTime(
  session
) {
  const date =
    new Date(
      session.confirmedAt ||
      session.updatedAt ||
      session.startedAt ||
      session.stocktakingDate
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 0;
  }

  return date.getTime();
}

function formatHistoryDateTime(
  value
) {
  const date =
    new Date(value);

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

function returnToStocktakingHistoryList() {
  currentStocktakingHistoryDetailSession =
    null;

  stocktakingHistoryDetailScreen.hidden =
    true;

  stocktakingHistoryScreen.hidden =
    false;

  moveToStocktakingHistorySection(
    stocktakingHistoryScreen
  );
}

function returnHomeFromStocktakingHistory() {
  currentStocktakingHistoryDetailSession =
    null;

  stocktakingHistoryScreen.hidden =
    true;

  stocktakingHistoryDetailScreen.hidden =
    true;

  window.inventoryApp.showScreen(
    "home"
  );
}

function hideAllScreensForStocktakingHistory() {
  const screens =
    document.querySelectorAll(
      "main > section"
    );

  screens.forEach(
    function (screen) {
      screen.hidden =
        true;
    }
  );
}