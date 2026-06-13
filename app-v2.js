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
    expenses: ["経費表", "税理士の分類に合わせて品名、個数、単価、経費を管理"],
    sales: ["売上", "振込入金を売上として通帳別に管理"],
    invoices: ["請求書", "請求番号、実施日、支払予定日、入金日のずれを管理"],
    estimates: ["見積", "見積番号、金額、請求書化状況を記録"],
    trips: ["出張台帳", "移動、宿泊、ガソリン請求を記録"],
    payroll: ["給与台帳", "月別の給与、手当、控除、支払日を記録"],
    cards: ["カード台帳", "カード明細、領収書、T番号をまとめて確認"],
    hitech: ["ハイテク台帳", "送付資料、講師関連、入出金状況を記録"],
    books: ["会計帳簿", "総勘定元帳、補助元帳、試算表、推移表、部門別、前期比較"],
    closing: ["締め・提出", "15日前後と月末の締め、税理士提出データの点検"],
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
    seedFiscalOptions();
    bindGlobalEvents();
    persist("自動保存");
    render();
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
        backupReminderDays: 7,
        lastBackupAt: ""
      },
      expenses: [],
      sales: [],
      invoices: [],
      estimates: [],
      trips: [],
      payroll: [],
      hitech: [],
      closings: [],
      journals: [],
      trash: [],
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
      "sales",
      "invoices",
      "estimates",
      "trips",
      "payroll",
      "hitech",
      "closings",
      "journals",
      "trash",
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
    if (hasMojibake(normalized.settings.companyName)) normalized.settings.companyName = base.settings.companyName;
    if (hasMojibake(normalized.settings.bankAccount)) normalized.settings.bankAccount = base.settings.bankAccount;
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
      expenses: renderExpenses,
      sales: renderSales,
      invoices: renderInvoices,
      estimates: renderEstimates,
      trips: () => renderSimpleLedger("trips"),
      payroll: () => renderSimpleLedger("payroll"),
      cards: renderCards,
      hitech: () => renderSimpleLedger("hitech"),
      books: renderBooks,
      closing: renderClosing,
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
            <h2>改善済みの懸念</h2>
            <span class="badge good">10項目</span>
          </div>
          <div class="panel-body">
            <div class="check-list">
              ${[
                "全体バックアップと復元",
                "保存容量と最終バックアップ日",
                "証憑未添付チェック",
                "カード/現金/口座振込の識別",
                "T番号と1万円以上の確認",
                "請求書と売上入金の照合",
                "金額差・期限超過・請求書なし売上の検出",
                "決算またぎの税理士確認表示",
                "削除を含む監査ログ",
                "税理士提出パックの一括出力"
              ].map((item) => `<span>✓ ${esc(item)}</span>`).join("")}
            </div>
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
    document.getElementById("detectPaymentButton").addEventListener("click", () => {
      const form = document.getElementById("receiptForm");
      form.elements.paymentMethod.value = detectPayment(`${form.elements.note.value} ${form.elements.proof.value}`) || form.elements.paymentMethod.value;
    });
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
    document.getElementById("exportExpensesCsv").addEventListener("click", () => exportCsv("expenses", expenses, [
      ["date", "日付"], ["category", "経費科目"], ["department", "部門"], ["vendor", "取引先"], ["itemName", "品名"],
      ["quantity", "個数"], ["unitPrice", "単価"], ["amount", "金額"], ["paymentMethod", "支払区分"],
      ["taxRate", "税区分"], ["registrationNumber", "T番号"], ["invoiceEligible", "インボイス適格"], ["note", "摘要"]
    ]));
    bindFilterControls("expenses");
    bindTableActions();
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
        <div class="actions" style="grid-column:1 / -1;">
          <button class="button" type="submit">${esc(buttonLabel)}</button>
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
    state.expenses.push(record);
    addAudit("経費登録", record);
    persist("経費保存");
    if (activeView === "receipts") renderReceipts();
    else renderExpenses();
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
        <div class="panel-body">
          <form id="invoiceForm" class="form-grid">
            ${field("invoiceNo", "請求書番号", "text", nextInvoiceNo())}
            ${field("issueDate", "請求日", "date", TODAY)}
            ${field("serviceDate", "実施日", "date", TODAY)}
            ${field("dueDate", "支払期限", "date", endOfNextMonth(TODAY))}
            ${field("expectedPaymentDate", "入金予定日", "date", endOfNextMonth(TODAY))}
            ${field("paymentDate", "入金日", "date", "")}
            ${field("customer", "請求先", "text", "")}
            ${field("content", "内容", "text", "")}
            ${selectField("classification", "分類", salesCategories, "業務委託")}
            ${selectField("department", "部門", departments(), departments()[0])}
            ${field("amount", "金額", "number", "")}
            ${selectField("taxRate", "税区分", taxRates, "10%")}
            ${selectField("status", "状態", invoiceStatuses, "未入金")}
            <label class="field" style="grid-column:1 / -1;"><span>税理士確認メモ</span><textarea name="note" placeholder="決算またぎ、実施日の考え方、支払いとのずれなど"></textarea></label>
            <div class="actions" style="grid-column:1 / -1;"><button class="button" type="submit">請求書登録</button></div>
          </form>
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
    document.getElementById("exportInvoicesCsv").addEventListener("click", () => exportCsv("invoices", invoices, [
      ["invoiceNo", "請求書番号"], ["issueDate", "請求日"], ["serviceDate", "実施日"], ["dueDate", "支払期限"],
      ["expectedPaymentDate", "入金予定日"], ["paymentDate", "入金日"], ["customer", "請求先"], ["content", "内容"],
      ["classification", "分類"], ["department", "部門"], ["amount", "金額"], ["status", "状態"], ["note", "確認メモ"]
    ]));
    bindFilterControls("invoices");
    bindTableActions();
  }

  function handleInvoiceSubmit(event) {
    event.preventDefault();
    const data = formValues(event.currentTarget);
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
      amount: num(data.amount),
      taxRate: data.taxRate || "10%",
      status: data.paymentDate ? "入金済" : data.status || "未入金",
      note: data.note,
      createdAt: new Date().toISOString()
    };
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
        <div class="panel-body">
          <form id="estimateForm" class="form-grid">
            ${field("estimateNo", "見積番号", "text", nextEstimateNo())}
            ${field("date", "見積日", "date", TODAY)}
            ${field("customer", "提出先", "text", "")}
            ${selectField("classification", "分類", salesCategories, "業務委託")}
            ${selectField("department", "部門", departments(), departments()[0])}
            ${field("content", "内容", "text", "")}
            ${field("amount", "金額", "number", "")}
            ${selectField("status", "状態", ["作成中", "提出済", "受注", "失注", "保留"], "作成中")}
            ${field("linkedInvoiceNo", "請求書番号", "text", "")}
            <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note"></textarea></label>
            <div class="actions" style="grid-column:1 / -1;"><button class="button" type="submit">見積登録</button></div>
          </form>
        </div>
      </section>
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>見積一覧</h2><span class="badge">${estimates.length}件</span></div>
        <div class="panel-body">${renderEstimateTable(estimates)}</div>
      </section>
    `;
    document.getElementById("estimateForm").addEventListener("submit", handleEstimateSubmit);
    document.getElementById("exportEstimatesCsv").addEventListener("click", () => exportCsv("estimates", estimates, [
      ["estimateNo", "見積番号"], ["date", "見積日"], ["customer", "提出先"], ["classification", "分類"],
      ["department", "部門"], ["content", "内容"], ["amount", "金額"], ["status", "状態"], ["linkedInvoiceNo", "請求書番号"], ["note", "メモ"]
    ]));
    bindTableActions();
  }

  function handleEstimateSubmit(event) {
    event.preventDefault();
    const data = formValues(event.currentTarget);
    const record = {
      id: uid("est"),
      estimateNo: data.estimateNo || nextEstimateNo(),
      date: data.date || TODAY,
      customer: data.customer,
      classification: data.classification,
      department: data.department || departments()[0],
      content: data.content,
      amount: num(data.amount),
      status: data.status,
      linkedInvoiceNo: data.linkedInvoiceNo,
      note: data.note,
      createdAt: new Date().toISOString()
    };
    state.estimates.push(record);
    addAudit("見積登録", record);
    persist("見積保存");
    renderEstimates();
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
      ["amount", "金額"], ["taxRate", "税区分"], ["registrationNumber", "T番号"], ["invoiceEligible", "インボイス適格"], ["note", "摘要"]
    ]));
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
    `;

    document.getElementById("closingForm").addEventListener("submit", handleClosingSubmit);
    document.getElementById("exportPackage").addEventListener("click", exportAccountantPackage);
    document.getElementById("exportSubmissionSummary").addEventListener("click", exportSubmissionSummary);
    document.getElementById("exportClosingCsv").addEventListener("click", () => exportCsv("closings", closings, [
      ["month", "対象月"], ["closeType", "締め"], ["status", "状態"], ["note", "メモ"], ["createdAt", "登録日時"]
    ]));
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
            <label class="field" style="grid-column:1 / -1;"><span>税理士メモ</span><textarea name="accountantMemo">${esc(state.settings.accountantMemo || "")}</textarea></label>
            <label class="field" style="grid-column:1 / -1;"><span>経費科目</span><textarea name="categories">${esc(categories().join("\n"))}</textarea></label>
            <label class="field" style="grid-column:1 / -1;"><span>部門</span><textarea name="departments">${esc(departments().join("\n"))}</textarea></label>
            <div class="actions" style="grid-column:1 / -1;">
              <button class="button" type="submit">保存</button>
              <button class="button danger" id="clearDataButton" type="button">全データ削除</button>
            </div>
          </form>
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

  function handleSettingsSubmit(event) {
    event.preventDefault();
    const data = formValues(event.currentTarget);
    state.settings.companyName = data.companyName || "CDP北海道";
    state.settings.bankAccount = data.bankAccount || "道銀";
    state.settings.fiscalStartMonth = Number(data.fiscalStartMonth) || DEFAULT_FISCAL_START_MONTH;
    state.settings.backupReminderDays = Math.max(1, Number(data.backupReminderDays) || 7);
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
    if (isMonthLocked(recordMonth(trashItem.collection, record))) {
      alert("この月は月末締めが完了しているため、復元できません。締め状態を確認してください。");
      return;
    }
    if (!Array.isArray(state[trashItem.collection])) state[trashItem.collection] = [];
    state[trashItem.collection].push(record);
    state.trash = state.trash.filter((item) => item.id !== trashId);
    addAudit(`${collectionLabel(trashItem.collection)}復元`, record);
    persist("復元");
    renderSettings();
  }

  function purgeTrashItem(trashId) {
    if (!confirm("削除済みデータを完全に削除します。バックアップ後に実行してください。")) return;
    const trashItem = (state.trash || []).find((item) => item.id === trashId);
    state.trash = (state.trash || []).filter((item) => item.id !== trashId);
    addAudit("削除済みデータ完全削除", trashItem || { id: trashId });
    persist("完全削除");
    renderSettings();
  }

  function isMonthLocked(month) {
    if (!month) return false;
    return state.closings.some((item) => item.month === month && item.closeType === "月末" && item.status === "完了");
  }

  function lockedMonths() {
    return fiscalMonths(selectedFiscalYear).filter((month) => isMonthLocked(month));
  }

  function recordMonth(collection, record) {
    const date = recordDate(collection, record);
    return date ? date.slice(0, 7) : "";
  }

  function recordDate(collection, record) {
    if (!record) return "";
    if (collection === "invoices") return record.serviceDate || record.issueDate || record.expectedPaymentDate || record.paymentDate || "";
    if (collection === "payroll") return record.payDate || (record.payMonth ? `${record.payMonth}-01` : "");
    if (collection === "closings") return record.month ? `${record.month}-01` : "";
    return record.date || record.issueDate || record.createdAt || "";
  }

  function recordSummary(collection, record) {
    if (!record) return "";
    if (collection === "expenses") return [record.vendor, record.itemName, record.category].filter(Boolean).join(" / ");
    if (collection === "sales") return [record.customer, record.content, record.invoiceNo].filter(Boolean).join(" / ");
    if (collection === "invoices") return [record.invoiceNo, record.customer, record.content].filter(Boolean).join(" / ");
    if (collection === "estimates") return [record.estimateNo, record.customer, record.content].filter(Boolean).join(" / ");
    if (collection === "trips") return [record.destination, record.purpose].filter(Boolean).join(" / ");
    if (collection === "payroll") return [record.payMonth, record.employee].filter(Boolean).join(" / ");
    if (collection === "hitech") return [record.sender, record.instructor, record.course].filter(Boolean).join(" / ");
    return record.note || record.id || "";
  }

  function collectionLabel(collection) {
    const labels = {
      expenses: "経費",
      sales: "売上",
      invoices: "請求書",
      estimates: "見積",
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
          <thead><tr><th>日付</th><th>科目</th><th>部門</th><th>取引先</th><th>品名</th><th class="num">個数</th><th class="num">単価</th><th class="num">金額</th><th>支払</th><th>税区分</th><th>T番号</th><th>証憑</th><th>操作</th></tr></thead>
          <tbody>${items.map((item) => `<tr>
            <td>${esc(formatDate(item.date))}</td><td>${esc(item.category)}</td><td>${esc(item.department || departments()[0])}</td><td>${esc(item.vendor)}</td><td>${esc(item.itemName)}</td>
            <td class="num">${esc(item.quantity || "")}</td><td class="num">${item.unitPrice ? yen(item.unitPrice) : ""}</td><td class="num">${yen(item.amount)}</td>
            <td>${paymentBadge(item.paymentMethod)}</td><td>${esc(item.taxRate || "")}</td>
            <td>${registrationBadge(item)}</td><td>${item.proof ? '<span class="badge good">有</span>' : '<span class="badge warn">無</span>'}</td><td>${rowActions("expenses", item.id)}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
    `;
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

  function renderInvoiceTable(items) {
    if (!items.length) return `<div class="empty">請求書データはありません。</div>`;
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>番号</th><th>請求日</th><th>実施日</th><th>支払期限</th><th>入金予定</th><th>入金日</th><th>請求先</th><th>内容</th><th class="num">金額</th><th>状態</th><th>確認</th><th>操作</th></tr></thead>
          <tbody>${items.map((item) => {
            const sale = findSaleForInvoice(item);
            const crossing = fiscalCrossing(item);
            const mismatch = sale && num(sale.amount) !== num(item.amount);
            return `<tr>
              <td>${esc(item.invoiceNo)}</td><td>${esc(formatDate(item.issueDate))}</td><td>${esc(formatDate(item.serviceDate))}</td><td>${esc(formatDate(item.dueDate))}</td><td>${esc(formatDate(item.expectedPaymentDate))}</td><td>${esc(formatDate(item.paymentDate))}</td>
              <td>${esc(item.customer)}</td><td>${esc(item.content)}</td><td class="num">${yen(item.amount)}</td><td>${statusBadge(item.status)}</td>
              <td>${crossing ? '<span class="badge bad">決算またぎ</span>' : ""} ${mismatch ? '<span class="badge bad">金額差</span>' : ""}</td>
              <td>${rowActions("invoices", item.id)} <button class="button small secondary" data-action="issue-invoice" data-id="${esc(item.id)}" type="button">請求書発行</button> ${item.status !== "入金済" ? `<button class="button small secondary" data-action="make-sale" data-id="${esc(item.id)}" type="button">売上化</button>` : ""}</td>
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
        <thead><tr><th>番号</th><th>日付</th><th>提出先</th><th>分類</th><th>部門</th><th>内容</th><th class="num">金額</th><th>状態</th><th>請求書番号</th><th>操作</th></tr></thead>
        <tbody>${items.map((item) => `<tr><td>${esc(item.estimateNo)}</td><td>${esc(formatDate(item.date))}</td><td>${esc(item.customer)}</td><td>${esc(item.classification)}</td><td>${esc(item.department || "")}</td><td>${esc(item.content)}</td><td class="num">${yen(item.amount)}</td><td>${statusBadge(item.status)}</td><td>${esc(item.linkedInvoiceNo || "")}</td><td>${rowActions("estimates", item.id)} <button class="button small secondary" data-action="issue-estimate" data-id="${esc(item.id)}" type="button">見積書発行</button>${item.linkedInvoiceNo ? "" : ` <button class="button small secondary" data-action="estimate-to-invoice" data-id="${esc(item.id)}" type="button">請求書化</button>`}</td></tr>`).join("")}</tbody>
      </table></div>
    `;
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
          <div class="actions"><span class="badge">${sorted.length}件</span><span class="badge">${yen(sum(sorted, "amount"))}</span></div>
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
                <div class="receipt-meta"><span>${esc(item.category)}</span><strong>${yen(item.amount)}</strong></div>
                <div class="actions">${rowActions("expenses", item.id)}</div>
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
          <thead><tr><th>月</th><th>15日前後</th><th>月末</th><th>メモ</th></tr></thead>
          <tbody>${months.map((month) => {
            const mid = closings.find((item) => item.month === month && item.closeType === "15日前後");
            const end = closings.find((item) => item.month === month && item.closeType === "月末");
            return `<tr><td>${esc(month)}</td><td>${mid ? statusBadge(mid.status) : '<span class="badge warn">未</span>'}</td><td>${end ? statusBadge(end.status) : '<span class="badge warn">未</span>'}</td><td>${esc([mid && mid.note, end && end.note].filter(Boolean).join(" / "))}</td></tr>`;
          }).join("")}</tbody>
        </table>
      </div>
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
    bindTableActions();
  }

  function bindTableActions() {
    app.querySelectorAll("[data-action='delete']").forEach((button) => {
      button.addEventListener("click", () => {
        const collection = button.dataset.collection;
        const id = button.dataset.id;
        const item = (state[collection] || []).find((record) => record.id === id);
        if (!item) return;
        if (isMonthLocked(recordMonth(collection, item))) {
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

    app.querySelectorAll("[data-action='estimate-to-invoice']").forEach((button) => {
      button.addEventListener("click", () => {
        const estimate = state.estimates.find((item) => item.id === button.dataset.id);
        if (estimate) createInvoiceFromEstimate(estimate);
      });
    });

    app.querySelectorAll("[data-action='make-sale']").forEach((button) => {
      button.addEventListener("click", () => {
        const invoice = state.invoices.find((item) => item.id === button.dataset.id);
        if (!invoice) return;
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
        renderInvoices();
      });
    });
  }

  function showDetail(collection, id) {
    const item = (state[collection] || []).find((record) => record.id === id);
    if (!item) return;
    dialogTitle.textContent = "詳細";
    const proof = item.proof;
    const rows = Object.entries(item)
      .filter(([key]) => !["id", "proof"].includes(key))
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
        ${editFieldsFor(collection, item)}
        <div class="actions" style="grid-column:1 / -1;">
          <button class="button" type="submit">保存</button>
          <button class="button secondary" data-action="cancel-edit" type="button">キャンセル</button>
        </div>
      </form>
    `;
    const form = document.getElementById("editRecordForm");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await updateRecordFromEdit(collection, id, form);
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
        ${selectField("status", "状態", invoiceStatuses, item.status || "未入金")}
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
        ${selectField("status", "状態", ["作成中", "提出済", "受注", "失注", "保留"], item.status || "作成中")}
        ${field("linkedInvoiceNo", "請求書番号", "text", item.linkedInvoiceNo || "")}
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
    if (!item) return;
    const data = formValues(form);
    const formData = new FormData(form);
    const numericFields = ["quantity", "unitPrice", "amount", "mileage", "fuelClaim", "lodging", "total", "basePay", "allowance", "deduction", "netPay"];

    Object.entries(data).forEach(([key, value]) => {
      if (key === "proof" || key === "invoiceEligible") return;
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
    if (collection === "trips" && !num(item.total)) item.total = num(item.fuelClaim) + num(item.lodging);
    if (collection === "payroll" && !num(item.netPay)) item.netPay = num(item.basePay) + num(item.allowance) - num(item.deduction);
    if (collection === "sales") markInvoicePaidFromSale(item);
    if (collection === "invoices" && item.paymentDate) item.status = "入金済";
    item.updatedAt = new Date().toISOString();
    addAudit(`${collection}編集`, item);
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
      sales: fiscalItems(state.sales, "date"),
      invoices: fiscalInvoices(),
      estimates: fiscalItems(state.estimates, "date"),
      trips: fiscalItems(state.trips, "date"),
      payroll: fiscalItems(state.payroll, "payMonth"),
      hitech: fiscalItems(state.hitech, "date"),
      closings: state.closings.filter((item) => item.month && getFiscalYear(`${item.month}-01`) === selectedFiscalYear),
      journals: fiscalItems(state.journals, "date"),
      bookEntries: fiscalBookEntries(),
      trash: state.trash || [],
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

  function createInvoiceFromEstimate(estimate) {
    if (estimate.linkedInvoiceNo) {
      alert("この見積にはすでに請求書番号が紐づいています。");
      return;
    }
    if (isMonthLocked(recordMonth("estimates", estimate))) {
      alert("この見積月は月末締めが完了しているため、請求書化できません。締め状態を確認してください。");
      return;
    }
    const now = new Date().toISOString();
    const invoiceNo = nextInvoiceNo();
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
      amount: num(estimate.amount),
      taxRate: "10%",
      status: "未入金",
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
    renderEstimates();
  }

  function businessDocumentHtml(type, record) {
    const isInvoice = type === "invoice";
    const title = isInvoice ? "請求書" : "見積書";
    const number = isInvoice ? record.invoiceNo : record.estimateNo;
    const partnerLabel = isInvoice ? "請求先" : "提出先";
    const partner = record.customer || "";
    const rows = isInvoice ? [
      ["請求書番号", record.invoiceNo],
      ["請求日", formatDate(record.issueDate)],
      ["実施日", formatDate(record.serviceDate)],
      ["支払期限", formatDate(record.dueDate)],
      ["入金予定日", formatDate(record.expectedPaymentDate)],
      ["入金日", formatDate(record.paymentDate)],
      ["請求先", record.customer],
      ["内容", record.content],
      ["分類", record.classification],
      ["部門", record.department],
      ["税区分", record.taxRate || "未設定"],
      ["状態", record.status],
      ["振込先", state.settings.bankAccount || "道銀"],
      ["税理士確認メモ", record.note]
    ] : [
      ["見積番号", record.estimateNo],
      ["見積日", formatDate(record.date)],
      ["提出先", record.customer],
      ["内容", record.content],
      ["分類", record.classification],
      ["部門", record.department],
      ["状態", record.status],
      ["関連請求書番号", record.linkedInvoiceNo],
      ["メモ", record.note]
    ];

    return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>${esc(title)} ${esc(number || "")}</title>
  <style>
    body{font-family:"Yu Gothic",Meiryo,sans-serif;background:#f3f6fa;color:#182235;margin:0;line-height:1.65}
    .sheet{max-width:860px;margin:24px auto;background:#fff;padding:44px;border:1px solid #d7deea}
    .top{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #2f5f9f;padding-bottom:18px}
    h1{font-size:32px;margin:0;letter-spacing:0}.number{font-size:14px;color:#637087;margin-top:8px}
    .company{text-align:right}.company strong{font-size:18px}.muted{color:#637087}.partner{font-size:20px;margin:26px 0 18px}
    table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #d8dee8;padding:10px 12px;text-align:left;vertical-align:top}th{width:210px;background:#e8f1fb}
    .amount{margin:28px 0;padding:18px 22px;background:#eef5ff;border-left:5px solid #2f5f9f;display:flex;justify-content:space-between;align-items:baseline}
    .amount span{font-size:15px}.amount strong{font-size:30px}.note{margin-top:22px;padding:14px;background:#fff8e6;border:1px solid #ead8a6}
    .actions{margin-top:22px}.button{border:1px solid #2f5f9f;background:#2f5f9f;color:#fff;border-radius:4px;padding:9px 16px;cursor:pointer}
    @media print{body{background:#fff}.sheet{margin:0;border:0}.actions{display:none}}
  </style>
</head>
<body>
  <main class="sheet">
    <div class="top">
      <div>
        <h1>${esc(title)}</h1>
        <div class="number">${esc(number || "")}</div>
      </div>
      <div class="company">
        <strong>${esc(state.settings.companyName || "CDP北海道")}</strong><br>
        <span class="muted">出力日 ${esc(formatDate(TODAY))}</span>
      </div>
    </div>
    <div class="partner">${esc(partner || partnerLabel)} 御中</div>
    <div class="amount"><span>${esc(title)}金額</span><strong>${esc(yen(record.amount))}</strong></div>
    <table><tbody>${rows.map(([label, value]) => `<tr><th>${esc(label)}</th><td>${esc(value || "")}</td></tr>`).join("")}</tbody></table>
    <div class="note">
      ${isInvoice
        ? "請求日、実施日、支払期限、入金予定日、入金日を会計判断用に残しています。決算またぎや売上計上日は担当税理士に確認してください。"
        : "見積書は記録として保存し、受注後は見積一覧から請求書化できます。金額や条件に変更がある場合は請求書化前に見積を編集してください。"}
    </div>
    <div class="actions"><button class="button" onclick="window.print()">印刷</button></div>
  </main>
</body>
</html>`;
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

  async function importSalesCsv(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const rows = csvObjects(await file.text());
      let count = 0;
      rows.forEach((row) => {
        const date = normalizeDateText(pick(row, ["入金日", "取引日", "日付", "年月日", "date"]));
        const amount = positiveAmount(pick(row, ["入金額", "金額", "取引金額", "amount"]));
        if (!date || !amount) return;
        const invoiceNo = pick(row, ["請求書番号", "請求番号", "invoiceNo", "invoice"]);
        const customer = pick(row, ["取引先", "振込依頼人", "摘要", "内容", "name"]);
        const content = pick(row, ["内容", "摘要", "取引内容", "メモ", "description"]) || "通帳CSV取込";
        state.sales.push({
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
        });
        markInvoicePaidFromSale(state.sales[state.sales.length - 1]);
        count += 1;
      });
      addAudit("通帳CSV取込", { id: `${file.name} ${count}件` });
      persist("CSV取込");
      alert(`${count}件の売上入金を取り込みました。`);
      renderSales();
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
      rows.forEach((row) => {
        const date = normalizeDateText(pick(row, ["利用日", "取引日", "日付", "年月日", "date"]));
        const amount = positiveAmount(pick(row, ["利用金額", "金額", "取引金額", "amount"]));
        if (!date || !amount) return;
        state.expenses.push({
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
        });
        count += 1;
      });
      addAudit("カードCSV取込", { id: `${file.name} ${count}件` });
      persist("CSV取込");
      alert(`${count}件のカード経費を取り込みました。`);
      renderCards();
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
      target: payload ? [payload.invoiceNo, payload.estimateNo, payload.vendor, payload.customer, payload.id].filter(Boolean).join(" / ") : ""
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

  function selectField(name, label, options, selected) {
    const optionHtml = options.map((option) => {
      const value = Array.isArray(option) ? option[0] : option;
      const text = Array.isArray(option) ? option[1] : option;
      return `<option value="${esc(value)}" ${String(value) === String(selected) ? "selected" : ""}>${esc(text)}</option>`;
    }).join("");
    return `<label class="field"><span>${esc(label)}</span><select name="${esc(name)}">${optionHtml}</select></label>`;
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
    const locked = item && isMonthLocked(recordMonth(collection, item));
    return `<div class="actions"><button class="button small secondary" data-action="detail" data-collection="${esc(collection)}" data-id="${esc(id)}" type="button">詳細</button>${locked ? '<span class="badge warn">ロック中</span>' : `<button class="button small secondary" data-action="edit" data-collection="${esc(collection)}" data-id="${esc(id)}" type="button">編集</button><button class="button small danger" data-action="delete" data-collection="${esc(collection)}" data-id="${esc(id)}" type="button">削除</button>`}</div>`;
  }

  function paymentBadge(value) {
    const label = paymentLabel(value);
    const cls = value === "card" ? "card" : value === "cash" ? "cash" : value === "bank" ? "bank" : "";
    return `<span class="badge ${cls}">${esc(label)}</span>`;
  }

  function paymentLabel(value) {
    return paymentMethods.find((item) => item[0] === value)?.[1] || "その他";
  }

  function statusBadge(value) {
    const text = value || "未処理";
    const cls = ["完了", "入金済", "受注"].includes(text) ? "good" : ["期限超過", "保留", "失注"].includes(text) ? "bad" : "warn";
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

  function nextEstimateNo() {
    return `EST-${selectedFiscalYear}-${String(state.estimates.length + 1).padStart(4, "0")}`;
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
    if (key.toLowerCase().includes("date") || key === "createdAt" || key === "at") return String(value).includes("T") ? formatDateTime(value) : formatDate(value);
    if (["amount", "unitPrice", "fuelClaim", "lodging", "total", "basePay", "allowance", "deduction", "netPay", "debit", "credit", "balance", "previous", "current", "diff"].includes(key)) return yen(value);
    if (key === "paymentMethod") return paymentLabel(value);
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
      paymentMethod: "支払区分",
      taxRate: "税区分",
      registrationNumber: "T番号",
      invoiceEligible: "インボイス適格",
      note: "メモ",
      invoiceNo: "請求書番号",
      customer: "取引先",
      content: "内容",
      classification: "分類",
      status: "状態",
      createdAt: "登録日時"
    };
    return labels[key] || key;
  }

  function clean(value) {
    return String(value || "").trim();
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
