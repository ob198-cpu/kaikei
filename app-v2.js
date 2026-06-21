(function () {
  "use strict";

  const STORAGE_KEY = "cdp-accounting-system-v2";
  const LEGACY_STORAGE_KEY = "cdp-accounting-system-v1";
  const DEFAULT_FISCAL_START_MONTH = 6;
  const TODAY = toDateInput(new Date());

  const expenseCategories = [
    "旅費交通費",
    "交際費",
    "会議費",
    "消耗品費",
    "通信費",
    "広告宣伝費",
    "外注費",
    "車両費",
    "燃料費",
    "支払手数料",
    "研修費",
    "新聞図書費",
    "租税公課",
    "雑費",
    "未分類"
  ];

  const salesCategories = [
    "講師料",
    "業務委託",
    "調査・測量",
    "資料作成",
    "保守",
    "その他"
  ];

  const taxRates = ["10%", "8%", "非課税", "不明"];
  const invoiceStatuses = ["未入金", "入金予定", "入金済", "保留"];
  const paymentRequestStatuses = ["下書き", "申請中", "差し戻し", "承認済", "支払済"];
  const receivedDocTypes = ["請求書", "領収書", "納品書", "見積書", "契約書", "その他"];
  const receivedDocStatuses = ["未確認", "保管", "支払依頼待ち", "申請中", "承認済", "支払済"];
  const ledgerStatuses = ["未処理", "確認中", "完了", "保留"];
  const paymentMethods = [
    ["card", "カード"],
    ["cash", "現金"],
    ["bank", "口座振込"],
    ["other", "その他"]
  ];
  const defaultDepartments = ["共通費"];

  const pageMeta = {
    dashboard: ["ホーム", "月次の未処理、保存状態、提出前チェック"],
    receipts: ["レシート管理", "月ごとに証憑画像を保存し、カードと現金を分けて確認"],
    receivedDocs: ["受領書類", "請求書、領収書、納品書など受け取った書類を保管"],
    expenses: ["経費表", "税理士の分類に合わせて品名、個数、単価、経費を管理"],
    approvals: ["申請・承認", "支払依頼、事前申請、承認、差し戻し、支払済みを管理"],
    dataLink: ["データ連携", "通帳CSV、カード明細CSVの取込履歴と処理状況を管理"],
    sales: ["売上", "振込入金を売上として通帳別に管理"],
    invoices: ["請求書", "請求番号、実施日、支払予定日、入金日のずれを管理"],
    estimates: ["見積", "見積番号、金額、請求書化状況を記録"],
    deliveries: ["納品書", "納品番号、納品日、請求書化状況を記録"],
    receiptDocs: ["領収書", "入金後に相手へ渡す領収書を作成"],
    salesFlow: ["販売管理", "見積、納品、請求、入金、領収書まで一連で確認"],
    sendManagement: ["送付管理", "未送付帳票、メール文、郵送先、送付履歴を管理"],
    partners: ["取引先", "住所、敬称、担当者、送付先、振込条件を管理"],
    items: ["品目", "品名、標準単価、単位、税率を管理"],
    recurring: ["毎月自動", "毎月同じ請求、納品、領収書の作成予定を管理"],
    trips: ["出張台帳", "移動、宿泊、ガソリン請求を記録"],
    payroll: ["給与台帳", "月別の給与、手当、控除、支払日を記録"],
    cards: ["カード台帳", "カード明細、領収書、T番号をまとめて確認"],
    hitech: ["ハイテク台帳", "送付資料、講師関連、入出金状況を記録"],
    books: ["会計帳簿", "総勘定元帳、補助元帳、試算表、推移表、部門別、前期比較"],
    closing: ["締め・提出", "15日前後と月末の締め、税理士提出データの点検"],
    history: ["履歴", "操作履歴、削除済みデータ、出力履歴を確認"],
    settings: ["設定", "会社名、決算月、分類、バックアップ、データ保守"]
  };

  const accountMaster = [
    { name: "現金", type: "asset", normal: "debit", group: "流動資産" },
    { name: "普通預金", type: "asset", normal: "debit", group: "流動資産" },
    { name: "売掛金", type: "asset", normal: "debit", group: "流動資産" },
    { name: "クレジットカード未払", type: "liability", normal: "credit", group: "流動負債" },
    { name: "未払金", type: "liability", normal: "credit", group: "流動負債" },
    { name: "預り金", type: "liability", normal: "credit", group: "流動負債" },
    { name: "資本金", type: "equity", normal: "credit", group: "株主資本" },
    { name: "繰越利益剰余金", type: "equity", normal: "credit", group: "利益剰余金" },
    { name: "売上高", type: "revenue", normal: "credit", group: "売上" },
    { name: "売上原価", type: "expense", normal: "debit", group: "売上原価" },
    { name: "給与手当", type: "expense", normal: "debit", group: "販売費及び一般管理費" }
  ];

  const app = document.getElementById("app");
  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");
  const fiscalYearSelect = document.getElementById("fiscalYearSelect");
  const saveStatus = document.getElementById("saveStatus");
  const dialog = document.getElementById("recordDialog");
  const dialogTitle = document.getElementById("dialogTitle");
  const dialogBody = document.getElementById("dialogBody");

  let state = loadState();
  let activeView = "dashboard";
  let selectedFiscalYear = getFiscalYear(TODAY);
  let receiptPaymentFilter = "all";
  let bookState = {
    tab: "general",
    report: "pl",
    period: "monthly",
    account: "現金",
    subAccount: "全て",
    taxMode: "taxExcluded",
    showZero: false
  };
  let tableFilters = {
    expenses: { query: "", category: "all", paymentMethod: "all", proof: "all" },
    sales: { query: "", invoice: "all" },
    invoices: { query: "", status: "all", due: "all" }
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    ensureHistoryNav();
    seedFiscalOptions();
    bindGlobalEvents();
    persist("自動保存");
    render();
  }

  function ensureHistoryNav() {
    const nav = document.querySelector(".nav");
    if (!nav || nav.querySelector('[data-view="history"]')) return;
    const button = document.createElement("button");
    button.className = "nav-item";
    button.dataset.view = "history";
    button.type = "button";
    button.textContent = "履歴";
    nav.insertBefore(button, nav.querySelector('[data-view="settings"]'));
  }

  function defaultState() {
    return {
      schemaVersion: 2,
      settings: {
        companyName: "CDP北海道",
        fiscalStartMonth: DEFAULT_FISCAL_START_MONTH,
        accountantMemo: "顧客管理システムとは分けて運用。売上計上や決算またぎは税理士が判断できるよう、請求日・実施日・入金予定日・入金日を残す。",
        bankAccount: "道銀",
        categories: expenseCategories,
        departments: defaultDepartments,
        defaultDocumentTemplate: "標準",
        documentAccentColor: "#2f5f9f",
        documentLogoText: "CDP",
        documentSealText: "CDP",
        documentFooterNote: "本帳票は会計システムで作成し、発行履歴と送付履歴を保存しています。",
        backupReminderDays: 7,
        lastBackupAt: ""
      },
      expenses: [],
      receivedDocs: [],
      paymentRequests: [],
      importBatches: [],
      sales: [],
      invoices: [],
      estimates: [],
      deliveries: [],
      receiptDocs: [],
      partners: [],
      items: [],
      recurringDocs: [],
      sendLogs: [],
      trips: [],
      payroll: [],
      hitech: [],
      closings: [],
      journals: [],
      trash: [],
      handoffs: [],
      audit: []
    };
  }

  function loadState() {
    const base = defaultState();
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return base;
    try {
      const parsed = JSON.parse(raw);
      return normalizeState(parsed, base);
    } catch (error) {
      console.error(error);
      return base;
    }
  }

  function normalizeState(input, base = defaultState()) {
    const normalized = {
      ...base,
      ...input,
      schemaVersion: 2,
      settings: {
        ...base.settings,
        ...(input && input.settings ? input.settings : {})
      }
    };

    [
      "expenses",
      "receivedDocs",
      "paymentRequests",
      "importBatches",
      "sales",
      "invoices",
      "estimates",
      "deliveries",
      "receiptDocs",
      "partners",
      "items",
      "recurringDocs",
      "sendLogs",
      "trips",
      "payroll",
      "hitech",
      "closings",
      "journals",
      "trash",
      "handoffs",
      "audit"
    ].forEach((key) => {
      normalized[key] = Array.isArray(input && input[key]) ? input[key] : [];
    });

    if (!Array.isArray(normalized.settings.categories) || !normalized.settings.categories.length || hasMojibake(normalized.settings.categories.join(""))) {
      normalized.settings.categories = expenseCategories;
    }
    if (!Array.isArray(normalized.settings.departments) || !normalized.settings.departments.length || hasMojibake(normalized.settings.departments.join(""))) {
      normalized.settings.departments = defaultDepartments;
    }
    normalized.importBatches = (normalized.importBatches || []).map((batch) => ({
      ...batch,
      importDate: batch.importDate || String(batch.importedAt || batch.createdAt || "").slice(0, 10)
    }));
    if (hasMojibake(normalized.settings.companyName)) normalized.settings.companyName = base.settings.companyName;
    if (hasMojibake(normalized.settings.bankAccount)) normalized.settings.bankAccount = base.settings.bankAccount;
    if (!documentTemplates().includes(normalized.settings.defaultDocumentTemplate)) normalized.settings.defaultDocumentTemplate = base.settings.defaultDocumentTemplate;
    if (!isHexColor(normalized.settings.documentAccentColor)) normalized.settings.documentAccentColor = base.settings.documentAccentColor;
    if (!clean(normalized.settings.documentLogoText)) normalized.settings.documentLogoText = base.settings.documentLogoText;
    if (!clean(normalized.settings.documentSealText)) normalized.settings.documentSealText = base.settings.documentSealText;
    if (!clean(normalized.settings.documentFooterNote)) normalized.settings.documentFooterNote = base.settings.documentFooterNote;
    return normalized;
  }

  function persist(action) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      saveStatus.textContent = `${action || "保存"} ${new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`;
    } catch (error) {
      console.error(error);
      alert("保存に失敗しました。証憑画像が多い場合は、全体バックアップ後に画像サイズを小さくしてください。");
    }
  }

  function bindGlobalEvents() {
    document.querySelectorAll(".nav-item").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.view));
    });
    fiscalYearSelect.addEventListener("change", () => {
      selectedFiscalYear = Number(fiscalYearSelect.value);
      render();
    });
    document.getElementById("exportAllButton").addEventListener("click", exportAllData);
    document.getElementById("importAllInput").addEventListener("change", importAllData);
    document.getElementById("dialogClose").addEventListener("click", () => dialog.close());
  }

  function switchView(view) {
    activeView = view;
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("is-active", item.dataset.view === view));
    render();
  }

  function seedFiscalOptions() {
    const current = getFiscalYear(TODAY);
    const years = [];
    for (let year = current - 2; year <= current + 3; year += 1) years.push(year);
    fiscalYearSelect.innerHTML = years.map((year) => `<option value="${year}">${year}年度</option>`).join("");
    fiscalYearSelect.value = selectedFiscalYear;
  }

  function ensureFiscalYearOption(year) {
    const fiscalYear = Number(year);
    if (!Number.isFinite(fiscalYear)) return;
    const years = [...new Set([...fiscalYearSelect.options].map((option) => Number(option.value)).concat(fiscalYear))]
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    fiscalYearSelect.innerHTML = years.map((item) => `<option value="${item}">${item}年度</option>`).join("");
    fiscalYearSelect.value = fiscalYear;
  }

  function showFiscalYearForDate(date) {
    const fiscalYear = getFiscalYear(date || TODAY);
    ensureFiscalYearOption(fiscalYear);
    selectedFiscalYear = fiscalYear;
    fiscalYearSelect.value = fiscalYear;
  }

  function render() {
    const [title, subtitle] = pageMeta[activeView] || pageMeta.dashboard;
    const range = getFiscalRange(selectedFiscalYear);
    pageTitle.textContent = title;
    pageSubtitle.textContent = `${subtitle} / ${formatDate(range.start)} - ${formatDate(range.end)}`;
    fiscalYearSelect.value = selectedFiscalYear;
    app.innerHTML = "";

    const renderers = {
      dashboard: renderDashboard,
      receipts: renderReceipts,
      receivedDocs: renderReceivedDocs,
      expenses: renderExpenses,
      approvals: renderApprovals,
      dataLink: renderDataLink,
      sales: renderSales,
      invoices: renderInvoices,
      estimates: renderEstimates,
      deliveries: renderDeliveries,
      receiptDocs: renderReceiptDocs,
      salesFlow: renderSalesFlow,
      sendManagement: renderSendManagement,
      partners: renderPartners,
      items: renderItems,
      recurring: renderRecurring,
      trips: () => renderSimpleLedger("trips"),
      payroll: () => renderSimpleLedger("payroll"),
      cards: renderCards,
      hitech: () => renderSimpleLedger("hitech"),
      books: renderBooks,
      closing: renderClosing,
      history: renderHistory,
      settings: renderSettings
    };
    (renderers[activeView] || renderDashboard)();
  }

  function renderDashboard() {
    const expenses = fiscalItems(state.expenses, "date");
    const sales = fiscalItems(state.sales, "date");
    const invoices = fiscalInvoices();
    const alerts = getAlerts();
    const summary = summarizeExpenses(expenses);
    const health = getDataHealth();
    const expenseTotal = sum(expenses, "amount");
    const salesTotal = sum(sales, "amount");
    const unpaid = invoices.filter((item) => item.status !== "入金済");

    app.innerHTML = `
      <div class="grid cols-4">
        ${summaryCard("経費合計", yen(expenseTotal), `${expenses.length}件 / カード ${yen(sum(expenses.filter((item) => item.paymentMethod === "card"), "amount"))}`)}
        ${summaryCard("売上入金", yen(salesTotal), `${sales.length}件 / ${esc(state.settings.bankAccount || "道銀")}`)}
        ${summaryCard("請求書", `${invoices.length}件`, `未入金 ${unpaid.length}件`)}
        ${summaryCard("営業残", yen(salesTotal - expenseTotal), "売上入金 - 経費")}
      </div>

      <div class="grid cols-2" style="margin-top:14px;">
        <section class="panel">
          <div class="panel-head">
            <h2>運用点検</h2>
            <span class="badge ${health.score >= 80 ? "good" : health.score >= 55 ? "warn" : "bad"}">${health.score}点</span>
          </div>
          <div class="panel-body">
            ${renderHealthGrid(health)}
            <div class="actions" style="margin-top:12px;">
              <button class="button secondary small" data-view-jump="closing" type="button">提出前チェック</button>
              <button class="button secondary small" data-view-jump="settings" type="button">保存状態</button>
              <button class="button secondary small" data-action="accountant-package" type="button">税理士パック</button>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>要確認</h2>
            <span class="badge ${alerts.length ? "warn" : "good"}">${alerts.length}件</span>
          </div>
          <div class="panel-body">
            ${alerts.length ? `<div class="alert-list">${alerts.slice(0, 9).map(renderAlert).join("")}</div>` : `<div class="notice info">提出前の大きな未処理はありません。</div>`}
          </div>
        </section>
      </div>

      <div class="grid cols-2" style="margin-top:14px;">
        <section class="panel">
          <div class="panel-head">
            <h2>経費分類の構成比</h2>
            <button class="button secondary small" data-view-jump="expenses" type="button">経費表</button>
          </div>
          <div class="panel-body">
            ${summary.length ? summary.slice(0, 8).map((row) => `
              <div class="progress-line">
                <div class="receipt-meta"><strong>${esc(row.category)}</strong><span>${yen(row.amount)} / ${row.percent.toFixed(1)}%</span></div>
                <div class="progress-bar"><span style="width:${Math.min(row.percent, 100)}%"></span></div>
              </div>
            `).join("") : `<div class="empty">経費データがありません。</div>`}
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>機能対応</h2>
            <span class="badge good">10項目</span>
          </div>
          <div class="panel-body">
            ${renderMoneyForwardFeatureChecks()}
          </div>
        </section>
      </div>
    `;

    bindDashboardActions();
  }

  function bindDashboardActions() {
    app.querySelectorAll("[data-view-jump]").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.viewJump));
    });
    const packageButton = app.querySelector("[data-action='accountant-package']");
    if (packageButton) packageButton.addEventListener("click", exportAccountantPackage);
  }

  function renderMoneyForwardFeatureChecks() {
    const checks = [
      ["領収書作成", "入金後に相手へ渡す領収書を作成・HTML発行・送付状態管理", "receiptDocs"],
      ["納品書作成", "納品番号、納品日、明細、請求書化まで管理", "deliveries"],
      ["帳票変換", "見積 → 納品書 → 請求書 → 売上/領収書の変換導線を用意", "salesFlow"],
      ["帳票プレビュー", "入力画面の右側で帳票完成形を即時プレビュー", "invoices"],
      ["取引先マスタ", "住所、敬称、担当者、送付先、振込条件を保存", "partners"],
      ["品目マスタ", "品番、品名、標準単価、単位、税率を保存して明細入力に利用", "items"],
      ["テンプレート切替", "標準、フォーマル、控えめ、ブランドの帳票デザイン切替", "settings"],
      ["送付管理", "未送付、送付済、再送予定、郵送済、送付履歴を管理", "sendManagement"],
      ["毎月自動作成", "定期請求、定期納品、定期領収書の作成予定を管理", "recurring"],
      ["販売管理台帳", "見積、納品、請求、入金、領収書まで案件単位で確認", "salesFlow"]
    ];
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>懸念</th><th>改善内容</th><th>状態</th><th>確認</th></tr></thead>
          <tbody>${checks.map(([label, detail, view]) => `<tr>
            <td><strong>${esc(label)}</strong></td>
            <td>${esc(detail)}</td>
            <td>${statusBadge("対応済")}</td>
            <td><button class="button secondary small" data-view-jump="${esc(view)}" type="button">開く</button></td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function renderReceipts() {
    const expenses = fiscalItems(state.expenses, "date").sort(byDate("date"));
    const filtered = receiptPaymentFilter === "all" ? expenses : expenses.filter((item) => item.paymentMethod === receiptPaymentFilter);
    const grouped = groupByMonth(filtered, "date");

    app.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <h2>レシート登録</h2>
          <span class="badge">${esc(state.settings.companyName)}</span>
        </div>
        <div class="panel-body">
          ${expenseForm("receiptForm", "登録", true)}
        </div>
      </section>

      <section class="panel" style="margin-top:14px;">
        <div class="panel-head">
          <h2>月別フォルダ</h2>
          <div class="tabs" style="margin:0;">
            ${receiptFilterTab("all", "全て")}
            ${receiptFilterTab("card", "カード")}
            ${receiptFilterTab("cash", "現金")}
            ${receiptFilterTab("bank", "口座振込")}
          </div>
        </div>
        <div class="panel-body">
          ${Object.keys(grouped).length ? Object.entries(grouped).map(([month, records]) => renderReceiptMonth(month, records)).join("") : `<div class="empty">この年度のレシートはありません。</div>`}
        </div>
      </section>
    `;

    document.getElementById("receiptForm").addEventListener("submit", handleExpenseSubmit);
    bindExpenseFormHelpers("receiptForm");
    bindReceiptActions();
  }

  function renderExpenses() {
    const allExpenses = fiscalItems(state.expenses, "date").sort(byDate("date"));
    const expenses = filterExpenses(allExpenses);
    const summary = summarizeExpenses(expenses);
    const total = sum(expenses, "amount");

    app.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <h2>経費入力</h2>
          <div class="actions">
            <button class="button secondary small" id="exportExpensesCsv" type="button">CSV</button>
          </div>
        </div>
        <div class="panel-body">
          ${expenseForm("expenseForm", "経費登録", false)}
        </div>
      </section>

      <div class="grid cols-2" style="margin-top:14px;">
        <section class="panel">
          <div class="panel-head"><h2>科目別構成比</h2><span class="badge">${yen(total)}</span></div>
          <div class="panel-body">
            ${summary.length ? summary.map((row) => `
              <div class="progress-line">
                <div class="receipt-meta"><strong>${esc(row.category)}</strong><span>${yen(row.amount)} / ${row.percent.toFixed(1)}%</span></div>
                <div class="progress-bar"><span style="width:${Math.min(row.percent, 100)}%"></span></div>
              </div>
            `).join("") : `<div class="empty">経費データがありません。</div>`}
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>提出前チェック</h2></div>
          <div class="panel-body">${renderExpenseChecks(allExpenses)}</div>
        </section>
      </div>

      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>経費一覧</h2><span class="badge">${expenses.length} / ${allExpenses.length}件</span></div>
        <div class="panel-body">
          ${renderExpenseFilters(allExpenses)}
          ${renderExpenseTable(expenses)}
        </div>
      </section>
    `;

    document.getElementById("expenseForm").addEventListener("submit", handleExpenseSubmit);
    bindExpenseFormHelpers("expenseForm");
    document.getElementById("exportExpensesCsv").addEventListener("click", () => exportCsv("expenses", expenses, [
      ["date", "日付"], ["category", "経費科目"], ["department", "部門"], ["vendor", "取引先"], ["itemName", "品名"],
      ["quantity", "個数"], ["unitPrice", "単価"], ["amount", "金額"], ["paymentMethod", "支払区分"],
      ["paymentRequestNo", "支払依頼番号"], ["paymentRequestStatus", "支払依頼状態"], ["taxRate", "税区分"], ["registrationNumber", "T番号"], ["invoiceEligible", "インボイス適格"], ["splitGroupId", "税率分割ID"], ["note", "摘要"]
    ]));
    bindFilterControls("expenses");
    bindTableActions();
  }

  function bindExpenseFormHelpers(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    const detectButton = form.querySelector("#detectPaymentButton");
    if (detectButton) {
      detectButton.addEventListener("click", () => {
        form.elements.paymentMethod.value = detectPayment(`${form.elements.note.value} ${form.elements.proof.value}`) || form.elements.paymentMethod.value;
      });
    }
    const tsuruhaButton = form.querySelector("[data-action='fill-tsuruha-example']");
    if (tsuruhaButton) tsuruhaButton.addEventListener("click", () => fillTsuruhaExample(form));
  }

  function fillTsuruhaExample(form) {
    form.elements.date.value = "2026-03-01";
    form.elements.vendor.value = "ツルハドラッグ 福井店";
    if ([...form.elements.category.options].some((option) => option.value === "消耗品費")) form.elements.category.value = "消耗品費";
    form.elements.itemName.value = "ツルハ購入分";
    form.elements.quantity.value = "1";
    form.elements.unitPrice.value = "";
    form.elements.amount.value = "22436";
    form.elements.taxRate.value = "10%";
    form.elements.registrationNumber.value = "T1430001010672";
    form.elements.split10Amount.value = "8716";
    form.elements.split8Amount.value = "13720";
    form.elements.splitMemo.value = "ツルハ領収書の10%・8%対象額を分割";
    form.elements.note.value = "支払方法はレシートで未確認。カード明細があればカードへ変更。業務用途を追記。";
  }

  function expenseForm(id, buttonLabel, showDetectButton) {
    return `
      <form id="${id}" class="form-grid">
        ${field("date", "日付", "date", TODAY)}
        ${field("vendor", "取引先", "text", "", "例: ENEOS")}
        ${selectField("category", "経費科目", categories(), "消耗品費")}
        ${selectField("department", "部門", departments(), departments()[0])}
        ${selectField("paymentMethod", "支払区分", paymentMethods, "cash")}
        ${field("itemName", "品名", "text", "", "例: ガソリン")}
        ${field("quantity", "個数", "number", "1")}
        ${field("unitPrice", "単価", "number", "")}
        ${field("amount", "金額", "number", "")}
        ${selectField("taxRate", "税区分", taxRates, "10%")}
        ${field("registrationNumber", "T番号", "text", "", "T1234567890123")}
        <label class="check-field"><input name="invoiceEligible" type="checkbox" checked> インボイス適格</label>
        <label class="field"><span>証憑画像/PDF</span><input name="proof" type="file" accept="image/*,application/pdf"></label>
        <label class="field" style="grid-column:1 / -1;">
          <span>摘要・読み取り文字</span>
          <textarea name="note" placeholder="カード払い、現金、口座振込、領収書の文字など"></textarea>
        </label>
        <div class="tax-split-box" style="grid-column:1 / -1;">
          <div class="tax-split-head">
            <div>
              <strong>10%と8%が混ざるレシート</strong>
              <p>ツルハのように税率別対象額が印字されている場合は、ここに金額を入れて税率別に2行登録します。T番号、支払区分、証憑画像は同じ内容で引き継ぎます。</p>
            </div>
            <button class="button secondary small" data-action="fill-tsuruha-example" type="button">ツルハ例を入力</button>
          </div>
          <div class="tax-split-grid">
            ${field("split10Amount", "10%対象額", "number", "", "例: 8716")}
            ${field("split8Amount", "8%対象額", "number", "", "例: 13720")}
            ${field("splitMemo", "分割メモ", "text", "", "例: 税率別に分割登録")}
          </div>
        </div>
        <div class="actions" style="grid-column:1 / -1;">
          <button class="button" type="submit">${esc(buttonLabel)}</button>
          <button class="button secondary" data-submit-mode="tax-split" type="submit">税率別に登録</button>
          ${showDetectButton ? `<button class="button secondary" id="detectPaymentButton" type="button">支払区分を判定</button>` : ""}
        </div>
      </form>
    `;
  }

  async function handleExpenseSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const quantity = num(data.get("quantity")) || 1;
    const unitPrice = num(data.get("unitPrice"));
    const amount = num(data.get("amount")) || Math.round(quantity * unitPrice);
    const proofFile = data.get("proof");
    const proof = proofFile && proofFile.size ? await readFile(proofFile) : null;
    const paymentMethod = detectPayment(`${data.get("note") || ""} ${proofFile && proofFile.name ? proofFile.name : ""}`) || clean(data.get("paymentMethod")) || "cash";
    const hasSplitAmounts = num(data.get("split10Amount")) > 0 || num(data.get("split8Amount")) > 0;
    const splitMode = (event.submitter && event.submitter.dataset.submitMode === "tax-split") || hasSplitAmounts;
    if (splitMode) {
      const records = buildTaxSplitExpenseRecords(data, { paymentMethod, proof });
      if (!records.length) {
        alert("10%対象額または8%対象額を入力してください。");
        return;
      }
      if (records.some((record) => isLockedRecordMonth("expenses", record, "税率別登録", { silent: true, noAudit: true }))) {
        alert(lockedMonthMessage((records[0].date || "").slice(0, 7), "税率別登録"));
        return;
      }
      records.forEach((record) => state.expenses.push(record));
      addAudit("経費税率別登録", { count: records.length, vendor: clean(data.get("vendor")), total: sum(records, "amount") });
      persist("税率別経費保存");
      showFiscalYearForDate(records[0].date);
      render();
      return;
    }

    const record = {
      id: uid("exp"),
      date: clean(data.get("date")) || TODAY,
      vendor: clean(data.get("vendor")),
      category: clean(data.get("category")) || "未分類",
      department: clean(data.get("department")) || departments()[0],
      itemName: clean(data.get("itemName")),
      quantity,
      unitPrice,
      amount,
      taxRate: clean(data.get("taxRate")) || "不明",
      paymentMethod,
      registrationNumber: normalizeRegistration(data.get("registrationNumber")),
      invoiceEligible: Boolean(data.get("invoiceEligible")),
      note: clean(data.get("note")),
      proof,
      createdAt: new Date().toISOString()
    };
    if (isLockedRecordMonth("expenses", record, "登録")) return;
    state.expenses.push(record);
    addAudit("経費登録", record);
    persist("経費保存");
    showFiscalYearForDate(record.date);
    render();
  }

  function buildTaxSplitExpenseRecords(data, options = {}) {
    const splitRows = [
      { amount: num(data.get("split10Amount")), taxRate: "10%", label: "10%対象" },
      { amount: num(data.get("split8Amount")), taxRate: "8%", label: "8%対象" }
    ].filter((row) => row.amount > 0);
    if (!splitRows.length) return [];

    const baseItemName = clean(data.get("itemName")) || "レシート購入分";
    const baseNote = clean(data.get("note"));
    const splitMemo = clean(data.get("splitMemo"));
    const total = splitRows.reduce((acc, row) => acc + row.amount, 0);
    const splitText = `税率別分割 / 合計 ${yen(total)} / ${splitRows.map((row) => `${row.taxRate} ${yen(row.amount)}`).join(" / ")}`;
    const groupId = uid("split");
    const createdAt = new Date().toISOString();

    return splitRows.map((row) => ({
      id: uid("exp"),
      splitGroupId: groupId,
      date: clean(data.get("date")) || TODAY,
      vendor: clean(data.get("vendor")),
      category: clean(data.get("category")) || "未分類",
      department: clean(data.get("department")) || departments()[0],
      itemName: `${baseItemName} ${row.label}`,
      quantity: 1,
      unitPrice: row.amount,
      amount: row.amount,
      taxRate: row.taxRate,
      paymentMethod: options.paymentMethod || clean(data.get("paymentMethod")) || "cash",
      registrationNumber: normalizeRegistration(data.get("registrationNumber")),
      invoiceEligible: Boolean(data.get("invoiceEligible")),
      note: [baseNote, splitMemo, splitText].filter(Boolean).join(" / "),
      proof: options.proof || null,
      createdAt
    }));
  }

  function renderReceivedDocs() {
    const docs = fiscalItems(state.receivedDocs || [], "receivedDate").sort(byDate("receivedDate"));
    const pending = docs.filter((item) => ["未確認", "支払依頼待ち"].includes(item.status));
    const noFile = docs.filter((item) => !item.file);
    const paymentTargets = docs.filter((item) => item.documentType === "請求書" && !item.paymentRequestNo);
    const paid = docs.filter((item) => item.status === "支払済");

    app.innerHTML = `
      <div class="grid cols-4">
        ${summaryCard("未処理", `${pending.length}件`, "確認または支払依頼待ち")}
        ${summaryCard("請求書未申請", `${paymentTargets.length}件`, "支払依頼に未連携")}
        ${summaryCard("添付なし", `${noFile.length}件`, "PDF/画像の保存確認")}
        ${summaryCard("支払済", `${paid.length}件`, "処理完了")}
      </div>

      <section class="panel" style="margin-top:14px;">
        <div class="panel-head">
          <h2>受領書類登録</h2>
          <button class="button secondary small" id="exportReceivedDocsCsv" type="button">CSV</button>
        </div>
        <div class="panel-body">
          <form id="receivedDocForm" class="form-grid">
            ${field("receivedDate", "受領日", "date", TODAY)}
            ${selectField("documentType", "書類種別", receivedDocTypes, "請求書")}
            ${field("vendor", "発行元・支払先", "text", "")}
            ${field("title", "件名", "text", "")}
            ${field("amount", "金額", "number", "")}
            ${field("dueDate", "支払期限", "date", endOfNextMonth(TODAY))}
            ${selectField("category", "経費科目", categories(), "未分類")}
            ${selectField("department", "部門", departments(), departments()[0])}
            ${selectField("status", "状態", receivedDocStatuses, "未確認")}
            <label class="field"><span>書類画像/PDF</span><input name="file" type="file" accept="image/*,application/pdf"></label>
            <label class="field" style="grid-column:1 / -1;"><span>メモ・読み取り文字</span><textarea name="note" placeholder="請求書番号、口座、明細、確認事項など"></textarea></label>
            <div class="actions" style="grid-column:1 / -1;"><button class="button" type="submit">受領書類登録</button></div>
          </form>
        </div>
      </section>

      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>受領書類一覧</h2><span class="badge">${docs.length}件</span></div>
        <div class="panel-body">
          <div class="notice info" style="margin-bottom:12px;">取引先から届いた請求書・領収書・納品書などをここに保管します。請求書は「支払依頼化」で申請・承認画面へつなげられます。</div>
          ${renderReceivedDocTable(docs)}
        </div>
      </section>
    `;
    document.getElementById("receivedDocForm").addEventListener("submit", handleReceivedDocSubmit);
    document.getElementById("exportReceivedDocsCsv").addEventListener("click", () => exportCsv("received-docs", docs, receivedDocCsvFields()));
    bindTableActions();
  }

  async function handleReceivedDocSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");
    const data = formValues(form);
    const record = receivedDocRecordFromData({
      ...data,
      file: file && file.size ? await readFile(file) : null
    });
    if (isLockedRecordMonth("receivedDocs", record, "登録")) return;
    state.receivedDocs.push(record);
    addAudit("受領書類登録", record);
    persist("受領書類保存");
    renderReceivedDocs();
  }

  function receivedDocRecordFromData(data, withId = true) {
    return {
      ...(withId ? { id: uid("recv") } : {}),
      receivedDate: data.receivedDate || TODAY,
      documentType: data.documentType || "請求書",
      vendor: data.vendor || "",
      title: data.title || "",
      amount: num(data.amount),
      dueDate: data.dueDate || "",
      category: data.category || "未分類",
      department: data.department || departments()[0],
      status: data.status || "未確認",
      paymentRequestNo: data.paymentRequestNo || "",
      paymentRequestStatus: data.paymentRequestStatus || "",
      file: data.file || null,
      note: data.note || "",
      createdAt: new Date().toISOString()
    };
  }

  function renderApprovals() {
    const requests = fiscalItems(state.paymentRequests, "requestDate").sort(byDate("requestDate"));
    const pending = requests.filter((item) => item.status === "申請中");
    const returned = requests.filter((item) => item.status === "差し戻し");
    const approved = requests.filter((item) => item.status === "承認済");
    const overdue = requests.filter((item) => item.dueDate && item.dueDate < TODAY && item.status !== "支払済");

    app.innerHTML = `
      <div class="grid cols-4">
        ${summaryCard("承認待ち", `${pending.length}件`, "支払前に確認が必要")}
        ${summaryCard("差し戻し", `${returned.length}件`, "内容修正が必要")}
        ${summaryCard("承認済", `${approved.length}件`, "支払待ち")}
        ${summaryCard("期限超過", `${overdue.length}件`, "支払期限を確認")}
      </div>

      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>承認ワークフロー</h2><span class="badge">${requests.length}件</span></div>
        <div class="panel-body">
          <div class="notice info" style="margin-bottom:12px;">下書き、差し戻し、承認待ち、支払待ち、支払済みを列で確認します。期限超過や期限が近い支払依頼を先に処理できます。</div>
          ${renderApprovalWorkflowBoard(requests)}
        </div>
      </section>

      <section class="panel" style="margin-top:14px;">
        <div class="panel-head">
          <h2>支払依頼・事前申請</h2>
          <button class="button secondary small" id="exportPaymentRequestsCsv" type="button">CSV</button>
        </div>
        <div class="panel-body">
          <form id="paymentRequestForm" class="form-grid">
            ${field("requestNo", "申請番号", "text", nextPaymentRequestNo())}
            ${selectField("requestType", "申請種別", ["支払依頼", "事前申請", "経費精算", "その他"], "支払依頼")}
            ${field("requestDate", "申請日", "date", TODAY)}
            ${field("dueDate", "支払期限", "date", endOfNextMonth(TODAY))}
            ${field("vendor", "支払先", "text", "")}
            ${field("content", "内容", "text", "")}
            ${selectField("category", "経費科目", categories(), "未分類")}
            ${selectField("department", "部門", departments(), departments()[0])}
            ${field("amount", "金額", "number", "")}
            ${field("applicant", "申請者", "text", "")}
            ${field("approver", "承認者", "text", "")}
            ${selectField("status", "状態", paymentRequestStatuses, "申請中")}
            <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note" placeholder="支払理由、添付資料、確認事項など"></textarea></label>
            <div class="actions" style="grid-column:1 / -1;"><button class="button" type="submit">申請登録</button></div>
          </form>
        </div>
      </section>

      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>申請一覧</h2><span class="badge">${requests.length}件</span></div>
        <div class="panel-body">
          <div class="notice info" style="margin-bottom:12px;">経費一覧の「支払依頼化」からも申請を作れます。承認済み後に「支払済」にすると、税理士提出前に未払い・未承認の確認ができます。</div>
          ${renderPaymentRequestTable(requests)}
        </div>
      </section>
    `;
    document.getElementById("paymentRequestForm").addEventListener("submit", handlePaymentRequestSubmit);
    document.getElementById("exportPaymentRequestsCsv").addEventListener("click", () => exportCsv("payment-requests", requests, paymentRequestCsvFields()));
    bindPaymentRequestActions();
    bindTableActions();
  }

  function renderApprovalWorkflowBoard(requests) {
    const lanes = [
      { status: "下書き", title: "下書き", hint: "申請前" },
      { status: "差し戻し", title: "差し戻し", hint: "修正して再申請" },
      { status: "申請中", title: "承認待ち", hint: "承認または差戻し" },
      { status: "承認済", title: "支払待ち", hint: "支払済みに更新" },
      { status: "支払済", title: "支払済", hint: "処理完了" }
    ];
    return `<div class="approval-board">${lanes.map((lane) => renderApprovalLane(lane, requests.filter((item) => item.status === lane.status))).join("")}</div>`;
  }

  function renderApprovalLane(lane, items) {
    return `
      <section class="approval-lane">
        <div class="approval-lane-head">
          <strong>${esc(lane.title)}</strong>
          <span class="badge">${items.length}件</span>
        </div>
        <div class="approval-lane-sub">${esc(lane.hint)} / ${yen(sum(items, "amount"))}</div>
        <div class="approval-lane-body">
          ${items.length ? items.map(renderApprovalCard).join("") : '<div class="approval-empty">対象なし</div>'}
        </div>
      </section>
    `;
  }

  function renderApprovalCard(item) {
    return `
      <article class="approval-card">
        <div class="approval-card-top">
          <strong>${esc(item.requestNo || "")}</strong>
          ${paymentRequestDueBadge(item)}
        </div>
        <div class="approval-card-main">${esc(item.vendor || "支払先未入力")}</div>
        <div class="approval-card-meta">${esc(item.content || "内容未入力")}</div>
        <div class="approval-card-foot">
          <span>${esc(formatDate(item.dueDate)) || "期限未入力"}</span>
          <strong>${yen(item.amount)}</strong>
        </div>
        <div class="actions">${paymentRequestActionButtons(item)}</div>
      </article>
    `;
  }

  function paymentRequestDueBadge(item) {
    if (item.status === "支払済") return '<span class="badge good">完了</span>';
    if (!item.dueDate) return '<span class="badge warn">期限未入力</span>';
    if (item.dueDate < TODAY) return '<span class="badge bad">期限超過</span>';
    if (daysBetween(TODAY, item.dueDate) <= 7) return '<span class="badge warn">期限近い</span>';
    return '<span class="badge good">期限内</span>';
  }

  function handlePaymentRequestSubmit(event) {
    event.preventDefault();
    const data = formValues(event.currentTarget);
    const record = paymentRequestRecordFromData(data);
    if (isLockedRecordMonth("paymentRequests", record, "登録")) return;
    state.paymentRequests.push(record);
    addAudit("支払依頼登録", record);
    persist("支払依頼保存");
    renderApprovals();
  }

  function paymentRequestRecordFromData(data, withId = true) {
    return {
      ...(withId ? { id: uid("payreq") } : {}),
      requestNo: data.requestNo || nextPaymentRequestNo(),
      requestType: data.requestType || "支払依頼",
      requestDate: data.requestDate || TODAY,
      dueDate: data.dueDate || "",
      vendor: data.vendor || "",
      content: data.content || "",
      category: data.category || "未分類",
      department: data.department || departments()[0],
      amount: num(data.amount),
      applicant: data.applicant || "",
      approver: data.approver || "",
      status: data.status || "申請中",
      linkedExpenseId: data.linkedExpenseId || "",
      linkedReceivedDocId: data.linkedReceivedDocId || "",
      note: data.note || "",
      createdAt: new Date().toISOString()
    };
  }

  function createPaymentRequestFromExpense(expense) {
    const existing = paymentRequestForExpense(expense.id);
    if (existing) {
      alert(`この経費はすでに ${existing.requestNo} として申請されています。`);
      return;
    }
    if (isLockedRecordMonth("expenses", expense, "支払依頼化")) return;
    const request = paymentRequestRecordFromData({
      requestNo: nextPaymentRequestNo(),
      requestType: "支払依頼",
      requestDate: TODAY,
      dueDate: expense.date || TODAY,
      vendor: expense.vendor,
      content: expense.itemName || expense.note || "経費",
      category: expense.category,
      department: expense.department || departments()[0],
      amount: expense.amount,
      applicant: "",
      approver: "",
      status: "申請中",
      linkedExpenseId: expense.id,
      note: [`経費 ${formatDate(expense.date)} から作成`, expense.note].filter(Boolean).join(" / ")
    });
    if (isLockedRecordMonth("paymentRequests", request, "支払依頼化")) return;
    state.paymentRequests.push(request);
    expense.paymentRequestNo = request.requestNo;
    expense.paymentRequestStatus = request.status;
    addAudit("経費から支払依頼化", { expenseId: expense.id, requestNo: request.requestNo });
    persist("支払依頼化");
    alert(`支払依頼 ${request.requestNo} を作成しました。`);
    if (activeView === "approvals") renderApprovals();
    else renderExpenses();
  }

  function createPaymentRequestFromReceivedDoc(doc) {
    const existing = paymentRequestForReceivedDoc(doc.id);
    if (existing) {
      alert(`この受領書類はすでに ${existing.requestNo} として申請されています。`);
      return;
    }
    if (isLockedRecordMonth("receivedDocs", doc, "支払依頼化")) return;
    const request = paymentRequestRecordFromData({
      requestNo: nextPaymentRequestNo(),
      requestType: "支払依頼",
      requestDate: TODAY,
      dueDate: doc.dueDate || TODAY,
      vendor: doc.vendor,
      content: doc.title || `${doc.documentType || "受領書類"} 支払`,
      category: doc.category || "未分類",
      department: doc.department || departments()[0],
      amount: doc.amount,
      applicant: "",
      approver: "",
      status: "申請中",
      linkedReceivedDocId: doc.id,
      note: [`受領書類 ${formatDate(doc.receivedDate)} から作成`, doc.note].filter(Boolean).join(" / ")
    });
    if (isLockedRecordMonth("paymentRequests", request, "支払依頼化")) return;
    state.paymentRequests.push(request);
    doc.paymentRequestNo = request.requestNo;
    doc.paymentRequestStatus = request.status;
    doc.status = "申請中";
    addAudit("受領書類から支払依頼化", { receivedDocId: doc.id, requestNo: request.requestNo });
    persist("支払依頼化");
    alert(`支払依頼 ${request.requestNo} を作成しました。`);
    if (activeView === "approvals") renderApprovals();
    else renderReceivedDocs();
  }

  function renderSales() {
    const allSales = fiscalItems(state.sales, "date").sort(byDate("date"));
    const sales = filterSales(allSales);
    let cumulative = 0;
    const rows = sales.map((sale) => {
      cumulative += num(sale.amount);
      return { ...sale, cumulative };
    });

    app.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <h2>売上入金</h2>
          <div class="actions">
            <label class="button secondary small file-button">通帳CSV取込<input id="importSalesCsvInput" type="file" accept=".csv,text/csv"></label>
            <button class="button secondary small" id="exportSalesCsv" type="button">CSV</button>
          </div>
        </div>
        <div class="panel-body">
          <form id="salesForm" class="form-grid">
            ${field("date", "入金日", "date", TODAY)}
            ${field("customer", "取引先", "text", "")}
            ${field("content", "項目・内容", "text", "")}
            ${selectField("classification", "分類", salesCategories, "業務委託")}
            ${selectField("department", "部門", departments(), departments()[0])}
            ${field("amount", "売上額", "number", "")}
            ${field("invoiceNo", "請求書番号", "text", "")}
            ${field("bankAccount", "通帳", "text", state.settings.bankAccount || "道銀")}
            <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note"></textarea></label>
            <div class="actions" style="grid-column:1 / -1;"><button class="button" type="submit">売上登録</button></div>
          </form>
        </div>
      </section>
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>売上一覧</h2><span class="badge">${yen(sum(sales, "amount"))} / ${sales.length}件</span></div>
        <div class="panel-body">
          ${renderSalesFilters(allSales)}
          ${renderSalesTable(rows)}
        </div>
      </section>
    `;

    document.getElementById("salesForm").addEventListener("submit", handleSalesSubmit);
    document.getElementById("importSalesCsvInput").addEventListener("change", importSalesCsv);
    document.getElementById("exportSalesCsv").addEventListener("click", () => exportCsv("sales", sales, [
      ["date", "入金日"], ["customer", "取引先"], ["content", "項目"], ["classification", "分類"],
      ["department", "部門"], ["amount", "売上額"], ["invoiceNo", "請求書番号"], ["bankAccount", "通帳"], ["note", "メモ"]
    ]));
    bindFilterControls("sales");
    bindTableActions();
  }

  function handleSalesSubmit(event) {
    event.preventDefault();
    const data = formValues(event.currentTarget);
    const record = {
      id: uid("sale"),
      date: data.date || TODAY,
      customer: data.customer,
      content: data.content,
      classification: data.classification,
      department: data.department || departments()[0],
      amount: num(data.amount),
      invoiceNo: data.invoiceNo,
      bankAccount: data.bankAccount || state.settings.bankAccount || "道銀",
      note: data.note,
      createdAt: new Date().toISOString()
    };
    if (isLockedRecordMonth("sales", record, "登録")) return;
    state.sales.push(record);
    markInvoicePaidFromSale(record);
    addAudit("売上登録", record);
    persist("売上保存");
    renderSales();
  }

  function renderInvoices() {
    const allInvoices = fiscalInvoices().sort(byDate("issueDate"));
    const invoices = filterInvoices(allInvoices);
    const issues = getInvoiceIssues();

    app.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <h2>請求書登録</h2>
          <div class="actions"><button class="button secondary small" id="exportInvoicesCsv" type="button">CSV</button></div>
        </div>
        <div class="panel-body document-builder">
          <form id="invoiceForm" class="form-grid">
            ${partnerDatalist()}
            ${itemDatalist()}
            ${field("invoiceNo", "請求書番号", "text", nextInvoiceNo())}
            ${field("issueDate", "請求日", "date", TODAY)}
            ${field("serviceDate", "実施日", "date", TODAY)}
            ${field("dueDate", "支払期限", "date", endOfNextMonth(TODAY))}
            ${field("expectedPaymentDate", "入金予定日", "date", endOfNextMonth(TODAY))}
            ${field("paymentDate", "入金日", "date", "")}
            ${textFieldWithList("customer", "請求先", "", "partnerNameList", "取引先マスタから選択または直接入力")}
            ${textFieldWithList("content", "内容", "", "itemNameList", "品目マスタから選択または直接入力")}
            ${selectField("classification", "分類", salesCategories, "業務委託")}
            ${selectField("department", "部門", departments(), departments()[0])}
            ${field("amount", "金額", "number", "")}
            ${selectField("taxRate", "税区分", taxRates, "10%")}
            ${documentLinesEditor()}
            ${selectField("status", "状態", invoiceStatuses, "未入金")}
            ${selectField("template", "テンプレート", documentTemplates(), defaultDocumentTemplate())}
            ${selectField("sendStatus", "送付状態", sendStatuses(), "未送付")}
            ${field("sendDate", "送付日", "date", "")}
            <label class="field" style="grid-column:1 / -1;"><span>税理士確認メモ</span><textarea name="note" placeholder="決算またぎ、実施日の考え方、支払いとのずれなど"></textarea></label>
            <div class="actions" style="grid-column:1 / -1;"><button class="button" type="submit">請求書登録</button></div>
          </form>
          <aside class="document-preview-panel">
            <h3>作成プレビュー</h3>
            <div id="invoicePreview" class="document-preview"></div>
          </aside>
        </div>
      </section>

      <div class="grid cols-3" style="margin-top:14px;">
        <section class="panel">
          <div class="panel-head"><h2>請求・売上照合</h2><span class="badge ${issues.length ? "warn" : "good"}">${issues.length}件</span></div>
          <div class="panel-body">${issues.length ? `<div class="alert-list">${issues.map(renderAlert).join("")}</div>` : `<div class="notice info">請求書と売上の大きなずれはありません。</div>`}</div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>未収・回収予定</h2><span class="badge">${yen(sum(unpaidInvoices(allInvoices), "amount"))}</span></div>
          <div class="panel-body">${renderReceivableAging(allInvoices)}</div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>会計判断メモ</h2><span class="badge warn">税理士確認</span></div>
          <div class="panel-body">
            <div class="notice">
              <p><strong>例: 6月25日請求、7月末支払い、7月25日入金。</strong> このシステムでは、入金日は売上一覧へ、請求書側には請求日・実施日・支払期限・入金予定日・入金日を残します。</p>
              <p><span class="red-note">担当税理士に確認が必要。</span> 決算をまたぐ場合は、入金日だけで判断せず、実施日と役務提供完了日を確認できる情報を残してください。</p>
            </div>
          </div>
        </section>
      </div>

      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>請求書一覧</h2><span class="badge">${yen(sum(invoices, "amount"))} / ${invoices.length}件</span></div>
        <div class="panel-body">
          ${renderInvoiceFilters(allInvoices)}
          ${renderInvoiceTable(invoices)}
        </div>
      </section>
    `;

    document.getElementById("invoiceForm").addEventListener("submit", handleInvoiceSubmit);
    bindLineEditor("invoiceForm");
    bindDocumentPreview("invoiceForm", "invoicePreview", "invoice");
    document.getElementById("exportInvoicesCsv").addEventListener("click", () => exportCsv("invoices", invoices, [
      ["invoiceNo", "請求書番号"], ["issueDate", "請求日"], ["serviceDate", "実施日"], ["dueDate", "支払期限"],
      ["expectedPaymentDate", "入金予定日"], ["paymentDate", "入金日"], ["customer", "請求先"], ["content", "内容"],
      ["classification", "分類"], ["department", "部門"], ["amount", "金額"], ["lines", "明細"], ["status", "状態"], ["sendStatus", "送付状態"], ["sendDate", "送付日"], ["template", "テンプレート"], ["note", "確認メモ"]
    ]));
    bindFilterControls("invoices");
    bindTableActions();
  }

  function handleInvoiceSubmit(event) {
    event.preventDefault();
    const data = formValues(event.currentTarget);
    const lines = documentLinesFromData(data, { itemName: data.content, quantity: 1, unit: "式", unitPrice: data.amount, amount: data.amount, taxRate: data.taxRate });
    const record = {
      id: uid("inv"),
      invoiceNo: data.invoiceNo || nextInvoiceNo(),
      issueDate: data.issueDate || TODAY,
      serviceDate: data.serviceDate || data.issueDate || TODAY,
      dueDate: data.dueDate,
      expectedPaymentDate: data.expectedPaymentDate,
      paymentDate: data.paymentDate,
      customer: data.customer,
      content: data.content,
      classification: data.classification,
      department: data.department || departments()[0],
      amount: documentAmountFromLines(lines, data.amount),
      taxRate: data.taxRate || "10%",
      lines,
      status: data.paymentDate ? "入金済" : data.status || "未入金",
      template: data.template || defaultDocumentTemplate(),
      sendStatus: data.sendStatus || "未送付",
      sendDate: data.sendDate,
      note: data.note,
      createdAt: new Date().toISOString()
    };
    if (isLockedRecordMonth("invoices", record, "登録")) return;
    state.invoices.push(record);
    addAudit("請求書登録", record);
    persist("請求書保存");
    renderInvoices();
  }

  function renderEstimates() {
    const estimates = fiscalItems(state.estimates, "date").sort(byDate("date"));
    app.innerHTML = `
      <section class="panel">
        <div class="panel-head"><h2>見積登録</h2><button class="button secondary small" id="exportEstimatesCsv" type="button">CSV</button></div>
        <div class="panel-body document-builder">
          <form id="estimateForm" class="form-grid">
            ${partnerDatalist()}
            ${itemDatalist()}
            ${field("estimateNo", "見積番号", "text", nextEstimateNo())}
            ${field("date", "見積日", "date", TODAY)}
            ${textFieldWithList("customer", "提出先", "", "partnerNameList", "取引先マスタから選択または直接入力")}
            ${selectField("classification", "分類", salesCategories, "業務委託")}
            ${selectField("department", "部門", departments(), departments()[0])}
            ${textFieldWithList("content", "内容", "", "itemNameList", "品目マスタから選択または直接入力")}
            ${field("amount", "金額", "number", "")}
            ${documentLinesEditor()}
            ${selectField("status", "状態", ["作成中", "提出済", "受注", "失注", "保留"], "作成中")}
            ${field("linkedDeliveryNo", "納品書番号", "text", "")}
            ${field("linkedInvoiceNo", "請求書番号", "text", "")}
            ${selectField("template", "テンプレート", documentTemplates(), defaultDocumentTemplate())}
            ${selectField("sendStatus", "送付状態", sendStatuses(), "未送付")}
            ${field("sendDate", "送付日", "date", "")}
            <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note"></textarea></label>
            <div class="actions" style="grid-column:1 / -1;"><button class="button" type="submit">見積登録</button></div>
          </form>
          <aside class="document-preview-panel">
            <h3>作成プレビュー</h3>
            <div id="estimatePreview" class="document-preview"></div>
          </aside>
        </div>
      </section>
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>見積一覧</h2><span class="badge">${estimates.length}件</span></div>
        <div class="panel-body">${renderEstimateTable(estimates)}</div>
      </section>
    `;
    document.getElementById("estimateForm").addEventListener("submit", handleEstimateSubmit);
    bindLineEditor("estimateForm");
    bindDocumentPreview("estimateForm", "estimatePreview", "estimate");
    document.getElementById("exportEstimatesCsv").addEventListener("click", () => exportCsv("estimates", estimates, [
      ["estimateNo", "見積番号"], ["date", "見積日"], ["customer", "提出先"], ["classification", "分類"],
      ["department", "部門"], ["content", "内容"], ["amount", "金額"], ["lines", "明細"], ["status", "状態"], ["linkedDeliveryNo", "納品書番号"], ["linkedInvoiceNo", "請求書番号"], ["sendStatus", "送付状態"], ["sendDate", "送付日"], ["template", "テンプレート"], ["note", "メモ"]
    ]));
    bindTableActions();
  }

  function handleEstimateSubmit(event) {
    event.preventDefault();
    const data = formValues(event.currentTarget);
    const lines = documentLinesFromData(data, { itemName: data.content, quantity: 1, unit: "式", unitPrice: data.amount, amount: data.amount, taxRate: data.taxRate || "10%" });
    const record = {
      id: uid("est"),
      estimateNo: data.estimateNo || nextEstimateNo(),
      date: data.date || TODAY,
      customer: data.customer,
      classification: data.classification,
      department: data.department || departments()[0],
      content: data.content,
      amount: documentAmountFromLines(lines, data.amount),
      lines,
      status: data.status,
      linkedDeliveryNo: data.linkedDeliveryNo,
      linkedInvoiceNo: data.linkedInvoiceNo,
      template: data.template || defaultDocumentTemplate(),
      sendStatus: data.sendStatus || "未送付",
      sendDate: data.sendDate,
      note: data.note,
      createdAt: new Date().toISOString()
    };
    if (isLockedRecordMonth("estimates", record, "登録")) return;
    state.estimates.push(record);
    addAudit("見積登録", record);
    persist("見積保存");
    renderEstimates();
  }

  function renderDeliveries() {
    const deliveries = fiscalItems(state.deliveries, "date").sort(byDate("date"));
    app.innerHTML = `
      <section class="panel">
        <div class="panel-head"><h2>納品書作成</h2><button class="button secondary small" id="exportDeliveriesCsv" type="button">CSV</button></div>
        <div class="panel-body document-builder">
          <form id="deliveryForm" class="form-grid">
            ${partnerDatalist()}
            ${itemDatalist()}
            ${field("deliveryNo", "納品書番号", "text", nextDeliveryNo())}
            ${field("date", "納品日", "date", TODAY)}
            ${textFieldWithList("customer", "取引先", "", "partnerNameList", "取引先マスタから選択または直接入力")}
            ${field("subject", "件名", "text", "")}
            ${textFieldWithList("itemName", "品目", "", "itemNameList", "品目マスタから選択または直接入力")}
            ${field("quantity", "数量", "number", "1")}
            ${field("unit", "単位", "text", "式")}
            ${field("unitPrice", "単価", "number", "")}
            ${field("amount", "金額", "number", "")}
            ${selectField("taxRate", "税区分", taxRates, "10%")}
            ${documentLinesEditor()}
            ${selectField("template", "テンプレート", documentTemplates(), defaultDocumentTemplate())}
            ${selectField("sendStatus", "送付状態", sendStatuses(), "未送付")}
            ${field("sendDate", "送付日", "date", "")}
            ${field("linkedEstimateNo", "関連見積番号", "text", "")}
            ${field("linkedInvoiceNo", "関連請求書番号", "text", "")}
            <label class="field" style="grid-column:1 / -1;"><span>備考</span><textarea name="note"></textarea></label>
            <div class="actions" style="grid-column:1 / -1;"><button class="button" type="submit">納品書登録</button></div>
          </form>
          <aside class="document-preview-panel">
            <h3>作成プレビュー</h3>
            <div id="deliveryPreview" class="document-preview"></div>
          </aside>
        </div>
      </section>
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>納品書一覧</h2><span class="badge">${deliveries.length}件</span></div>
        <div class="panel-body">${renderDeliveryTable(deliveries)}</div>
      </section>
    `;
    document.getElementById("deliveryForm").addEventListener("submit", handleDeliverySubmit);
    bindLineEditor("deliveryForm");
    document.getElementById("exportDeliveriesCsv").addEventListener("click", () => exportCsv("deliveries", deliveries, deliveryCsvFields()));
    bindDocumentPreview("deliveryForm", "deliveryPreview", "delivery");
    bindTableActions();
  }

  function handleDeliverySubmit(event) {
    event.preventDefault();
    const data = formValues(event.currentTarget);
    const record = deliveryRecordFromData(data);
    if (isLockedRecordMonth("deliveries", record, "登録")) return;
    state.deliveries.push(record);
    addAudit("納品書登録", record);
    persist("納品書保存");
    renderDeliveries();
  }

  function renderReceiptDocs() {
    const receiptDocs = fiscalItems(state.receiptDocs, "issueDate").sort(byDate("issueDate"));
    app.innerHTML = `
      <section class="panel">
        <div class="panel-head"><h2>領収書作成</h2><button class="button secondary small" id="exportReceiptDocsCsv" type="button">CSV</button></div>
        <div class="panel-body document-builder">
          <form id="receiptDocForm" class="form-grid">
            ${partnerDatalist()}
            ${itemDatalist()}
            ${field("receiptNo", "領収書番号", "text", nextReceiptNo())}
            ${field("issueDate", "発行日", "date", TODAY)}
            ${field("paymentDate", "入金日", "date", TODAY)}
            ${textFieldWithList("customer", "取引先", "", "partnerNameList", "取引先マスタから選択または直接入力")}
            ${field("invoiceNo", "請求書番号", "text", "")}
            ${textFieldWithList("content", "但し書き・内容", "", "itemNameList", "品目マスタから選択または直接入力")}
            ${field("amount", "領収金額", "number", "")}
            ${selectField("taxRate", "税区分", taxRates, "10%")}
            ${documentLinesEditor()}
            ${selectField("template", "テンプレート", documentTemplates(), defaultDocumentTemplate())}
            ${selectField("sendStatus", "送付状態", sendStatuses(), "未送付")}
            ${field("sendDate", "送付日", "date", "")}
            <label class="field" style="grid-column:1 / -1;"><span>備考</span><textarea name="note"></textarea></label>
            <div class="actions" style="grid-column:1 / -1;"><button class="button" type="submit">領収書登録</button></div>
          </form>
          <aside class="document-preview-panel">
            <h3>作成プレビュー</h3>
            <div id="receiptDocPreview" class="document-preview"></div>
          </aside>
        </div>
      </section>
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>領収書一覧</h2><span class="badge">${receiptDocs.length}件</span></div>
        <div class="panel-body">${renderReceiptDocTable(receiptDocs)}</div>
      </section>
    `;
    document.getElementById("receiptDocForm").addEventListener("submit", handleReceiptDocSubmit);
    bindLineEditor("receiptDocForm");
    document.getElementById("exportReceiptDocsCsv").addEventListener("click", () => exportCsv("receipt-docs", receiptDocs, receiptDocCsvFields()));
    bindDocumentPreview("receiptDocForm", "receiptDocPreview", "receipt");
    bindTableActions();
  }

  function handleReceiptDocSubmit(event) {
    event.preventDefault();
    const data = formValues(event.currentTarget);
    const record = receiptDocRecordFromData(data);
    if (isLockedRecordMonth("receiptDocs", record, "登録")) return;
    state.receiptDocs.push(record);
    addAudit("領収書登録", record);
    persist("領収書保存");
    renderReceiptDocs();
  }

  function renderPartners() {
    const partners = [...(state.partners || [])].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ja"));
    app.innerHTML = `
      <section class="panel">
        <div class="panel-head"><h2>取引先登録</h2><button class="button secondary small" id="exportPartnersCsv" type="button">CSV</button></div>
        <div class="panel-body">
          <form id="partnerForm" class="form-grid">
            ${field("name", "取引先名", "text", "")}
            ${selectField("honorific", "敬称", ["御中", "様", "先生", "なし"], "御中")}
            ${field("contact", "担当者", "text", "")}
            ${field("email", "メール", "email", "")}
            ${field("phone", "電話", "tel", "")}
            ${field("paymentTerms", "支払条件", "text", "月末締め翌月末払い")}
            <label class="field" style="grid-column:1 / -1;"><span>住所・送付先</span><textarea name="address"></textarea></label>
            <label class="field" style="grid-column:1 / -1;"><span>振込先・請求条件メモ</span><textarea name="bankInfo"></textarea></label>
            <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note"></textarea></label>
            <div class="actions" style="grid-column:1 / -1;"><button class="button" type="submit">取引先登録</button></div>
          </form>
        </div>
      </section>
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>取引先一覧</h2><span class="badge">${partners.length}件</span></div>
        <div class="panel-body">${renderPartnerTable(partners)}</div>
      </section>
    `;
    document.getElementById("partnerForm").addEventListener("submit", handlePartnerSubmit);
    document.getElementById("exportPartnersCsv").addEventListener("click", () => exportCsv("partners", partners, partnerCsvFields()));
    bindTableActions();
  }

  function handlePartnerSubmit(event) {
    event.preventDefault();
    const data = formValues(event.currentTarget);
    const record = {
      id: uid("partner"),
      name: data.name,
      honorific: data.honorific || "御中",
      contact: data.contact,
      email: data.email,
      phone: data.phone,
      paymentTerms: data.paymentTerms,
      address: data.address,
      bankInfo: data.bankInfo,
      note: data.note,
      createdAt: new Date().toISOString()
    };
    state.partners.push(record);
    addAudit("取引先登録", record);
    persist("取引先保存");
    renderPartners();
  }

  function renderItems() {
    const items = [...(state.items || [])].sort((a, b) => String(a.itemName || "").localeCompare(String(b.itemName || ""), "ja"));
    app.innerHTML = `
      <section class="panel">
        <div class="panel-head"><h2>品目登録</h2><button class="button secondary small" id="exportItemsCsv" type="button">CSV</button></div>
        <div class="panel-body">
          <form id="itemForm" class="form-grid">
            ${field("itemCode", "品番", "text", "")}
            ${field("itemName", "品目名", "text", "")}
            ${selectField("category", "分類", salesCategories, "業務委託")}
            ${field("unitPrice", "標準単価", "number", "")}
            ${field("unit", "単位", "text", "式")}
            ${selectField("taxRate", "税率", taxRates, "10%")}
            <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note"></textarea></label>
            <div class="actions" style="grid-column:1 / -1;"><button class="button" type="submit">品目登録</button></div>
          </form>
        </div>
      </section>
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>品目一覧</h2><span class="badge">${items.length}件</span></div>
        <div class="panel-body">${renderItemTable(items)}</div>
      </section>
    `;
    document.getElementById("itemForm").addEventListener("submit", handleItemSubmit);
    document.getElementById("exportItemsCsv").addEventListener("click", () => exportCsv("items", items, itemCsvFields()));
    bindTableActions();
  }

  function handleItemSubmit(event) {
    event.preventDefault();
    const data = formValues(event.currentTarget);
    const record = {
      id: uid("item"),
      itemCode: data.itemCode,
      itemName: data.itemName,
      category: data.category || "業務委託",
      unitPrice: num(data.unitPrice),
      unit: data.unit || "式",
      taxRate: data.taxRate || "10%",
      note: data.note,
      createdAt: new Date().toISOString()
    };
    state.items.push(record);
    addAudit("品目登録", record);
    persist("品目保存");
    renderItems();
  }

  function renderRecurring() {
    const templates = [...(state.recurringDocs || [])].sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ja"));
    app.innerHTML = `
      <section class="panel">
        <div class="panel-head"><h2>毎月自動作成ルール</h2><button class="button secondary small" id="exportRecurringCsv" type="button">CSV</button></div>
        <div class="panel-body">
          <form id="recurringForm" class="form-grid">
            ${partnerDatalist()}
            ${itemDatalist()}
            ${field("title", "ルール名", "text", "")}
            ${selectField("documentType", "作成帳票", [["invoice", "請求書"], ["delivery", "納品書"], ["receipt", "領収書"]], "invoice")}
            ${field("dayOfMonth", "作成日", "number", "15")}
            ${textFieldWithList("customer", "取引先", "", "partnerNameList", "取引先マスタから選択または直接入力")}
            ${textFieldWithList("content", "内容", "", "itemNameList", "品目マスタから選択または直接入力")}
            ${field("amount", "金額", "number", "")}
            ${selectField("classification", "分類", salesCategories, "業務委託")}
            ${selectField("department", "部門", departments(), departments()[0])}
            ${selectField("taxRate", "税区分", taxRates, "10%")}
            ${selectField("template", "テンプレート", documentTemplates(), defaultDocumentTemplate())}
            <label class="check-field"><input name="active" type="checkbox" checked> 有効</label>
            <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note"></textarea></label>
            <div class="actions" style="grid-column:1 / -1;"><button class="button" type="submit">ルール登録</button></div>
          </form>
        </div>
      </section>
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>自動作成一覧</h2><span class="badge">${templates.length}件</span></div>
        <div class="panel-body">${renderRecurringTable(templates)}</div>
      </section>
    `;
    document.getElementById("recurringForm").addEventListener("submit", handleRecurringSubmit);
    document.getElementById("exportRecurringCsv").addEventListener("click", () => exportCsv("recurring-docs", templates, recurringCsvFields()));
    bindRecurringActions();
    bindTableActions();
  }

  function handleRecurringSubmit(event) {
    event.preventDefault();
    const data = formValues(event.currentTarget);
    const formData = new FormData(event.currentTarget);
    const record = {
      id: uid("recurring"),
      title: data.title,
      documentType: data.documentType || "invoice",
      dayOfMonth: Math.min(31, Math.max(1, num(data.dayOfMonth) || 15)),
      customer: data.customer,
      content: data.content,
      amount: num(data.amount),
      classification: data.classification || "業務委託",
      department: data.department || departments()[0],
      taxRate: data.taxRate || "10%",
      template: data.template || defaultDocumentTemplate(),
      active: Boolean(formData.get("active")),
      lastCreatedMonth: "",
      note: data.note,
      createdAt: new Date().toISOString()
    };
    state.recurringDocs.push(record);
    addAudit("毎月自動ルール登録", record);
    persist("毎月自動保存");
    renderRecurring();
  }

  function renderSalesFlow() {
    const rows = salesFlowRows();
    const completeRows = rows.filter(salesFlowIsComplete);
    const issueRows = rows.filter((row) => salesFlowIssues(row).length);
    const invoiceWithoutSale = rows.filter((row) => row.invoice && !row.sale);
    const receiptMissing = rows.filter((row) => row.sale && !row.receipt);
    app.innerHTML = `
      <div class="grid cols-4">
        ${summaryCard("案件数", `${rows.length}件`, "見積・納品・請求・入金・領収をまとめた件数")}
        ${summaryCard("完了", `${completeRows.length}件`, "請求・入金・領収書までそろった案件")}
        ${summaryCard("要確認", `${issueRows.length}件`, "金額差、未入金、決算またぎなど")}
        ${summaryCard("未入金/未領収", `${invoiceWithoutSale.length}/${receiptMissing.length}件`, "締め日前に確認する対象")}
      </div>
      <section class="panel">
        <div class="panel-head">
          <h2>販売管理台帳</h2>
          <div class="actions">
            <span class="badge">${rows.length}件</span>
            <button class="button secondary small" id="exportSalesFlowCsv" type="button">CSV</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="notice info" style="margin-bottom:12px;">見積 → 納品 → 請求 → 入金 → 領収書の流れを横並びで確認します。請求書があるのに入金がない、入金済みなのに領収書がない、という確認に使えます。</div>
          ${renderSalesFlowTable(rows)}
        </div>
      </section>
    `;
    document.getElementById("exportSalesFlowCsv").addEventListener("click", () => exportCsv("sales-flow", rows.map(salesFlowCsvRow), salesFlowCsvFields()));
    bindTableActions();
  }

  function renderSendManagement() {
    const docs = sendDocuments();
    const pending = docs.filter((doc) => !isSentStatus(doc.sendStatus));
    const missingEmail = pending.filter((doc) => !doc.email);
    const missingAddress = pending.filter((doc) => !doc.address);
    const logs = fiscalSendLogs();
    app.innerHTML = `
      <div class="grid cols-4">
        ${summaryCard("未送付", `${pending.length}件`, "メール文作成または送付済みにする対象")}
        ${summaryCard("送付済み", `${docs.length - pending.length}件`, "メール送付・郵送済みの帳票")}
        ${summaryCard("メール不足", `${missingEmail.length}件`, "取引先マスタにメールがない帳票")}
        ${summaryCard("住所不足", `${missingAddress.length}件`, "郵送先住所がない帳票")}
      </div>
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head">
          <h2>未送付・送付管理</h2>
          <span class="badge">${docs.length}件</span>
        </div>
        <div class="panel-body">
          <div class="notice info" style="margin-bottom:12px;">帳票を作ったあと、メール文作成・送付済み・郵送済みをここで記録します。金額や仕訳は変更せず、外部へ渡した証跡だけを残します。</div>
          ${renderSendDocumentTable(docs)}
        </div>
      </section>
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head">
          <h2>送付履歴</h2>
          <div class="actions">
            <span class="badge">${logs.length}件</span>
            <button class="button secondary small" id="exportSendLogsCsv" type="button">CSV</button>
          </div>
        </div>
        <div class="panel-body">${renderSendLogTable(logs)}</div>
      </section>
    `;
    document.getElementById("exportSendLogsCsv").addEventListener("click", () => exportCsv("send-logs", logs, sendLogCsvFields()));
    bindTableActions();
  }

  function renderSendDocumentTable(docs) {
    if (!docs.length) return `<div class="empty">送付管理の対象になる帳票はまだありません。</div>`;
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>帳票</th><th>番号</th><th>日付</th><th>取引先</th><th>宛先</th><th>内容</th><th class="num">金額</th><th>状態</th><th>操作</th></tr></thead>
          <tbody>${docs.map((doc) => `
            <tr>
              <td>${esc(doc.label)}</td>
              <td>${esc(doc.number)}</td>
              <td>${esc(formatDate(doc.date))}</td>
              <td>${esc(doc.customer || "")}</td>
              <td>
                <div>${doc.email ? esc(doc.email) : '<span class="badge warn">メール未登録</span>'}</div>
                <div class="sub">${doc.address ? esc(doc.address) : '<span class="badge warn">住所未登録</span>'}</div>
              </td>
              <td>${esc(doc.content || "")}</td>
              <td class="num">${yen(doc.amount)}</td>
              <td>${statusBadge(normalizedSendStatus(doc.sendStatus))} ${doc.sendDate ? esc(formatDate(doc.sendDate)) : ""}</td>
              <td>${sendActionButtons(doc.collection, doc.id)}</td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function renderSendLogTable(logs) {
    if (!logs.length) return `<div class="empty">送付履歴はまだありません。</div>`;
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>記録日時</th><th>帳票</th><th>番号</th><th>取引先</th><th>方法</th><th>宛先</th><th class="num">金額</th><th>メモ</th></tr></thead>
          <tbody>${logs.map((log) => `
            <tr>
              <td>${esc(formatDateTime(log.at))}</td>
              <td>${esc(log.documentLabel || documentTypeLabel(log.documentType))}</td>
              <td>${esc(log.documentNo || "")}</td>
              <td>${esc(log.customer || "")}</td>
              <td>${statusBadge(log.method || "")}</td>
              <td>${esc(log.recipient || "")}</td>
              <td class="num">${yen(log.amount)}</td>
              <td>${esc(log.note || "")}</td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function sendDocuments() {
    return [
      ...fiscalItems(state.estimates, "date").map((record) => sendDocumentFromRecord("estimates", record)),
      ...fiscalItems(state.deliveries, "date").map((record) => sendDocumentFromRecord("deliveries", record)),
      ...fiscalInvoices().map((record) => sendDocumentFromRecord("invoices", record)),
      ...fiscalItems(state.receiptDocs, "issueDate").map((record) => sendDocumentFromRecord("receiptDocs", record))
    ].filter(Boolean).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }

  function sendDocumentFromRecord(collection, record) {
    if (!record) return null;
    const type = documentTypeForCollection(collection);
    const partner = partnerByName(record.customer);
    return {
      collection,
      id: record.id,
      type,
      label: documentTypeLabel(type),
      number: documentNumber(type, record),
      date: documentDateForSend(collection, record),
      customer: record.customer || "",
      content: documentContentForSend(type, record),
      amount: num(record.amount),
      sendStatus: record.sendStatus || "未送付",
      sendDate: record.sendDate || "",
      email: clean(record.email || (partner && partner.email)),
      address: clean(record.address || (partner && partner.address)),
      record
    };
  }

  function documentTypeForCollection(collection) {
    return {
      estimates: "estimate",
      deliveries: "delivery",
      invoices: "invoice",
      receiptDocs: "receipt"
    }[collection] || collection;
  }

  function documentDateForSend(collection, record) {
    if (collection === "invoices") return record.issueDate || record.serviceDate || record.expectedPaymentDate || "";
    if (collection === "receiptDocs") return record.issueDate || record.paymentDate || "";
    return record.date || "";
  }

  function documentContentForSend(type, record) {
    if (type === "delivery") return record.subject || record.itemName || "";
    return record.content || record.subject || record.itemName || "";
  }

  function fiscalSendLogs() {
    const range = getFiscalRange(selectedFiscalYear);
    return (state.sendLogs || [])
      .filter((log) => {
        const date = (log.documentDate || log.sentDate || log.at || "").slice(0, 10);
        return date >= range.start && date <= range.end;
      })
      .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  }

  function normalizedSendStatus(value) {
    const text = clean(value);
    if (!text || text === "譛ｪ騾∽ｻ・") return "未送付";
    if (text === "騾∽ｻ俶ｸ・") return "送付済";
    if (text === "驛ｵ騾∵ｸ・") return "郵送済";
    if (text === "蜀埼∽ｺ亥ｮ・") return "再送予定";
    if (text === "菫晉蕗") return "保留";
    return text;
  }

  function isSentStatus(value) {
    return ["送付済", "郵送済", "騾∽ｻ俶ｸ・", "驛ｵ騾∵ｸ・"].includes(clean(value));
  }

  function sendActionButtons(collection, id) {
    return `<div class="actions">
      <button class="button small secondary" data-action="send-draft" data-collection="${esc(collection)}" data-id="${esc(id)}" type="button">メール文</button>
      <button class="button small secondary" data-action="mark-sent" data-method="メール" data-collection="${esc(collection)}" data-id="${esc(id)}" type="button">送付済</button>
      <button class="button small secondary" data-action="mark-sent" data-method="郵送" data-collection="${esc(collection)}" data-id="${esc(id)}" type="button">郵送済</button>
    </div>`;
  }

  function findBusinessDocument(collection, id) {
    return (state[collection] || []).find((record) => record.id === id) || null;
  }

  function showSendDraft(collection, id) {
    const record = findBusinessDocument(collection, id);
    const doc = sendDocumentFromRecord(collection, record);
    if (!doc) return;
    const draft = sendDraftFor(doc);
    dialogTitle.textContent = "送付メール文";
    dialogBody.innerHTML = `
      <div class="notice info" style="margin-bottom:12px;">HTML帳票を添付して送るための文面です。送信後は「送付済にする」で履歴に残せます。</div>
      <dl class="detail-list">
        <dt>帳票</dt><dd>${esc(doc.label)} ${esc(doc.number)}</dd>
        <dt>取引先</dt><dd>${esc(doc.customer || "")}</dd>
        <dt>メール</dt><dd>${doc.email ? esc(doc.email) : '<span class="badge warn">取引先マスタにメール未登録</span>'}</dd>
        <dt>郵送先</dt><dd>${doc.address ? esc(doc.address) : '<span class="badge warn">住所未登録</span>'}</dd>
      </dl>
      <label class="field" style="margin-top:12px;"><span>件名</span><input id="sendDraftSubject" type="text" value="${esc(draft.subject)}"></label>
      <label class="field" style="margin-top:12px;"><span>本文</span><textarea id="sendDraftBody" rows="10">${esc(draft.body)}</textarea></label>
      <div class="actions" style="margin-top:14px;">
        ${doc.email ? `<a class="button" id="openMailLink" href="${esc(mailtoFor(doc, draft.subject, draft.body))}">メールを開く</a>` : ""}
        <button class="button secondary" data-action="dialog-mark-sent" data-method="メール" type="button">送付済にする</button>
        <button class="button secondary" data-action="dialog-mark-sent" data-method="郵送" type="button">郵送済にする</button>
      </div>
    `;
    const subjectInput = document.getElementById("sendDraftSubject");
    const bodyInput = document.getElementById("sendDraftBody");
    const mailLink = document.getElementById("openMailLink");
    const refreshMailLink = () => {
      if (mailLink) mailLink.href = mailtoFor(doc, subjectInput.value, bodyInput.value);
    };
    subjectInput.addEventListener("input", refreshMailLink);
    bodyInput.addEventListener("input", refreshMailLink);
    dialogBody.querySelectorAll("[data-action='dialog-mark-sent']").forEach((button) => {
      button.addEventListener("click", () => {
        markDocumentSent(collection, id, button.dataset.method, "送付管理ダイアログから記録");
        dialog.close();
      });
    });
    dialog.showModal();
  }

  function sendDraftFor(doc) {
    const company = clean(state.settings.companyName) || "CDP北海道";
    const subject = `${doc.label} ${doc.number} のご送付`;
    const body = [
      `${partnerDisplay(doc.customer) || doc.customer || "ご担当者"} `,
      "",
      "いつもお世話になっております。",
      `${company}です。`,
      "",
      `${doc.label}（${doc.number}）をお送りします。`,
      `内容: ${doc.content || "-"}`,
      `金額: ${yen(doc.amount)}`,
      `発行日: ${formatDate(doc.date) || "-"}`,
      "",
      "添付のHTML帳票をご確認ください。",
      "よろしくお願いいたします。"
    ].join("\n");
    return { subject, body };
  }

  function mailtoFor(doc, subject, body) {
    return `mailto:${encodeURIComponent(doc.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function markDocumentSent(collection, id, method = "メール", note = "") {
    const record = findBusinessDocument(collection, id);
    const doc = sendDocumentFromRecord(collection, record);
    if (!record || !doc) return;
    const status = method === "郵送" ? "郵送済" : "送付済";
    record.sendStatus = status;
    record.sendDate = TODAY;
    record.updatedAt = new Date().toISOString();
    recordSendLog(doc, method, status, note);
    addAudit(`${doc.label}${status}`, record);
    persist("送付記録");
    render();
  }

  function recordSendLog(doc, method, status, note) {
    const recipient = method === "郵送" ? doc.address : doc.email;
    state.sendLogs = Array.isArray(state.sendLogs) ? state.sendLogs : [];
    state.sendLogs.push({
      id: uid("send"),
      at: new Date().toISOString(),
      sentDate: TODAY,
      collection: doc.collection,
      documentType: doc.type,
      documentLabel: doc.label,
      documentNo: doc.number,
      documentDate: doc.date,
      customer: doc.customer,
      content: doc.content,
      amount: doc.amount,
      method,
      status,
      recipient: recipient || "",
      note
    });
  }

  function sendLogCsvFields() {
    return [
      ["at", "記録日時"], ["sentDate", "送付日"], ["documentLabel", "帳票"], ["documentNo", "番号"], ["documentDate", "帳票日"],
      ["customer", "取引先"], ["content", "内容"], ["amount", "金額"], ["method", "方法"], ["status", "状態"], ["recipient", "宛先"], ["note", "メモ"]
    ];
  }

  function renderSimpleLedger(type) {
    const labels = {
      trips: ["出張台帳", "移動やガソリン請求を記録"],
      payroll: ["給与台帳", "給与と控除を記録"],
      hitech: ["ハイテク台帳", "送付資料や講師関連を記録"]
    };
    const items = fiscalItems(state[type], type === "payroll" ? "payMonth" : "date").sort(byDate(type === "payroll" ? "payMonth" : "date"));
    app.innerHTML = `
      <section class="panel">
        <div class="panel-head"><h2>${labels[type][0]}入力</h2><button class="button secondary small" id="exportLedgerCsv" type="button">CSV</button></div>
        <div class="panel-body">${ledgerForm(type)}</div>
      </section>
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>${labels[type][0]}一覧</h2><span class="badge">${items.length}件</span></div>
        <div class="panel-body">${renderLedgerTable(type, items)}</div>
      </section>
    `;
    document.getElementById("ledgerForm").addEventListener("submit", (event) => handleLedgerSubmit(event, type));
    document.getElementById("exportLedgerCsv").addEventListener("click", () => exportCsv(type, items, ledgerCsvFields(type)));
    bindTableActions();
  }

  function ledgerForm(type) {
    if (type === "trips") {
      return `
        <form id="ledgerForm" class="form-grid">
          ${field("date", "日付", "date", TODAY)}
          ${field("destination", "行先", "text", "")}
          ${field("purpose", "目的", "text", "")}
          ${field("transport", "移動手段", "text", "車")}
          ${field("mileage", "km", "number", "")}
          ${field("fuelClaim", "ガソリン請求", "number", "")}
          ${field("lodging", "宿泊費", "number", "")}
          ${field("total", "合計", "number", "")}
          <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note"></textarea></label>
          <div class="actions" style="grid-column:1 / -1;"><button class="button" type="submit">登録</button></div>
        </form>
      `;
    }
    if (type === "payroll") {
      return `
        <form id="ledgerForm" class="form-grid">
          ${field("payMonth", "対象月", "month", TODAY.slice(0, 7))}
          ${field("employee", "氏名", "text", "")}
          ${field("basePay", "基本給", "number", "")}
          ${field("allowance", "手当", "number", "")}
          ${field("deduction", "控除", "number", "")}
          ${field("netPay", "支給額", "number", "")}
          ${field("payDate", "支払日", "date", TODAY)}
          <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note"></textarea></label>
          <div class="actions" style="grid-column:1 / -1;"><button class="button" type="submit">登録</button></div>
        </form>
      `;
    }
    return `
      <form id="ledgerForm" class="form-grid">
        ${field("date", "日付", "date", TODAY)}
        ${field("sender", "送付元", "text", "")}
        ${field("instructor", "講師", "text", "")}
        ${field("course", "内容", "text", "")}
        ${field("amount", "金額", "number", "")}
        ${selectField("status", "状態", ledgerStatuses, "未処理")}
        <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note"></textarea></label>
        <div class="actions" style="grid-column:1 / -1;"><button class="button" type="submit">登録</button></div>
      </form>
    `;
  }

  function handleLedgerSubmit(event, type) {
    event.preventDefault();
    const data = formValues(event.currentTarget);
    const record = { id: uid(type), ...data, createdAt: new Date().toISOString() };
    ["mileage", "fuelClaim", "lodging", "total", "basePay", "allowance", "deduction", "netPay", "amount"].forEach((key) => {
      if (record[key] !== undefined) record[key] = num(record[key]);
    });
    if (type === "trips" && !record.total) record.total = num(record.fuelClaim) + num(record.lodging);
    if (type === "payroll" && !record.netPay) record.netPay = num(record.basePay) + num(record.allowance) - num(record.deduction);
    if (isLockedRecordMonth(type, record, "登録")) return;
    state[type].push(record);
    addAudit(`${ledgerTitle(type)}登録`, record);
    persist(`${ledgerTitle(type)}保存`);
    renderSimpleLedger(type);
  }

  function renderCards() {
    const cardExpenses = fiscalItems(state.expenses, "date").filter((item) => item.paymentMethod === "card").sort(byDate("date"));
    const grouped = groupByMonth(cardExpenses, "date");
    const missingT = cardExpenses.filter((item) => num(item.amount) >= 10000 && item.invoiceEligible && !isValidRegistration(item.registrationNumber));
    const missingProof = cardExpenses.filter((item) => !item.proof);

    app.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <h2>カード台帳</h2>
          <div class="actions">
            <label class="button secondary small file-button">カードCSV取込<input id="importCardCsvInput" type="file" accept=".csv,text/csv"></label>
            <button class="button secondary small" id="exportCardCsv" type="button">CSV</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="grid cols-3">
            ${summaryCard("カード経費", yen(sum(cardExpenses, "amount")), `${cardExpenses.length}件`)}
            ${summaryCard("T番号要確認", `${missingT.length}件`, "1万円以上・適格のもの")}
            ${summaryCard("証憑未添付", `${missingProof.length}件`, "明細だけでなく領収書も確認")}
          </div>
        </div>
      </section>
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>月別カード明細</h2><span class="badge">${Object.keys(grouped).length}か月</span></div>
        <div class="panel-body">
          ${Object.keys(grouped).length ? Object.entries(grouped).map(([month, records]) => renderReceiptMonth(month, records)).join("") : `<div class="empty">カード経費がありません。</div>`}
        </div>
      </section>
    `;

    document.getElementById("importCardCsvInput").addEventListener("change", importCardCsv);
    document.getElementById("exportCardCsv").addEventListener("click", () => exportCsv("card-ledger", cardExpenses, [
      ["date", "日付"], ["vendor", "取引先"], ["category", "経費科目"], ["department", "部門"], ["itemName", "品名"],
      ["amount", "金額"], ["taxRate", "税区分"], ["registrationNumber", "T番号"], ["invoiceEligible", "インボイス適格"], ["splitGroupId", "税率分割ID"], ["note", "摘要"]
    ]));
    bindMonthlyHandoffActions();
    bindTableActions();
  }

  function renderDataLink() {
    const batches = fiscalItems(state.importBatches || [], "importDate")
      .sort((a, b) => String(b.importedAt || "").localeCompare(String(a.importedAt || "")));
    const bankBatches = batches.filter((item) => item.sourceType === "bank");
    const cardBatches = batches.filter((item) => item.sourceType === "card");
    const createdCount = sum(batches, "createdCount");
    const latest = batches[0];

    app.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <h2>CSV取込</h2>
          <div class="actions">
            <label class="button secondary small file-button">通帳CSV取込<input id="dataLinkSalesImport" type="file" accept=".csv,text/csv"></label>
            <label class="button secondary small file-button">カードCSV取込<input id="dataLinkCardImport" type="file" accept=".csv,text/csv"></label>
          </div>
        </div>
        <div class="panel-body">
          <div class="grid cols-4">
            ${summaryCard("取込履歴", `${batches.length}件`, latest ? `最新 ${formatDateTime(latest.importedAt)}` : "まだ取込はありません")}
            ${summaryCard("通帳CSV", `${sum(bankBatches, "createdCount")}件`, `${bankBatches.length}回 / 売上一覧へ登録`)}
            ${summaryCard("カードCSV", `${sum(cardBatches, "createdCount")}件`, `${cardBatches.length}回 / カード経費へ登録`)}
            ${summaryCard("取込金額", yen(sum(batches, "amountTotal")), `登録 ${createdCount}件`)}
          </div>
          <div class="notice info" style="margin-top:12px;">
            通帳CSVは売上一覧へ、カードCSVはカード支払の経費として登録します。取込履歴は税理士提出パックにも含めます。
          </div>
          <div class="actions" style="margin-top:12px;">
            <button class="button secondary small" data-view-jump="sales" type="button">売上一覧を確認</button>
            <button class="button secondary small" data-view-jump="cards" type="button">カード台帳を確認</button>
            <button class="button secondary small" id="exportImportBatchCsv" type="button">取込履歴CSV</button>
          </div>
        </div>
      </section>
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>取込履歴</h2><span class="badge">${batches.length}件</span></div>
        <div class="panel-body">
          ${renderImportBatchTable(batches)}
        </div>
      </section>
    `;

    document.getElementById("dataLinkSalesImport").addEventListener("change", importSalesCsv);
    document.getElementById("dataLinkCardImport").addEventListener("change", importCardCsv);
    document.getElementById("exportImportBatchCsv").addEventListener("click", () => exportCsv("import-history", batches, importBatchCsvFields()));
    app.querySelectorAll("[data-view-jump]").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.viewJump));
    });
    bindTableActions();
  }

  function renderClosing() {
    const months = fiscalMonths(selectedFiscalYear);
    const closings = state.closings.filter((item) => item.month && getFiscalYear(`${item.month}-01`) === selectedFiscalYear);
    const alerts = getAlerts();
    const health = getDataHealth();

    app.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <h2>締め登録</h2>
          <div class="actions">
            <button class="button secondary small" id="exportPackage" type="button">税理士提出パック</button>
            <button class="button secondary small" id="exportSubmissionSummary" type="button">提出サマリー</button>
            <button class="button secondary small" id="exportClosingCsv" type="button">締めCSV</button>
          </div>
        </div>
        <div class="panel-body">
          <form id="closingForm" class="form-grid">
            ${selectField("month", "対象月", months, months[0])}
            ${selectField("closeType", "締め", ["15日前後", "月末"], "15日前後")}
            ${selectField("status", "状態", ledgerStatuses, "確認中")}
            <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note" placeholder="税理士へ渡した内容、未確認、担当部署に確認が必要な点"></textarea></label>
            <div class="actions" style="grid-column:1 / -1;"><button class="button" type="submit">締め登録</button></div>
          </form>
        </div>
      </section>

      <div class="grid cols-3" style="margin-top:14px;">
        <section class="panel">
          <div class="panel-head"><h2>締め状況</h2><span class="badge">${closings.length}件</span></div>
          <div class="panel-body">${renderClosingMatrix(months, closings)}</div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>月締めロック</h2><span class="badge">${lockedMonths().length}か月</span></div>
          <div class="panel-body">${renderLockedMonthList()}</div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>提出前チェック</h2><span class="badge ${alerts.length ? "warn" : "good"}">${health.score}点</span></div>
          <div class="panel-body">${alerts.length ? `<div class="alert-list">${alerts.map(renderAlert).join("")}</div>` : `<div class="notice info">提出前の未確認はありません。</div>`}</div>
        </section>
      </div>

      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>月次提出履歴</h2><span class="badge">${fiscalHandoffs().length}件</span></div>
        <div class="panel-body">${renderMonthlyHandoffHistory(months)}</div>
      </section>
    `;

    document.getElementById("closingForm").addEventListener("submit", handleClosingSubmit);
    document.getElementById("exportPackage").addEventListener("click", exportAccountantPackage);
    document.getElementById("exportSubmissionSummary").addEventListener("click", exportSubmissionSummary);
    document.getElementById("exportClosingCsv").addEventListener("click", () => exportCsv("closings", closings, [
      ["month", "対象月"], ["closeType", "締め"], ["status", "状態"], ["note", "メモ"], ["createdAt", "登録日時"]
    ]));
    bindMonthlyHandoffActions();
  }

  function handleClosingSubmit(event) {
    event.preventDefault();
    const data = formValues(event.currentTarget);
    const record = { id: uid("closing"), ...data, createdAt: new Date().toISOString() };
    state.closings.push(record);
    addAudit("締め登録", record);
    persist("締め保存");
    renderClosing();
  }

  function renderBooks() {
    const entries = fiscalBookEntries();
    app.innerHTML = `
      <div class="tabs">
        ${bookTab("general", "総勘定元帳")}
        ${bookTab("subsidiary", "補助元帳")}
        ${bookTab("trial", "残高試算表")}
        ${bookTab("transition", "推移表")}
        ${bookTab("department", "部門別集計表")}
        ${bookTab("compare", "前期比較")}
      </div>
      ${["general", "subsidiary"].includes(bookState.tab) ? renderJournalEntryPanel() : ""}
      ${bookState.tab === "general" ? renderGeneralLedger(entries) : ""}
      ${bookState.tab === "subsidiary" ? renderSubsidiaryLedger(entries) : ""}
      ${bookState.tab === "trial" ? renderTrialBalance(entries) : ""}
      ${bookState.tab === "transition" ? renderTransitionReport(entries) : ""}
      ${bookState.tab === "department" ? renderDepartmentReport(entries) : ""}
      ${bookState.tab === "compare" ? renderComparisonReport(entries) : ""}
    `;
    bindBookActions();
  }

  function renderJournalEntryPanel() {
    return `
      <section class="panel" style="margin-bottom:14px;">
        <div class="panel-head"><h2>手入力仕訳</h2><span class="badge">税理士確認用</span></div>
        <div class="panel-body">
          <form id="journalForm" class="form-grid">
            ${field("date", "取引日", "date", TODAY)}
            ${field("no", "取引No", "text", uid("J"))}
            ${selectField("department", "部門", departments(), departments()[0])}
            ${selectField("debitAccount", "借方勘定科目", bookAccountNames(), "現金")}
            ${field("debitSub", "借方補助科目", "text", "")}
            ${selectField("debitTax", "借方税区分", taxRates, "不明")}
            ${field("debitAmount", "借方金額", "number", "")}
            ${selectField("creditAccount", "貸方勘定科目", bookAccountNames(), "売上高")}
            ${field("creditSub", "貸方補助科目", "text", "")}
            ${selectField("creditTax", "貸方税区分", taxRates, "不明")}
            ${field("creditAmount", "貸方金額", "number", "")}
            <label class="field" style="grid-column:1 / -1;"><span>摘要</span><textarea name="summary"></textarea></label>
            <div class="actions" style="grid-column:1 / -1;"><button class="button" type="submit">仕訳登録</button></div>
          </form>
        </div>
      </section>
    `;
  }

  function renderGeneralLedger(entries) {
    const selected = bookState.account;
    const rows = ledgerRows(entries, selected);
    return `
      <section class="panel">
        <div class="panel-head"><h2>総勘定元帳</h2><button class="button secondary small" data-book-export="general" type="button">CSV</button></div>
        <div class="panel-body">
          ${renderBookFilterPanel("general")}
          ${renderLedgerTableForAccount(selected, rows)}
        </div>
      </section>
    `;
  }

  function renderSubsidiaryLedger(entries) {
    const rows = ledgerRows(entries, bookState.account);
    const subAccounts = ["全て", ...new Set(rows.map((row) => row.subAccount).filter(Boolean))];
    const filtered = bookState.subAccount === "全て" ? rows : rows.filter((row) => row.subAccount === bookState.subAccount);
    return `
      <section class="panel">
        <div class="panel-head"><h2>補助元帳</h2><button class="button secondary small" data-book-export="subsidiary" type="button">CSV</button></div>
        <div class="panel-body">
          ${renderBookFilterPanel("subsidiary", subAccounts)}
          ${renderLedgerTableForAccount(bookState.account, filtered, true)}
        </div>
      </section>
    `;
  }

  function renderTrialBalance(entries) {
    const rows = trialRows(entries, bookState.report);
    return `
      <section class="panel">
        <div class="panel-head"><h2>残高試算表</h2><button class="button secondary small" data-book-export="trial" type="button">CSV</button></div>
        <div class="panel-body">
          ${renderReportControls()}
          ${renderTrialTable(rows)}
        </div>
      </section>
    `;
  }

  function renderTransitionReport(entries) {
    const periods = reportPeriods(selectedFiscalYear, bookState.period);
    const rows = transitionRows(entries, bookState.report, periods);
    return `
      <section class="panel">
        <div class="panel-head"><h2>推移表</h2><button class="button secondary small" data-book-export="transition" type="button">CSV</button></div>
        <div class="panel-body">
          ${renderTransitionControls()}
          ${renderTransitionTable(rows, periods)}
        </div>
      </section>
    `;
  }

  function renderDepartmentReport(entries) {
    const depts = departments();
    const rows = departmentRows(entries, bookState.report, depts);
    return `
      <section class="panel">
        <div class="panel-head"><h2>部門別集計表</h2><button class="button secondary small" data-book-export="department" type="button">CSV</button></div>
        <div class="panel-body">
          ${renderDepartmentControls()}
          ${renderDepartmentTable(rows, depts)}
        </div>
      </section>
    `;
  }

  function renderComparisonReport(entries) {
    const rows = comparisonRows(entries, bookState.report);
    return `
      <section class="panel">
        <div class="panel-head"><h2>前期比較</h2><button class="button secondary small" data-book-export="compare" type="button">CSV</button></div>
        <div class="panel-body">
          ${renderComparisonControls()}
          ${renderComparisonTable(rows)}
        </div>
      </section>
    `;
  }

  function renderBookFilterPanel(mode, subAccounts) {
    return `
      <div class="book-filter">
        ${selectField("bookAccount", "勘定科目", bookAccountNames(), bookState.account)}
        ${mode === "subsidiary" ? selectField("bookSubAccount", "補助科目", subAccounts || ["全て"], bookState.subAccount) : ""}
        <span class="book-range">${selectedFiscalYear}年度 ${formatDate(getFiscalRange(selectedFiscalYear).start)} - ${formatDate(getFiscalRange(selectedFiscalYear).end)}</span>
      </div>
    `;
  }

  function renderReportControls() {
    return `
      <div class="report-toolbar">
        ${reportTypeControls()}
        <label class="check-field"><input id="bookShowZero" type="checkbox" ${bookState.showZero ? "checked" : ""}> 残高0円を表示</label>
      </div>
    `;
  }

  function renderTransitionControls() {
    return `
      <div class="report-toolbar">
        ${reportTypeControls()}
        ${selectField("bookPeriod", "期間", [["monthly", "月次"], ["quarterly", "四半期"], ["half", "半期"], ["yearly", "年次"]], bookState.period)}
      </div>
    `;
  }

  function renderDepartmentControls() {
    return `<div class="report-toolbar">${reportTypeControls()}</div>`;
  }

  function renderComparisonControls() {
    return `<div class="report-toolbar">${reportTypeControls()}</div>`;
  }

  function reportTypeControls() {
    return `
      <div class="tabs" style="margin:0;">
        <button class="tab ${bookState.report === "bs" ? "is-active" : ""}" data-report-type="bs" type="button">貸借対照表</button>
        <button class="tab ${bookState.report === "pl" ? "is-active" : ""}" data-report-type="pl" type="button">損益計算書</button>
      </div>
    `;
  }

  function renderLedgerTableForAccount(account, rows, showSub) {
    if (!rows.length) return `<div class="empty">${esc(account)} の仕訳はありません。</div>`;
    return `
      <div class="table-wrap">
        <table class="book-table compact-table">
          <thead><tr><th>取引No</th><th>取引日</th>${showSub ? "<th>補助科目</th>" : ""}<th>相手勘定</th><th>摘要</th><th>税区分</th><th class="num">借方</th><th class="num">貸方</th><th class="num">残高</th></tr></thead>
          <tbody>
            ${rows.map((row) => `<tr>
              <td>${esc(row.no)}</td><td>${esc(formatDate(row.date))}</td>${showSub ? `<td>${esc(row.subAccount || "")}</td>` : ""}
              <td>${esc(row.counterAccount || "")}</td><td>${esc(row.summary || "")}</td><td>${esc(row.tax || "不明")}</td>
              <td class="num">${row.debit ? yen(row.debit) : ""}</td><td class="num">${row.credit ? yen(row.credit) : ""}</td><td class="num">${yen(row.balance)}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderTrialTable(rows) {
    const visibleRows = bookState.showZero ? rows : rows.filter((row) => row.debit || row.credit || row.balance);
    if (!visibleRows.length) return `<div class="empty">集計対象の仕訳はありません。</div>`;
    return `
      <div class="table-wrap">
        <table class="book-table">
          <thead><tr><th>区分</th><th>勘定科目</th><th class="num">借方金額</th><th class="num">貸方金額</th><th class="num">残高</th><th class="num">構成比</th></tr></thead>
          <tbody>${visibleRows.map((row) => `<tr>
            <td>${esc(row.group)}</td><td>${esc(row.label)}</td><td class="num">${yen(row.debit)}</td><td class="num">${yen(row.credit)}</td><td class="num">${yen(row.balance)}</td><td class="num">${row.percent.toFixed(1)}%</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function renderTransitionTable(rows, periods) {
    if (!rows.length) return `<div class="empty">集計対象の仕訳はありません。</div>`;
    return `
      <div class="table-wrap">
        <table class="transition-table">
          <thead><tr><th>区分</th>${periods.map((period) => `<th class="num">${esc(period.label)}</th>`).join("")}<th class="num">合計</th></tr></thead>
          <tbody>${rows.map((row) => `<tr>
            <td>${esc(row.label)}</td>${periods.map((period) => `<td class="num">${yen(row.values[period.key] || 0)}</td>`).join("")}<td class="num">${yen(row.total)}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function renderDepartmentTable(rows, depts) {
    if (!rows.length) return `<div class="empty">集計対象の仕訳はありません。</div>`;
    return `
      <div class="table-wrap">
        <table class="transition-table">
          <thead><tr><th>区分</th>${depts.map((dept) => `<th class="num">${esc(dept)}</th>`).join("")}<th class="num">合計</th></tr></thead>
          <tbody>${rows.map((row) => `<tr>
            <td>${esc(row.label)}</td>${depts.map((dept) => `<td class="num">${yen(row.values[dept] || 0)}</td>`).join("")}<td class="num">${yen(row.total)}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function renderComparisonTable(rows) {
    if (!rows.length) return `<div class="empty">比較対象の仕訳はありません。</div>`;
    return `
      <div class="table-wrap">
        <table class="book-table">
          <thead><tr><th>区分</th><th class="num">前期</th><th class="num">構成比</th><th class="num">当期</th><th class="num">構成比</th><th class="num">増減額</th><th class="num">増減率</th></tr></thead>
          <tbody>${rows.map((row) => `<tr>
            <td>${esc(row.label)}</td><td class="num">${yen(row.previous)}</td><td class="num">${row.previousPercent.toFixed(1)}%</td><td class="num">${yen(row.current)}</td><td class="num">${row.currentPercent.toFixed(1)}%</td><td class="num">${yen(row.diff)}</td><td class="num">${row.rate}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function bindBookActions() {
    app.querySelectorAll("[data-book-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        bookState.tab = button.dataset.bookTab;
        renderBooks();
      });
    });
    app.querySelectorAll("[data-report-type]").forEach((button) => {
      button.addEventListener("click", () => {
        bookState.report = button.dataset.reportType;
        renderBooks();
      });
    });
    const account = app.querySelector("[name='bookAccount']");
    if (account) account.addEventListener("change", () => {
      bookState.account = account.value;
      bookState.subAccount = "全て";
      renderBooks();
    });
    const sub = app.querySelector("[name='bookSubAccount']");
    if (sub) sub.addEventListener("change", () => {
      bookState.subAccount = sub.value;
      renderBooks();
    });
    const period = app.querySelector("[name='bookPeriod']");
    if (period) period.addEventListener("change", () => {
      bookState.period = period.value;
      renderBooks();
    });
    const showZero = app.querySelector("#bookShowZero");
    if (showZero) showZero.addEventListener("change", () => {
      bookState.showZero = showZero.checked;
      renderBooks();
    });
    const journal = app.querySelector("#journalForm");
    if (journal) journal.addEventListener("submit", handleJournalSubmit);
    app.querySelectorAll("[data-book-export]").forEach((button) => {
      button.addEventListener("click", () => exportBookCsv(button.dataset.bookExport));
    });
  }

  function handleJournalSubmit(event) {
    event.preventDefault();
    const data = formValues(event.currentTarget);
    const amount = num(data.debitAmount) || num(data.creditAmount);
    const record = {
      id: uid("journal"),
      date: data.date || TODAY,
      no: data.no || uid("J"),
      department: data.department || departments()[0],
      debitAccount: data.debitAccount,
      debitSub: data.debitSub,
      debitTax: data.debitTax,
      debitAmount: amount,
      creditAccount: data.creditAccount,
      creditSub: data.creditSub,
      creditTax: data.creditTax,
      creditAmount: amount,
      summary: data.summary,
      source: "manual",
      createdAt: new Date().toISOString()
    };
    if (isLockedRecordMonth("journals", record, "登録")) return;
    state.journals.push(record);
    addAudit("仕訳登録", record);
    persist("仕訳保存");
    renderBooks();
  }

  function renderSettings() {
    const health = getDataHealth();
    const storage = storageInfo();
    const auditRows = [...state.audit].slice(-20).reverse();
    const trashRows = [...(state.trash || [])].slice(-30).reverse();

    app.innerHTML = `
      <section class="panel">
        <div class="panel-head"><h2>基本設定</h2><span class="badge">${health.score}点</span></div>
        <div class="panel-body">
          <form id="settingsForm" class="form-grid">
            ${field("companyName", "会社名", "text", state.settings.companyName || "")}
            ${field("bankAccount", "売上通帳", "text", state.settings.bankAccount || "道銀")}
            ${selectField("fiscalStartMonth", "決算開始月", Array.from({ length: 12 }, (_, index) => [String(index + 1), `${index + 1}月`]), String(state.settings.fiscalStartMonth || DEFAULT_FISCAL_START_MONTH))}
            ${field("backupReminderDays", "バックアップ警告日数", "number", state.settings.backupReminderDays || 7)}
            ${selectField("defaultDocumentTemplate", "既定帳票テンプレート", documentTemplates(), defaultDocumentTemplate())}
            ${field("documentAccentColor", "帳票カラー", "color", documentAccentColor())}
            ${field("documentLogoText", "ロゴ表記", "text", state.settings.documentLogoText || "CDP")}
            ${field("documentSealText", "印影表記", "text", state.settings.documentSealText || "CDP")}
            <label class="field" style="grid-column:1 / -1;"><span>帳票フッター文</span><textarea name="documentFooterNote">${esc(state.settings.documentFooterNote || "")}</textarea></label>
            <label class="field" style="grid-column:1 / -1;"><span>税理士メモ</span><textarea name="accountantMemo">${esc(state.settings.accountantMemo || "")}</textarea></label>
            <label class="field" style="grid-column:1 / -1;"><span>経費科目</span><textarea name="categories">${esc(categories().join("\n"))}</textarea></label>
            <label class="field" style="grid-column:1 / -1;"><span>部門</span><textarea name="departments">${esc(departments().join("\n"))}</textarea></label>
            <div class="actions" style="grid-column:1 / -1;">
              <button class="button" type="submit">保存</button>
              <button class="button danger" id="clearDataButton" type="button">全データ削除</button>
            </div>
          </form>
          ${renderDocumentDesignPreview()}
        </div>
      </section>

      <div class="grid cols-2" style="margin-top:14px;">
        <section class="panel">
          <div class="panel-head"><h2>保存とバックアップ</h2><span class="badge ${health.backupOk ? "good" : "warn"}">${health.backupOk ? "OK" : "要バックアップ"}</span></div>
          <div class="panel-body">
            <div class="status-list">
              <span><strong>保存先</strong> このブラウザの localStorage</span>
              <span><strong>推定容量</strong> ${storage.kb.toFixed(1)} KB / 目安 5 MB</span>
              <span><strong>最終バックアップ</strong> ${state.settings.lastBackupAt ? formatDateTime(state.settings.lastBackupAt) : "未実施"}</span>
              <span><strong>注意</strong> PC変更、ブラウザ削除、キャッシュ消去でデータが消える可能性があります。</span>
            </div>
            <div class="actions" style="margin-top:12px;">
              <button class="button secondary small" id="settingsExportButton" type="button">全体バックアップ</button>
              <button class="button secondary small" id="settingsPackageButton" type="button">税理士提出パック</button>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>監査ログ</h2><span class="badge">${state.audit.length}件</span></div>
          <div class="panel-body">${renderAuditTable(auditRows)}</div>
        </section>
      </div>

      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>削除済みデータ</h2><span class="badge">${(state.trash || []).length}件</span></div>
        <div class="panel-body">${renderTrashTable(trashRows)}</div>
      </section>
    `;

    document.getElementById("settingsForm").addEventListener("submit", handleSettingsSubmit);
    document.getElementById("settingsExportButton").addEventListener("click", exportAllData);
    document.getElementById("settingsPackageButton").addEventListener("click", exportAccountantPackage);
    document.getElementById("clearDataButton").addEventListener("click", clearAllData);
    bindTrashActions();
  }

  function renderHistory() {
    const auditRows = [...(state.audit || [])].reverse();
    const trashRows = [...(state.trash || [])].reverse();
    const recentRows = auditRows.filter((row) => row.at && daysBetween(row.at, new Date().toISOString()) <= 1);
    const outputRows = auditRows.filter((row) => historyIsOutputAction(row.action));

    app.innerHTML = `
      <div class="grid cols-4">
        ${summaryCard("操作履歴", `${auditRows.length}件`, "登録、編集、出力、変換の記録")}
        ${summaryCard("直近24時間", `${recentRows.length}件`, "今日の作業確認")}
        ${summaryCard("削除済み", `${trashRows.length}件`, "復元または完全削除の対象")}
        ${summaryCard("出力履歴", `${outputRows.length}件`, "帳票発行、提出、バックアップ")}
      </div>

      <section class="panel" style="margin-top:14px;">
        <div class="panel-head">
          <h2>履歴エクスポート</h2>
          <div class="actions">
            <button class="button secondary small" id="exportAuditCsv" type="button">操作履歴CSV</button>
            <button class="button secondary small" id="exportTrashCsv" type="button">削除済みCSV</button>
            <button class="button secondary small" id="historyExportButton" type="button">全体バックアップ</button>
            <button class="button secondary small" id="historyPackageButton" type="button">税理士提出パック</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="notice info">Money Forwardの履歴画面の代わりに、誰が見ても「いつ何をしたか」「何を削除したか」「いつ提出用に出力したか」が追える画面です。</div>
        </div>
      </section>

      <div class="grid cols-2" style="margin-top:14px;">
        <section class="panel">
          <div class="panel-head"><h2>出力・提出履歴</h2><span class="badge">${outputRows.length}件</span></div>
          <div class="panel-body">${renderAuditTable(outputRows.slice(0, 80))}</div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>直近の操作</h2><span class="badge">${recentRows.length}件</span></div>
          <div class="panel-body">${renderAuditTable(auditRows.slice(0, 80))}</div>
        </section>
      </div>

      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>削除済みデータ</h2><span class="badge">${trashRows.length}件</span></div>
        <div class="panel-body">${renderTrashTable(trashRows.slice(0, 120))}</div>
      </section>
    `;

    document.getElementById("exportAuditCsv").addEventListener("click", () => exportCsv("audit-log", auditRows, auditCsvFields()));
    document.getElementById("exportTrashCsv").addEventListener("click", () => exportCsv("trash-log", trashRows.map(trashCsvRow), trashCsvFields()));
    document.getElementById("historyExportButton").addEventListener("click", exportAllData);
    document.getElementById("historyPackageButton").addEventListener("click", exportAccountantPackage);
    bindTrashActions();
  }

  function historyIsOutputAction(action) {
    return /出力|発行|バックアップ|提出パック|提出サマリー|月次提出/.test(String(action || ""));
  }

  function renderDocumentDesignPreview() {
    const brand = documentBrand(defaultDocumentTemplate());
    return `
      <div class="document-design-preview" style="--doc-accent:${esc(brand.accent)};">
        <div class="preview-logo">${esc(brand.logoText)}</div>
        <div>
          <strong>${esc(state.settings.companyName || "CDP北海道")}</strong>
          <span>${esc(brand.template)} / ${esc(brand.footerNote)}</span>
        </div>
        <div class="preview-seal">${esc(brand.sealText)}</div>
      </div>
    `;
  }

  function handleSettingsSubmit(event) {
    event.preventDefault();
    const data = formValues(event.currentTarget);
    state.settings.companyName = data.companyName || "CDP北海道";
    state.settings.bankAccount = data.bankAccount || "道銀";
    state.settings.fiscalStartMonth = Number(data.fiscalStartMonth) || DEFAULT_FISCAL_START_MONTH;
    state.settings.backupReminderDays = Math.max(1, Number(data.backupReminderDays) || 7);
    state.settings.defaultDocumentTemplate = documentTemplates().includes(data.defaultDocumentTemplate) ? data.defaultDocumentTemplate : "標準";
    state.settings.documentAccentColor = isHexColor(data.documentAccentColor) ? data.documentAccentColor : "#2f5f9f";
    state.settings.documentLogoText = clean(data.documentLogoText) || "CDP";
    state.settings.documentSealText = clean(data.documentSealText) || "CDP";
    state.settings.documentFooterNote = clean(data.documentFooterNote) || defaultState().settings.documentFooterNote;
    state.settings.accountantMemo = data.accountantMemo;
    state.settings.categories = lines(data.categories);
    state.settings.departments = lines(data.departments);
    if (!state.settings.categories.length) state.settings.categories = expenseCategories;
    if (!state.settings.departments.length) state.settings.departments = defaultDepartments;
    selectedFiscalYear = getFiscalYear(TODAY);
    seedFiscalOptions();
    addAudit("設定保存", { companyName: state.settings.companyName });
    persist("設定保存");
    renderSettings();
  }

  function clearAllData() {
    if (!confirm("全データを削除します。先に全体バックアップを保存したか確認してください。")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    addAudit("全データ削除", {});
    persist("初期化");
    render();
  }

  function renderTrashTable(rows) {
    if (!rows.length) return `<div class="empty">削除済みデータはありません。</div>`;
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>削除日時</th><th>種類</th><th>日付/月</th><th>内容</th><th class="num">金額</th><th>操作</th></tr></thead>
          <tbody>${rows.map((item) => {
            const record = item.record || {};
            const date = recordDate(item.collection, record);
            return `<tr>
              <td>${esc(formatDateTime(item.deletedAt))}</td>
              <td>${esc(collectionLabel(item.collection))}</td>
              <td>${esc(formatDate(date))}</td>
              <td>${esc(recordSummary(item.collection, record))}</td>
              <td class="num">${record.amount || record.total || record.netPay ? yen(record.amount || record.total || record.netPay) : ""}</td>
              <td><div class="actions"><button class="button small secondary" data-trash-action="restore" data-trash-id="${esc(item.id)}" type="button">復元</button><button class="button small danger" data-trash-action="purge" data-trash-id="${esc(item.id)}" type="button">完全削除</button></div></td>
            </tr>`;
          }).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function bindTrashActions() {
    app.querySelectorAll("[data-trash-action='restore']").forEach((button) => {
      button.addEventListener("click", () => restoreTrashItem(button.dataset.trashId));
    });
    app.querySelectorAll("[data-trash-action='purge']").forEach((button) => {
      button.addEventListener("click", () => purgeTrashItem(button.dataset.trashId));
    });
  }

  function restoreTrashItem(trashId) {
    const trashItem = (state.trash || []).find((item) => item.id === trashId);
    if (!trashItem) return;
    const record = trashItem.record;
    if (hasLockedRecordMonth(trashItem.collection, record)) {
      alert("この月は月末締めが完了しているため、復元できません。締め状態を確認してください。");
      return;
    }
    if (!Array.isArray(state[trashItem.collection])) state[trashItem.collection] = [];
    state[trashItem.collection].push(record);
    if (trashItem.collection === "paymentRequests") syncExpensePaymentRequestStatus(record);
    if (trashItem.collection === "paymentRequests") syncReceivedDocPaymentRequestStatus(record);
    state.trash = state.trash.filter((item) => item.id !== trashId);
    addAudit(`${collectionLabel(trashItem.collection)}復元`, record);
    persist("復元");
    if (activeView === "history") renderHistory();
    else renderSettings();
  }

  function purgeTrashItem(trashId) {
    if (!confirm("削除済みデータを完全に削除します。バックアップ後に実行してください。")) return;
    const trashItem = (state.trash || []).find((item) => item.id === trashId);
    state.trash = (state.trash || []).filter((item) => item.id !== trashId);
    addAudit("削除済みデータ完全削除", trashItem || { id: trashId });
    persist("完全削除");
    if (activeView === "history") renderHistory();
    else renderSettings();
  }

  function isMonthLocked(month) {
    if (!month) return false;
    return state.closings.some((item) => item.month === month && item.closeType === "月末" && item.status === "完了");
  }

  function lockedMonthMessage(month, action) {
    const label = month ? `${month.slice(0, 4)}年${Number(month.slice(5, 7))}月` : "対象月";
    return `${label}は月末締めが完了しているため、${action}できません。締め状態を確認してください。`;
  }

  function isLockedRecordMonth(collection, record, action = "登録", options = {}) {
    const month = lockedRecordMonth(collection, record);
    if (!month || !isMonthLocked(month)) return false;
    if (!options.silent) alert(lockedMonthMessage(month, action));
    if (!options.noAudit) {
      addAudit(`ロック月${action}ブロック`, { id: `${collection}:${month}` });
      persist("ロック月ブロック");
    }
    return true;
  }

  function isLockedDate(date, action = "登録", options = {}) {
    const month = String(date || "").slice(0, 7);
    if (!month || !isMonthLocked(month)) return false;
    if (!options.silent) alert(lockedMonthMessage(month, action));
    if (!options.noAudit) {
      addAudit(`ロック月${action}ブロック`, { id: month });
      persist("ロック月ブロック");
    }
    return true;
  }

  function restoreRecordSnapshot(target, snapshot) {
    Object.keys(target).forEach((key) => delete target[key]);
    Object.assign(target, snapshot);
  }

  function lockedMonths() {
    return fiscalMonths(selectedFiscalYear).filter((month) => isMonthLocked(month));
  }

  function lockedRecordMonth(collection, record) {
    return recordMonths(collection, record).find((month) => isMonthLocked(month)) || "";
  }

  function hasLockedRecordMonth(collection, record) {
    return Boolean(lockedRecordMonth(collection, record));
  }

  function recordMonths(collection, record) {
    return [...new Set(recordDates(collection, record)
      .map((date) => String(date || "").slice(0, 7))
      .filter(Boolean))];
  }

  function recordMonth(collection, record) {
    return recordMonths(collection, record)[0] || "";
  }

  function recordDate(collection, record) {
    return recordDates(collection, record)[0] || "";
  }

  function recordDates(collection, record) {
    if (!record) return [];
    if (collection === "invoices") return [record.serviceDate, record.issueDate, record.expectedPaymentDate, record.paymentDate].filter(Boolean);
    if (collection === "receiptDocs") return [record.issueDate, record.paymentDate].filter(Boolean);
    if (collection === "deliveries") return [record.date].filter(Boolean);
    if (collection === "receivedDocs") return [record.receivedDate, record.dueDate].filter(Boolean);
    if (collection === "paymentRequests") return [record.requestDate, record.dueDate, record.paidAt].filter(Boolean);
    if (collection === "importBatches") return [record.importedAt].filter(Boolean);
    if (collection === "partners" || collection === "items" || collection === "recurringDocs") return [];
    if (collection === "payroll") return [record.payDate, record.payMonth ? `${record.payMonth}-01` : ""].filter(Boolean);
    if (collection === "closings") return [record.month ? `${record.month}-01` : ""].filter(Boolean);
    return [record.date, record.issueDate, record.createdAt].filter(Boolean);
  }

  function recordSummary(collection, record) {
    if (!record) return "";
    if (collection === "expenses") return [record.vendor, record.itemName, record.category].filter(Boolean).join(" / ");
    if (collection === "receivedDocs") return [record.documentType, record.vendor, record.title, record.status].filter(Boolean).join(" / ");
    if (collection === "paymentRequests") return [record.requestNo, record.vendor, record.content, record.status].filter(Boolean).join(" / ");
    if (collection === "importBatches") return [record.fileName, importTargetLabel(record.target), record.createdCount ? `${record.createdCount}件` : "", record.status].filter(Boolean).join(" / ");
    if (collection === "sales") return [record.customer, record.content, record.invoiceNo].filter(Boolean).join(" / ");
    if (collection === "invoices") return [record.invoiceNo, record.customer, record.content].filter(Boolean).join(" / ");
    if (collection === "estimates") return [record.estimateNo, record.customer, record.content].filter(Boolean).join(" / ");
    if (collection === "deliveries") return [record.deliveryNo, record.customer, record.subject || record.itemName].filter(Boolean).join(" / ");
    if (collection === "receiptDocs") return [record.receiptNo, record.customer, record.invoiceNo].filter(Boolean).join(" / ");
    if (collection === "partners") return [record.name, record.contact].filter(Boolean).join(" / ");
    if (collection === "items") return [record.itemCode, record.itemName].filter(Boolean).join(" / ");
    if (collection === "recurringDocs") return [record.title, documentTypeLabel(record.documentType), record.customer].filter(Boolean).join(" / ");
    if (collection === "sendLogs") return [record.documentLabel, record.documentNo, record.customer, record.method].filter(Boolean).join(" / ");
    if (collection === "trips") return [record.destination, record.purpose].filter(Boolean).join(" / ");
    if (collection === "payroll") return [record.payMonth, record.employee].filter(Boolean).join(" / ");
    if (collection === "hitech") return [record.sender, record.instructor, record.course].filter(Boolean).join(" / ");
    return record.note || record.id || "";
  }

  function collectionLabel(collection) {
    const labels = {
      expenses: "経費",
      receivedDocs: "受領書類",
      paymentRequests: "申請・承認",
      importBatches: "データ連携",
      sales: "売上",
      invoices: "請求書",
      estimates: "見積",
      deliveries: "納品書",
      receiptDocs: "領収書",
      partners: "取引先",
      items: "品目",
      recurringDocs: "毎月自動",
      sendLogs: "送付履歴",
      trips: "出張台帳",
      payroll: "給与台帳",
      hitech: "ハイテク台帳",
      closings: "締め",
      journals: "仕訳"
    };
    return labels[collection] || collection;
  }

  function renderExpenseFilters(allExpenses) {
    const filter = tableFilters.expenses;
    return `
      <div class="filter-bar">
        ${field("expenseQuery", "検索", "search", filter.query, "取引先・品名・摘要")}
        ${selectField("expenseCategory", "科目", [["all", "全て"], ...categories().map((item) => [item, item])], filter.category)}
        ${selectField("expensePayment", "支払", [["all", "全て"], ...paymentMethods], filter.paymentMethod)}
        ${selectField("expenseProof", "証憑", [["all", "全て"], ["missing", "未添付"], ["attached", "添付済"]], filter.proof)}
        <button class="button secondary small" data-filter-apply="expenses" type="button">反映</button>
        <button class="button secondary small" data-filter-reset="expenses" type="button">クリア</button>
        <span class="badge">${allExpenses.length}件中</span>
      </div>
    `;
  }

  function renderSalesFilters(allSales) {
    const filter = tableFilters.sales;
    return `
      <div class="filter-bar">
        ${field("salesQuery", "検索", "search", filter.query, "取引先・内容・請求番号")}
        ${selectField("salesInvoice", "請求書番号", [["all", "全て"], ["linked", "あり"], ["missing", "なし"]], filter.invoice)}
        <button class="button secondary small" data-filter-apply="sales" type="button">反映</button>
        <button class="button secondary small" data-filter-reset="sales" type="button">クリア</button>
        <span class="badge">${allSales.length}件中</span>
      </div>
    `;
  }

  function renderInvoiceFilters(allInvoices) {
    const filter = tableFilters.invoices;
    return `
      <div class="filter-bar">
        ${field("invoiceQuery", "検索", "search", filter.query, "請求先・内容・請求番号")}
        ${selectField("invoiceStatus", "状態", [["all", "全て"], ...invoiceStatuses.map((item) => [item, item])], filter.status)}
        ${selectField("invoiceDue", "期限", [["all", "全て"], ["overdue", "期限超過"], ["next30", "30日以内"], ["unpaid", "未入金"]], filter.due)}
        <button class="button secondary small" data-filter-apply="invoices" type="button">反映</button>
        <button class="button secondary small" data-filter-reset="invoices" type="button">クリア</button>
        <span class="badge">${allInvoices.length}件中</span>
      </div>
    `;
  }

  function bindFilterControls(type) {
    const reset = app.querySelector(`[data-filter-reset="${type}"]`);
    const apply = app.querySelector(`[data-filter-apply="${type}"]`);
    if (type === "expenses") {
      const query = app.querySelector("[name='expenseQuery']");
      const category = app.querySelector("[name='expenseCategory']");
      const payment = app.querySelector("[name='expensePayment']");
      const proof = app.querySelector("[name='expenseProof']");
      const update = () => {
        tableFilters.expenses = { query: query.value, category: category.value, paymentMethod: payment.value, proof: proof.value };
        renderExpenses();
      };
      [category, payment, proof].forEach((control) => control && control.addEventListener("change", update));
      if (apply) apply.addEventListener("click", update);
      if (query) query.addEventListener("keydown", (event) => { if (event.key === "Enter") update(); });
    }
    if (type === "sales") {
      const query = app.querySelector("[name='salesQuery']");
      const invoice = app.querySelector("[name='salesInvoice']");
      const update = () => {
        tableFilters.sales = { query: query.value, invoice: invoice.value };
        renderSales();
      };
      if (invoice) invoice.addEventListener("change", update);
      if (apply) apply.addEventListener("click", update);
      if (query) query.addEventListener("keydown", (event) => { if (event.key === "Enter") update(); });
    }
    if (type === "invoices") {
      const query = app.querySelector("[name='invoiceQuery']");
      const status = app.querySelector("[name='invoiceStatus']");
      const due = app.querySelector("[name='invoiceDue']");
      const update = () => {
        tableFilters.invoices = { query: query.value, status: status.value, due: due.value };
        renderInvoices();
      };
      [status, due].forEach((control) => control && control.addEventListener("change", update));
      if (apply) apply.addEventListener("click", update);
      if (query) query.addEventListener("keydown", (event) => { if (event.key === "Enter") update(); });
    }
    if (reset) {
      reset.addEventListener("click", () => {
        if (type === "expenses") tableFilters.expenses = { query: "", category: "all", paymentMethod: "all", proof: "all" };
        if (type === "sales") tableFilters.sales = { query: "", invoice: "all" };
        if (type === "invoices") tableFilters.invoices = { query: "", status: "all", due: "all" };
        render();
      });
    }
  }

  function filterExpenses(items) {
    const filter = tableFilters.expenses;
    return items.filter((item) => {
      if (filter.category !== "all" && item.category !== filter.category) return false;
      if (filter.paymentMethod !== "all" && item.paymentMethod !== filter.paymentMethod) return false;
      if (filter.proof === "missing" && item.proof) return false;
      if (filter.proof === "attached" && !item.proof) return false;
      return matchesQuery(item, filter.query, ["date", "vendor", "category", "department", "itemName", "amount", "paymentMethod", "registrationNumber", "note"]);
    });
  }

  function filterSales(items) {
    const filter = tableFilters.sales;
    return items.filter((item) => {
      if (filter.invoice === "linked" && !item.invoiceNo) return false;
      if (filter.invoice === "missing" && item.invoiceNo) return false;
      return matchesQuery(item, filter.query, ["date", "customer", "content", "classification", "department", "amount", "invoiceNo", "bankAccount", "note"]);
    });
  }

  function filterInvoices(items) {
    const filter = tableFilters.invoices;
    const today = new Date(TODAY);
    return items.filter((item) => {
      if (filter.status !== "all" && item.status !== filter.status) return false;
      if (filter.due === "unpaid" && item.status === "入金済") return false;
      if (filter.due === "overdue" && !(item.status !== "入金済" && item.dueDate && new Date(item.dueDate) < today)) return false;
      if (filter.due === "next30") {
        const due = item.dueDate && new Date(item.dueDate);
        const day = due ? daysBetween(TODAY, item.dueDate) : 999;
        if (!(item.status !== "入金済" && due >= today && day <= 30)) return false;
      }
      return matchesQuery(item, filter.query, ["invoiceNo", "issueDate", "serviceDate", "dueDate", "expectedPaymentDate", "paymentDate", "customer", "content", "classification", "department", "amount", "status", "note"]);
    });
  }

  function matchesQuery(item, query, keys) {
    const words = clean(query).toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    const haystack = keys.map((key) => displayValue(key, item[key])).join(" ").toLowerCase();
    return words.every((word) => haystack.includes(word));
  }

  function unpaidInvoices(invoices) {
    return invoices.filter((invoice) => invoice.status !== "入金済");
  }

  function renderReceivableAging(invoices) {
    const today = new Date(TODAY);
    const rows = [
      { label: "期限超過", items: unpaidInvoices(invoices).filter((invoice) => invoice.dueDate && new Date(invoice.dueDate) < today), cls: "bad" },
      { label: "30日以内", items: unpaidInvoices(invoices).filter((invoice) => {
        if (!invoice.dueDate) return false;
        const due = new Date(invoice.dueDate);
        return due >= today && daysBetween(TODAY, invoice.dueDate) <= 30;
      }), cls: "warn" },
      { label: "予定あり", items: unpaidInvoices(invoices).filter((invoice) => invoice.dueDate && new Date(invoice.dueDate) >= today), cls: "good" },
      { label: "期限未入力", items: unpaidInvoices(invoices).filter((invoice) => !invoice.dueDate), cls: "warn" }
    ];
    return `
      <div class="mini-metrics">
        ${rows.map((row) => `<div><strong>${yen(sum(row.items, "amount"))}</strong><span class="${row.cls}">${esc(row.label)} ${row.items.length}件</span></div>`).join("")}
      </div>
    `;
  }

  function renderExpenseTable(items) {
    if (!items.length) return `<div class="empty">経費データはありません。</div>`;
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>日付</th><th>科目</th><th>部門</th><th>取引先</th><th>品名</th><th class="num">個数</th><th class="num">単価</th><th class="num">金額</th><th>支払</th><th>税区分</th><th>T番号</th><th>証憑</th><th>申請</th><th>操作</th></tr></thead>
          <tbody>${items.map((item) => `<tr>
            <td>${esc(formatDate(item.date))}</td><td>${esc(item.category)}</td><td>${esc(item.department || departments()[0])}</td><td>${esc(item.vendor)}</td><td>${esc(item.itemName)} ${item.splitGroupId ? '<span class="badge">税率分割</span>' : ""}</td>
            <td class="num">${esc(item.quantity || "")}</td><td class="num">${item.unitPrice ? yen(item.unitPrice) : ""}</td><td class="num">${yen(item.amount)}</td>
            <td>${paymentBadge(item.paymentMethod)}</td><td>${esc(item.taxRate || "")}</td>
            <td>${registrationBadge(item)}</td><td>${item.proof ? '<span class="badge good">有</span>' : '<span class="badge warn">無</span>'}</td><td>${expensePaymentRequestCell(item)}</td><td>${rowActions("expenses", item.id)}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function renderReceivedDocTable(items) {
    if (!items.length) return `<div class="empty">受領書類はまだありません。</div>`;
    return `
      <div class="table-wrap"><table>
        <thead><tr><th>受領日</th><th>種別</th><th>発行元</th><th>件名</th><th class="num">金額</th><th>支払期限</th><th>状態</th><th>ファイル</th><th>支払依頼</th><th>操作</th></tr></thead>
        <tbody>${items.map((item) => `<tr>
          <td>${esc(formatDate(item.receivedDate))}</td><td>${esc(item.documentType || "")}</td><td>${esc(item.vendor || "")}</td><td>${esc(item.title || "")}</td>
          <td class="num">${yen(item.amount)}</td><td>${esc(formatDate(item.dueDate))}</td><td>${statusBadge(item.status)}</td>
          <td>${receivedDocFileCell(item)}</td><td>${receivedDocPaymentRequestCell(item)}</td><td>${rowActions("receivedDocs", item.id)}</td>
        </tr>`).join("")}</tbody>
      </table></div>
    `;
  }

  function receivedDocFileCell(item) {
    if (!item.file) return '<span class="badge warn">無</span>';
    const name = item.file.name || "添付ファイル";
    if (item.file.type && item.file.type.startsWith("image/")) {
      return `<button class="receipt-thumb mini" data-action="detail" data-collection="receivedDocs" data-id="${esc(item.id)}" type="button" aria-label="受領書類を表示"><img src="${esc(item.file.dataUrl)}" alt="${esc(name)}"></button>`;
    }
    return `<span class="badge good">${esc(name)}</span>`;
  }

  function receivedDocPaymentRequestCell(item) {
    if (item.paymentRequestNo) {
      return `${statusBadge(item.paymentRequestStatus || "申請中")}<br>${esc(item.paymentRequestNo)}`;
    }
    if (item.documentType === "請求書" || num(item.amount)) {
      return `<button class="button small secondary" data-action="received-to-payment-request" data-id="${esc(item.id)}" type="button">支払依頼化</button>`;
    }
    return '<span class="badge warn">対象外</span>';
  }

  function renderPaymentRequestTable(items) {
    if (!items.length) return `<div class="empty">申請データはありません。</div>`;
    return `
      <div class="table-wrap"><table>
        <thead><tr><th>申請番号</th><th>種別</th><th>申請日</th><th>支払期限</th><th>支払先</th><th>内容</th><th>科目</th><th class="num">金額</th><th>申請元</th><th>申請者</th><th>承認者</th><th>状態</th><th>操作</th></tr></thead>
        <tbody>${items.map((item) => `<tr>
          <td>${esc(item.requestNo || "")}</td><td>${esc(item.requestType || "")}</td><td>${esc(formatDate(item.requestDate))}</td><td>${esc(formatDate(item.dueDate))}</td>
          <td>${esc(item.vendor || "")}</td><td>${esc(item.content || "")}</td><td>${esc(item.category || "")}</td><td class="num">${yen(item.amount)}</td>
          <td>${paymentRequestSourceBadge(item)}</td><td>${esc(item.applicant || "")}</td><td>${esc(item.approver || "")}</td><td>${statusBadge(item.status)}</td>
          <td><div class="actions">${paymentRequestActionButtons(item)}${rowActions("paymentRequests", item.id)}</div></td>
        </tr>`).join("")}</tbody>
      </table></div>
    `;
  }

  function paymentRequestSourceBadge(item) {
    if (item.linkedReceivedDocId) return '<span class="badge good">受領書類</span>';
    if (item.linkedExpenseId) return '<span class="badge good">経費</span>';
    return '<span class="badge warn">手入力</span>';
  }

  function expensePaymentRequestCell(expense) {
    const request = paymentRequestForExpense(expense.id);
    if (request) {
      return `<span class="badge ${request.status === "支払済" || request.status === "承認済" ? "good" : "warn"}">${esc(request.status)}</span><br>${esc(request.requestNo || "")}`;
    }
    return `<button class="button small secondary" data-action="expense-to-payment-request" data-id="${esc(expense.id)}" type="button">支払依頼化</button>`;
  }

  function paymentRequestActionButtons(item) {
    const buttons = [];
    if (["下書き", "差し戻し"].includes(item.status)) {
      buttons.push(`<button class="button small secondary" data-action="request-submit" data-id="${esc(item.id)}" type="button">申請</button>`);
    }
    if (item.status === "申請中") {
      buttons.push(`<button class="button small secondary" data-action="request-approve" data-id="${esc(item.id)}" type="button">承認</button>`);
      buttons.push(`<button class="button small secondary" data-action="request-return" data-id="${esc(item.id)}" type="button">差戻し</button>`);
    }
    if (item.status === "承認済") {
      buttons.push(`<button class="button small secondary" data-action="request-paid" data-id="${esc(item.id)}" type="button">支払済</button>`);
    }
    return buttons.join("");
  }

  function renderSalesTable(items) {
    if (!items.length) return `<div class="empty">売上データはありません。</div>`;
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>入金日</th><th>取引先</th><th>項目</th><th>分類</th><th>部門</th><th class="num">売上</th><th class="num">累計</th><th>通帳</th><th>請求書番号</th><th>操作</th></tr></thead>
          <tbody>${items.map((item) => `<tr>
            <td>${esc(formatDate(item.date))}</td><td>${esc(item.customer)}</td><td>${esc(item.content)}</td><td>${esc(item.classification)}</td><td>${esc(item.department || "")}</td>
            <td class="num">${yen(item.amount)}</td><td class="num">${yen(item.cumulative)}</td><td>${esc(item.bankAccount || "")}</td><td>${esc(item.invoiceNo || "")}</td><td>${rowActions("sales", item.id)}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function renderImportBatchTable(items) {
    if (!items.length) return `<div class="empty">CSV取込履歴はまだありません。</div>`;
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>取込日時</th><th>種別</th><th>ファイル名</th><th class="num">読取行</th><th class="num">登録件数</th><th class="num">取込金額</th><th>登録先</th><th>状態</th><th>メモ</th><th>操作</th></tr></thead>
          <tbody>${items.map((item) => `<tr>
            <td>${esc(formatDateTime(item.importedAt))}</td>
            <td>${importSourceBadge(item.sourceType)}</td>
            <td>${esc(item.fileName || "")}</td>
            <td class="num">${esc(item.rowCount || 0)}</td>
            <td class="num">${esc(item.createdCount || 0)}</td>
            <td class="num">${yen(item.amountTotal)}</td>
            <td>${esc(importTargetLabel(item.target))}</td>
            <td>${statusBadge(item.status || "取込済")}</td>
            <td>${esc(item.note || "")}</td>
            <td>${importBatchActions(item)}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function importSourceBadge(sourceType) {
    if (sourceType === "bank") return '<span class="badge bank">通帳</span>';
    if (sourceType === "card") return '<span class="badge card">カード</span>';
    return '<span class="badge">CSV</span>';
  }

  function importTargetLabel(target) {
    if (target === "sales") return "売上一覧";
    if (target === "expenses") return "経費表・カード台帳";
    return target || "";
  }

  function importBatchActions(item) {
    return `<div class="actions"><button class="button small secondary" data-action="detail" data-collection="importBatches" data-id="${esc(item.id)}" type="button">詳細</button><button class="button small danger" data-action="delete" data-collection="importBatches" data-id="${esc(item.id)}" type="button">削除</button></div>`;
  }

  function renderInvoiceTable(items) {
    if (!items.length) return `<div class="empty">請求書データはありません。</div>`;
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>番号</th><th>請求日</th><th>実施日</th><th>支払期限</th><th>入金予定</th><th>入金日</th><th>請求先</th><th>内容</th><th class="num">金額</th><th>状態</th><th>送付</th><th>確認</th><th>操作</th></tr></thead>
          <tbody>${items.map((item) => {
            const sale = findSaleForInvoice(item);
            const crossing = fiscalCrossing(item);
            const mismatch = sale && num(sale.amount) !== num(item.amount);
            const receiptCreated = receiptExistsForInvoice(item.invoiceNo);
            return `<tr>
              <td>${esc(item.invoiceNo)}</td><td>${esc(formatDate(item.issueDate))}</td><td>${esc(formatDate(item.serviceDate))}</td><td>${esc(formatDate(item.dueDate))}</td><td>${esc(formatDate(item.expectedPaymentDate))}</td><td>${esc(formatDate(item.paymentDate))}</td>
              <td>${esc(item.customer)}</td><td>${esc(item.content)}</td><td class="num">${yen(item.amount)}</td><td>${statusBadge(item.status)}</td>
              <td>${statusBadge(item.sendStatus || "未送付")} ${item.sendDate ? esc(formatDate(item.sendDate)) : ""}</td>
              <td>${crossing ? '<span class="badge bad">決算またぎ</span>' : ""} ${mismatch ? '<span class="badge bad">金額差</span>' : ""}</td>
              <td>${rowActions("invoices", item.id)} ${sendActionButtons("invoices", item.id)} <button class="button small secondary" data-action="issue-invoice" data-id="${esc(item.id)}" type="button">請求書発行</button> ${item.status !== "入金済" ? `<button class="button small secondary" data-action="make-sale" data-id="${esc(item.id)}" type="button">売上化</button>` : ""} ${receiptCreated ? '<span class="badge good">領収書済</span>' : `<button class="button small secondary" data-action="invoice-to-receipt" data-id="${esc(item.id)}" type="button">領収書化</button>`}</td>
            </tr>`;
          }).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function renderEstimateTable(items) {
    if (!items.length) return `<div class="empty">見積データはありません。</div>`;
    return `
      <div class="table-wrap"><table>
        <thead><tr><th>番号</th><th>日付</th><th>提出先</th><th>分類</th><th>部門</th><th>内容</th><th class="num">金額</th><th>状態</th><th>納品書番号</th><th>請求書番号</th><th>送付</th><th>操作</th></tr></thead>
        <tbody>${items.map((item) => `<tr><td>${esc(item.estimateNo)}</td><td>${esc(formatDate(item.date))}</td><td>${esc(item.customer)}</td><td>${esc(item.classification)}</td><td>${esc(item.department || "")}</td><td>${esc(item.content)}</td><td class="num">${yen(item.amount)}</td><td>${statusBadge(item.status)}</td><td>${esc(item.linkedDeliveryNo || "")}</td><td>${esc(item.linkedInvoiceNo || "")}</td><td>${statusBadge(item.sendStatus || "未送付")} ${item.sendDate ? esc(formatDate(item.sendDate)) : ""}</td><td>${rowActions("estimates", item.id)} ${sendActionButtons("estimates", item.id)} <button class="button small secondary" data-action="issue-estimate" data-id="${esc(item.id)}" type="button">見積書発行</button>${item.linkedDeliveryNo ? "" : ` <button class="button small secondary" data-action="estimate-to-delivery" data-id="${esc(item.id)}" type="button">納品書化</button>`}${item.linkedInvoiceNo ? "" : ` <button class="button small secondary" data-action="estimate-to-invoice" data-id="${esc(item.id)}" type="button">請求書化</button>`}</td></tr>`).join("")}</tbody>
      </table></div>
    `;
  }

  function renderDeliveryTable(items) {
    if (!items.length) return `<div class="empty">納品書データはありません。</div>`;
    return `
      <div class="table-wrap"><table>
        <thead><tr><th>番号</th><th>納品日</th><th>取引先</th><th>件名</th><th>品目</th><th class="num">数量</th><th class="num">金額</th><th>関連見積</th><th>請求書番号</th><th>送付</th><th>操作</th></tr></thead>
        <tbody>${items.map((item) => `<tr>
          <td>${esc(item.deliveryNo)}</td><td>${esc(formatDate(item.date))}</td><td>${esc(item.customer || "")}</td><td>${esc(item.subject || "")}</td><td>${esc(item.itemName || "")}</td>
          <td class="num">${esc(item.quantity || "")} ${esc(item.unit || "")}</td><td class="num">${yen(item.amount)}</td><td>${esc(item.linkedEstimateNo || "")}</td><td>${esc(item.linkedInvoiceNo || "")}</td>
          <td>${statusBadge(item.sendStatus || "未送付")} ${item.sendDate ? esc(formatDate(item.sendDate)) : ""}</td>
          <td>${rowActions("deliveries", item.id)} ${sendActionButtons("deliveries", item.id)} <button class="button small secondary" data-action="issue-delivery" data-id="${esc(item.id)}" type="button">納品書発行</button>${item.linkedInvoiceNo ? "" : ` <button class="button small secondary" data-action="delivery-to-invoice" data-id="${esc(item.id)}" type="button">請求書化</button>`}</td>
        </tr>`).join("")}</tbody>
      </table></div>
    `;
  }

  function renderReceiptDocTable(items) {
    if (!items.length) return `<div class="empty">領収書データはありません。</div>`;
    return `
      <div class="table-wrap"><table>
        <thead><tr><th>番号</th><th>発行日</th><th>入金日</th><th>取引先</th><th>請求書番号</th><th>内容</th><th class="num">金額</th><th>送付</th><th>操作</th></tr></thead>
        <tbody>${items.map((item) => `<tr>
          <td>${esc(item.receiptNo)}</td><td>${esc(formatDate(item.issueDate))}</td><td>${esc(formatDate(item.paymentDate))}</td><td>${esc(item.customer || "")}</td><td>${esc(item.invoiceNo || "")}</td><td>${esc(item.content || "")}</td><td class="num">${yen(item.amount)}</td>
          <td>${statusBadge(item.sendStatus || "未送付")} ${item.sendDate ? esc(formatDate(item.sendDate)) : ""}</td>
          <td>${rowActions("receiptDocs", item.id)} ${sendActionButtons("receiptDocs", item.id)} <button class="button small secondary" data-action="issue-receipt-doc" data-id="${esc(item.id)}" type="button">領収書発行</button></td>
        </tr>`).join("")}</tbody>
      </table></div>
    `;
  }

  function renderPartnerTable(items) {
    if (!items.length) return `<div class="empty">取引先はまだ登録されていません。</div>`;
    return `
      <div class="table-wrap"><table>
        <thead><tr><th>取引先</th><th>敬称</th><th>担当者</th><th>メール</th><th>電話</th><th>支払条件</th><th>送付先</th><th>操作</th></tr></thead>
        <tbody>${items.map((item) => `<tr><td>${esc(item.name || "")}</td><td>${esc(item.honorific || "")}</td><td>${esc(item.contact || "")}</td><td>${esc(item.email || "")}</td><td>${esc(item.phone || "")}</td><td>${esc(item.paymentTerms || "")}</td><td>${esc(item.address || "")}</td><td>${rowActions("partners", item.id)}</td></tr>`).join("")}</tbody>
      </table></div>
    `;
  }

  function renderItemTable(items) {
    if (!items.length) return `<div class="empty">品目はまだ登録されていません。</div>`;
    return `
      <div class="table-wrap"><table>
        <thead><tr><th>品番</th><th>品目</th><th>分類</th><th class="num">標準単価</th><th>単位</th><th>税率</th><th>操作</th></tr></thead>
        <tbody>${items.map((item) => `<tr><td>${esc(item.itemCode || "")}</td><td>${esc(item.itemName || "")}</td><td>${esc(item.category || "")}</td><td class="num">${yen(item.unitPrice)}</td><td>${esc(item.unit || "")}</td><td>${esc(item.taxRate || "")}</td><td>${rowActions("items", item.id)}</td></tr>`).join("")}</tbody>
      </table></div>
    `;
  }

  function renderRecurringTable(items) {
    if (!items.length) return `<div class="empty">毎月自動作成ルールはまだありません。</div>`;
    return `
      <div class="table-wrap"><table>
        <thead><tr><th>ルール名</th><th>帳票</th><th>作成日</th><th>取引先</th><th>内容</th><th class="num">金額</th><th>状態</th><th>最終作成月</th><th>操作</th></tr></thead>
        <tbody>${items.map((item) => `<tr><td>${esc(item.title || "")}</td><td>${esc(documentTypeLabel(item.documentType))}</td><td>${esc(item.dayOfMonth || "")}日</td><td>${esc(item.customer || "")}</td><td>${esc(item.content || "")}</td><td class="num">${yen(item.amount)}</td><td>${statusBadge(item.active ? "完了" : "保留")}</td><td>${esc(item.lastCreatedMonth || "")}</td><td>${rowActions("recurringDocs", item.id)} <button class="button small secondary" data-action="create-recurring" data-id="${esc(item.id)}" type="button">今月分を作成</button></td></tr>`).join("")}</tbody>
      </table></div>
    `;
  }

  function renderSalesFlowTable(rows) {
    if (!rows.length) return `<div class="empty">販売管理の対象データはまだありません。</div>`;
    return `
      <div class="table-wrap"><table>
        <thead><tr><th>基準日</th><th>取引先</th><th>内容</th><th>進捗</th><th>見積</th><th>納品</th><th>請求</th><th>入金</th><th>領収</th><th class="num">金額</th><th>確認</th><th>次アクション</th></tr></thead>
        <tbody>${rows.map((row) => `<tr>
          <td>${esc(formatDate(row.date))}</td><td>${esc(row.customer || "")}</td><td>${esc(row.content || "")}</td><td>${salesFlowProgressBadge(row)}</td>
          <td>${row.estimate ? `${statusBadge(row.estimate.status || "作成中")}<br>${esc(row.estimate.estimateNo || "")}` : '<span class="badge warn">なし</span>'}</td>
          <td>${row.delivery ? `${statusBadge(row.delivery.sendStatus || "未送付")}<br>${esc(row.delivery.deliveryNo || "")}` : '<span class="badge warn">なし</span>'}</td>
          <td>${row.invoice ? `${statusBadge(row.invoice.status || "未入金")}<br>${esc(row.invoice.invoiceNo || "")}` : '<span class="badge warn">なし</span>'}</td>
          <td>${row.sale ? `${statusBadge("入金済")}<br>${esc(formatDate(row.sale.date))}` : '<span class="badge warn">未入金</span>'}</td>
          <td>${row.receipt ? `${statusBadge(row.receipt.sendStatus || "未送付")}<br>${esc(row.receipt.receiptNo || "")}` : '<span class="badge warn">未発行</span>'}</td>
          <td class="num">${yen(row.amount)}</td><td>${salesFlowIssueBadges(row)}</td><td>${salesFlowActionButtons(row)}</td>
        </tr>`).join("")}</tbody>
      </table></div>
    `;
  }

  function salesFlowActionButtons(row) {
    const actions = [];
    if (row.estimate && !row.delivery) {
      actions.push(`<button class="button small secondary" data-action="estimate-to-delivery" data-id="${esc(row.estimate.id)}" type="button">納品書化</button>`);
    }
    if (row.delivery && !row.invoice) {
      actions.push(`<button class="button small secondary" data-action="delivery-to-invoice" data-id="${esc(row.delivery.id)}" type="button">請求書化</button>`);
    } else if (row.estimate && !row.invoice) {
      actions.push(`<button class="button small secondary" data-action="estimate-to-invoice" data-id="${esc(row.estimate.id)}" type="button">請求書化</button>`);
    }
    if (row.invoice && !row.sale) {
      actions.push(`<button class="button small secondary" data-action="make-sale" data-id="${esc(row.invoice.id)}" type="button">売上化</button>`);
    }
    if (row.invoice && row.sale && !row.receipt) {
      actions.push(`<button class="button small secondary" data-action="invoice-to-receipt" data-id="${esc(row.invoice.id)}" type="button">領収書化</button>`);
    }
    return actions.length ? `<div class="actions">${actions.join("")}</div>` : '<span class="badge good">完了</span>';
  }

  function salesFlowProgress(row) {
    if (row.sale && !row.invoice) return { label: "請求書なし入金", cls: "warn" };
    if (row.invoice && row.sale && row.receipt) return { label: "完了", cls: "good" };
    if (row.sale && !row.receipt) return { label: "領収書待ち", cls: "warn" };
    if (row.invoice && !row.sale) return { label: "入金待ち", cls: "warn" };
    if (row.delivery && !row.invoice) return { label: "請求待ち", cls: "warn" };
    if (row.estimate && !row.delivery) return { label: "納品待ち", cls: "warn" };
    if (row.receipt && !row.sale) return { label: "入金確認待ち", cls: "warn" };
    return { label: "確認中", cls: "warn" };
  }

  function salesFlowProgressBadge(row) {
    const progress = salesFlowProgress(row);
    return `<span class="badge ${progress.cls}">${esc(progress.label)}</span>`;
  }

  function salesFlowIsComplete(row) {
    return Boolean(row.invoice && row.sale && row.receipt && !salesFlowIssues(row).length);
  }

  function salesFlowNextActionLabel(row) {
    if (row.estimate && !row.delivery) return "納品書化";
    if (row.delivery && !row.invoice) return "請求書化";
    if (row.estimate && !row.invoice) return "請求書化";
    if (row.invoice && !row.sale) return "売上化";
    if (row.invoice && row.sale && !row.receipt) return "領収書化";
    return "完了";
  }

  function renderLedgerTable(type, items) {
    if (!items.length) return `<div class="empty">データはありません。</div>`;
    if (type === "trips") {
      return `<div class="table-wrap"><table><thead><tr><th>日付</th><th>行先</th><th>目的</th><th>移動</th><th class="num">km</th><th class="num">ガソリン</th><th class="num">宿泊</th><th class="num">合計</th><th>操作</th></tr></thead><tbody>${items.map((item) => `<tr><td>${esc(formatDate(item.date))}</td><td>${esc(item.destination)}</td><td>${esc(item.purpose)}</td><td>${esc(item.transport)}</td><td class="num">${esc(item.mileage || "")}</td><td class="num">${yen(item.fuelClaim)}</td><td class="num">${yen(item.lodging)}</td><td class="num">${yen(item.total)}</td><td>${rowActions(type, item.id)}</td></tr>`).join("")}</tbody></table></div>`;
    }
    if (type === "payroll") {
      return `<div class="table-wrap"><table><thead><tr><th>対象月</th><th>氏名</th><th class="num">基本給</th><th class="num">手当</th><th class="num">控除</th><th class="num">支給額</th><th>支払日</th><th>操作</th></tr></thead><tbody>${items.map((item) => `<tr><td>${esc(item.payMonth)}</td><td>${esc(item.employee)}</td><td class="num">${yen(item.basePay)}</td><td class="num">${yen(item.allowance)}</td><td class="num">${yen(item.deduction)}</td><td class="num">${yen(item.netPay)}</td><td>${esc(formatDate(item.payDate))}</td><td>${rowActions(type, item.id)}</td></tr>`).join("")}</tbody></table></div>`;
    }
    return `<div class="table-wrap"><table><thead><tr><th>日付</th><th>送付元</th><th>講師</th><th>内容</th><th class="num">金額</th><th>状態</th><th>操作</th></tr></thead><tbody>${items.map((item) => `<tr><td>${esc(formatDate(item.date))}</td><td>${esc(item.sender)}</td><td>${esc(item.instructor)}</td><td>${esc(item.course)}</td><td class="num">${yen(item.amount)}</td><td>${statusBadge(item.status)}</td><td>${rowActions(type, item.id)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function renderReceiptMonth(month, records) {
    const sorted = [...records].sort(byDate("date"));
    return `
      <div class="receipt-month" style="margin-bottom:14px;">
        <div class="receipt-month-head">
          <h3>${esc(monthLabel(month))}</h3>
          <div class="actions"><span class="badge">${sorted.length}件</span><span class="badge">${yen(sum(sorted, "amount"))}</span><button class="button secondary small" data-action="month-handoff" data-month="${esc(month)}" type="button">提出HTML</button></div>
        </div>
        <div class="receipt-list">
          ${sorted.map((item) => `
            <article class="receipt-card">
              <button class="receipt-thumb" data-action="preview" data-id="${esc(item.id)}" type="button" aria-label="証憑を表示">
                ${item.proof && item.proof.type && item.proof.type.startsWith("image/") ? `<img src="${item.proof.dataUrl}" alt="${esc(item.proof.name)}">` : `<span>${item.proof ? esc(item.proof.name) : "証憑なし"}</span>`}
              </button>
              <div class="receipt-card-body">
                <div class="receipt-meta"><span>${esc(formatDate(item.date))}</span>${paymentBadge(item.paymentMethod)}</div>
                <strong>${esc(item.vendor || item.itemName || "未入力")}</strong>
                <div class="receipt-meta"><span>${esc(item.category)}${item.splitGroupId ? " / 税率分割" : ""}</span><strong>${yen(item.amount)}</strong></div>
                <div class="actions">${splitProofAction(item)}${rowActions("expenses", item.id)}</div>
              </div>
            </article>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderClosingMatrix(months, closings) {
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>月</th><th>15日前後</th><th>月末</th><th>メモ</th><th>提出</th></tr></thead>
          <tbody>${months.map((month) => {
            const mid = closings.find((item) => item.month === month && item.closeType === "15日前後");
            const end = closings.find((item) => item.month === month && item.closeType === "月末");
            return `<tr><td>${esc(month)}</td><td>${mid ? statusBadge(mid.status) : '<span class="badge warn">未</span>'}</td><td>${end ? statusBadge(end.status) : '<span class="badge warn">未</span>'}</td><td>${esc([mid && mid.note, end && end.note].filter(Boolean).join(" / "))}</td><td>${renderHandoffStatus(month)} <button class="button secondary small" data-action="month-handoff" data-month="${esc(month)}" type="button">提出HTML</button></td></tr>`;
          }).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function renderHandoffStatus(month) {
    const latest = latestHandoffForMonth(month);
    if (!latest) return '<span class="badge warn">未提出</span>';
    return `<span class="badge good">提出済 ${esc(formatDateTime(latest.exportedAt))}</span>`;
  }

  function renderMonthlyHandoffHistory(months) {
    const rows = fiscalHandoffs().slice(0, 40);
    const missingMonths = months.filter((month) => !latestHandoffForMonth(month));
    return `
      ${missingMonths.length ? `<div class="notice" style="margin-bottom:12px;">未提出月: ${missingMonths.map((month) => esc(monthLabel(month))).join("、")}</div>` : `<div class="notice info" style="margin-bottom:12px;">全ての月に提出履歴があります。</div>`}
      ${rows.length ? `<div class="table-wrap"><table>
        <thead><tr><th>提出日時</th><th>対象月</th><th>ファイル名</th><th class="num">経費</th><th class="num">売上</th><th class="num">請求書</th><th class="num">未確認</th></tr></thead>
        <tbody>${rows.map((item) => `<tr><td>${esc(formatDateTime(item.exportedAt))}</td><td>${esc(monthLabel(item.month))}</td><td>${esc(item.fileName || "")}</td><td class="num">${item.expenseCount || 0}件</td><td class="num">${item.saleCount || 0}件</td><td class="num">${item.invoiceCount || 0}件</td><td class="num">${item.issueCount || 0}件</td></tr>`).join("")}</tbody>
      </table></div>` : `<div class="empty">月次提出HTMLの出力履歴はまだありません。</div>`}
    `;
  }

  function renderLockedMonthList() {
    const months = lockedMonths();
    if (!months.length) {
      return `<div class="notice info">月末締めが「完了」の月はまだありません。</div>`;
    }
    return `
      <div class="status-list">
        ${months.map((month) => `<span><strong>${esc(monthLabel(month))}</strong> 編集・削除・復元をロック中</span>`).join("")}
      </div>
    `;
  }

  function renderExpenseChecks(expenses) {
    const checks = [];
    const missingProof = expenses.filter((item) => !item.proof);
    const missingRegistration = expenses.filter((item) => num(item.amount) >= 10000 && item.invoiceEligible && !isValidRegistration(item.registrationNumber));
    const uncategorized = expenses.filter((item) => item.category === "未分類");
    const cardNoProof = expenses.filter((item) => item.paymentMethod === "card" && !item.proof);
    const duplicates = duplicateExpenseGroups(expenses);
    if (missingProof.length) checks.push({ severity: "warn", title: "証憑未添付", body: `${missingProof.length}件あります。税理士提出前に画像/PDFを確認してください。` });
    if (missingRegistration.length) checks.push({ severity: "bad", title: "T番号要確認", body: `${missingRegistration.length}件あります。1万円以上・適格のものは担当税理士に確認が必要。` });
    if (uncategorized.length) checks.push({ severity: "warn", title: "未分類", body: `${uncategorized.length}件あります。税理士の分け方に合わせて科目を確認してください。` });
    if (cardNoProof.length) checks.push({ severity: "warn", title: "カード証憑不足", body: `${cardNoProof.length}件あります。カード明細だけでなく領収書の有無を確認してください。` });
    if (duplicates.length) checks.push({ severity: "warn", title: "経費重複の疑い", body: `${duplicates.length}組あります。同じ日付・取引先・金額の二重登録を確認してください。` });
    if (!checks.length) return `<div class="notice info">経費表の提出前チェックは通っています。</div>`;
    return `<div class="alert-list">${checks.map(renderAlert).join("")}</div>`;
  }

  function getAlerts() {
    const fiscalExpenses = fiscalItems(state.expenses, "date");
    const alerts = [];
    const health = getDataHealth();
    if (!health.backupOk) alerts.push({ severity: "bad", title: "バックアップ未実施", body: "ブラウザ保存だけでは消失リスクがあります。全体バックアップを保存してください。" });
    if (health.storageWarn) alerts.push({ severity: "warn", title: "保存容量が大きい", body: "証憑画像が増えています。必要に応じて画像サイズを下げてください。" });
    alerts.push(...expenseAlerts(fiscalExpenses));
    alerts.push(...receivedDocAlerts());
    alerts.push(...paymentRequestAlerts());
    alerts.push(...getInvoiceIssues());
    return alerts;
  }

  function expenseAlerts(expenses) {
    const alerts = [];
    const missingProof = expenses.filter((item) => !item.proof);
    const missingRegistration = expenses.filter((item) => num(item.amount) >= 10000 && item.invoiceEligible && !isValidRegistration(item.registrationNumber));
    const invalidRegistration = expenses.filter((item) => item.registrationNumber && !isValidRegistration(item.registrationNumber));
    const unclassified = expenses.filter((item) => item.category === "未分類");
    const duplicates = duplicateExpenseGroups(expenses);
    if (missingProof.length) alerts.push({ severity: "warn", title: "証憑未添付", body: `${missingProof.length}件の経費に画像またはPDFがありません。` });
    if (missingRegistration.length) alerts.push({ severity: "bad", title: "T番号確認", body: `${missingRegistration.length}件が1万円以上・適格・T番号未入力です。担当税理士に確認が必要。` });
    if (invalidRegistration.length) alerts.push({ severity: "bad", title: "T番号形式不一致", body: `${invalidRegistration.length}件あります。T + 13桁で入力してください。` });
    if (unclassified.length) alerts.push({ severity: "warn", title: "経費科目未分類", body: `${unclassified.length}件あります。` });
    if (duplicates.length) alerts.push({ severity: "warn", title: "経費重複確認", body: `${duplicates.length}組あります。同じ日付・取引先・金額の登録を確認してください。` });
    return alerts;
  }

  function paymentRequestAlerts() {
    const alerts = [];
    const requests = fiscalItems(state.paymentRequests || [], "requestDate");
    const pending = requests.filter((item) => !["承認済", "支払済"].includes(item.status));
    const overdue = requests.filter((item) => item.dueDate && item.dueDate < TODAY && item.status !== "支払済");
    if (pending.length) alerts.push({ severity: "warn", title: "未承認の支払依頼", body: `${pending.length}件あります。支払前に承認・差し戻しを確認してください。` });
    if (overdue.length) alerts.push({ severity: "bad", title: "支払依頼期限超過", body: `${overdue.length}件あります。支払期限と支払済み状態を確認してください。` });
    return alerts;
  }

  function receivedDocAlerts() {
    const alerts = [];
    const docs = fiscalItems(state.receivedDocs || [], "receivedDate");
    const unconfirmed = docs.filter((item) => item.status === "未確認");
    const noFile = docs.filter((item) => !item.file);
    const invoiceNoRequest = docs.filter((item) => item.documentType === "請求書" && !item.paymentRequestNo && num(item.amount));
    if (unconfirmed.length) alerts.push({ severity: "warn", title: "未確認の受領書類", body: `${unconfirmed.length}件あります。内容確認と保管状況を確認してください。` });
    if (noFile.length) alerts.push({ severity: "warn", title: "受領書類ファイル未添付", body: `${noFile.length}件あります。画像/PDFを保管してください。` });
    if (invoiceNoRequest.length) alerts.push({ severity: "warn", title: "請求書の支払依頼未作成", body: `${invoiceNoRequest.length}件あります。必要に応じて支払依頼化してください。` });
    return alerts;
  }

  function duplicateExpenseGroups(expenses) {
    const groups = expenses.reduce((acc, item) => {
      const key = [item.date, clean(item.vendor).toLowerCase(), num(item.amount)].join("|");
      if (!item.date || !item.vendor || !num(item.amount)) return acc;
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});
    return Object.values(groups).filter((items) => items.length > 1);
  }

  function getInvoiceIssues() {
    const issues = [];
    const today = new Date(TODAY);
    const invoiceNos = state.invoices.map((item) => item.invoiceNo).filter(Boolean);
    const duplicates = invoiceNos.filter((no, index) => invoiceNos.indexOf(no) !== index);
    [...new Set(duplicates)].forEach((no) => {
      issues.push({ severity: "bad", title: `請求番号重複 ${no}`, body: "同じ請求書番号が複数あります。番号を確認してください。" });
    });

    fiscalInvoices().forEach((invoice) => {
      const sale = findSaleForInvoice(invoice);
      if (invoice.status !== "入金済" && invoice.dueDate && new Date(invoice.dueDate) < today) {
        issues.push({ severity: "bad", title: `期限超過 ${invoice.invoiceNo}`, body: `${invoice.customer || "請求先未入力"} / ${yen(invoice.amount)} が未入金です。` });
      }
      if (invoice.status === "入金済" && !sale) {
        issues.push({ severity: "warn", title: `売上未照合 ${invoice.invoiceNo}`, body: "入金済みですが売上一覧に同じ請求書番号がありません。" });
      }
      if ((invoice.status === "入金済" || sale) && !receiptExistsForInvoice(invoice.invoiceNo)) {
        issues.push({ severity: "warn", title: `領収書未発行 ${invoice.invoiceNo}`, body: "入金済みですが、相手へ渡す領収書がまだ作成されていません。" });
      }
      if (sale && num(sale.amount) !== num(invoice.amount)) {
        issues.push({ severity: "bad", title: `金額差 ${invoice.invoiceNo}`, body: `請求 ${yen(invoice.amount)} / 売上 ${yen(sale.amount)}。差額を確認してください。` });
      }
      if (!invoice.serviceDate) {
        issues.push({ severity: "warn", title: `実施日未入力 ${invoice.invoiceNo}`, body: "決算またぎ判断のため実施日を残してください。" });
      }
      if (fiscalCrossing(invoice)) {
        issues.push({ severity: "bad", title: `決算またぎ ${invoice.invoiceNo}`, body: "実施日と入金予定/入金日が別年度です。担当税理士に確認が必要。" });
      }
    });

    fiscalItems(state.sales, "date").forEach((sale) => {
      if (sale.invoiceNo && !state.invoices.some((invoice) => invoice.invoiceNo === sale.invoiceNo)) {
        issues.push({ severity: "warn", title: `請求書なし売上 ${sale.invoiceNo}`, body: `${formatDate(sale.date)} / ${yen(sale.amount)} の請求書番号が請求書一覧にありません。` });
      }
    });
    return issues;
  }

  function bindReceiptActions() {
    app.querySelectorAll(".tab[data-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        receiptPaymentFilter = button.dataset.filter;
        renderReceipts();
      });
    });
    bindMonthlyHandoffActions();
    bindTableActions();
  }

  function bindMonthlyHandoffActions() {
    app.querySelectorAll("[data-action='month-handoff']").forEach((button) => {
      button.addEventListener("click", () => exportMonthlyHandoff(button.dataset.month));
    });
  }

  function bindTableActions() {
    app.querySelectorAll("[data-action='delete']").forEach((button) => {
      button.addEventListener("click", () => {
        const collection = button.dataset.collection;
        const id = button.dataset.id;
        const item = (state[collection] || []).find((record) => record.id === id);
        if (!item) return;
        if (hasLockedRecordMonth(collection, item)) {
          alert("この月は月末締めが完了しているため、削除できません。締め状態を確認してください。");
          return;
        }
        if (!confirm("この行を削除済みデータへ移動します。設定画面から復元できます。")) return;
        state.trash = Array.isArray(state.trash) ? state.trash : [];
        state.trash.push({
          id: uid("trash"),
          collection,
          deletedAt: new Date().toISOString(),
          record: item
        });
        state[collection] = (state[collection] || []).filter((record) => record.id !== id);
        if (collection === "paymentRequests") clearExpensePaymentRequest(item);
        if (collection === "paymentRequests") clearReceivedDocPaymentRequest(item);
        addAudit(`${collectionLabel(collection)}削除`, item);
        persist("削除保存");
        render();
      });
    });

    app.querySelectorAll("[data-action='detail']").forEach((button) => {
      button.addEventListener("click", () => showDetail(button.dataset.collection, button.dataset.id));
    });

    app.querySelectorAll("[data-action='edit']").forEach((button) => {
      button.addEventListener("click", () => {
        const collection = button.dataset.collection;
        const item = (state[collection] || []).find((record) => record.id === button.dataset.id);
        if (item && isMonthLocked(recordMonth(collection, item))) {
          alert("この月は月末締めが完了しているため、編集できません。締め状態を確認してください。");
          return;
        }
        showEditForm(collection, button.dataset.id);
      });
    });

    app.querySelectorAll("[data-action='preview']").forEach((button) => {
      button.addEventListener("click", () => showDetail("expenses", button.dataset.id));
    });

    app.querySelectorAll("[data-action='attach-split-proof']").forEach((input) => {
      input.addEventListener("change", (event) => attachSplitProof(event.currentTarget));
    });

    app.querySelectorAll("[data-action='expense-tax-split']").forEach((button) => {
      button.addEventListener("click", () => splitExistingExpense(button.dataset.id));
    });

    app.querySelectorAll("[data-action='send-draft']").forEach((button) => {
      button.addEventListener("click", () => showSendDraft(button.dataset.collection, button.dataset.id));
    });

    app.querySelectorAll("[data-action='mark-sent']").forEach((button) => {
      button.addEventListener("click", () => markDocumentSent(button.dataset.collection, button.dataset.id, button.dataset.method));
    });

    app.querySelectorAll("[data-action='expense-to-payment-request']").forEach((button) => {
      button.addEventListener("click", () => {
        const expense = state.expenses.find((item) => item.id === button.dataset.id);
        if (expense) createPaymentRequestFromExpense(expense);
      });
    });

    app.querySelectorAll("[data-action='received-to-payment-request']").forEach((button) => {
      button.addEventListener("click", () => {
        const doc = (state.receivedDocs || []).find((item) => item.id === button.dataset.id);
        if (doc) createPaymentRequestFromReceivedDoc(doc);
      });
    });

    app.querySelectorAll("[data-action='issue-invoice']").forEach((button) => {
      button.addEventListener("click", () => {
        const invoice = state.invoices.find((item) => item.id === button.dataset.id);
        if (invoice) exportInvoiceDocument(invoice);
      });
    });

    app.querySelectorAll("[data-action='issue-estimate']").forEach((button) => {
      button.addEventListener("click", () => {
        const estimate = state.estimates.find((item) => item.id === button.dataset.id);
        if (estimate) exportEstimateDocument(estimate);
      });
    });

    app.querySelectorAll("[data-action='issue-delivery']").forEach((button) => {
      button.addEventListener("click", () => {
        const delivery = state.deliveries.find((item) => item.id === button.dataset.id);
        if (delivery) exportDeliveryDocument(delivery);
      });
    });

    app.querySelectorAll("[data-action='issue-receipt-doc']").forEach((button) => {
      button.addEventListener("click", () => {
        const receiptDoc = state.receiptDocs.find((item) => item.id === button.dataset.id);
        if (receiptDoc) exportReceiptDocDocument(receiptDoc);
      });
    });

    app.querySelectorAll("[data-action='estimate-to-delivery']").forEach((button) => {
      button.addEventListener("click", () => {
        const estimate = state.estimates.find((item) => item.id === button.dataset.id);
        if (estimate) createDeliveryFromEstimate(estimate);
      });
    });

    app.querySelectorAll("[data-action='estimate-to-invoice']").forEach((button) => {
      button.addEventListener("click", () => {
        const estimate = state.estimates.find((item) => item.id === button.dataset.id);
        if (estimate) createInvoiceFromEstimate(estimate);
      });
    });

    app.querySelectorAll("[data-action='delivery-to-invoice']").forEach((button) => {
      button.addEventListener("click", () => {
        const delivery = state.deliveries.find((item) => item.id === button.dataset.id);
        if (delivery) createInvoiceFromDelivery(delivery);
      });
    });

    app.querySelectorAll("[data-action='invoice-to-receipt']").forEach((button) => {
      button.addEventListener("click", () => {
        const invoice = state.invoices.find((item) => item.id === button.dataset.id);
        if (invoice) createReceiptFromInvoice(invoice);
      });
    });

    app.querySelectorAll("[data-action='make-sale']").forEach((button) => {
      button.addEventListener("click", () => {
        const invoice = state.invoices.find((item) => item.id === button.dataset.id);
        if (invoice) createSaleFromInvoice(invoice);
      });
    });
  }

  function bindRecurringActions() {
    app.querySelectorAll("[data-action='create-recurring']").forEach((button) => {
      button.addEventListener("click", () => {
        const template = state.recurringDocs.find((item) => item.id === button.dataset.id);
        if (template) createRecurringDocument(template);
      });
    });
  }

  function bindPaymentRequestActions() {
    app.querySelectorAll("[data-action='request-submit']").forEach((button) => {
      button.addEventListener("click", () => updatePaymentRequestStatus(button.dataset.id, "申請中"));
    });
    app.querySelectorAll("[data-action='request-approve']").forEach((button) => {
      button.addEventListener("click", () => updatePaymentRequestStatus(button.dataset.id, "承認済"));
    });
    app.querySelectorAll("[data-action='request-return']").forEach((button) => {
      button.addEventListener("click", () => {
        const reason = prompt("差し戻し理由をメモに追記します。", "");
        if (reason === null) return;
        updatePaymentRequestStatus(button.dataset.id, "差し戻し", reason);
      });
    });
    app.querySelectorAll("[data-action='request-paid']").forEach((button) => {
      button.addEventListener("click", () => updatePaymentRequestStatus(button.dataset.id, "支払済"));
    });
  }

  function updatePaymentRequestStatus(id, status, note) {
    const request = (state.paymentRequests || []).find((item) => item.id === id);
    if (!request) return;
    request.status = status;
    request.updatedAt = new Date().toISOString();
    if (status === "申請中") request.submittedAt = request.updatedAt;
    if (status === "承認済") request.approvedAt = request.updatedAt;
    if (status === "差し戻し") {
      request.returnedAt = request.updatedAt;
      if (note) request.note = [request.note, `差戻し: ${note}`].filter(Boolean).join(" / ");
    }
    if (status === "支払済") request.paidAt = TODAY;
    syncExpensePaymentRequestStatus(request);
    syncReceivedDocPaymentRequestStatus(request);
    addAudit(`支払依頼${status}`, request);
    persist("支払依頼更新");
    renderApprovals();
  }

  function showDetail(collection, id) {
    const item = (state[collection] || []).find((record) => record.id === id);
    if (!item) return;
    dialogTitle.textContent = "詳細";
    const proof = item.proof || item.file;
    const rows = Object.entries(item)
      .filter(([key]) => !["id", "proof", "file"].includes(key))
      .map(([key, value]) => `<dt>${esc(labelFor(key))}</dt><dd>${esc(displayValue(key, value))}</dd>`)
      .join("");
    dialogBody.innerHTML = `
      ${proof ? (proof.type && proof.type.startsWith("image/")
        ? `<img class="preview-image" src="${proof.dataUrl}" alt="${esc(proof.name)}">`
        : `<div class="notice info">${esc(proof.name)} を保存済みです。</div>`) : ""}
      <dl class="detail-list" style="margin-top:14px;">${rows}</dl>
    `;
    dialog.showModal();
  }

  function showEditForm(collection, id) {
    const item = (state[collection] || []).find((record) => record.id === id);
    if (!item) return;
    dialogTitle.textContent = "編集";
    dialogBody.innerHTML = `
      <form id="editRecordForm" class="form-grid">
        ${partnerDatalist()}
        ${itemDatalist()}
        ${editFieldsFor(collection, item)}
        <div class="actions" style="grid-column:1 / -1;">
          <button class="button" type="submit">保存</button>
          <button class="button secondary" data-action="cancel-edit" type="button">キャンセル</button>
        </div>
      </form>
    `;
    const form = document.getElementById("editRecordForm");
    bindLineEditor("editRecordForm");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const saved = await updateRecordFromEdit(collection, id, form);
      if (!saved) return;
      dialog.close();
      persist("編集保存");
      render();
    });
    form.querySelector("[data-action='cancel-edit']").addEventListener("click", () => dialog.close());
    dialog.showModal();
  }

  function editFieldsFor(collection, item) {
    if (collection === "expenses") {
      return `
        ${field("date", "日付", "date", item.date || TODAY)}
        ${field("vendor", "取引先", "text", item.vendor || "")}
        ${selectField("category", "経費科目", categories(), item.category || "未分類")}
        ${selectField("department", "部門", departments(), item.department || departments()[0])}
        ${selectField("paymentMethod", "支払区分", paymentMethods, item.paymentMethod || "cash")}
        ${field("itemName", "品名", "text", item.itemName || "")}
        ${field("quantity", "個数", "number", item.quantity || "1")}
        ${field("unitPrice", "単価", "number", item.unitPrice || "")}
        ${field("amount", "金額", "number", item.amount || "")}
        ${selectField("taxRate", "税区分", taxRates, item.taxRate || "10%")}
        ${field("registrationNumber", "T番号", "text", item.registrationNumber || "")}
        <label class="check-field"><input name="invoiceEligible" type="checkbox" ${item.invoiceEligible ? "checked" : ""}> インボイス適格</label>
        <label class="field"><span>証憑差し替え</span><input name="proof" type="file" accept="image/*,application/pdf"></label>
        <div class="notice info" style="grid-column:1 / -1;">証憑を選ばない場合、現在の証憑をそのまま残します。</div>
        <label class="field" style="grid-column:1 / -1;"><span>摘要</span><textarea name="note">${esc(item.note || "")}</textarea></label>
      `;
    }
    if (collection === "receivedDocs") {
      return `
        ${field("receivedDate", "受領日", "date", item.receivedDate || TODAY)}
        ${selectField("documentType", "書類種別", receivedDocTypes, item.documentType || "請求書")}
        ${field("vendor", "発行元・支払先", "text", item.vendor || "")}
        ${field("title", "件名", "text", item.title || "")}
        ${field("amount", "金額", "number", item.amount || "")}
        ${field("dueDate", "支払期限", "date", item.dueDate || "")}
        ${selectField("category", "経費科目", categories(), item.category || "未分類")}
        ${selectField("department", "部門", departments(), item.department || departments()[0])}
        ${selectField("status", "状態", receivedDocStatuses, item.status || "未確認")}
        ${field("paymentRequestNo", "支払依頼番号", "text", item.paymentRequestNo || "")}
        ${field("paymentRequestStatus", "支払依頼状態", "text", item.paymentRequestStatus || "")}
        <label class="field"><span>書類差し替え</span><input name="file" type="file" accept="image/*,application/pdf"></label>
        <div class="notice info" style="grid-column:1 / -1;">書類を選ばない場合、現在のファイルをそのまま残します。</div>
        <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note">${esc(item.note || "")}</textarea></label>
      `;
    }
    if (collection === "paymentRequests") {
      return `
        ${field("requestNo", "申請番号", "text", item.requestNo || "")}
        ${selectField("requestType", "申請種別", ["支払依頼", "事前申請", "経費精算", "その他"], item.requestType || "支払依頼")}
        ${field("requestDate", "申請日", "date", item.requestDate || TODAY)}
        ${field("dueDate", "支払期限", "date", item.dueDate || "")}
        ${field("vendor", "支払先", "text", item.vendor || "")}
        ${field("content", "内容", "text", item.content || "")}
        ${selectField("category", "経費科目", categories(), item.category || "未分類")}
        ${selectField("department", "部門", departments(), item.department || departments()[0])}
        ${field("amount", "金額", "number", item.amount || "")}
        ${field("applicant", "申請者", "text", item.applicant || "")}
        ${field("approver", "承認者", "text", item.approver || "")}
        ${selectField("status", "状態", paymentRequestStatuses, item.status || "申請中")}
        ${field("linkedExpenseId", "関連経費ID", "text", item.linkedExpenseId || "")}
        <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note">${esc(item.note || "")}</textarea></label>
      `;
    }
    if (collection === "sales") {
      return `
        ${field("date", "入金日", "date", item.date || TODAY)}
        ${field("customer", "取引先", "text", item.customer || "")}
        ${field("content", "項目・内容", "text", item.content || "")}
        ${selectField("classification", "分類", salesCategories, item.classification || "業務委託")}
        ${selectField("department", "部門", departments(), item.department || departments()[0])}
        ${field("amount", "売上額", "number", item.amount || "")}
        ${field("invoiceNo", "請求書番号", "text", item.invoiceNo || "")}
        ${field("bankAccount", "通帳", "text", item.bankAccount || state.settings.bankAccount || "道銀")}
        <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note">${esc(item.note || "")}</textarea></label>
      `;
    }
    if (collection === "invoices") {
      return `
        ${field("invoiceNo", "請求書番号", "text", item.invoiceNo || "")}
        ${field("issueDate", "請求日", "date", item.issueDate || TODAY)}
        ${field("serviceDate", "実施日", "date", item.serviceDate || "")}
        ${field("dueDate", "支払期限", "date", item.dueDate || "")}
        ${field("expectedPaymentDate", "入金予定日", "date", item.expectedPaymentDate || "")}
        ${field("paymentDate", "入金日", "date", item.paymentDate || "")}
        ${field("customer", "請求先", "text", item.customer || "")}
        ${field("content", "内容", "text", item.content || "")}
        ${selectField("classification", "分類", salesCategories, item.classification || "業務委託")}
        ${selectField("department", "部門", departments(), item.department || departments()[0])}
        ${field("amount", "金額", "number", item.amount || "")}
        ${selectField("taxRate", "税区分", taxRates, item.taxRate || "10%")}
        ${documentLinesEditor(normalizedDocumentLines(item))}
        ${selectField("status", "状態", invoiceStatuses, item.status || "未入金")}
        ${selectField("template", "テンプレート", documentTemplates(), item.template || "標準")}
        ${selectField("sendStatus", "送付状態", sendStatuses(), item.sendStatus || "未送付")}
        ${field("sendDate", "送付日", "date", item.sendDate || "")}
        ${field("linkedEstimateNo", "関連見積番号", "text", item.linkedEstimateNo || "")}
        ${field("linkedDeliveryNo", "関連納品書番号", "text", item.linkedDeliveryNo || "")}
        ${field("linkedReceiptNo", "関連領収書番号", "text", item.linkedReceiptNo || "")}
        <label class="field" style="grid-column:1 / -1;"><span>確認メモ</span><textarea name="note">${esc(item.note || "")}</textarea></label>
      `;
    }
    if (collection === "estimates") {
      return `
        ${field("estimateNo", "見積番号", "text", item.estimateNo || "")}
        ${field("date", "見積日", "date", item.date || TODAY)}
        ${field("customer", "提出先", "text", item.customer || "")}
        ${selectField("classification", "分類", salesCategories, item.classification || "業務委託")}
        ${selectField("department", "部門", departments(), item.department || departments()[0])}
        ${field("content", "内容", "text", item.content || "")}
        ${field("amount", "金額", "number", item.amount || "")}
        ${documentLinesEditor(normalizedDocumentLines(item))}
        ${selectField("status", "状態", ["作成中", "提出済", "受注", "失注", "保留"], item.status || "作成中")}
        ${field("linkedDeliveryNo", "納品書番号", "text", item.linkedDeliveryNo || "")}
        ${field("linkedInvoiceNo", "請求書番号", "text", item.linkedInvoiceNo || "")}
        ${selectField("template", "テンプレート", documentTemplates(), item.template || "標準")}
        ${selectField("sendStatus", "送付状態", sendStatuses(), item.sendStatus || "未送付")}
        ${field("sendDate", "送付日", "date", item.sendDate || "")}
        <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note">${esc(item.note || "")}</textarea></label>
      `;
    }
    if (collection === "deliveries") {
      return `
        ${field("deliveryNo", "納品書番号", "text", item.deliveryNo || "")}
        ${field("date", "納品日", "date", item.date || TODAY)}
        ${field("customer", "取引先", "text", item.customer || "")}
        ${field("subject", "件名", "text", item.subject || "")}
        ${field("itemName", "品目", "text", item.itemName || "")}
        ${field("quantity", "数量", "number", item.quantity || "1")}
        ${field("unit", "単位", "text", item.unit || "式")}
        ${field("unitPrice", "単価", "number", item.unitPrice || "")}
        ${field("amount", "金額", "number", item.amount || "")}
        ${selectField("taxRate", "税区分", taxRates, item.taxRate || "10%")}
        ${documentLinesEditor(normalizedDocumentLines(item))}
        ${selectField("template", "テンプレート", documentTemplates(), item.template || "標準")}
        ${selectField("sendStatus", "送付状態", sendStatuses(), item.sendStatus || "未送付")}
        ${field("sendDate", "送付日", "date", item.sendDate || "")}
        ${field("linkedEstimateNo", "関連見積番号", "text", item.linkedEstimateNo || "")}
        ${field("linkedInvoiceNo", "関連請求書番号", "text", item.linkedInvoiceNo || "")}
        <label class="field" style="grid-column:1 / -1;"><span>備考</span><textarea name="note">${esc(item.note || "")}</textarea></label>
      `;
    }
    if (collection === "receiptDocs") {
      return `
        ${field("receiptNo", "領収書番号", "text", item.receiptNo || "")}
        ${field("issueDate", "発行日", "date", item.issueDate || TODAY)}
        ${field("paymentDate", "入金日", "date", item.paymentDate || TODAY)}
        ${field("customer", "取引先", "text", item.customer || "")}
        ${field("invoiceNo", "請求書番号", "text", item.invoiceNo || "")}
        ${field("content", "但し書き・内容", "text", item.content || "")}
        ${field("amount", "領収金額", "number", item.amount || "")}
        ${selectField("taxRate", "税区分", taxRates, item.taxRate || "10%")}
        ${documentLinesEditor(normalizedDocumentLines(item))}
        ${selectField("template", "テンプレート", documentTemplates(), item.template || "標準")}
        ${selectField("sendStatus", "送付状態", sendStatuses(), item.sendStatus || "未送付")}
        ${field("sendDate", "送付日", "date", item.sendDate || "")}
        <label class="field" style="grid-column:1 / -1;"><span>備考</span><textarea name="note">${esc(item.note || "")}</textarea></label>
      `;
    }
    if (collection === "partners") {
      return `
        ${field("name", "取引先名", "text", item.name || "")}
        ${selectField("honorific", "敬称", ["御中", "様", "先生", "なし"], item.honorific || "御中")}
        ${field("contact", "担当者", "text", item.contact || "")}
        ${field("email", "メール", "email", item.email || "")}
        ${field("phone", "電話", "tel", item.phone || "")}
        ${field("paymentTerms", "支払条件", "text", item.paymentTerms || "")}
        <label class="field" style="grid-column:1 / -1;"><span>住所・送付先</span><textarea name="address">${esc(item.address || "")}</textarea></label>
        <label class="field" style="grid-column:1 / -1;"><span>振込先・条件メモ</span><textarea name="bankInfo">${esc(item.bankInfo || "")}</textarea></label>
        <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note">${esc(item.note || "")}</textarea></label>
      `;
    }
    if (collection === "items") {
      return `
        ${field("itemCode", "品番", "text", item.itemCode || "")}
        ${field("itemName", "品目名", "text", item.itemName || "")}
        ${selectField("category", "分類", salesCategories, item.category || "業務委託")}
        ${field("unitPrice", "標準単価", "number", item.unitPrice || "")}
        ${field("unit", "単位", "text", item.unit || "式")}
        ${selectField("taxRate", "税率", taxRates, item.taxRate || "10%")}
        <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note">${esc(item.note || "")}</textarea></label>
      `;
    }
    if (collection === "recurringDocs") {
      return `
        ${field("title", "ルール名", "text", item.title || "")}
        ${selectField("documentType", "作成帳票", [["invoice", "請求書"], ["delivery", "納品書"], ["receipt", "領収書"]], item.documentType || "invoice")}
        ${field("dayOfMonth", "作成日", "number", item.dayOfMonth || "15")}
        ${field("customer", "取引先", "text", item.customer || "")}
        ${field("content", "内容", "text", item.content || "")}
        ${field("amount", "金額", "number", item.amount || "")}
        ${selectField("classification", "分類", salesCategories, item.classification || "業務委託")}
        ${selectField("department", "部門", departments(), item.department || departments()[0])}
        ${selectField("taxRate", "税区分", taxRates, item.taxRate || "10%")}
        ${selectField("template", "テンプレート", documentTemplates(), item.template || "標準")}
        <label class="check-field"><input name="active" type="checkbox" ${item.active ? "checked" : ""}> 有効</label>
        ${field("lastCreatedMonth", "最終作成月", "month", item.lastCreatedMonth || "")}
        <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note">${esc(item.note || "")}</textarea></label>
      `;
    }
    if (collection === "trips") {
      return `
        ${field("date", "日付", "date", item.date || TODAY)}
        ${field("destination", "行先", "text", item.destination || "")}
        ${field("purpose", "目的", "text", item.purpose || "")}
        ${field("transport", "移動手段", "text", item.transport || "")}
        ${field("mileage", "km", "number", item.mileage || "")}
        ${field("fuelClaim", "ガソリン請求", "number", item.fuelClaim || "")}
        ${field("lodging", "宿泊費", "number", item.lodging || "")}
        ${field("total", "合計", "number", item.total || "")}
        <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note">${esc(item.note || "")}</textarea></label>
      `;
    }
    if (collection === "payroll") {
      return `
        ${field("payMonth", "対象月", "month", item.payMonth || TODAY.slice(0, 7))}
        ${field("employee", "氏名", "text", item.employee || "")}
        ${field("basePay", "基本給", "number", item.basePay || "")}
        ${field("allowance", "手当", "number", item.allowance || "")}
        ${field("deduction", "控除", "number", item.deduction || "")}
        ${field("netPay", "支給額", "number", item.netPay || "")}
        ${field("payDate", "支払日", "date", item.payDate || TODAY)}
        <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note">${esc(item.note || "")}</textarea></label>
      `;
    }
    return `
      ${field("date", "日付", "date", item.date || TODAY)}
      ${field("sender", "送付元", "text", item.sender || "")}
      ${field("instructor", "講師", "text", item.instructor || "")}
      ${field("course", "内容", "text", item.course || "")}
      ${field("amount", "金額", "number", item.amount || "")}
      ${selectField("status", "状態", ledgerStatuses, item.status || "未処理")}
      <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note">${esc(item.note || "")}</textarea></label>
    `;
  }

  async function updateRecordFromEdit(collection, id, form) {
    const item = (state[collection] || []).find((record) => record.id === id);
    if (!item) return false;
    const before = JSON.parse(JSON.stringify(item));
    const data = formValues(form);
    const formData = new FormData(form);
    const numericFields = ["quantity", "unitPrice", "amount", "mileage", "fuelClaim", "lodging", "total", "basePay", "allowance", "deduction", "netPay", "dayOfMonth"];

    Object.entries(data).forEach(([key, value]) => {
      if (key === "proof" || key === "file" || key === "invoiceEligible") return;
      if (/^line(ItemName|Quantity|Unit|UnitPrice|TaxRate)\d+$/.test(key)) return;
      item[key] = numericFields.includes(key) ? num(value) : clean(value);
    });

    if (collection === "expenses") {
      item.invoiceEligible = Boolean(formData.get("invoiceEligible"));
      item.registrationNumber = normalizeRegistration(item.registrationNumber);
      const quantity = num(item.quantity) || 1;
      const unitPrice = num(item.unitPrice);
      if (!num(item.amount) && unitPrice) item.amount = Math.round(quantity * unitPrice);
      const proofFile = formData.get("proof");
      if (proofFile && proofFile.size) item.proof = await readFile(proofFile);
    }
    if (collection === "receivedDocs") {
      const file = formData.get("file");
      if (file && file.size) item.file = await readFile(file);
      const request = paymentRequestForReceivedDoc(item.id);
      if (request) {
        item.paymentRequestNo = request.requestNo;
        item.paymentRequestStatus = request.status;
      }
    }
    if (collection === "trips" && !num(item.total)) item.total = num(item.fuelClaim) + num(item.lodging);
    if (collection === "payroll" && !num(item.netPay)) item.netPay = num(item.basePay) + num(item.allowance) - num(item.deduction);
    if (isLockedRecordMonth(collection, item, "編集")) {
      restoreRecordSnapshot(item, before);
      return false;
    }
    if (collection === "sales") markInvoicePaidFromSale(item);
    if (collection === "invoices" && item.paymentDate) item.status = "入金済";
    if (collection === "paymentRequests") {
      if (item.status === "支払済" && !item.paidAt) item.paidAt = TODAY;
      syncExpensePaymentRequestStatus(item);
      syncReceivedDocPaymentRequestStatus(item);
    }
    if (["estimates", "invoices", "deliveries", "receiptDocs"].includes(collection)) {
      item.lines = documentLinesFromData(data, {
        itemName: item.content || item.itemName || item.subject,
        quantity: item.quantity || 1,
        unit: item.unit || "式",
        unitPrice: item.unitPrice || item.amount,
        amount: item.amount,
        taxRate: item.taxRate || "10%"
      });
      item.amount = documentAmountFromLines(item.lines, item.amount);
    }
    if (collection === "deliveries" && !num(item.amount)) item.amount = Math.round((num(item.quantity) || 1) * num(item.unitPrice));
    if (collection === "recurringDocs") {
      item.active = Boolean(formData.get("active"));
      item.dayOfMonth = Math.min(31, Math.max(1, num(item.dayOfMonth) || 15));
    }
    item.updatedAt = new Date().toISOString();
    addAudit(`${collection}編集`, item);
    return true;
  }

  function exportAllData() {
    state.settings.lastBackupAt = new Date().toISOString();
    addAudit("全体バックアップ", { fiscalYear: selectedFiscalYear });
    persist("バックアップ記録");
    downloadJson(`cdp-accounting-backup-${TODAY}.json`, {
      exportedAt: new Date().toISOString(),
      type: "full-backup",
      state
    });
  }

  function exportAccountantPackage() {
    const payload = {
      exportedAt: new Date().toISOString(),
      type: "accountant-package",
      fiscalYear: selectedFiscalYear,
      fiscalRange: getFiscalRange(selectedFiscalYear),
      settings: state.settings,
      checks: getAlerts(),
      dataHealth: getDataHealth(),
      expenses: fiscalItems(state.expenses, "date"),
      receivedDocs: fiscalItems(state.receivedDocs || [], "receivedDate"),
      paymentRequests: fiscalItems(state.paymentRequests || [], "requestDate"),
      importBatches: fiscalItems(state.importBatches || [], "importDate"),
      sales: fiscalItems(state.sales, "date"),
      invoices: fiscalInvoices(),
      estimates: fiscalItems(state.estimates, "date"),
      deliveries: fiscalItems(state.deliveries, "date"),
      receiptDocs: fiscalItems(state.receiptDocs, "issueDate"),
      partners: state.partners || [],
      items: state.items || [],
      recurringDocs: state.recurringDocs || [],
      trips: fiscalItems(state.trips, "date"),
      payroll: fiscalItems(state.payroll, "payMonth"),
      hitech: fiscalItems(state.hitech, "date"),
      closings: state.closings.filter((item) => item.month && getFiscalYear(`${item.month}-01`) === selectedFiscalYear),
      journals: fiscalItems(state.journals, "date"),
      bookEntries: fiscalBookEntries(),
      trash: state.trash || [],
      handoffs: fiscalHandoffs(),
      sendLogs: fiscalSendLogs(),
      audit: state.audit
    };
    addAudit("税理士提出パック出力", { fiscalYear: selectedFiscalYear });
    persist("提出パック");
    downloadJson(`税理士提出パック-${selectedFiscalYear}年度-${TODAY}.json`, payload);
  }

  function exportSubmissionSummary() {
    const expenses = fiscalItems(state.expenses, "date");
    const sales = fiscalItems(state.sales, "date");
    const invoices = fiscalInvoices();
    const alerts = getAlerts();
    const health = getDataHealth();
    const categoryRows = summarizeExpenses(expenses);
    const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>税理士提出サマリー ${selectedFiscalYear}年度</title>
  <style>
    body{font-family:"Yu Gothic",Meiryo,sans-serif;color:#182235;margin:28px;line-height:1.6}
    h1{font-size:24px} h2{font-size:18px;margin-top:26px;border-bottom:2px solid #2e5f9e;padding-bottom:4px}
    table{width:100%;border-collapse:collapse;margin-top:10px} th,td{border:1px solid #d8dee8;padding:8px;text-align:left;vertical-align:top} th{background:#e7f0fb}
    .num{text-align:right}.bad{color:#b73838;font-weight:700}.warn{color:#b56b00;font-weight:700}.muted{color:#637087}
  </style>
</head>
<body>
  <h1>${esc(state.settings.companyName)} 税理士提出サマリー</h1>
  <p class="muted">${selectedFiscalYear}年度 / ${formatDate(getFiscalRange(selectedFiscalYear).start)} - ${formatDate(getFiscalRange(selectedFiscalYear).end)} / 出力日 ${formatDate(TODAY)}</p>
  <h2>提出前ステータス</h2>
  <table><tbody>
    <tr><th>運用点検</th><td>${health.score}点</td></tr>
    <tr><th>経費合計</th><td>${yen(sum(expenses, "amount"))} / ${expenses.length}件</td></tr>
    <tr><th>売上入金</th><td>${yen(sum(sales, "amount"))} / ${sales.length}件</td></tr>
    <tr><th>請求書</th><td>${yen(sum(invoices, "amount"))} / ${invoices.length}件</td></tr>
    <tr><th>未確認</th><td>${alerts.length}件</td></tr>
  </tbody></table>
  <h2>要確認事項</h2>
  ${alerts.length ? `<table><thead><tr><th>重要度</th><th>項目</th><th>内容</th></tr></thead><tbody>${alerts.map((alert) => `<tr><td class="${alert.severity === "bad" ? "bad" : "warn"}">${alert.severity === "bad" ? "要対応" : "確認"}</td><td>${esc(alert.title)}</td><td>${esc(alert.body)}</td></tr>`).join("")}</tbody></table>` : "<p>提出前の大きな未確認はありません。</p>"}
  <h2>経費分類</h2>
  ${categoryRows.length ? `<table><thead><tr><th>科目</th><th class="num">金額</th><th class="num">構成比</th></tr></thead><tbody>${categoryRows.map((row) => `<tr><td>${esc(row.category)}</td><td class="num">${yen(row.amount)}</td><td class="num">${row.percent.toFixed(1)}%</td></tr>`).join("")}</tbody></table>` : "<p>経費データはありません。</p>"}
  <h2>請求書と売上の扱い</h2>
  <p>請求日、実施日、支払期限、入金予定日、入金日を残しています。決算またぎや売上計上日は、担当税理士に確認が必要です。</p>
  <h2>税理士メモ</h2>
  <p>${esc(state.settings.accountantMemo || "")}</p>
</body>
</html>`;
    addAudit("提出サマリー出力", { fiscalYear: selectedFiscalYear });
    persist("提出サマリー");
    downloadBlob(`税理士提出サマリー-${selectedFiscalYear}年度-${TODAY}.html`, new Blob([html], { type: "text/html;charset=utf-8" }));
  }

  function exportMonthlyHandoff(month) {
    if (!month) return;
    const data = monthlyHandoffData(month);
    const html = monthlyHandoffHtml(data);
    const fileName = `月次提出-${safeFilePart(month)}-${TODAY}.html`;
    recordMonthlyHandoff(data, fileName);
    addAudit("月次提出HTML出力", {
      month,
      expenses: data.expenses.length,
      sales: data.sales.length,
      invoices: data.invoices.length,
      issues: data.issues.length
    });
    persist("月次提出HTML");
    downloadBlob(fileName, new Blob([html], { type: "text/html;charset=utf-8" }));
  }

  function recordMonthlyHandoff(data, fileName) {
    state.handoffs = Array.isArray(state.handoffs) ? state.handoffs : [];
    state.handoffs.push({
      id: uid("handoff"),
      month: data.month,
      fileName,
      exportedAt: new Date().toISOString(),
      expenseCount: data.expenses.length,
      expenseTotal: sum(data.expenses, "amount"),
      saleCount: data.sales.length,
      saleTotal: sum(data.sales, "amount"),
      invoiceCount: data.invoices.length,
      invoiceTotal: sum(data.invoices, "amount"),
      estimateCount: data.estimates.length,
      deliveryCount: data.deliveries.length,
      receiptDocCount: data.receiptDocs.length,
      issueCount: data.issues.length
    });
    if (state.handoffs.length > 500) state.handoffs = state.handoffs.slice(-500);
  }

  function monthlyHandoffData(month) {
    const inMonth = (date) => String(date || "").slice(0, 7) === month;
    const expenses = state.expenses.filter((item) => inMonth(item.date)).sort(byDate("date"));
    const receivedDocs = (state.receivedDocs || []).filter((item) => [item.receivedDate, item.dueDate].some(inMonth)).sort(byDate("receivedDate"));
    const sales = state.sales.filter((item) => inMonth(item.date)).sort(byDate("date"));
    const invoices = state.invoices
      .filter((item) => [item.issueDate, item.serviceDate, item.dueDate, item.expectedPaymentDate, item.paymentDate].some(inMonth))
      .sort(byDate("issueDate"));
    const estimates = state.estimates.filter((item) => inMonth(item.date)).sort(byDate("date"));
    const deliveries = state.deliveries.filter((item) => inMonth(item.date)).sort(byDate("date"));
    const receiptDocs = state.receiptDocs.filter((item) => [item.issueDate, item.paymentDate].some(inMonth)).sort(byDate("issueDate"));
    const paymentRequests = (state.paymentRequests || []).filter((item) => [item.requestDate, item.dueDate, item.paidAt].some(inMonth)).sort(byDate("requestDate"));
    const closings = state.closings.filter((item) => item.month === month);
    const paymentRows = paymentMethods.map(([key, label]) => {
      const rows = expenses.filter((item) => item.paymentMethod === key);
      return { key, label, count: rows.length, amount: sum(rows, "amount") };
    });
    const data = { month, expenses, receivedDocs, paymentRequests, sales, invoices, estimates, deliveries, receiptDocs, closings, paymentRows };
    data.issues = monthlyHandoffIssues(data);
    return data;
  }

  function monthlyHandoffIssues(data) {
    const issues = [];
    const missingProof = data.expenses.filter((item) => !item.proof);
    const unconfirmedReceivedDocs = (data.receivedDocs || []).filter((item) => item.status === "未確認");
    const receivedDocsWithoutFile = (data.receivedDocs || []).filter((item) => !item.file);
    const missingRegistration = data.expenses.filter((item) => num(item.amount) >= 10000 && item.invoiceEligible && !isValidRegistration(item.registrationNumber));
    const duplicates = duplicateExpenseGroups(data.expenses);
    const pendingRequests = (data.paymentRequests || []).filter((item) => !["承認済", "支払済"].includes(item.status));
    const overdueRequests = (data.paymentRequests || []).filter((item) => item.dueDate && item.dueDate < TODAY && item.status !== "支払済");
    const midClosed = data.closings.some((item) => item.closeType === "15日前後" && item.status === "完了");
    const monthClosed = data.closings.some((item) => item.closeType === "月末" && item.status === "完了");

    if (!midClosed) issues.push({ severity: "warn", title: "15日前後の締め未完了", body: "中間締めの確認状況を残してください。" });
    if (!monthClosed) issues.push({ severity: "warn", title: "月末締め未完了", body: "月末締めが完了していない月です。" });
    if (missingProof.length) issues.push({ severity: "warn", title: "証憑未添付", body: `${missingProof.length}件あります。画像/PDFを確認してください。` });
    if (unconfirmedReceivedDocs.length) issues.push({ severity: "warn", title: "未確認の受領書類", body: `${unconfirmedReceivedDocs.length}件あります。請求書・領収書の内容確認を残してください。` });
    if (receivedDocsWithoutFile.length) issues.push({ severity: "warn", title: "受領書類ファイル未添付", body: `${receivedDocsWithoutFile.length}件あります。画像/PDFを保管してください。` });
    if (missingRegistration.length) issues.push({ severity: "bad", title: "T番号要確認", body: `${missingRegistration.length}件あります。1万円以上・適格のものは担当税理士に確認が必要。` });
    if (duplicates.length) issues.push({ severity: "warn", title: "経費重複の疑い", body: `${duplicates.length}組あります。同じ日付・取引先・金額を確認してください。` });
    if (pendingRequests.length) issues.push({ severity: "warn", title: "未承認の支払依頼", body: `${pendingRequests.length}件あります。承認または差し戻し状況を確認してください。` });
    if (overdueRequests.length) issues.push({ severity: "bad", title: "支払依頼の期限超過", body: `${overdueRequests.length}件あります。支払済み・期限・承認状態を確認してください。` });

    data.invoices.forEach((invoice) => {
      const sale = findSaleForInvoice(invoice);
      const receiptDoc = data.receiptDocs.find((item) => item.invoiceNo && item.invoiceNo === invoice.invoiceNo);
      if (!invoice.serviceDate) issues.push({ severity: "warn", title: `実施日未入力 ${invoice.invoiceNo}`, body: "決算またぎ判断のため実施日を残してください。" });
      if (invoice.status === "入金済" && !sale) issues.push({ severity: "warn", title: `売上未照合 ${invoice.invoiceNo}`, body: "入金済みですが売上一覧に同じ請求書番号がありません。" });
      if ((invoice.status === "入金済" || sale) && !receiptDoc) issues.push({ severity: "warn", title: `領収書未発行 ${invoice.invoiceNo}`, body: "入金済みですが、相手へ渡す領収書がまだ作成されていません。" });
      if (sale && num(sale.amount) !== num(invoice.amount)) issues.push({ severity: "bad", title: `金額差 ${invoice.invoiceNo}`, body: `請求 ${yen(invoice.amount)} / 売上 ${yen(sale.amount)}。` });
      if (fiscalCrossing(invoice)) issues.push({ severity: "bad", title: `決算またぎ ${invoice.invoiceNo}`, body: "実施日と入金予定/入金日が別年度です。担当税理士に確認が必要。" });
    });

    return issues;
  }

  function monthlyHandoffHtml(data) {
    const expenseTotal = sum(data.expenses, "amount");
    const salesTotal = sum(data.sales, "amount");
    const invoiceTotal = sum(data.invoices, "amount");
    const proofCount = data.expenses.filter((item) => item.proof).length;
    const range = getFiscalRange(selectedFiscalYear);

    return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>月次提出 ${esc(monthLabel(data.month))}</title>
  <style>
    body{font-family:"Yu Gothic",Meiryo,sans-serif;color:#182235;margin:28px;line-height:1.55}
    h1{font-size:24px;margin:0}h2{font-size:17px;margin:26px 0 8px;border-bottom:2px solid #2f5f9f;padding-bottom:4px}
    .muted{color:#637087}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:16px}.card{border:1px solid #d8dee8;background:#f7f9fc;padding:12px}.card strong{display:block;font-size:20px}
    table{width:100%;border-collapse:collapse;margin-top:10px}th,td{border:1px solid #d8dee8;padding:7px;text-align:left;vertical-align:top}th{background:#e8f1fb}.num{text-align:right;white-space:nowrap}
    .bad{color:#b73838;font-weight:700}.warn{color:#b56b00;font-weight:700}.good{color:#217346;font-weight:700}
    .proof-img{max-width:130px;max-height:100px;object-fit:cover;border:1px solid #d8dee8}.missing{color:#b56b00;font-weight:700}
    .issue{padding:8px 10px;border:1px solid #ead8a6;background:#fff8e6;margin:6px 0}.issue.bad{border-color:#efb8b8;background:#fff0f0}
    @media print{body{margin:12mm}.grid{grid-template-columns:repeat(2,1fr)}}
  </style>
</head>
<body>
  <h1>${esc(state.settings.companyName)} 月次提出 ${esc(monthLabel(data.month))}</h1>
  <p class="muted">${selectedFiscalYear}年度 ${formatDate(range.start)} - ${formatDate(range.end)} / 出力日 ${formatDate(TODAY)}</p>
  <div class="grid">
    <div class="card"><span>経費</span><strong>${esc(yen(expenseTotal))}</strong><span>${data.expenses.length}件</span></div>
    <div class="card"><span>証憑添付</span><strong>${proofCount}/${data.expenses.length}</strong><span>${data.expenses.length - proofCount}件未添付</span></div>
    <div class="card"><span>受領書類</span><strong>${(data.receivedDocs || []).length}件</strong><span>${esc(yen(sum(data.receivedDocs || [], "amount")))}</span></div>
    <div class="card"><span>売上入金</span><strong>${esc(yen(salesTotal))}</strong><span>${data.sales.length}件</span></div>
    <div class="card"><span>請求書</span><strong>${esc(yen(invoiceTotal))}</strong><span>${data.invoices.length}件</span></div>
    <div class="card"><span>納品書</span><strong>${data.deliveries.length}件</strong><span>${esc(yen(sum(data.deliveries, "amount")))}</span></div>
    <div class="card"><span>領収書</span><strong>${data.receiptDocs.length}件</strong><span>${esc(yen(sum(data.receiptDocs, "amount")))}</span></div>
    <div class="card"><span>支払依頼</span><strong>${(data.paymentRequests || []).length}件</strong><span>${esc(yen(sum(data.paymentRequests || [], "amount")))}</span></div>
  </div>

  <h2>提出前確認</h2>
  ${data.issues.length ? data.issues.map((issue) => `<div class="issue ${issue.severity === "bad" ? "bad" : ""}"><strong class="${issue.severity === "bad" ? "bad" : "warn"}">${esc(issue.title)}</strong><br>${esc(issue.body)}</div>`).join("") : `<p class="good">この月の大きな未確認はありません。</p>`}

  <h2>支払区分</h2>
  <table><thead><tr><th>区分</th><th class="num">件数</th><th class="num">金額</th></tr></thead><tbody>
    ${data.paymentRows.map((row) => `<tr><td>${esc(row.label)}</td><td class="num">${row.count}</td><td class="num">${esc(yen(row.amount))}</td></tr>`).join("")}
  </tbody></table>

  <h2>支払依頼・承認</h2>
  ${(data.paymentRequests || []).length ? `<table><thead><tr><th>申請番号</th><th>申請日</th><th>支払期限</th><th>支払先</th><th>内容</th><th>状態</th><th class="num">金額</th></tr></thead><tbody>${data.paymentRequests.map((item) => `<tr><td>${esc(item.requestNo || "")}</td><td>${esc(formatDate(item.requestDate))}</td><td>${esc(formatDate(item.dueDate))}</td><td>${esc(item.vendor || "")}</td><td>${esc(item.content || "")}</td><td>${esc(item.status || "")}</td><td class="num">${esc(yen(item.amount))}</td></tr>`).join("")}</tbody></table>` : `<p class="muted">この月の支払依頼はありません。</p>`}

  <h2>受領書類</h2>
  ${(data.receivedDocs || []).length ? `<table><thead><tr><th>受領日</th><th>種別</th><th>発行元</th><th>件名</th><th>状態</th><th>支払依頼</th><th class="num">金額</th></tr></thead><tbody>${data.receivedDocs.map((item) => `<tr><td>${esc(formatDate(item.receivedDate))}</td><td>${esc(item.documentType || "")}</td><td>${esc(item.vendor || "")}</td><td>${esc(item.title || "")}</td><td>${esc(item.status || "")}</td><td>${esc(item.paymentRequestNo || "")}</td><td class="num">${esc(yen(item.amount))}</td></tr>`).join("")}</tbody></table>` : `<p class="muted">この月の受領書類はありません。</p>`}

  <h2>経費・証憑</h2>
  ${data.expenses.length ? `<table><thead><tr><th>日付</th><th>支払</th><th>取引先/品名</th><th>科目</th><th class="num">金額</th><th>T番号</th><th>証憑</th></tr></thead><tbody>${data.expenses.map((item) => `
    <tr>
      <td>${esc(formatDate(item.date))}</td><td>${esc(paymentLabel(item.paymentMethod))}</td><td>${esc([item.vendor, item.itemName].filter(Boolean).join(" / "))}</td>
      <td>${esc(item.category || "")}</td><td class="num">${esc(yen(item.amount))}</td><td>${esc(item.registrationNumber || "")}</td><td>${handoffProofCell(item)}</td>
    </tr>`).join("")}</tbody></table>` : `<p class="muted">この月の経費はありません。</p>`}

  <h2>売上入金</h2>
  ${data.sales.length ? `<table><thead><tr><th>入金日</th><th>取引先</th><th>内容</th><th>請求書番号</th><th class="num">金額</th></tr></thead><tbody>${data.sales.map((item) => `<tr><td>${esc(formatDate(item.date))}</td><td>${esc(item.customer || "")}</td><td>${esc(item.content || "")}</td><td>${esc(item.invoiceNo || "")}</td><td class="num">${esc(yen(item.amount))}</td></tr>`).join("")}</tbody></table>` : `<p class="muted">この月の売上入金はありません。</p>`}

  <h2>請求書・見積</h2>
  ${data.invoices.length ? `<table><thead><tr><th>番号</th><th>請求日</th><th>実施日</th><th>請求先</th><th>状態</th><th class="num">金額</th></tr></thead><tbody>${data.invoices.map((item) => `<tr><td>${esc(item.invoiceNo || "")}</td><td>${esc(formatDate(item.issueDate))}</td><td>${esc(formatDate(item.serviceDate))}</td><td>${esc(item.customer || "")}</td><td>${esc(item.status || "")}</td><td class="num">${esc(yen(item.amount))}</td></tr>`).join("")}</tbody></table>` : `<p class="muted">この月に関係する請求書はありません。</p>`}
  ${data.estimates.length ? `<table><thead><tr><th>見積番号</th><th>見積日</th><th>提出先</th><th>状態</th><th>請求書番号</th><th class="num">金額</th></tr></thead><tbody>${data.estimates.map((item) => `<tr><td>${esc(item.estimateNo || "")}</td><td>${esc(formatDate(item.date))}</td><td>${esc(item.customer || "")}</td><td>${esc(item.status || "")}</td><td>${esc(item.linkedInvoiceNo || "")}</td><td class="num">${esc(yen(item.amount))}</td></tr>`).join("")}</tbody></table>` : ""}

  <h2>納品書・領収書</h2>
  ${data.deliveries.length ? `<table><thead><tr><th>納品書番号</th><th>納品日</th><th>取引先</th><th>件名</th><th>請求書番号</th><th class="num">金額</th></tr></thead><tbody>${data.deliveries.map((item) => `<tr><td>${esc(item.deliveryNo || "")}</td><td>${esc(formatDate(item.date))}</td><td>${esc(item.customer || "")}</td><td>${esc(item.subject || item.itemName || "")}</td><td>${esc(item.linkedInvoiceNo || "")}</td><td class="num">${esc(yen(item.amount))}</td></tr>`).join("")}</tbody></table>` : `<p class="muted">この月の納品書はありません。</p>`}
  ${data.receiptDocs.length ? `<table><thead><tr><th>領収書番号</th><th>発行日</th><th>入金日</th><th>取引先</th><th>請求書番号</th><th class="num">金額</th></tr></thead><tbody>${data.receiptDocs.map((item) => `<tr><td>${esc(item.receiptNo || "")}</td><td>${esc(formatDate(item.issueDate))}</td><td>${esc(formatDate(item.paymentDate))}</td><td>${esc(item.customer || "")}</td><td>${esc(item.invoiceNo || "")}</td><td class="num">${esc(yen(item.amount))}</td></tr>`).join("")}</tbody></table>` : `<p class="muted">この月の領収書はありません。</p>`}

  <h2>締め状況</h2>
  ${data.closings.length ? `<table><thead><tr><th>締め</th><th>状態</th><th>メモ</th><th>登録日時</th></tr></thead><tbody>${data.closings.map((item) => `<tr><td>${esc(item.closeType)}</td><td>${esc(item.status)}</td><td>${esc(item.note || "")}</td><td>${esc(formatDateTime(item.createdAt))}</td></tr>`).join("")}</tbody></table>` : `<p class="warn">この月の締め登録はありません。</p>`}
  <p class="muted">このHTMLは月次確認用です。決算またぎ、売上計上日、T番号、インボイス適格性は担当税理士に確認してください。</p>
</body>
</html>`;
  }

  function handoffProofCell(item) {
    const proof = item.proof;
    if (!proof) return `<span class="missing">未添付</span>`;
    if (proof.type && proof.type.startsWith("image/")) {
      return `<img class="proof-img" src="${esc(proof.dataUrl)}" alt="${esc(proof.name || "証憑")}">`;
    }
    if (proof.dataUrl) {
      return `<a href="${esc(proof.dataUrl)}" download="${esc(proof.name || "proof")}">${esc(proof.name || "添付ファイル")}</a>`;
    }
    return esc(proof.name || "添付ファイル");
  }

  function exportInvoiceDocument(invoice) {
    const html = businessDocumentHtml("invoice", invoice);
    addAudit("請求書HTML発行", { id: invoice.id, invoiceNo: invoice.invoiceNo });
    persist("請求書発行");
    downloadBlob(`請求書-${safeFilePart(invoice.invoiceNo || invoice.id)}-${TODAY}.html`, new Blob([html], { type: "text/html;charset=utf-8" }));
  }

  function exportEstimateDocument(estimate) {
    const html = businessDocumentHtml("estimate", estimate);
    addAudit("見積書HTML発行", { id: estimate.id, estimateNo: estimate.estimateNo });
    persist("見積書発行");
    downloadBlob(`見積書-${safeFilePart(estimate.estimateNo || estimate.id)}-${TODAY}.html`, new Blob([html], { type: "text/html;charset=utf-8" }));
  }

  function exportDeliveryDocument(delivery) {
    const html = businessDocumentHtml("delivery", delivery);
    addAudit("納品書HTML発行", { id: delivery.id, deliveryNo: delivery.deliveryNo });
    persist("納品書発行");
    downloadBlob(`納品書-${safeFilePart(delivery.deliveryNo || delivery.id)}-${TODAY}.html`, new Blob([html], { type: "text/html;charset=utf-8" }));
  }

  function exportReceiptDocDocument(receiptDoc) {
    const html = businessDocumentHtml("receipt", receiptDoc);
    addAudit("領収書HTML発行", { id: receiptDoc.id, receiptNo: receiptDoc.receiptNo });
    persist("領収書発行");
    downloadBlob(`領収書-${safeFilePart(receiptDoc.receiptNo || receiptDoc.id)}-${TODAY}.html`, new Blob([html], { type: "text/html;charset=utf-8" }));
  }

  function renderAfterDocumentConversion(fallbackRender) {
    if (activeView === "salesFlow") {
      renderSalesFlow();
    } else {
      fallbackRender();
    }
  }

  function createSaleFromInvoice(invoice) {
    const paymentDate = invoice.paymentDate || invoice.expectedPaymentDate || TODAY;
    if (isMonthLocked(paymentDate.slice(0, 7))) {
      alert("入金月が月末締め完了済みのため、売上化できません。締め状態を確認してください。");
      return;
    }
    const sale = {
      id: uid("sale"),
      date: paymentDate,
      customer: invoice.customer,
      content: invoice.content,
      classification: invoice.classification,
      department: invoice.department || departments()[0],
      amount: invoice.amount,
      invoiceNo: invoice.invoiceNo,
      bankAccount: state.settings.bankAccount || "道銀",
      note: "請求書から売上登録",
      createdAt: new Date().toISOString()
    };
    state.sales.push(sale);
    invoice.status = "入金済";
    invoice.paymentDate = paymentDate;
    addAudit("請求書売上化", sale);
    persist("売上化");
    renderAfterDocumentConversion(renderInvoices);
  }

  function createDeliveryFromEstimate(estimate) {
    if (estimate.linkedDeliveryNo) {
      alert("この見積にはすでに納品書番号が紐づいています。");
      return;
    }
    if (isMonthLocked(recordMonth("estimates", estimate))) {
      alert("この見積月は月末締めが完了しているため、納品書化できません。締め状態を確認してください。");
      return;
    }
    if (isLockedDate(TODAY, "納品書化")) return;
    const now = new Date().toISOString();
    const deliveryNo = nextDeliveryNo();
    const lines = cloneDocumentLines(estimate);
    const delivery = deliveryRecordFromData({
      deliveryNo,
      date: TODAY,
      customer: estimate.customer,
      subject: estimate.content,
      itemName: estimate.content,
      quantity: 1,
      unit: "式",
      unitPrice: estimate.amount,
      amount: estimate.amount,
      taxRate: "10%",
      lines,
      template: estimate.template || "標準",
      sendStatus: "未送付",
      linkedEstimateNo: estimate.estimateNo,
      linkedInvoiceNo: estimate.linkedInvoiceNo,
      note: [`見積 ${estimate.estimateNo || ""} から作成`, estimate.note].filter(Boolean).join(" / ")
    });
    delivery.createdAt = now;
    state.deliveries.push(delivery);
    estimate.linkedDeliveryNo = deliveryNo;
    estimate.status = "受注";
    estimate.updatedAt = now;
    addAudit("見積から納品書化", { estimateNo: estimate.estimateNo, deliveryNo });
    persist("納品書化");
    alert(`納品書 ${deliveryNo} を作成しました。`);
    renderAfterDocumentConversion(renderEstimates);
  }

  function createInvoiceFromEstimate(estimate) {
    if (estimate.linkedInvoiceNo) {
      alert("この見積にはすでに請求書番号が紐づいています。");
      return;
    }
    if (isMonthLocked(recordMonth("estimates", estimate))) {
      alert("この見積月は月末締めが完了しているため、請求書化できません。締め状態を確認してください。");
      return;
    }
    if (isLockedDate(TODAY, "請求書化")) return;
    const now = new Date().toISOString();
    const invoiceNo = nextInvoiceNo();
    const lines = cloneDocumentLines(estimate);
    const invoice = {
      id: uid("inv"),
      invoiceNo,
      issueDate: TODAY,
      serviceDate: estimate.date || TODAY,
      dueDate: endOfNextMonth(TODAY),
      expectedPaymentDate: endOfNextMonth(TODAY),
      paymentDate: "",
      customer: estimate.customer,
      content: estimate.content,
      classification: estimate.classification,
      department: estimate.department || departments()[0],
      amount: documentAmountFromLines(lines, estimate.amount),
      taxRate: "10%",
      lines,
      status: "未入金",
      template: estimate.template || "標準",
      sendStatus: "未送付",
      sendDate: "",
      linkedEstimateNo: estimate.estimateNo,
      linkedDeliveryNo: estimate.linkedDeliveryNo || "",
      note: [`見積 ${estimate.estimateNo || ""} から作成`, estimate.note].filter(Boolean).join(" / "),
      createdAt: now
    };
    state.invoices.push(invoice);
    estimate.linkedInvoiceNo = invoiceNo;
    estimate.status = "受注";
    estimate.updatedAt = now;
    addAudit("見積から請求書化", { estimateNo: estimate.estimateNo, invoiceNo });
    persist("請求書化");
    alert(`請求書 ${invoiceNo} を作成しました。`);
    renderAfterDocumentConversion(renderEstimates);
  }

  function createInvoiceFromDelivery(delivery) {
    if (delivery.linkedInvoiceNo) {
      alert("この納品書にはすでに請求書番号が紐づいています。");
      return;
    }
    if (isMonthLocked(recordMonth("deliveries", delivery))) {
      alert("この納品月は月末締めが完了しているため、請求書化できません。締め状態を確認してください。");
      return;
    }
    if (isLockedDate(TODAY, "請求書化")) return;
    const now = new Date().toISOString();
    const invoiceNo = nextInvoiceNo();
    const lines = cloneDocumentLines(delivery);
    const invoice = {
      id: uid("inv"),
      invoiceNo,
      issueDate: TODAY,
      serviceDate: delivery.date || TODAY,
      dueDate: endOfNextMonth(TODAY),
      expectedPaymentDate: endOfNextMonth(TODAY),
      paymentDate: "",
      customer: delivery.customer,
      content: delivery.subject || delivery.itemName,
      classification: "業務委託",
      department: departments()[0],
      amount: documentAmountFromLines(lines, delivery.amount),
      taxRate: delivery.taxRate || "10%",
      lines,
      status: "未入金",
      template: delivery.template || "標準",
      sendStatus: "未送付",
      sendDate: "",
      linkedEstimateNo: delivery.linkedEstimateNo || "",
      linkedDeliveryNo: delivery.deliveryNo,
      note: [`納品書 ${delivery.deliveryNo || ""} から作成`, delivery.note].filter(Boolean).join(" / "),
      createdAt: now
    };
    state.invoices.push(invoice);
    delivery.linkedInvoiceNo = invoiceNo;
    delivery.updatedAt = now;
    const estimate = state.estimates.find((item) => item.estimateNo && item.estimateNo === delivery.linkedEstimateNo);
    if (estimate) {
      estimate.linkedInvoiceNo = invoiceNo;
      estimate.updatedAt = now;
    }
    addAudit("納品書から請求書化", { deliveryNo: delivery.deliveryNo, invoiceNo });
    persist("請求書化");
    alert(`請求書 ${invoiceNo} を作成しました。`);
    renderAfterDocumentConversion(renderDeliveries);
  }

  function createReceiptFromInvoice(invoice) {
    if (receiptExistsForInvoice(invoice.invoiceNo)) {
      alert("この請求書番号の領収書はすでに作成されています。");
      return;
    }
    const receiptDate = invoice.paymentDate || invoice.expectedPaymentDate || TODAY;
    if (isLockedDate(receiptDate, "領収書化") || isLockedDate(TODAY, "領収書化")) return;
    const now = new Date().toISOString();
    const receiptNo = nextReceiptNo();
    const lines = cloneDocumentLines(invoice);
    const receiptDoc = receiptDocRecordFromData({
      receiptNo,
      issueDate: TODAY,
      paymentDate: receiptDate,
      customer: invoice.customer,
      invoiceNo: invoice.invoiceNo,
      content: invoice.content || "お品代",
      amount: invoice.amount,
      lines,
      taxRate: invoice.taxRate || "10%",
      template: invoice.template || "標準",
      sendStatus: "未送付",
      note: [`請求書 ${invoice.invoiceNo || ""} から作成`, invoice.note].filter(Boolean).join(" / ")
    });
    receiptDoc.createdAt = now;
    state.receiptDocs.push(receiptDoc);
    invoice.linkedReceiptNo = receiptNo;
    invoice.updatedAt = now;
    addAudit("請求書から領収書化", { invoiceNo: invoice.invoiceNo, receiptNo });
    persist("領収書化");
    alert(`領収書 ${receiptNo} を作成しました。`);
    renderAfterDocumentConversion(renderInvoices);
  }

  function businessDocumentHtml(type, record) {
    const meta = documentMeta(type, record);
    const brand = documentBrand(record.template);
    const accent = brand.accent;
    const amountBg = brand.template === "控えめ" ? "#f2f7f4" : brand.template === "フォーマル" ? "#eef2f8" : "#eef5ff";
    const sheetPadding = brand.template === "控えめ" ? "36px" : "44px";

    return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>${esc(meta.title)} ${esc(meta.number || "")}</title>
  <style>
    body{font-family:"Yu Gothic",Meiryo,sans-serif;background:#f3f6fa;color:#182235;margin:0;line-height:1.65}
    .sheet{max-width:860px;margin:24px auto;background:#fff;padding:${sheetPadding};border:1px solid #d7deea}
    .top{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid ${accent};padding-bottom:18px}
    h1{font-size:32px;margin:0;letter-spacing:0}.number{font-size:14px;color:#637087;margin-top:8px}
    .company{text-align:right}.company strong{font-size:18px}.muted{color:#637087}.partner{font-size:20px;margin:26px 0 18px}
    .brand-head{display:flex;justify-content:flex-end;align-items:center;gap:12px}.brand-text{min-width:170px}
    .logo-mark{display:inline-grid;place-items:center;min-width:44px;height:44px;border-radius:6px;background:${accent};color:#fff;font-weight:800;padding:0 8px}
    .seal{display:inline-grid;place-items:center;width:58px;height:58px;border:2px solid ${accent};border-radius:50%;color:${accent};font-weight:800;font-size:13px;line-height:1.1}
    .template-label{font-size:12px;color:${accent};font-weight:700}
    table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #d8dee8;padding:10px 12px;text-align:left;vertical-align:top}th{width:210px;background:#e8f1fb}
    .lines th{width:auto}.lines td.num,.lines th.num{text-align:right;white-space:nowrap}.totals{max-width:420px;margin-left:auto}.totals th{width:auto}
    .amount{margin:28px 0;padding:18px 22px;background:${amountBg};border-left:5px solid ${accent};display:flex;justify-content:space-between;align-items:baseline}
    .amount span{font-size:15px}.amount strong{font-size:30px}.note{margin-top:22px;padding:14px;background:#fff8e6;border:1px solid #ead8a6}
    .doc-footer{margin-top:22px;border-top:1px solid #d8dee8;padding-top:12px;color:#637087;font-size:12px}
    .actions{margin-top:22px}.button{border:1px solid ${accent};background:${accent};color:#fff;border-radius:4px;padding:9px 16px;cursor:pointer}
    @media print{body{background:#fff}.sheet{margin:0;border:0}.actions{display:none}}
  </style>
</head>
<body>
  <main class="sheet">
    <div class="top">
      <div>
        <h1>${esc(meta.title)}</h1>
        <div class="number">${esc(meta.number || "")}</div>
      </div>
      <div class="company">
        <div class="brand-head">
          <span class="logo-mark">${esc(brand.logoText)}</span>
          <div class="brand-text">
            <strong>${esc(state.settings.companyName || "CDP北海道")}</strong><br>
            <span class="muted">出力日 ${esc(formatDate(TODAY))}</span><br>
            <span class="template-label">${esc(brand.template)}</span>
          </div>
          <span class="seal">${esc(brand.sealText)}</span>
        </div>
      </div>
    </div>
    <div class="partner">${esc(meta.partner || meta.partnerLabel)}</div>
    <div class="amount"><span>${esc(meta.amountLabel)}</span><strong>${esc(yen(meta.financial.total))}</strong></div>
    ${documentLinesTable(meta.lines, meta.financial)}
    <table><tbody>${meta.rows.map(([label, value]) => `<tr><th>${esc(label)}</th><td>${esc(value || "")}</td></tr>`).join("")}</tbody></table>
    <div class="note">
      ${esc(meta.note)}
    </div>
    <div class="doc-footer">${esc(brand.footerNote)}</div>
    <div class="actions"><button class="button" onclick="window.print()">印刷</button></div>
  </main>
</body>
</html>`;
  }

  function documentMeta(type, record) {
    const title = documentTypeLabel(type);
    const number = documentNumber(type, record);
    const partnerLabel = type === "estimate" ? "提出先" : "取引先";
    const partner = partnerDisplay(record.customer);
    const lines = normalizedDocumentLines(record);
    const financial = documentFinancials(lines, record.amount);
    const rows = documentRows(type, record, lines, financial);
    const notes = {
      estimate: "見積書は記録として保存し、受注後は納品書化または請求書化できます。金額や条件に変更がある場合は変換前に編集してください。",
      delivery: "納品書は見積・請求書とのつながりを残します。請求書化後も納品日と内容を確認できるよう保存してください。",
      invoice: "請求日、実施日、支払期限、入金予定日、入金日を会計判断用に残しています。決算またぎや売上計上日は担当税理士に確認してください。",
      receipt: "領収書は入金後に相手へ渡す控えです。請求書番号と入金日を残し、売上とのずれを確認してください。"
    };
    return {
      title,
      number,
      partnerLabel,
      partner: partner || `${partnerLabel} 御中`,
      amountLabel: type === "receipt" ? "領収金額" : `${title}金額`,
      lines,
      financial,
      rows,
      note: notes[type] || "帳票として保存します。"
    };
  }

  function documentRows(type, record, lines = normalizedDocumentLines(record), financial = documentFinancials(lines, record.amount)) {
    const lineSummary = documentLinesSummary(lines);
    const taxSummary = taxBreakdownText(financial.taxBreakdown);
    if (type === "invoice") {
      return [
        ["請求書番号", record.invoiceNo],
        ["請求日", formatDate(record.issueDate)],
        ["実施日", formatDate(record.serviceDate)],
        ["支払期限", formatDate(record.dueDate)],
        ["入金予定日", formatDate(record.expectedPaymentDate)],
        ["入金日", formatDate(record.paymentDate)],
        ["請求先", record.customer],
        ["内容", record.content],
        ["明細", lineSummary],
        ["分類", record.classification],
        ["部門", record.department],
        ["税区分", record.taxRate || "未設定"],
        ["税率別内訳", taxSummary],
        ["状態", record.status],
        ["送付状態", record.sendStatus],
        ["送付日", formatDate(record.sendDate)],
        ["関連見積番号", record.linkedEstimateNo],
        ["関連納品書番号", record.linkedDeliveryNo],
        ["関連領収書番号", record.linkedReceiptNo],
        ["振込先", state.settings.bankAccount || "道銀"],
        ["税理士確認メモ", record.note]
      ];
    }
    if (type === "delivery") {
      return [
        ["納品書番号", record.deliveryNo],
        ["納品日", formatDate(record.date)],
        ["取引先", record.customer],
        ["件名", record.subject],
        ["明細", lineSummary],
        ["税区分", record.taxRate],
        ["税率別内訳", taxSummary],
        ["送付状態", record.sendStatus],
        ["送付日", formatDate(record.sendDate)],
        ["関連見積番号", record.linkedEstimateNo],
        ["関連請求書番号", record.linkedInvoiceNo],
        ["備考", record.note]
      ];
    }
    if (type === "receipt") {
      return [
        ["領収書番号", record.receiptNo],
        ["発行日", formatDate(record.issueDate)],
        ["入金日", formatDate(record.paymentDate)],
        ["取引先", record.customer],
        ["請求書番号", record.invoiceNo],
        ["但し書き・内容", record.content],
        ["明細", lineSummary],
        ["税区分", record.taxRate],
        ["税率別内訳", taxSummary],
        ["送付状態", record.sendStatus],
        ["送付日", formatDate(record.sendDate)],
        ["備考", record.note]
      ];
    }
    return [
      ["見積番号", record.estimateNo],
      ["見積日", formatDate(record.date)],
      ["提出先", record.customer],
      ["内容", record.content],
      ["明細", lineSummary],
      ["分類", record.classification],
      ["部門", record.department],
      ["税率別内訳", taxSummary],
      ["状態", record.status],
      ["送付状態", record.sendStatus],
      ["送付日", formatDate(record.sendDate)],
      ["関連納品書番号", record.linkedDeliveryNo],
      ["関連請求書番号", record.linkedInvoiceNo],
      ["メモ", record.note]
    ];
  }

  function businessDocumentPreviewHtml(type, record) {
    const meta = documentMeta(type, record);
    const brand = documentBrand(record.template);
    return `
      <div class="preview-sheet" style="--doc-accent:${esc(brand.accent)};">
        <div class="preview-top">
          <div>
            <strong>${esc(meta.title)}</strong>
            <span>${esc(meta.number || "")}</span>
          </div>
          <div class="preview-brand">
            <span class="preview-logo">${esc(brand.logoText)}</span>
            <span class="preview-seal">${esc(brand.sealText)}</span>
          </div>
        </div>
        <div class="preview-partner">${esc(meta.partner || meta.partnerLabel)}</div>
        <div class="preview-amount"><span>${esc(meta.amountLabel)}</span><strong>${esc(yen(meta.financial.total))}</strong></div>
        ${documentLinesPreview(meta.lines)}
        <dl class="preview-list">
          ${meta.rows.slice(0, 8).map(([label, value]) => `<dt>${esc(label)}</dt><dd>${esc(value || "")}</dd>`).join("")}
        </dl>
        <div class="preview-footer">${esc(brand.footerNote)}</div>
      </div>
    `;
  }

  function bindDocumentPreview(formId, previewId, type) {
    const form = document.getElementById(formId);
    const preview = document.getElementById(previewId);
    if (!form || !preview) return;
    const update = () => {
      const data = formValues(form);
      const record = documentRecordFromData(type, data, false);
      preview.innerHTML = businessDocumentPreviewHtml(type, record);
    };
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    update();
  }

  function documentLinesEditor(lines = []) {
    const rows = Array.from({ length: Math.max(3, lines.length + 1) }, (_, index) => {
      const line = lines[index] || {};
      const initialAmount = line.itemName || line.amount ? yen(lineLineAmount(line)) : "";
      return `
        <div class="line-row">
          <span class="line-no">${index + 1}</span>
          <input name="lineItemName${index}" type="text" list="itemNameList" value="${esc(line.itemName || "")}" placeholder="品目">
          <input name="lineQuantity${index}" type="number" value="${esc(line.quantity || "")}" placeholder="数量">
          <input name="lineUnit${index}" type="text" value="${esc(line.unit || "")}" placeholder="単位">
          <input name="lineUnitPrice${index}" type="number" value="${esc(line.unitPrice || "")}" placeholder="単価">
          <select name="lineTaxRate${index}">${taxRates.map((rate) => `<option value="${esc(rate)}" ${String(rate) === String(line.taxRate || "10%") ? "selected" : ""}>${esc(rate)}</option>`).join("")}</select>
          <output>${esc(initialAmount)}</output>
        </div>
      `;
    }).join("");
    return `
      <section class="line-editor" data-line-editor style="grid-column:1 / -1;">
        <div class="line-editor-head">
          <strong>明細</strong>
          <span>品目マスタ名を入れると単価・単位・税率を補完します</span>
        </div>
        <div class="line-row line-header">
          <span>No.</span><span>品目</span><span>数量</span><span>単位</span><span>単価</span><span>税率</span><span>金額</span>
        </div>
        ${rows}
      </section>
    `;
  }

  function bindLineEditor(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    const update = (event) => {
      if (event && /^lineItemName\d+$/.test(event.target.name || "")) {
        const index = event.target.name.replace("lineItemName", "");
        const master = itemByName(event.target.value);
        if (master) {
          const unitPrice = form.querySelector(`[name="lineUnitPrice${index}"]`);
          const unit = form.querySelector(`[name="lineUnit${index}"]`);
          const taxRate = form.querySelector(`[name="lineTaxRate${index}"]`);
          if (unitPrice && !unitPrice.value) unitPrice.value = master.unitPrice || "";
          if (unit && !unit.value) unit.value = master.unit || "式";
          if (taxRate) taxRate.value = master.taxRate || "10%";
        }
      }
      const lines = documentLinesFromData(formValues(form));
      form.querySelectorAll(".line-row:not(.line-header)").forEach((row, index) => {
        const line = lineFromData(formValues(form), index);
        const output = row.querySelector("output");
        if (output) output.textContent = line.itemName ? yen(lineLineAmount(line)) : "";
      });
      const amount = form.querySelector("[name='amount']");
      if (amount && lines.length) amount.value = String(documentAmountFromLines(lines, amount.value));
      const content = form.querySelector("[name='content']");
      if (content && !content.value && lines.length) content.value = documentLinesSummary(lines);
      const subject = form.querySelector("[name='subject']");
      if (subject && !subject.value && lines.length) subject.value = documentLinesSummary(lines);
    };
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    update();
  }

  function documentLinesFromData(data, fallback) {
    const lines = [];
    for (let index = 0; index < 12; index += 1) {
      const line = lineFromData(data, index);
      if (line.itemName || line.quantity || line.unitPrice || line.amount) lines.push(line);
    }
    if (!lines.length && fallback) {
      const fallbackLine = normalizeLine(fallback);
      if (fallbackLine.itemName || fallbackLine.amount) lines.push(fallbackLine);
    }
    return lines;
  }

  function lineFromData(data, index) {
    const itemName = clean(data[`lineItemName${index}`]);
    const master = itemByName(itemName);
    const quantity = num(data[`lineQuantity${index}`]) || (itemName ? 1 : 0);
    const unitPrice = num(data[`lineUnitPrice${index}`]) || num(master && master.unitPrice);
    const amount = quantity && unitPrice ? Math.round(quantity * unitPrice) : 0;
    return normalizeLine({
      itemName,
      quantity,
      unit: data[`lineUnit${index}`] || (master && master.unit) || "式",
      unitPrice,
      amount,
      taxRate: data[`lineTaxRate${index}`] || (master && master.taxRate) || "10%"
    });
  }

  function normalizeLine(line) {
    const quantity = num(line && line.quantity) || (line && (line.itemName || line.amount) ? 1 : 0);
    const unitPrice = num(line && line.unitPrice) || num(line && line.amount);
    const amount = num(line && line.amount) || Math.round(quantity * unitPrice);
    return {
      itemName: clean(line && line.itemName),
      quantity,
      unit: clean(line && line.unit) || "式",
      unitPrice,
      amount,
      taxRate: clean(line && line.taxRate) || "10%"
    };
  }

  function normalizedDocumentLines(record) {
    const direct = cloneDocumentLines(record);
    if (direct.length) return direct;
    return documentLinesFromData({}, {
      itemName: record.content || record.itemName || record.subject,
      quantity: record.quantity || 1,
      unit: record.unit || "式",
      unitPrice: record.unitPrice || record.amount,
      amount: record.amount,
      taxRate: record.taxRate || "10%"
    });
  }

  function cloneDocumentLines(record) {
    return Array.isArray(record && record.lines) ? record.lines.map(normalizeLine).filter((line) => line.itemName || line.amount) : [];
  }

  function documentAmountFromLines(lines, fallback) {
    const total = (lines || []).reduce((acc, line) => acc + lineLineAmount(line), 0);
    return total || num(fallback);
  }

  function lineLineAmount(line) {
    return num(line && line.amount) || Math.round((num(line && line.quantity) || 0) * num(line && line.unitPrice));
  }

  function taxRateNumber(rate) {
    const match = String(rate || "").match(/(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : 0;
  }

  function includedTax(amount, rate) {
    const percent = taxRateNumber(rate);
    return percent ? Math.round(num(amount) * percent / (100 + percent)) : 0;
  }

  function documentFinancials(lines, fallbackAmount) {
    const normalized = lines && lines.length ? lines : [{ amount: num(fallbackAmount), taxRate: "10%" }];
    const total = documentAmountFromLines(normalized, fallbackAmount);
    const taxBreakdown = normalized.reduce((acc, line) => {
      const rate = line.taxRate || "不明";
      const amount = lineLineAmount(line);
      acc[rate] = acc[rate] || { rate, amount: 0, tax: 0 };
      acc[rate].amount += amount;
      acc[rate].tax += includedTax(amount, rate);
      return acc;
    }, {});
    const tax = Object.values(taxBreakdown).reduce((acc, row) => acc + row.tax, 0);
    return { total, tax, subtotal: total - tax, taxBreakdown: Object.values(taxBreakdown) };
  }

  function documentLinesSummary(lines) {
    return (lines || []).map((line) => clean(line.itemName)).filter(Boolean).join("、");
  }

  function taxBreakdownText(rows) {
    return (rows || []).map((row) => `${row.rate}: ${yen(row.amount)}（内税 ${yen(row.tax)}）`).join(" / ");
  }

  function documentLinesTable(lines, financial) {
    if (!lines.length) return "";
    return `
      <table class="lines">
        <thead><tr><th>品目</th><th class="num">数量</th><th>単位</th><th class="num">単価</th><th>税率</th><th class="num">金額</th></tr></thead>
        <tbody>${lines.map((line) => `<tr><td>${esc(line.itemName || "")}</td><td class="num">${esc(line.quantity || "")}</td><td>${esc(line.unit || "")}</td><td class="num">${esc(yen(line.unitPrice))}</td><td>${esc(line.taxRate || "")}</td><td class="num">${esc(yen(lineLineAmount(line)))}</td></tr>`).join("")}</tbody>
      </table>
      <table class="totals"><tbody>
        <tr><th>小計</th><td class="num">${esc(yen(financial.subtotal))}</td></tr>
        <tr><th>消費税内訳</th><td class="num">${esc(yen(financial.tax))}</td></tr>
        <tr><th>合計</th><td class="num">${esc(yen(financial.total))}</td></tr>
      </tbody></table>
    `;
  }

  function documentLinesPreview(lines) {
    if (!lines.length) return "";
    return `
      <div class="preview-lines">
        ${lines.slice(0, 4).map((line) => `<div><span>${esc(line.itemName || "")}</span><strong>${esc(yen(lineLineAmount(line)))}</strong></div>`).join("")}
      </div>
    `;
  }

  function documentRecordFromData(type, data, withId = true) {
    if (type === "invoice") return invoiceRecordFromData(data, withId);
    if (type === "estimate") return estimateRecordFromData(data, withId);
    if (type === "delivery") return deliveryRecordFromData(data, withId);
    return receiptDocRecordFromData(data, withId);
  }

  function invoiceRecordFromData(data, withId = true) {
    const lines = cloneDocumentLines(data).length ? cloneDocumentLines(data) : documentLinesFromData(data, { itemName: data.content, quantity: 1, unit: "式", unitPrice: data.amount, amount: data.amount, taxRate: data.taxRate });
    return {
      ...(withId ? { id: uid("inv") } : {}),
      invoiceNo: data.invoiceNo || nextInvoiceNo(),
      issueDate: data.issueDate || TODAY,
      serviceDate: data.serviceDate || data.issueDate || TODAY,
      dueDate: data.dueDate,
      expectedPaymentDate: data.expectedPaymentDate,
      paymentDate: data.paymentDate,
      customer: data.customer,
      content: data.content,
      classification: data.classification,
      department: data.department || departments()[0],
      amount: documentAmountFromLines(lines, data.amount),
      taxRate: data.taxRate || "10%",
      lines,
      status: data.paymentDate ? "入金済" : data.status || "未入金",
      template: data.template || defaultDocumentTemplate(),
      sendStatus: data.sendStatus || "未送付",
      sendDate: data.sendDate,
      linkedEstimateNo: data.linkedEstimateNo,
      linkedDeliveryNo: data.linkedDeliveryNo,
      linkedReceiptNo: data.linkedReceiptNo,
      note: data.note,
      createdAt: new Date().toISOString()
    };
  }

  function estimateRecordFromData(data, withId = true) {
    const lines = cloneDocumentLines(data).length ? cloneDocumentLines(data) : documentLinesFromData(data, { itemName: data.content, quantity: 1, unit: "式", unitPrice: data.amount, amount: data.amount, taxRate: data.taxRate || "10%" });
    return {
      ...(withId ? { id: uid("est") } : {}),
      estimateNo: data.estimateNo || nextEstimateNo(),
      date: data.date || TODAY,
      customer: data.customer,
      classification: data.classification,
      department: data.department || departments()[0],
      content: data.content,
      amount: documentAmountFromLines(lines, data.amount),
      taxRate: data.taxRate || "10%",
      lines,
      status: data.status,
      linkedDeliveryNo: data.linkedDeliveryNo,
      linkedInvoiceNo: data.linkedInvoiceNo,
      template: data.template || defaultDocumentTemplate(),
      sendStatus: data.sendStatus || "未送付",
      sendDate: data.sendDate,
      note: data.note,
      createdAt: new Date().toISOString()
    };
  }

  function deliveryRecordFromData(data, withId = true) {
    const master = itemByName(data.itemName || data.subject || data.content);
    const lines = cloneDocumentLines(data).length ? cloneDocumentLines(data) : documentLinesFromData(data, { itemName: data.itemName || data.content || data.subject, quantity: data.quantity, unit: data.unit, unitPrice: data.unitPrice || data.amount, amount: data.amount, taxRate: data.taxRate });
    const quantity = num(data.quantity) || 1;
    const unitPrice = num(data.unitPrice) || num(master && master.unitPrice);
    const amount = documentAmountFromLines(lines, num(data.amount) || Math.round(quantity * unitPrice));
    return {
      ...(withId ? { id: uid("del") } : {}),
      deliveryNo: data.deliveryNo || nextDeliveryNo(),
      date: data.date || TODAY,
      customer: data.customer,
      subject: data.subject || data.content || data.itemName,
      itemName: data.itemName || data.content || (master && master.itemName) || "",
      quantity,
      unit: data.unit || (master && master.unit) || "式",
      unitPrice,
      amount,
      taxRate: data.taxRate || (master && master.taxRate) || "10%",
      lines,
      template: data.template || defaultDocumentTemplate(),
      sendStatus: data.sendStatus || "未送付",
      sendDate: data.sendDate,
      linkedEstimateNo: data.linkedEstimateNo,
      linkedInvoiceNo: data.linkedInvoiceNo,
      note: data.note,
      createdAt: new Date().toISOString()
    };
  }

  function receiptDocRecordFromData(data, withId = true) {
    const lines = cloneDocumentLines(data).length ? cloneDocumentLines(data) : documentLinesFromData(data, { itemName: data.content, quantity: 1, unit: "式", unitPrice: data.amount, amount: data.amount, taxRate: data.taxRate });
    return {
      ...(withId ? { id: uid("receiptDoc") } : {}),
      receiptNo: data.receiptNo || nextReceiptNo(),
      issueDate: data.issueDate || TODAY,
      paymentDate: data.paymentDate || TODAY,
      customer: data.customer,
      invoiceNo: data.invoiceNo,
      content: data.content || "お品代",
      amount: documentAmountFromLines(lines, data.amount),
      taxRate: data.taxRate || "10%",
      lines,
      template: data.template || defaultDocumentTemplate(),
      sendStatus: data.sendStatus || "未送付",
      sendDate: data.sendDate,
      note: data.note,
      createdAt: new Date().toISOString()
    };
  }

  function createRecurringDocument(template) {
    if (!template.active) {
      alert("無効なルールです。有効にしてから作成してください。");
      return;
    }
    const month = TODAY.slice(0, 7);
    if (template.lastCreatedMonth === month) {
      alert("このルールは今月分をすでに作成しています。");
      return;
    }
    const scheduledDate = dateInMonth(month, template.dayOfMonth || 15);
    if (isLockedDate(scheduledDate, "毎月自動作成")) return;
    const recurringLines = [normalizeLine({
      itemName: template.content,
      quantity: 1,
      unit: "式",
      unitPrice: template.amount,
      amount: template.amount,
      taxRate: template.taxRate || "10%"
    })];
    if (template.documentType === "delivery") {
      const delivery = deliveryRecordFromData({
        deliveryNo: nextDeliveryNo(),
        date: scheduledDate,
        customer: template.customer,
        subject: template.content,
        itemName: template.content,
        quantity: 1,
        unit: "式",
        unitPrice: template.amount,
        amount: template.amount,
        taxRate: template.taxRate,
        lines: recurringLines,
        template: template.template,
        sendStatus: "未送付",
        note: [`毎月自動: ${template.title || ""}`, template.note].filter(Boolean).join(" / ")
      });
      state.deliveries.push(delivery);
      addAudit("毎月自動 納品書作成", delivery);
    } else if (template.documentType === "receipt") {
      const receiptDoc = receiptDocRecordFromData({
        receiptNo: nextReceiptNo(),
        issueDate: scheduledDate,
        paymentDate: scheduledDate,
        customer: template.customer,
        invoiceNo: "",
        content: template.content,
        amount: template.amount,
        lines: recurringLines,
        taxRate: template.taxRate,
        template: template.template,
        sendStatus: "未送付",
        note: [`毎月自動: ${template.title || ""}`, template.note].filter(Boolean).join(" / ")
      });
      state.receiptDocs.push(receiptDoc);
      addAudit("毎月自動 領収書作成", receiptDoc);
    } else {
      const invoice = {
        id: uid("inv"),
        invoiceNo: nextInvoiceNo(),
        issueDate: scheduledDate,
        serviceDate: scheduledDate,
        dueDate: endOfNextMonth(scheduledDate),
        expectedPaymentDate: endOfNextMonth(scheduledDate),
        paymentDate: "",
        customer: template.customer,
        content: template.content,
        classification: template.classification || "業務委託",
        department: template.department || departments()[0],
        amount: documentAmountFromLines(recurringLines, template.amount),
        taxRate: template.taxRate || "10%",
        lines: recurringLines,
        status: "未入金",
      template: template.template || defaultDocumentTemplate(),
        sendStatus: "未送付",
        sendDate: "",
        note: [`毎月自動: ${template.title || ""}`, template.note].filter(Boolean).join(" / "),
        createdAt: new Date().toISOString()
      };
      state.invoices.push(invoice);
      addAudit("毎月自動 請求書作成", invoice);
    }
    template.lastCreatedMonth = month;
    template.updatedAt = new Date().toISOString();
    persist("毎月自動作成");
    alert(`${month}分の${documentTypeLabel(template.documentType)}を作成しました。`);
    renderRecurring();
  }

  function salesFlowRows() {
    const estimates = fiscalItems(state.estimates, "date").sort(byDate("date"));
    const deliveries = fiscalItems(state.deliveries, "date").sort(byDate("date"));
    const invoices = fiscalInvoices().sort(byDate("issueDate"));
    const sales = fiscalItems(state.sales, "date").sort(byDate("date"));
    const receiptDocs = fiscalItems(state.receiptDocs, "issueDate").sort(byDate("issueDate"));
    const usedDeliveries = new Set();
    const usedInvoices = new Set();
    const usedSales = new Set();
    const usedReceipts = new Set();

    const rows = estimates.map((estimate) => {
      const delivery = deliveries.find((item) => item.linkedEstimateNo && item.linkedEstimateNo === estimate.estimateNo)
        || deliveries.find((item) => item.deliveryNo && item.deliveryNo === estimate.linkedDeliveryNo);
      const invoice = invoices.find((item) => item.linkedEstimateNo && item.linkedEstimateNo === estimate.estimateNo)
        || invoices.find((item) => item.invoiceNo && item.invoiceNo === estimate.linkedInvoiceNo)
        || (delivery ? invoices.find((item) => item.linkedDeliveryNo && item.linkedDeliveryNo === delivery.deliveryNo) : null);
      const sale = invoice ? sales.find((item) => item.invoiceNo && item.invoiceNo === invoice.invoiceNo) : null;
      const receipt = invoice ? receiptDocs.find((item) => item.invoiceNo && item.invoiceNo === invoice.invoiceNo) : null;
      if (delivery) usedDeliveries.add(delivery.id);
      if (invoice) usedInvoices.add(invoice.id);
      if (sale) usedSales.add(sale.id);
      if (receipt) usedReceipts.add(receipt.id);
      return flowRow(estimate.date, estimate.customer, estimate.content, estimate.amount, estimate, delivery, invoice, sale, receipt);
    });

    deliveries.filter((item) => !usedDeliveries.has(item.id)).forEach((delivery) => {
      const invoice = invoices.find((item) => item.linkedDeliveryNo && item.linkedDeliveryNo === delivery.deliveryNo)
        || invoices.find((item) => item.invoiceNo && item.invoiceNo === delivery.linkedInvoiceNo);
      const sale = invoice ? sales.find((item) => item.invoiceNo && item.invoiceNo === invoice.invoiceNo) : null;
      const receipt = invoice ? receiptDocs.find((item) => item.invoiceNo && item.invoiceNo === invoice.invoiceNo) : null;
      if (invoice) usedInvoices.add(invoice.id);
      if (sale) usedSales.add(sale.id);
      if (receipt) usedReceipts.add(receipt.id);
      rows.push(flowRow(delivery.date, delivery.customer, delivery.subject || delivery.itemName, delivery.amount, null, delivery, invoice, sale, receipt));
    });

    invoices.filter((item) => !usedInvoices.has(item.id)).forEach((invoice) => {
      const sale = sales.find((item) => item.invoiceNo && item.invoiceNo === invoice.invoiceNo);
      const receipt = receiptDocs.find((item) => item.invoiceNo && item.invoiceNo === invoice.invoiceNo);
      if (sale) usedSales.add(sale.id);
      if (receipt) usedReceipts.add(receipt.id);
      rows.push(flowRow(invoice.issueDate, invoice.customer, invoice.content, invoice.amount, null, null, invoice, sale, receipt));
    });

    sales.filter((item) => !usedSales.has(item.id)).forEach((sale) => rows.push(flowRow(sale.date, sale.customer, sale.content, sale.amount, null, null, null, sale, null)));
    receiptDocs.filter((item) => !usedReceipts.has(item.id)).forEach((receipt) => rows.push(flowRow(receipt.issueDate, receipt.customer, receipt.content, receipt.amount, null, null, null, null, receipt)));
    return rows.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  }

  function flowRow(date, customer, content, amount, estimate, delivery, invoice, sale, receipt) {
    return { date, customer, content, amount: num(amount), estimate, delivery, invoice, sale, receipt };
  }

  function salesFlowIssues(row) {
    const issues = [];
    if (row.invoice && !row.sale) issues.push({ label: "入金未確認", severity: "warn" });
    if (row.sale && !row.invoice) issues.push({ label: "請求書なし入金", severity: "warn" });
    if (row.invoice && row.sale && num(row.invoice.amount) !== num(row.sale.amount)) issues.push({ label: "金額差", severity: "bad" });
    if (row.sale && !row.receipt) issues.push({ label: "領収書未発行", severity: "warn" });
    if (row.invoice && fiscalCrossing(row.invoice)) issues.push({ label: "決算またぎ", severity: "bad" });
    return issues;
  }

  function salesFlowIssueBadges(row) {
    const issues = salesFlowIssues(row);
    if (!issues.length) return '<span class="badge good">確認済</span>';
    return issues.map((issue) => `<span class="badge ${issue.severity}">${esc(issue.label)}</span>`).join(" ");
  }

  function salesFlowCsvRow(row) {
    const progress = salesFlowProgress(row);
    return {
      date: row.date,
      customer: row.customer,
      content: row.content,
      progress: progress.label,
      estimateNo: row.estimate ? row.estimate.estimateNo : "",
      deliveryNo: row.delivery ? row.delivery.deliveryNo : "",
      invoiceNo: row.invoice ? row.invoice.invoiceNo : "",
      saleDate: row.sale ? row.sale.date : "",
      receiptNo: row.receipt ? row.receipt.receiptNo : "",
      amount: row.amount,
      issues: salesFlowIssues(row).map((issue) => issue.label).join(" / "),
      nextAction: salesFlowNextActionLabel(row)
    };
  }

  function salesFlowCsvFields() {
    return [
      ["date", "基準日"],
      ["customer", "取引先"],
      ["content", "内容"],
      ["progress", "進捗"],
      ["estimateNo", "見積番号"],
      ["deliveryNo", "納品書番号"],
      ["invoiceNo", "請求書番号"],
      ["saleDate", "入金日"],
      ["receiptNo", "領収書番号"],
      ["amount", "金額"],
      ["issues", "確認"],
      ["nextAction", "次アクション"]
    ];
  }

  async function importAllData(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      const incoming = imported.state || imported;
      if (!incoming || !incoming.settings) throw new Error("invalid");
      if (!confirm("現在のデータを、選択したバックアップで置き換えます。続けますか？")) return;
      state = normalizeState(incoming);
      addAudit("バックアップ復元", { file: file.name });
      persist("復元");
      render();
    } catch (error) {
      console.error(error);
      alert("JSONを読み込めませんでした。全体バックアップのファイルを選択してください。");
    } finally {
      event.target.value = "";
    }
  }

  function recordImportBatch(batch) {
    state.importBatches = Array.isArray(state.importBatches) ? state.importBatches : [];
    state.importBatches.push({
      id: uid("import"),
      importedAt: new Date().toISOString(),
      importDate: TODAY,
      fiscalYear: selectedFiscalYear,
      sourceType: batch.sourceType || "csv",
      target: batch.target || "",
      fileName: batch.fileName || "",
      rowCount: num(batch.rowCount),
      createdCount: num(batch.createdCount),
      amountTotal: num(batch.amountTotal),
      status: batch.status || "取込済",
      note: batch.note || ""
    });
    if (state.importBatches.length > 300) state.importBatches = state.importBatches.slice(-300);
  }

  async function importSalesCsv(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const rows = csvObjects(await file.text());
      let count = 0;
      let amountTotal = 0;
      let skippedLocked = 0;
      rows.forEach((row) => {
        const date = normalizeDateText(pick(row, ["入金日", "取引日", "日付", "年月日", "date"]));
        const amount = positiveAmount(pick(row, ["入金額", "金額", "取引金額", "amount"]));
        if (!date || !amount) return;
        const invoiceNo = pick(row, ["請求書番号", "請求番号", "invoiceNo", "invoice"]);
        const customer = pick(row, ["取引先", "振込依頼人", "摘要", "内容", "name"]);
        const content = pick(row, ["内容", "摘要", "取引内容", "メモ", "description"]) || "通帳CSV取込";
        const record = {
          id: uid("sale"),
          date,
          customer,
          content,
          classification: pick(row, ["分類"]) || "その他",
          department: pick(row, ["部門"]) || departments()[0],
          amount,
          invoiceNo,
          bankAccount: pick(row, ["通帳", "銀行", "口座"]) || state.settings.bankAccount || "道銀",
          note: `CSV取込: ${file.name}`,
          createdAt: new Date().toISOString()
        };
        if (isLockedRecordMonth("sales", record, "CSV取込", { silent: true, noAudit: true })) {
          skippedLocked += 1;
          return;
        }
        state.sales.push(record);
        markInvoicePaidFromSale(record);
        count += 1;
        amountTotal += amount;
      });
      if (skippedLocked) addAudit("ロック月CSV取込スキップ", { id: `${file.name} 売上 ${skippedLocked}件` });
      recordImportBatch({
        sourceType: "bank",
        target: "sales",
        fileName: file.name,
        rowCount: rows.length,
        createdCount: count,
        amountTotal,
        status: skippedLocked ? "一部取込" : "取込済",
        note: `通帳CSVから売上一覧へ登録${skippedLocked ? ` / ロック済み月スキップ ${skippedLocked}件` : ""}`
      });
      addAudit("通帳CSV取込", { id: `${file.name} ${count}件` });
      persist("CSV取込");
      alert(`${count}件の売上入金を取り込みました。${skippedLocked ? ` ロック済み月は${skippedLocked}件スキップしました。` : ""}`);
      if (activeView === "dataLink") renderDataLink();
      else renderSales();
    } catch (error) {
      console.error(error);
      alert("通帳CSVを読み込めませんでした。");
    } finally {
      event.target.value = "";
    }
  }

  async function importCardCsv(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const rows = csvObjects(await file.text());
      let count = 0;
      let amountTotal = 0;
      let skippedLocked = 0;
      rows.forEach((row) => {
        const date = normalizeDateText(pick(row, ["利用日", "取引日", "日付", "年月日", "date"]));
        const amount = positiveAmount(pick(row, ["利用金額", "金額", "取引金額", "amount"]));
        if (!date || !amount) return;
        const record = {
          id: uid("exp"),
          date,
          vendor: pick(row, ["利用店名", "加盟店", "取引先", "摘要", "内容", "name"]),
          category: pick(row, ["経費科目", "科目", "分類"]) || "未分類",
          department: pick(row, ["部門"]) || departments()[0],
          itemName: pick(row, ["品名", "内容", "摘要"]) || "カード明細",
          quantity: 1,
          unitPrice: amount,
          amount,
          taxRate: pick(row, ["税区分"]) || "不明",
          paymentMethod: "card",
          registrationNumber: normalizeRegistration(pick(row, ["T番号", "登録番号"])),
          invoiceEligible: true,
          note: `カードCSV取込: ${file.name}`,
          proof: null,
          createdAt: new Date().toISOString()
        };
        if (isLockedRecordMonth("expenses", record, "CSV取込", { silent: true, noAudit: true })) {
          skippedLocked += 1;
          return;
        }
        state.expenses.push(record);
        count += 1;
        amountTotal += amount;
      });
      if (skippedLocked) addAudit("ロック月CSV取込スキップ", { id: `${file.name} カード ${skippedLocked}件` });
      recordImportBatch({
        sourceType: "card",
        target: "expenses",
        fileName: file.name,
        rowCount: rows.length,
        createdCount: count,
        amountTotal,
        status: skippedLocked ? "一部取込" : "取込済",
        note: `カードCSVからカード支払の経費へ登録${skippedLocked ? ` / ロック済み月スキップ ${skippedLocked}件` : ""}`
      });
      addAudit("カードCSV取込", { id: `${file.name} ${count}件` });
      persist("CSV取込");
      alert(`${count}件のカード経費を取り込みました。${skippedLocked ? ` ロック済み月は${skippedLocked}件スキップしました。` : ""}`);
      if (activeView === "dataLink") renderDataLink();
      else renderCards();
    } catch (error) {
      console.error(error);
      alert("カードCSVを読み込めませんでした。");
    } finally {
      event.target.value = "";
    }
  }

  function exportBookCsv(type) {
    const entries = fiscalBookEntries();
    if (type === "general" || type === "subsidiary") {
      const rows = ledgerRows(entries, bookState.account);
      exportCsv(`books-${type}-${bookState.account}`, rows, [
        ["no", "取引No"], ["date", "取引日"], ["subAccount", "補助科目"], ["counterAccount", "相手勘定"], ["summary", "摘要"], ["tax", "税区分"], ["debit", "借方"], ["credit", "貸方"], ["balance", "残高"]
      ]);
      return;
    }
    if (type === "trial") {
      exportCsv("books-trial", trialRows(entries, bookState.report), [
        ["group", "区分"], ["label", "勘定科目"], ["debit", "借方"], ["credit", "貸方"], ["balance", "残高"], ["percent", "構成比"]
      ]);
      return;
    }
    if (type === "transition") {
      const periods = reportPeriods(selectedFiscalYear, bookState.period);
      const rows = transitionRows(entries, bookState.report, periods).map((row) => {
        const out = { label: row.label, total: row.total };
        periods.forEach((period) => { out[period.label] = row.values[period.key] || 0; });
        return out;
      });
      exportCsv("books-transition", rows, [["label", "区分"], ...periods.map((period) => [period.label, period.label]), ["total", "合計"]]);
      return;
    }
    if (type === "department") {
      const depts = departments();
      const rows = departmentRows(entries, bookState.report, depts).map((row) => {
        const out = { label: row.label, total: row.total };
        depts.forEach((dept) => { out[dept] = row.values[dept] || 0; });
        return out;
      });
      exportCsv("books-department", rows, [["label", "区分"], ...depts.map((dept) => [dept, dept]), ["total", "合計"]]);
      return;
    }
    exportCsv("books-compare", comparisonRows(entries, bookState.report), [
      ["label", "区分"], ["previous", "前期"], ["previousPercent", "前期構成比"], ["current", "当期"], ["currentPercent", "当期構成比"], ["diff", "増減額"], ["rate", "増減率"]
    ]);
  }

  function importBatchCsvFields() {
    return [
      ["importedAt", "取込日時"],
      ["importDate", "取込日"],
      ["sourceType", "種別"],
      ["fileName", "ファイル名"],
      ["rowCount", "読取行"],
      ["createdCount", "登録件数"],
      ["amountTotal", "取込金額"],
      ["target", "登録先"],
      ["status", "状態"],
      ["note", "メモ"]
    ];
  }

  function auditCsvFields() {
    return [
      ["at", "日時"],
      ["action", "操作"],
      ["target", "対象"]
    ];
  }

  function trashCsvRow(item) {
    const record = item.record || {};
    return {
      deletedAt: item.deletedAt || "",
      collection: collectionLabel(item.collection),
      date: recordDate(item.collection, record),
      summary: recordSummary(item.collection, record),
      amount: record.amount || record.total || record.netPay || "",
      trashId: item.id
    };
  }

  function trashCsvFields() {
    return [
      ["deletedAt", "削除日時"],
      ["collection", "種類"],
      ["date", "日付/月"],
      ["summary", "内容"],
      ["amount", "金額"],
      ["trashId", "削除ID"]
    ];
  }

  function exportCsv(name, rows, fields) {
    const header = fields.map(([, label]) => label);
    const body = rows.map((row) => fields.map(([key]) => csvCell(displayValue(key, row[key]))));
    const csv = [header.map(csvCell).join(","), ...body.map((line) => line.join(","))].join("\r\n");
    downloadBlob(`${name}-${selectedFiscalYear}-${TODAY}.csv`, new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  }

  function downloadJson(name, payload) {
    downloadBlob(name, new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }));
  }

  function downloadBlob(name, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      if (file.type && file.type.startsWith("image/")) {
        compressImageFile(file).then(resolve).catch(reject);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, dataUrl: reader.result });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function compressImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const maxSide = 1600;
          const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          resolve({
            name: file.name.replace(/\.[^.]+$/, ".jpg"),
            originalName: file.name,
            type: "image/jpeg",
            originalSize: file.size,
            size: Math.round((dataUrl.length * 3) / 4),
            compressed: true,
            dataUrl
          });
        };
        image.onerror = reject;
        image.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function fiscalBookEntries() {
    return buildBookEntries().filter((entry) => getFiscalYear(entry.date) === selectedFiscalYear);
  }

  function buildBookEntries() {
    const entries = [];
    state.expenses.forEach((item, index) => {
      const credit = item.paymentMethod === "cash" ? "現金" : item.paymentMethod === "bank" ? "普通預金" : item.paymentMethod === "card" ? "クレジットカード未払" : "未払金";
      entries.push({
        source: "expense",
        no: `EXP-${index + 1}`,
        date: item.date,
        debitAccount: item.category || "未分類",
        debitSub: item.vendor || "",
        debitTax: item.taxRate || "不明",
        debitInvoiceEligible: item.invoiceEligible,
        debitAmount: num(item.amount),
        creditAccount: credit,
        creditSub: item.paymentMethod === "bank" ? state.settings.bankAccount : "",
        creditTax: "対象外",
        creditAmount: num(item.amount),
        summary: [item.itemName, item.vendor].filter(Boolean).join(" / ") || "経費",
        department: item.department || departments()[0],
        createdAt: item.createdAt
      });
    });

    state.sales.forEach((item, index) => {
      entries.push({
        source: "sale",
        no: `SALE-${index + 1}`,
        date: item.date,
        debitAccount: "普通預金",
        debitSub: item.bankAccount || state.settings.bankAccount || "道銀",
        debitTax: "対象外",
        debitAmount: num(item.amount),
        creditAccount: "売上高",
        creditSub: item.classification || "",
        creditTax: "10%",
        creditAmount: num(item.amount),
        summary: [item.content, item.invoiceNo].filter(Boolean).join(" / ") || "売上入金",
        department: item.department || departments()[0],
        createdAt: item.createdAt
      });
    });

    state.invoices.forEach((item, index) => {
      if (findSaleForInvoice(item)) return;
      entries.push({
        source: "invoice",
        no: item.invoiceNo || `INV-${index + 1}`,
        date: item.serviceDate || item.issueDate,
        debitAccount: "売掛金",
        debitSub: item.customer || "",
        debitTax: "対象外",
        debitAmount: num(item.amount),
        creditAccount: "売上高",
        creditSub: item.classification || "",
        creditTax: item.taxRate || "10%",
        creditAmount: num(item.amount),
        summary: [item.content, "未入金請求"].filter(Boolean).join(" / "),
        department: item.department || departments()[0],
        createdAt: item.createdAt
      });
    });

    state.payroll.forEach((item, index) => {
      entries.push({
        source: "payroll",
        no: `PAY-${index + 1}`,
        date: item.payDate || `${item.payMonth}-01`,
        debitAccount: "給与手当",
        debitSub: item.employee || "",
        debitTax: "対象外",
        debitAmount: num(item.netPay),
        creditAccount: "普通預金",
        creditSub: state.settings.bankAccount || "道銀",
        creditTax: "対象外",
        creditAmount: num(item.netPay),
        summary: `${item.payMonth || ""} 給与`,
        department: departments()[0],
        createdAt: item.createdAt
      });
    });

    state.journals.forEach((item) => entries.push(item));
    return entries.filter((entry) => entry.date);
  }

  function ledgerRows(entries, account) {
    let balance = 0;
    const normal = accountInfo(account).normal;
    return entries
      .filter((entry) => entry.debitAccount === account || entry.creditAccount === account)
      .sort(byDate("date"))
      .map((entry) => {
        const isDebit = entry.debitAccount === account;
        const debit = isDebit ? num(entry.debitAmount) : 0;
        const credit = isDebit ? 0 : num(entry.creditAmount);
        balance += normal === "debit" ? debit - credit : credit - debit;
        return {
          no: entry.no,
          date: entry.date,
          subAccount: isDebit ? entry.debitSub : entry.creditSub,
          counterAccount: isDebit ? entry.creditAccount : entry.debitAccount,
          summary: entry.summary,
          tax: isDebit ? entry.debitTax : entry.creditTax,
          debit,
          credit,
          balance
        };
      });
  }

  function trialRows(entries, report) {
    const accounts = bookAccountNames().filter((name) => report === "pl" ? ["revenue", "expense"].includes(accountInfo(name).type) : ["asset", "liability", "equity"].includes(accountInfo(name).type));
    const rows = accounts.map((account) => {
      const info = accountInfo(account);
      const debit = sum(entries.filter((entry) => entry.debitAccount === account), "debitAmount");
      const credit = sum(entries.filter((entry) => entry.creditAccount === account), "creditAmount");
      const balance = info.normal === "debit" ? debit - credit : credit - debit;
      return { label: account, group: info.group, debit, credit, balance: Math.abs(balance) };
    });
    const total = sum(rows, "balance") || 1;
    return rows.map((row) => ({ ...row, percent: Math.round((row.balance / total) * 1000) / 10 }));
  }

  function transitionRows(entries, report, periods) {
    const baseRows = trialRows(entries, report).filter((row) => row.balance || bookState.showZero);
    return baseRows.map((row) => {
      const values = {};
      periods.forEach((period) => {
        values[period.key] = trialRows(entries.filter((entry) => entry.date >= period.start && entry.date <= period.end), report).find((item) => item.label === row.label)?.balance || 0;
      });
      return { label: row.label, values, total: Object.values(values).reduce((acc, value) => acc + value, 0) };
    });
  }

  function departmentRows(entries, report, depts) {
    const baseRows = trialRows(entries, report).filter((row) => row.balance || bookState.showZero);
    return baseRows.map((row) => {
      const values = {};
      depts.forEach((dept) => {
        values[dept] = trialRows(entries.filter((entry) => (entry.department || departments()[0]) === dept), report).find((item) => item.label === row.label)?.balance || 0;
      });
      return { label: row.label, values, total: Object.values(values).reduce((acc, value) => acc + value, 0) };
    });
  }

  function comparisonRows(currentEntries, report) {
    const previousEntries = buildBookEntries().filter((entry) => getFiscalYear(entry.date) === selectedFiscalYear - 1);
    const current = trialRows(currentEntries, report);
    const previous = trialRows(previousEntries, report);
    const labels = [...new Set([...current.map((row) => row.label), ...previous.map((row) => row.label)])];
    const currentTotal = sum(current, "balance") || 1;
    const previousTotal = sum(previous, "balance") || 1;
    return labels.map((label) => {
      const currentValue = current.find((row) => row.label === label)?.balance || 0;
      const previousValue = previous.find((row) => row.label === label)?.balance || 0;
      const diff = currentValue - previousValue;
      return {
        label,
        previous: previousValue,
        previousPercent: Math.round((previousValue / previousTotal) * 1000) / 10,
        current: currentValue,
        currentPercent: Math.round((currentValue / currentTotal) * 1000) / 10,
        diff,
        rate: previousValue ? `${Math.round((diff / previousValue) * 1000) / 10}%` : "-"
      };
    }).filter((row) => row.current || row.previous || bookState.showZero);
  }

  function accountInfo(account) {
    return accountMaster.find((item) => item.name === account)
      || (categories().includes(account) ? { name: account, type: "expense", normal: "debit", group: "販売費及び一般管理費" } : { name: account, type: "asset", normal: "debit", group: "その他" });
  }

  function bookAccountNames() {
    return [...new Set([...accountMaster.map((item) => item.name), ...categories()])];
  }

  function reportPeriods(year, mode) {
    const months = fiscalMonths(year);
    if (mode === "yearly") return [{ key: String(year), label: "当期", start: `${months[0]}-01`, end: endOfMonth(`${months[11]}-01`) }];
    if (mode === "half") {
      return [
        { key: "h1", label: "上半期", start: `${months[0]}-01`, end: endOfMonth(`${months[5]}-01`) },
        { key: "h2", label: "下半期", start: `${months[6]}-01`, end: endOfMonth(`${months[11]}-01`) }
      ];
    }
    if (mode === "quarterly") {
      return [0, 3, 6, 9].map((index, q) => ({
        key: `q${q + 1}`,
        label: `第${q + 1}四半期`,
        start: `${months[index]}-01`,
        end: endOfMonth(`${months[index + 2]}-01`)
      }));
    }
    return months.map((month) => ({ key: month, label: `${Number(month.slice(5, 7))}月`, start: `${month}-01`, end: endOfMonth(`${month}-01`) }));
  }

  function getDataHealth() {
    const alerts = [
      ...expenseAlerts(fiscalItems(state.expenses, "date")),
      ...getInvoiceIssues()
    ];
    const storage = storageInfo();
    const reminderDays = Number(state.settings.backupReminderDays || 7);
    const backupOk = state.settings.lastBackupAt && daysBetween(state.settings.lastBackupAt, new Date().toISOString()) <= reminderDays;
    const storageWarn = storage.bytes > 3.5 * 1024 * 1024;
    const bad = alerts.filter((item) => item.severity === "bad").length + (backupOk ? 0 : 1);
    const warn = alerts.filter((item) => item.severity === "warn").length + (storageWarn ? 1 : 0);
    const score = Math.max(0, 100 - bad * 15 - warn * 6);
    return { score, backupOk, storageWarn, storage, bad, warn, alertCount: alerts.length };
  }

  function storageInfo() {
    const text = JSON.stringify(state);
    return { bytes: new Blob([text]).size, kb: new Blob([text]).size / 1024 };
  }

  function renderHealthGrid(health) {
    return `
      <div class="health-grid">
        <div><strong>${health.backupOk ? "OK" : "要対応"}</strong><span>バックアップ</span></div>
        <div><strong>${health.storage.kb.toFixed(1)}KB</strong><span>保存容量</span></div>
        <div><strong>${health.bad}件</strong><span>重大確認</span></div>
        <div><strong>${health.warn}件</strong><span>注意確認</span></div>
      </div>
    `;
  }

  function renderAuditTable(rows) {
    if (!rows.length) return `<div class="empty">監査ログはまだありません。</div>`;
    return `
      <div class="table-wrap"><table>
        <thead><tr><th>日時</th><th>操作</th><th>対象</th></tr></thead>
        <tbody>${rows.map((row) => `<tr><td>${esc(formatDateTime(row.at))}</td><td>${esc(row.action)}</td><td>${esc(row.target || "")}</td></tr>`).join("")}</tbody>
      </table></div>
    `;
  }

  function addAudit(action, payload) {
    state.audit = Array.isArray(state.audit) ? state.audit : [];
    state.audit.push({
      id: uid("audit"),
      at: new Date().toISOString(),
      action,
      target: payload ? [payload.invoiceNo, payload.estimateNo, payload.deliveryNo, payload.receiptNo, payload.name, payload.itemName, payload.title, payload.vendor, payload.customer, payload.id].filter(Boolean).join(" / ") : ""
    });
    if (state.audit.length > 1000) state.audit = state.audit.slice(-1000);
  }

  function findSaleForInvoice(invoice) {
    if (!invoice || !invoice.invoiceNo) return null;
    return state.sales.find((sale) => sale.invoiceNo && sale.invoiceNo === invoice.invoiceNo) || null;
  }

  function fiscalCrossing(invoice) {
    const serviceDate = invoice.serviceDate || invoice.issueDate;
    const paymentDate = invoice.paymentDate || invoice.expectedPaymentDate;
    if (!serviceDate || !paymentDate) return false;
    return getFiscalYear(serviceDate) !== getFiscalYear(paymentDate) && getFiscalYear(paymentDate) > getFiscalYear(serviceDate);
  }

  function markInvoicePaidFromSale(sale) {
    const invoice = state.invoices.find((item) => sale.invoiceNo && item.invoiceNo === sale.invoiceNo);
    if (!invoice) return;
    invoice.status = "入金済";
    invoice.paymentDate = sale.date;
  }

  function field(name, label, type, value, placeholder) {
    return `<label class="field"><span>${esc(label)}</span><input name="${esc(name)}" type="${esc(type)}" value="${esc(value || "")}" ${placeholder ? `placeholder="${esc(placeholder)}"` : ""}></label>`;
  }

  function textFieldWithList(name, label, value, listId, placeholder) {
    return `<label class="field"><span>${esc(label)}</span><input name="${esc(name)}" type="text" value="${esc(value || "")}" list="${esc(listId)}" ${placeholder ? `placeholder="${esc(placeholder)}"` : ""}></label>`;
  }

  function selectField(name, label, options, selected) {
    const optionHtml = options.map((option) => {
      const value = Array.isArray(option) ? option[0] : option;
      const text = Array.isArray(option) ? option[1] : option;
      return `<option value="${esc(value)}" ${String(value) === String(selected) ? "selected" : ""}>${esc(text)}</option>`;
    }).join("");
    return `<label class="field"><span>${esc(label)}</span><select name="${esc(name)}">${optionHtml}</select></label>`;
  }

  function partnerDatalist() {
    const options = partnerNames().map((name) => `<option value="${esc(name)}"></option>`).join("");
    return `<datalist id="partnerNameList">${options}</datalist>`;
  }

  function itemDatalist() {
    const options = itemNames().map((name) => `<option value="${esc(name)}"></option>`).join("");
    return `<datalist id="itemNameList">${options}</datalist>`;
  }

  function summaryCard(label, value, sub) {
    return `<section class="summary-card"><small>${esc(label)}</small><strong>${esc(value)}</strong><div class="sub">${esc(sub || "")}</div></section>`;
  }

  function bookTab(value, label) {
    return `<button class="tab ${bookState.tab === value ? "is-active" : ""}" data-book-tab="${esc(value)}" type="button">${esc(label)}</button>`;
  }

  function receiptFilterTab(value, label) {
    return `<button class="tab ${receiptPaymentFilter === value ? "is-active" : ""}" data-filter="${esc(value)}" type="button">${esc(label)}</button>`;
  }

  function renderAlert(alert) {
    return `<div class="alert-item ${esc(alert.severity || "warn")}"><div><strong>${esc(alert.title)}</strong><p>${esc(alert.body)}</p></div><span class="badge ${esc(alert.severity || "warn")}">${alert.severity === "bad" ? "要対応" : "確認"}</span></div>`;
  }

  function rowActions(collection, id) {
    const item = (state[collection] || []).find((record) => record.id === id);
    const locked = item && hasLockedRecordMonth(collection, item);
    const splitAction = collection === "expenses" && item && !item.splitGroupId
      ? `<button class="button small secondary" data-action="expense-tax-split" data-id="${esc(id)}" type="button">税率分割</button>`
      : "";
    return `<div class="actions"><button class="button small secondary" data-action="detail" data-collection="${esc(collection)}" data-id="${esc(id)}" type="button">詳細</button>${locked ? '<span class="badge warn">ロック中</span>' : `${splitAction}<button class="button small secondary" data-action="edit" data-collection="${esc(collection)}" data-id="${esc(id)}" type="button">編集</button><button class="button small danger" data-action="delete" data-collection="${esc(collection)}" data-id="${esc(id)}" type="button">削除</button>`}</div>`;
  }

  function paymentBadge(value) {
    const label = paymentLabel(value);
    const cls = value === "card" ? "card" : value === "cash" ? "cash" : value === "bank" ? "bank" : "";
    return `<span class="badge ${cls}">${esc(label)}</span>`;
  }

  function splitProofAction(item) {
    if (!item || !item.splitGroupId) return "";
    const label = item.proof ? "分割画像差替" : "分割画像添付";
    return `<label class="button small secondary file-button">${esc(label)}<input data-action="attach-split-proof" data-split-group-id="${esc(item.splitGroupId)}" type="file" accept="image/*,application/pdf"></label>`;
  }

  async function attachSplitProof(input) {
    const file = input.files && input.files[0];
    const groupId = clean(input.dataset.splitGroupId);
    if (!file || !groupId) return;
    const targets = state.expenses.filter((item) => item.splitGroupId === groupId);
    if (!targets.length) return;
    if (targets.some((record) => isLockedRecordMonth("expenses", record, "証憑添付", { silent: true, noAudit: true }))) {
      alert(lockedMonthMessage((targets[0].date || "").slice(0, 7), "証憑添付"));
      input.value = "";
      return;
    }
    try {
      const proof = await readFile(file);
      const now = new Date().toISOString();
      targets.forEach((record) => {
        record.proof = proof;
        record.updatedAt = now;
      });
      addAudit("税率分割証憑添付", { id: groupId, count: targets.length, fileName: file.name });
      persist("証憑添付");
      render();
    } catch (error) {
      console.error(error);
      alert("証憑画像/PDFを読み込めませんでした。");
      input.value = "";
    }
  }

  function splitExistingExpense(id) {
    const index = state.expenses.findIndex((item) => item.id === id);
    const expense = state.expenses[index];
    if (!expense) return;
    if (expense.splitGroupId) {
      alert("この経費はすでに税率別に分割されています。");
      return;
    }
    if (isLockedRecordMonth("expenses", expense, "税率分割")) return;

    const defaults = defaultExpenseSplitAmounts(expense);
    const amount10 = num(prompt("10%対象額を入力してください。", defaults.amount10 ? String(defaults.amount10) : ""));
    if (!amount10) return;
    const amount8 = num(prompt("8%対象額を入力してください。", defaults.amount8 ? String(defaults.amount8) : ""));
    if (!amount8) return;

    const total = amount10 + amount8;
    if (num(expense.amount) && total !== num(expense.amount)) {
      const ok = confirm(`分割合計 ${yen(total)} が元の金額 ${yen(expense.amount)} と一致しません。このまま分割しますか？`);
      if (!ok) return;
    }

    const groupId = uid("split");
    const now = new Date().toISOString();
    const baseName = clean(expense.itemName) || "レシート購入分";
    const splitText = `税率別分割 / 元行 ${yen(expense.amount)} / 10% ${yen(amount10)} / 8% ${yen(amount8)}`;
    const makeRecord = (amount, taxRate, label) => ({
      ...expense,
      id: uid("exp"),
      originalExpenseId: expense.id,
      splitGroupId: groupId,
      itemName: `${baseName.replace(/\s+(10%対象|8%対象)$/, "")} ${label}`,
      quantity: 1,
      unitPrice: amount,
      amount,
      taxRate,
      note: [expense.note, splitText].filter(Boolean).join(" / "),
      updatedAt: now
    });

    const records = [
      makeRecord(amount10, "10%", "10%対象"),
      makeRecord(amount8, "8%", "8%対象")
    ];
    state.expenses.splice(index, 1, ...records);
    addAudit("経費を税率分割", { id: expense.id, splitGroupId: groupId, total });
    persist("税率分割保存");
    showFiscalYearForDate(records[0].date);
    render();
  }

  function defaultExpenseSplitAmounts(expense) {
    const vendor = clean(expense && expense.vendor);
    const amount = num(expense && expense.amount);
    if (vendor.includes("ツルハ") && amount === 22436) return { amount10: 8716, amount8: 13720 };
    return { amount10: amount, amount8: 0 };
  }

  function paymentLabel(value) {
    return paymentMethods.find((item) => item[0] === value)?.[1] || "その他";
  }

  function paymentRequestForExpense(expenseId) {
    return (state.paymentRequests || []).find((item) => item.linkedExpenseId && item.linkedExpenseId === expenseId) || null;
  }

  function paymentRequestForReceivedDoc(receivedDocId) {
    return (state.paymentRequests || []).find((item) => item.linkedReceivedDocId && item.linkedReceivedDocId === receivedDocId) || null;
  }

  function syncExpensePaymentRequestStatus(request) {
    if (!request || !request.linkedExpenseId) return;
    const expense = state.expenses.find((item) => item.id === request.linkedExpenseId);
    if (!expense) return;
    expense.paymentRequestNo = request.requestNo;
    expense.paymentRequestStatus = request.status;
    expense.updatedAt = new Date().toISOString();
  }

  function clearExpensePaymentRequest(request) {
    if (!request || !request.linkedExpenseId) return;
    const expense = state.expenses.find((item) => item.id === request.linkedExpenseId);
    if (!expense) return;
    delete expense.paymentRequestNo;
    delete expense.paymentRequestStatus;
    expense.updatedAt = new Date().toISOString();
  }

  function syncReceivedDocPaymentRequestStatus(request) {
    if (!request || !request.linkedReceivedDocId) return;
    const doc = (state.receivedDocs || []).find((item) => item.id === request.linkedReceivedDocId);
    if (!doc) return;
    doc.paymentRequestNo = request.requestNo;
    doc.paymentRequestStatus = request.status;
    if (["申請中", "承認済", "支払済"].includes(request.status)) doc.status = request.status;
    if (request.status === "差し戻し") doc.status = "支払依頼待ち";
    doc.updatedAt = new Date().toISOString();
  }

  function clearReceivedDocPaymentRequest(request) {
    if (!request || !request.linkedReceivedDocId) return;
    const doc = (state.receivedDocs || []).find((item) => item.id === request.linkedReceivedDocId);
    if (!doc) return;
    delete doc.paymentRequestNo;
    delete doc.paymentRequestStatus;
    if (["申請中", "承認済", "支払済"].includes(doc.status)) doc.status = "支払依頼待ち";
    doc.updatedAt = new Date().toISOString();
  }

  function statusBadge(value) {
    const text = value || "未処理";
    const cls = ["完了", "対応済", "入金済", "受注", "送付済", "郵送済", "メール", "郵送", "承認済", "支払済", "保管"].includes(text) ? "good" : ["期限超過", "保留", "失注", "差し戻し"].includes(text) ? "bad" : "warn";
    return `<span class="badge ${cls}">${esc(text)}</span>`;
  }

  function registrationBadge(item) {
    if (item.registrationNumber && isValidRegistration(item.registrationNumber)) return esc(item.registrationNumber);
    if (item.registrationNumber) return `<span class="badge bad">${esc(item.registrationNumber)}</span>`;
    if (num(item.amount) >= 10000 && item.invoiceEligible) return '<span class="badge bad">要確認</span>';
    return "";
  }

  function categories() {
    return Array.isArray(state.settings.categories) && state.settings.categories.length ? state.settings.categories : expenseCategories;
  }

  function departments() {
    return Array.isArray(state.settings.departments) && state.settings.departments.length ? state.settings.departments : defaultDepartments;
  }

  function documentTemplates() {
    return ["標準", "フォーマル", "控えめ", "ブランド"];
  }

  function defaultDocumentTemplate() {
    return documentTemplates().includes(state.settings.defaultDocumentTemplate) ? state.settings.defaultDocumentTemplate : "標準";
  }

  function documentAccentColor() {
    return isHexColor(state.settings.documentAccentColor) ? state.settings.documentAccentColor : "#2f5f9f";
  }

  function documentBrand(template) {
    const templateName = documentTemplates().includes(template) ? template : defaultDocumentTemplate();
    return {
      template: templateName,
      accent: documentTemplateAccent(templateName),
      logoText: clean(state.settings.documentLogoText) || "CDP",
      sealText: clean(state.settings.documentSealText) || "CDP",
      footerNote: clean(state.settings.documentFooterNote) || defaultState().settings.documentFooterNote
    };
  }

  function sendStatuses() {
    return ["未送付", "送付済", "再送予定", "郵送済", "保留"];
  }

  function partnerNames() {
    return [...new Set((state.partners || []).map((item) => clean(item.name)).filter(Boolean))];
  }

  function itemNames() {
    return [...new Set((state.items || []).map((item) => clean(item.itemName)).filter(Boolean))];
  }

  function partnerByName(name) {
    const target = clean(name);
    return (state.partners || []).find((item) => clean(item.name) === target) || null;
  }

  function itemByName(name) {
    const target = clean(name);
    return (state.items || []).find((item) => clean(item.itemName) === target || clean(item.itemCode) === target) || null;
  }

  function partnerDisplay(name) {
    const partner = partnerByName(name);
    const base = clean(name);
    const honorific = partner && partner.honorific && partner.honorific !== "なし" ? partner.honorific : "御中";
    return base ? `${base} ${honorific}` : "";
  }

  function fiscalItems(items, dateKey) {
    const range = getFiscalRange(selectedFiscalYear);
    return (items || []).filter((item) => {
      const date = item[dateKey];
      if (!date) return false;
      const normalized = date.length === 7 ? `${date}-01` : date;
      return normalized >= range.start && normalized <= range.end;
    });
  }

  function fiscalInvoices() {
    const range = getFiscalRange(selectedFiscalYear);
    return state.invoices.filter((invoice) => {
      const dates = [invoice.issueDate, invoice.serviceDate, invoice.expectedPaymentDate, invoice.paymentDate].filter(Boolean);
      return dates.some((date) => date >= range.start && date <= range.end);
    });
  }

  function fiscalHandoffs() {
    return (state.handoffs || [])
      .filter((item) => item.month && getFiscalYear(`${item.month}-01`) === selectedFiscalYear)
      .sort((a, b) => String(b.exportedAt || "").localeCompare(String(a.exportedAt || "")));
  }

  function latestHandoffForMonth(month) {
    return (state.handoffs || [])
      .filter((item) => item.month === month)
      .sort((a, b) => String(b.exportedAt || "").localeCompare(String(a.exportedAt || "")))[0];
  }

  function getFiscalYear(dateString) {
    if (!dateString) return new Date().getFullYear();
    const date = new Date(dateString.length === 7 ? `${dateString}-01T00:00:00` : `${dateString}T00:00:00`);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const startMonth = Number(state?.settings?.fiscalStartMonth || DEFAULT_FISCAL_START_MONTH);
    return month >= startMonth ? year : year - 1;
  }

  function getFiscalRange(year) {
    const startMonth = Number(state?.settings?.fiscalStartMonth || DEFAULT_FISCAL_START_MONTH);
    const start = `${year}-${String(startMonth).padStart(2, "0")}-01`;
    const endYear = startMonth === 1 ? year : year + 1;
    const endMonth = startMonth === 1 ? 12 : startMonth - 1;
    return { start, end: endOfMonth(`${endYear}-${String(endMonth).padStart(2, "0")}-01`) };
  }

  function fiscalMonths(year) {
    const startMonth = Number(state.settings.fiscalStartMonth || DEFAULT_FISCAL_START_MONTH);
    return Array.from({ length: 12 }, (_, index) => {
      const month = ((startMonth + index - 1) % 12) + 1;
      const y = month >= startMonth ? year : year + 1;
      return `${y}-${String(month).padStart(2, "0")}`;
    });
  }

  function groupByMonth(items, dateKey) {
    return items.reduce((acc, item) => {
      const key = (item[dateKey] || "").slice(0, 7) || "日付なし";
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});
  }

  function summarizeExpenses(items) {
    const total = sum(items, "amount") || 1;
    const grouped = items.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + num(item.amount);
      return acc;
    }, {});
    return Object.entries(grouped)
      .map(([category, amount]) => ({ category, amount, percent: Math.round((amount / total) * 1000) / 10 }))
      .sort((a, b) => b.amount - a.amount);
  }

  function ledgerCsvFields(type) {
    if (type === "trips") return [["date", "日付"], ["destination", "行先"], ["purpose", "目的"], ["transport", "移動"], ["mileage", "km"], ["fuelClaim", "ガソリン請求"], ["lodging", "宿泊"], ["total", "合計"], ["note", "メモ"]];
    if (type === "payroll") return [["payMonth", "対象月"], ["employee", "氏名"], ["basePay", "基本給"], ["allowance", "手当"], ["deduction", "控除"], ["netPay", "支給額"], ["payDate", "支払日"], ["note", "メモ"]];
    return [["date", "日付"], ["sender", "送付元"], ["instructor", "講師"], ["course", "内容"], ["amount", "金額"], ["status", "状態"], ["note", "メモ"]];
  }

  function ledgerTitle(type) {
    return type === "trips" ? "出張台帳" : type === "payroll" ? "給与台帳" : "ハイテク台帳";
  }

  function nextInvoiceNo() {
    return `INV-${selectedFiscalYear}-${String(state.invoices.length + 1).padStart(4, "0")}`;
  }

  function nextPaymentRequestNo() {
    return `PAY-${selectedFiscalYear}-${String((state.paymentRequests || []).length + 1).padStart(4, "0")}`;
  }

  function nextEstimateNo() {
    return `EST-${selectedFiscalYear}-${String(state.estimates.length + 1).padStart(4, "0")}`;
  }

  function nextDeliveryNo() {
    return `DEL-${selectedFiscalYear}-${String(state.deliveries.length + 1).padStart(4, "0")}`;
  }

  function nextReceiptNo() {
    return `REC-${selectedFiscalYear}-${String(state.receiptDocs.length + 1).padStart(4, "0")}`;
  }

  function documentTypeLabel(type) {
    return {
      estimate: "見積書",
      invoice: "請求書",
      delivery: "納品書",
      receipt: "領収書"
    }[type] || type;
  }

  function documentNumber(type, record) {
    return {
      estimate: record.estimateNo,
      invoice: record.invoiceNo,
      delivery: record.deliveryNo,
      receipt: record.receiptNo
    }[type] || "";
  }

  function documentTemplateAccent(template) {
    if (template === "ブランド") return documentAccentColor();
    if (template === "フォーマル") return "#243f63";
    if (template === "控えめ") return "#4f6f61";
    return "#2f5f9f";
  }

  function receiptExistsForInvoice(invoiceNo) {
    if (!invoiceNo) return false;
    return state.receiptDocs.some((item) => item.invoiceNo && item.invoiceNo === invoiceNo);
  }

  function dateInMonth(month, day) {
    const lastDay = Number(endOfMonth(`${month}-01`).slice(8, 10));
    const safeDay = String(Math.min(Math.max(1, Number(day) || 1), lastDay)).padStart(2, "0");
    return `${month}-${safeDay}`;
  }

  function partnerCsvFields() {
    return [["name", "取引先名"], ["honorific", "敬称"], ["contact", "担当者"], ["email", "メール"], ["phone", "電話"], ["paymentTerms", "支払条件"], ["address", "住所・送付先"], ["bankInfo", "振込先・条件"], ["note", "メモ"]];
  }

  function itemCsvFields() {
    return [["itemCode", "品番"], ["itemName", "品目名"], ["category", "分類"], ["unitPrice", "標準単価"], ["unit", "単位"], ["taxRate", "税率"], ["note", "メモ"]];
  }

  function deliveryCsvFields() {
    return [["deliveryNo", "納品書番号"], ["date", "納品日"], ["customer", "取引先"], ["subject", "件名"], ["itemName", "品目"], ["quantity", "数量"], ["unit", "単位"], ["unitPrice", "単価"], ["amount", "金額"], ["lines", "明細"], ["taxRate", "税区分"], ["linkedEstimateNo", "関連見積番号"], ["linkedInvoiceNo", "関連請求書番号"], ["sendStatus", "送付状態"], ["sendDate", "送付日"], ["template", "テンプレート"], ["note", "備考"]];
  }

  function receiptDocCsvFields() {
    return [["receiptNo", "領収書番号"], ["issueDate", "発行日"], ["paymentDate", "入金日"], ["customer", "取引先"], ["invoiceNo", "請求書番号"], ["content", "内容"], ["amount", "金額"], ["lines", "明細"], ["taxRate", "税区分"], ["sendStatus", "送付状態"], ["sendDate", "送付日"], ["template", "テンプレート"], ["note", "備考"]];
  }

  function receivedDocCsvFields() {
    return [["receivedDate", "受領日"], ["documentType", "書類種別"], ["vendor", "発行元・支払先"], ["title", "件名"], ["amount", "金額"], ["dueDate", "支払期限"], ["category", "経費科目"], ["department", "部門"], ["status", "状態"], ["paymentRequestNo", "支払依頼番号"], ["paymentRequestStatus", "支払依頼状態"], ["note", "メモ"]];
  }

  function paymentRequestCsvFields() {
    return [["requestNo", "申請番号"], ["requestType", "申請種別"], ["requestDate", "申請日"], ["dueDate", "支払期限"], ["vendor", "支払先"], ["content", "内容"], ["category", "経費科目"], ["department", "部門"], ["amount", "金額"], ["applicant", "申請者"], ["approver", "承認者"], ["status", "状態"], ["linkedExpenseId", "関連経費ID"], ["linkedReceivedDocId", "関連受領書類ID"], ["submittedAt", "申請日時"], ["approvedAt", "承認日時"], ["returnedAt", "差戻し日時"], ["paidAt", "支払済日"], ["note", "メモ"]];
  }

  function recurringCsvFields() {
    return [["title", "ルール名"], ["documentType", "帳票"], ["dayOfMonth", "作成日"], ["customer", "取引先"], ["content", "内容"], ["amount", "金額"], ["classification", "分類"], ["department", "部門"], ["taxRate", "税区分"], ["template", "テンプレート"], ["active", "有効"], ["lastCreatedMonth", "最終作成月"], ["note", "メモ"]];
  }

  function detectPayment(text) {
    const source = String(text || "").toLowerCase();
    if (/カード|card|visa|master|jcb|amex|クレジット/.test(source)) return "card";
    if (/振込|口座|銀行|道銀|bank/.test(source)) return "bank";
    if (/現金|cash/.test(source)) return "cash";
    return "";
  }

  function normalizeRegistration(value) {
    const text = clean(value).toUpperCase().replace(/[^T0-9]/g, "");
    if (!text) return "";
    return text.startsWith("T") ? text : `T${text}`;
  }

  function isValidRegistration(value) {
    return /^T\d{13}$/.test(String(value || ""));
  }

  function csvObjects(text) {
    const rows = String(text || "")
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(splitCsvLine);
    if (rows.length < 2) return [];
    const headers = rows[0].map((header, index) => clean(header) || `列${index + 1}`);
    return rows.slice(1).map((cells) => {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = clean(cells[index]);
      });
      return row;
    });
  }

  function splitCsvLine(line) {
    const cells = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (char === '"' && quoted && next === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = !quoted;
      } else if (char === "," && !quoted) {
        cells.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current);
    return cells;
  }

  function pick(row, names) {
    const normalized = Object.entries(row || {}).reduce((acc, [key, value]) => {
      acc[clean(key).toLowerCase()] = value;
      return acc;
    }, {});
    for (const name of names) {
      const key = clean(name).toLowerCase();
      if (normalized[key]) return normalized[key];
    }
    return "";
  }

  function normalizeDateText(value) {
    const text = clean(value);
    if (!text) return "";
    const normalized = text.replace(/[年月.]/g, "/").replace(/日/g, "").replaceAll("-", "/");
    const parts = normalized.split("/").map((part) => part.padStart(2, "0"));
    if (parts.length === 3 && parts[0].length === 4) return `${parts[0]}-${parts[1]}-${parts[2]}`;
    if (parts.length === 3 && parts[2].length === 4) return `${parts[2]}-${parts[0]}-${parts[1]}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
  }

  function positiveAmount(value) {
    return Math.abs(num(String(value || "").replace(/[^\d.-]/g, "")));
  }

  function formValues(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function lines(value) {
    return String(value || "").split(/\r?\n/).map(clean).filter(Boolean);
  }

  function displayValue(key, value) {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return key === "lines" ? documentLinesSummary(value) : JSON.stringify(value);
    if (key.toLowerCase().includes("date") || key === "createdAt" || key === "deletedAt" || key === "at") return String(value).includes("T") ? formatDateTime(value) : formatDate(value);
    if (["amount", "amountTotal", "unitPrice", "fuelClaim", "lodging", "total", "basePay", "allowance", "deduction", "netPay", "debit", "credit", "balance", "previous", "current", "diff"].includes(key)) return yen(value);
    if (key === "paymentMethod") return paymentLabel(value);
    if (key === "sourceType") return value === "bank" ? "通帳" : value === "card" ? "カード" : String(value);
    if (key === "target") return importTargetLabel(value);
    if (typeof value === "boolean") return value ? "はい" : "いいえ";
    return String(value);
  }

  function labelFor(key) {
    const labels = {
      date: "日付",
      vendor: "取引先",
      category: "科目",
      department: "部門",
      itemName: "品名",
      quantity: "個数",
      unitPrice: "単価",
      amount: "金額",
      splitGroupId: "税率分割ID",
      paymentMethod: "支払区分",
      paymentRequestNo: "支払依頼番号",
      paymentRequestStatus: "支払依頼状態",
      importedAt: "取込日時",
      importDate: "取込日",
      sourceType: "取込種別",
      fileName: "ファイル名",
      rowCount: "読取行",
      createdCount: "登録件数",
      amountTotal: "取込金額",
      target: "登録先",
      receivedDate: "受領日",
      documentType: "書類種別",
      file: "受領ファイル",
      taxRate: "税区分",
      registrationNumber: "T番号",
      invoiceEligible: "インボイス適格",
      note: "メモ",
      invoiceNo: "請求書番号",
      requestNo: "申請番号",
      requestType: "申請種別",
      requestDate: "申請日",
      applicant: "申請者",
      approver: "承認者",
      linkedExpenseId: "関連経費ID",
      linkedReceivedDocId: "関連受領書類ID",
      submittedAt: "申請日時",
      approvedAt: "承認日時",
      returnedAt: "差戻し日時",
      paidAt: "支払済日",
      estimateNo: "見積番号",
      deliveryNo: "納品書番号",
      receiptNo: "領収書番号",
      customer: "取引先",
      content: "内容",
      classification: "分類",
      status: "状態",
      subject: "件名",
      unit: "単位",
      issueDate: "発行日",
      paymentDate: "入金日",
      dueDate: "支払期限",
      expectedPaymentDate: "入金予定日",
      serviceDate: "実施日",
      sendStatus: "送付状態",
      sendDate: "送付日",
      template: "テンプレート",
      linkedEstimateNo: "関連見積番号",
      linkedDeliveryNo: "関連納品書番号",
      linkedInvoiceNo: "関連請求書番号",
      linkedReceiptNo: "関連領収書番号",
      lines: "明細",
      name: "取引先名",
      honorific: "敬称",
      contact: "担当者",
      email: "メール",
      phone: "電話",
      paymentTerms: "支払条件",
      address: "住所・送付先",
      bankInfo: "振込先・条件メモ",
      itemCode: "品番",
      title: "ルール名",
      documentType: "帳票",
      documentLabel: "帳票",
      documentNo: "帳票番号",
      documentDate: "帳票日",
      sentDate: "送付日",
      method: "送付方法",
      recipient: "宛先",
      dayOfMonth: "作成日",
      active: "有効",
      lastCreatedMonth: "最終作成月",
      createdAt: "登録日時"
    };
    return labels[key] || key;
  }

  function clean(value) {
    return String(value || "").trim();
  }

  function isHexColor(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || ""));
  }

  function num(value) {
    const n = Number(String(value || "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function sum(items, key) {
    return (items || []).reduce((acc, item) => acc + num(item[key]), 0);
  }

  function byDate(key) {
    return (a, b) => String(a[key] || "").localeCompare(String(b[key] || ""));
  }

  function yen(value) {
    return `${Math.round(num(value)).toLocaleString("ja-JP")}円`;
  }

  function formatDate(value) {
    if (!value) return "";
    return String(value).replaceAll("-", "/");
  }

  function formatDateTime(value) {
    if (!value) return "";
    return new Date(value).toLocaleString("ja-JP");
  }

  function monthLabel(value) {
    if (!value || value === "日付なし") return value;
    const [year, month] = value.split("-");
    return `${year}年${Number(month)}月`;
  }

  function toDateInput(date) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function endOfMonth(dateString) {
    const date = new Date(`${dateString.slice(0, 7)}-01T00:00:00`);
    return toDateInput(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  }

  function endOfNextMonth(dateString) {
    const date = new Date(`${dateString}T00:00:00`);
    return toDateInput(new Date(date.getFullYear(), date.getMonth() + 2, 0));
  }

  function daysBetween(a, b) {
    return Math.abs(new Date(b) - new Date(a)) / 86400000;
  }

  function csvCell(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
  }

  function safeFilePart(value) {
    return String(value || "document").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_");
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function hasMojibake(value) {
    return /繧|縺|譁|螟|荳|驕|�/.test(String(value || ""));
  }
})();
