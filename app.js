(function () {
  "use strict";

  const STORAGE_KEY = "cdp-accounting-system-v1";
  const TODAY = dateToInput(new Date());
  const DEFAULT_FISCAL_START_MONTH = 6;

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
  const paymentMethods = [
    { value: "card", label: "カード" },
    { value: "cash", label: "現金" },
    { value: "bank", label: "振込" },
    { value: "other", label: "その他" }
  ];
  const defaultDepartments = ["共通費"];

  const ledgers = {
    trips: "出張台帳",
    payroll: "給与台帳",
    hitech: "ハイテク台帳"
  };

  const accountDefinitions = [
    { name: "現金", type: "asset", group: "流動資産", normal: "debit" },
    { name: "普通預金", type: "asset", group: "流動資産", normal: "debit" },
    { name: "売掛金", type: "asset", group: "流動資産", normal: "debit" },
    { name: "クレジットカード未払", type: "liability", group: "流動負債", normal: "credit" },
    { name: "未払金", type: "liability", group: "流動負債", normal: "credit" },
    { name: "預り金", type: "liability", group: "流動負債", normal: "credit" },
    { name: "資本金", type: "equity", group: "株主資本", normal: "credit" },
    { name: "繰越利益剰余金", type: "equity", group: "利益剰余金", normal: "credit" },
    { name: "売上高", type: "revenue", group: "売上", normal: "credit" },
    { name: "売上原価", type: "expense", group: "売上原価", normal: "debit" },
    { name: "給与手当", type: "expense", group: "販売費及び一般管理費", normal: "debit" }
  ];

  const bookAccountNames = () => [...new Set([...accountDefinitions.map((item) => item.name), ...categories()])];
  const assetAccounts = ["現金", "普通預金", "売掛金"];
  const liabilityAccounts = ["クレジットカード未払", "未払金", "預り金"];
  const equityAccounts = ["資本金", "繰越利益剰余金"];
  const revenueAccounts = ["売上高"];
  const expenseAccounts = () => [...new Set(["売上原価", "給与手当", ...categories().filter((item) => item !== "未分類")])];

  const pageMeta = {
    dashboard: ["ホーム", "月次状況、未処理、決算またぎ、税理士提出前チェック"],
    receipts: ["レシート管理", "月ごとに証憑画像を保存し、カードと現金を分けて確認"],
    expenses: ["経費表", "税理士提出用の科目別集計と構成比"],
    sales: ["売上", "道銀の振込入金を売上一覧で管理"],
    invoices: ["請求書", "請求番号、実施日、支払予定日、入金日のずれを管理"],
    estimates: ["見積", "見積番号、金額、請求化状況を記録"],
    trips: ["出張台帳", "移動、宿泊、ガソリン請求を記録"],
    payroll: ["給与台帳", "月別の給与、手当、控除、支払日を記録"],
    cards: ["カード台帳", "カード明細、領収書、T番号、1万円以上の確認"],
    hitech: ["ハイテク台帳", "送付資料、講師関連、入出金状況を記録"],
    books: ["会計帳簿", "総勘定元帳、補助元帳、残高試算表、推移表"],
    closing: ["締め・提出", "15日前後と月末締め、税理士提出データの点検"],
    settings: ["設定", "会社名、決算月、分類、データ保守"]
  };

  let state = loadState();
  let activeView = "dashboard";
  let selectedFiscalYear = getFiscalYear(TODAY);
  let receiptPaymentFilter = "all";
  let bookState = {
    tab: "general",
    report: "bs",
    period: "monthly",
    account: "現金",
    subAccount: "全て",
    taxMode: "taxExcluded",
    showZero: true
  };

  const app = document.getElementById("app");
  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");
  const fiscalYearSelect = document.getElementById("fiscalYearSelect");
  const saveStatus = document.getElementById("saveStatus");
  const dialog = document.getElementById("recordDialog");
  const dialogTitle = document.getElementById("dialogTitle");
  const dialogBody = document.getElementById("dialogBody");

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    seedFiscalOptions();
    bindGlobalEvents();
    render();
  }

  function loadState() {
    const empty = {
      settings: {
        companyName: "CDP北海道",
        fiscalStartMonth: DEFAULT_FISCAL_START_MONTH,
        accountantMemo: "税理士提出用。顧客管理システムとは分離。",
        bankAccount: "道銀",
        categories: expenseCategories,
        departments: defaultDepartments
      },
      expenses: [],
      sales: [],
      invoices: [],
      estimates: [],
      trips: [],
      payroll: [],
      hitech: [],
      closings: [],
      journals: []
    };

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return empty;
      const parsed = JSON.parse(raw);
      return {
        ...empty,
        ...parsed,
        settings: { ...empty.settings, ...(parsed.settings || {}) },
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
        sales: Array.isArray(parsed.sales) ? parsed.sales : [],
        invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
        estimates: Array.isArray(parsed.estimates) ? parsed.estimates : [],
        trips: Array.isArray(parsed.trips) ? parsed.trips : [],
        payroll: Array.isArray(parsed.payroll) ? parsed.payroll : [],
        hitech: Array.isArray(parsed.hitech) ? parsed.hitech : [],
        closings: Array.isArray(parsed.closings) ? parsed.closings : [],
        journals: Array.isArray(parsed.journals) ? parsed.journals : []
      };
    } catch (error) {
      console.error(error);
      return empty;
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveStatus.textContent = `保存済 ${new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`;
  }

  function bindGlobalEvents() {
    document.querySelectorAll(".nav-item").forEach((button) => {
      button.addEventListener("click", () => {
        activeView = button.dataset.view;
        document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("is-active", item === button));
        render();
      });
    });

    fiscalYearSelect.addEventListener("change", () => {
      selectedFiscalYear = Number(fiscalYearSelect.value);
      render();
    });

    document.getElementById("exportAllButton").addEventListener("click", exportAllData);
    document.getElementById("importAllInput").addEventListener("change", importAllData);
    document.getElementById("dialogClose").addEventListener("click", () => dialog.close());
  }

  function seedFiscalOptions() {
    const current = getFiscalYear(TODAY);
    const years = [];
    for (let year = current - 2; year <= current + 2; year += 1) years.push(year);
    fiscalYearSelect.innerHTML = years
      .map((year) => `<option value="${year}">${year}年度</option>`)
      .join("");
    fiscalYearSelect.value = selectedFiscalYear;
  }

  function render() {
    const [title, subtitle] = pageMeta[activeView] || pageMeta.dashboard;
    const range = getFiscalRange(selectedFiscalYear);
    pageTitle.textContent = title;
    pageSubtitle.textContent = `${subtitle} / ${formatDate(range.start)} - ${formatDate(range.end)}`;
    fiscalYearSelect.value = selectedFiscalYear;

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

    app.innerHTML = "";
    (renderers[activeView] || renderDashboard)();
  }

  function renderDashboard() {
    const expenses = fiscalItems(state.expenses, "date");
    const sales = fiscalItems(state.sales, "date");
    const invoices = fiscalInvoices();
    const expenseTotal = sum(expenses, "amount");
    const salesTotal = sum(sales, "amount");
    const unpaidInvoices = invoices.filter((invoice) => invoice.status !== "入金済");
    const alerts = getAlerts();
    const categorySummary = summarizeExpenses(expenses);

    app.innerHTML = `
      <div class="grid cols-4">
        ${summaryCard("経費合計", yen(expenseTotal), `${expenses.length}件 / カード ${yen(sum(expenses.filter((item) => item.paymentMethod === "card"), "amount"))}`)}
        ${summaryCard("売上入金", yen(salesTotal), `${sales.length}件 / ${state.settings.bankAccount || "道銀"}`)}
        ${summaryCard("請求書", `${invoices.length}件`, `未入金 ${unpaidInvoices.length}件`)}
        ${summaryCard("営業残", yen(salesTotal - expenseTotal), "売上入金 - 経費")}
      </div>

      <div class="grid cols-2" style="margin-top:14px;">
        <section class="panel">
          <div class="panel-head">
            <h2>要確認</h2>
            <span class="badge ${alerts.length ? "warn" : "good"}">${alerts.length}件</span>
          </div>
          <div class="panel-body">
            ${alerts.length ? `<div class="alert-list">${alerts.slice(0, 8).map(renderAlert).join("")}</div>` : `<div class="notice info">提出前の大きな未処理はありません。</div>`}
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>科目構成</h2>
            <button class="button secondary small" data-view-jump="expenses" type="button">経費表</button>
          </div>
          <div class="panel-body">
            ${categorySummary.length ? categorySummary.slice(0, 6).map((row) => `
              <div style="margin-bottom:12px;">
                <div class="receipt-meta"><strong>${esc(row.category)}</strong><span>${yen(row.amount)} / ${row.percent.toFixed(1)}%</span></div>
                <div class="progress-bar"><span style="width:${Math.min(row.percent, 100)}%"></span></div>
              </div>
            `).join("") : `<div class="empty">経費データがありません。</div>`}
          </div>
        </section>
      </div>

      <section class="panel" style="margin-top:14px;">
        <div class="panel-head">
          <h2>請求・売上計上メモ</h2>
          <span class="badge warn">税理士確認前提</span>
        </div>
        <div class="panel-body">
          <div class="notice">
            <p><strong>6月25日請求、7月末支払、7月25日入金の扱い:</strong> このシステムでは7月25日の振込を売上一覧に登録し、請求書側に請求日・実施日・支払予定日・入金日を残します。決算をまたぐ場合は、入金日だけで判断せず、実施日や役務提供完了日を税理士が確認できるように要確認表示を出します。</p>
            <p><span class="red-note">担当税理士に確認が必要:</span> 5月末決算をまたぐ請求、長期案件、前受・未収が疑われる請求。</p>
            <p class="source-links">参照: <a href="https://www.nta.go.jp/law/" target="_blank" rel="noreferrer">国税庁 法令等</a> / <a href="https://www.nta.go.jp/law/tsutatsu/kihon/hojin/01.htm" target="_blank" rel="noreferrer">法人税基本通達</a> / <a href="https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/invoice.htm" target="_blank" rel="noreferrer">インボイス制度特設サイト</a></p>
          </div>
        </div>
      </section>
    `;

    app.querySelectorAll("[data-view-jump]").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.viewJump));
    });
  }

  function renderReceipts() {
    const expenses = fiscalItems(state.expenses, "date");
    const filtered = receiptPaymentFilter === "all" ? expenses : expenses.filter((item) => item.paymentMethod === receiptPaymentFilter);
    const grouped = groupByMonth(filtered, "date");

    app.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <h2>レシート登録</h2>
          <span class="badge">${state.settings.companyName}</span>
        </div>
        <div class="panel-body">
          <form id="receiptForm" class="form-grid">
            ${field("date", "日付", "date", TODAY)}
            ${field("vendor", "取引先", "text", "", "例: ENEOS")}
            ${selectField("category", "経費科目", categories(), "燃料費")}
            ${selectField("paymentMethod", "支払区分", paymentMethods.map((item) => [item.value, item.label]), "cash")}
            ${field("itemName", "品名", "text", "", "例: ガソリン")}
            ${field("quantity", "個数", "number", "1")}
            ${field("unitPrice", "単価", "number", "")}
            ${field("amount", "金額", "number", "")}
            ${selectField("taxRate", "税区分", taxRates, "10%")}
            ${field("registrationNumber", "T番号", "text", "", "T1234567890123")}
            <label class="check-field"><input name="invoiceEligible" type="checkbox" checked> インボイス適格</label>
            <label class="field">
              <span>証憑画像</span>
              <input name="proof" type="file" accept="image/*,application/pdf">
            </label>
            <label class="field" style="grid-column:1 / -1;">
              <span>摘要・文字起こし</span>
              <textarea name="note" placeholder="カード払い、現金、用途、領収書の文字など"></textarea>
            </label>
            <div class="actions" style="grid-column:1 / -1;">
              <button class="button" type="submit">登録</button>
              <button class="button secondary" id="detectPaymentButton" type="button">支払区分を判定</button>
            </div>
          </form>
        </div>
      </section>

      <section class="panel" style="margin-top:14px;">
        <div class="panel-head">
          <h2>月別フォルダ</h2>
          <div class="tabs" style="margin:0;">
            ${receiptFilterTab("all", "全て")}
            ${receiptFilterTab("card", "カード")}
            ${receiptFilterTab("cash", "現金")}
          </div>
        </div>
        <div class="panel-body">
          ${Object.keys(grouped).length ? Object.entries(grouped).map(([month, records]) => renderReceiptMonth(month, records)).join("") : `<div class="empty">この年度のレシートはありません。</div>`}
        </div>
      </section>
    `;

    const form = document.getElementById("receiptForm");
    form.addEventListener("submit", handleReceiptSubmit);
    document.getElementById("detectPaymentButton").addEventListener("click", () => {
      form.elements.paymentMethod.value = detectPayment(`${form.elements.note.value} ${getFileName(form.elements.proof)}`) || form.elements.paymentMethod.value;
    });
    bindReceiptActions();
  }

  async function handleReceiptSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const quantity = num(data.get("quantity")) || 1;
    const unitPrice = num(data.get("unitPrice"));
    const amount = num(data.get("amount")) || Math.round(quantity * unitPrice);
    const proofFile = data.get("proof");
    const proof = proofFile && proofFile.size ? await readFile(proofFile) : null;
    const textForDetection = `${data.get("note") || ""} ${proof ? proof.name : ""}`;
    const detected = detectPayment(textForDetection);

    state.expenses.push({
      id: uid("exp"),
      date: data.get("date") || TODAY,
      vendor: clean(data.get("vendor")),
      category: clean(data.get("category")) || "未分類",
      itemName: clean(data.get("itemName")),
      quantity,
      unitPrice,
      amount,
      taxRate: clean(data.get("taxRate")) || "不明",
      paymentMethod: detected || clean(data.get("paymentMethod")) || "cash",
      registrationNumber: normalizeRegistration(data.get("registrationNumber")),
      invoiceEligible: Boolean(data.get("invoiceEligible")),
      note: clean(data.get("note")),
      proof,
      createdAt: new Date().toISOString()
    });

    persist();
    form.reset();
    form.elements.date.value = TODAY;
    form.elements.quantity.value = "1";
    if (activeView === "expenses") {
      renderExpenses();
    } else {
      renderReceipts();
    }
  }

  function renderExpenses() {
    const expenses = fiscalItems(state.expenses, "date").sort(byDate("date"));
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
          <form id="expenseForm" class="form-grid">
            ${field("date", "日付", "date", TODAY)}
            ${selectField("category", "経費科目", categories(), "消耗品費")}
            ${field("vendor", "取引先", "text", "")}
            ${selectField("paymentMethod", "支払区分", paymentMethods.map((item) => [item.value, item.label]), "cash")}
            ${field("itemName", "品名", "text", "")}
            ${field("quantity", "個数", "number", "1")}
            ${field("unitPrice", "単価", "number", "")}
            ${field("amount", "金額", "number", "")}
            ${selectField("taxRate", "税区分", taxRates, "10%")}
            ${field("registrationNumber", "T番号", "text", "")}
            <label class="check-field"><input name="invoiceEligible" type="checkbox" checked> インボイス適格</label>
            <label class="field"><span>証憑</span><input name="proof" type="file" accept="image/*,application/pdf"></label>
            <label class="field" style="grid-column:1 / -1;"><span>摘要</span><textarea name="note"></textarea></label>
            <div class="actions" style="grid-column:1 / -1;"><button class="button" type="submit">経費登録</button></div>
          </form>
        </div>
      </section>

      <div class="grid cols-2" style="margin-top:14px;">
        <section class="panel">
          <div class="panel-head"><h2>科目別構成比</h2><span class="badge">${yen(total)}</span></div>
          <div class="panel-body">
            ${summary.length ? summary.map((row) => `
              <div style="margin-bottom:12px;">
                <div class="receipt-meta"><strong>${esc(row.category)}</strong><span>${yen(row.amount)} / ${row.percent.toFixed(1)}%</span></div>
                <div class="progress-bar"><span style="width:${Math.min(row.percent, 100)}%"></span></div>
              </div>
            `).join("") : `<div class="empty">経費データがありません。</div>`}
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>提出前チェック</h2></div>
          <div class="panel-body">${renderExpenseChecks(expenses)}</div>
        </section>
      </div>

      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>経費一覧</h2><span class="badge">${expenses.length}件</span></div>
        <div class="panel-body">${renderExpenseTable(expenses)}</div>
      </section>
    `;

    document.getElementById("expenseForm").addEventListener("submit", handleReceiptSubmit);
    document.getElementById("exportExpensesCsv").addEventListener("click", () => exportCsv("expenses", expenses, [
      ["date", "日付"], ["category", "経費科目"], ["vendor", "取引先"], ["itemName", "品名"],
      ["quantity", "個数"], ["unitPrice", "単価"], ["amount", "金額"], ["paymentMethod", "支払区分"],
      ["taxRate", "税区分"], ["registrationNumber", "T番号"], ["note", "摘要"]
    ]));
    bindTableActions();
  }

  function renderSales() {
    const sales = fiscalItems(state.sales, "date").sort(byDate("date"));
    let cumulative = 0;
    const rows = sales.map((sale) => {
      cumulative += num(sale.amount);
      return { ...sale, cumulative };
    });

    app.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <h2>売上入力</h2>
          <div class="actions"><button class="button secondary small" id="exportSalesCsv" type="button">CSV</button></div>
        </div>
        <div class="panel-body">
          <form id="salesForm" class="form-grid">
            ${field("date", "入金日", "date", TODAY)}
            ${field("customer", "取引先", "text", "")}
            ${field("content", "項目・内容", "text", "")}
            ${selectField("classification", "分類", salesCategories, "業務委託")}
            ${field("amount", "売上額", "number", "")}
            ${field("invoiceNo", "請求書番号", "text", "")}
            ${field("bankAccount", "通帳", "text", state.settings.bankAccount || "道銀")}
            <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note"></textarea></label>
            <div class="actions" style="grid-column:1 / -1;"><button class="button" type="submit">売上登録</button></div>
          </form>
        </div>
      </section>
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>売上一覧</h2><span class="badge">${yen(sum(sales, "amount"))}</span></div>
        <div class="panel-body">${renderSalesTable(rows)}</div>
      </section>
    `;

    document.getElementById("salesForm").addEventListener("submit", handleSalesSubmit);
    document.getElementById("exportSalesCsv").addEventListener("click", () => exportCsv("sales", sales, [
      ["date", "入金日"], ["customer", "取引先"], ["content", "項目"], ["classification", "分類"],
      ["amount", "売上額"], ["invoiceNo", "請求書番号"], ["bankAccount", "通帳"], ["note", "メモ"]
    ]));
    bindTableActions();
  }

  function handleSalesSubmit(event) {
    event.preventDefault();
    const data = formValues(event.currentTarget);
    state.sales.push({
      id: uid("sale"),
      date: data.date || TODAY,
      customer: data.customer,
      content: data.content,
      classification: data.classification,
      amount: num(data.amount),
      invoiceNo: data.invoiceNo,
      bankAccount: data.bankAccount || state.settings.bankAccount || "道銀",
      note: data.note,
      createdAt: new Date().toISOString()
    });
    markInvoicePaidFromSale(state.sales[state.sales.length - 1]);
    persist();
    renderSales();
  }

  function renderInvoices() {
    const invoices = fiscalInvoices().sort(byDate("issueDate"));
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
            ${field("serviceDate", "実施日・完了日", "date", TODAY)}
            ${field("dueDate", "支払期限", "date", addDays(TODAY, 35))}
            ${field("expectedPaymentDate", "入金予定日", "date", addDays(TODAY, 35))}
            ${field("paymentDate", "入金日", "date", "")}
            ${field("customer", "請求先", "text", "")}
            ${selectField("classification", "分類", salesCategories, "業務委託")}
            ${field("content", "内容", "text", "")}
            ${field("amount", "金額", "number", "")}
            ${selectField("taxRate", "税区分", taxRates, "10%")}
            ${selectField("status", "状態", ["作成中", "送付済", "入金済", "保留"], "送付済")}
            <label class="field" style="grid-column:1 / -1;"><span>税理士メモ</span><textarea name="memo" placeholder="決算またぎ、前受、未収、実施期間など"></textarea></label>
            <div class="actions" style="grid-column:1 / -1;"><button class="button" type="submit">請求書登録</button></div>
          </form>
        </div>
      </section>

      <div class="grid cols-2" style="margin-top:14px;">
        <section class="panel">
          <div class="panel-head"><h2>照合チェック</h2><span class="badge ${issues.length ? "warn" : "good"}">${issues.length}件</span></div>
          <div class="panel-body">
            ${issues.length ? `<div class="alert-list">${issues.map(renderAlert).join("")}</div>` : `<div class="notice info">請求書と売上の大きなずれはありません。</div>`}
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>決算またぎ</h2></div>
          <div class="panel-body">
            <div class="notice danger">
              <p>5月31日以前に実施済みで、入金予定または入金が6月以降の場合は、売掛金・未収・前受の判断が必要です。</p>
              <p><span class="red-note">担当税理士に確認が必要</span> として、請求書の実施日・請求日・入金日を残します。</p>
            </div>
          </div>
        </section>
      </div>

      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>請求書一覧</h2><span class="badge">${yen(sum(invoices, "amount"))}</span></div>
        <div class="panel-body">${renderInvoiceTable(invoices)}</div>
      </section>
    `;

    document.getElementById("invoiceForm").addEventListener("submit", handleInvoiceSubmit);
    document.getElementById("exportInvoicesCsv").addEventListener("click", () => exportCsv("invoices", invoices, [
      ["invoiceNo", "請求書番号"], ["issueDate", "請求日"], ["serviceDate", "実施日"], ["dueDate", "支払期限"],
      ["expectedPaymentDate", "入金予定日"], ["paymentDate", "入金日"], ["customer", "請求先"],
      ["content", "内容"], ["classification", "分類"], ["amount", "金額"], ["status", "状態"], ["memo", "税理士メモ"]
    ]));
    bindTableActions();
  }

  function handleInvoiceSubmit(event) {
    event.preventDefault();
    const data = formValues(event.currentTarget);
    state.invoices.push({
      id: uid("inv"),
      invoiceNo: data.invoiceNo || nextInvoiceNo(),
      issueDate: data.issueDate || TODAY,
      serviceDate: data.serviceDate || data.issueDate || TODAY,
      dueDate: data.dueDate,
      expectedPaymentDate: data.expectedPaymentDate,
      paymentDate: data.paymentDate,
      customer: data.customer,
      classification: data.classification,
      content: data.content,
      amount: num(data.amount),
      taxRate: data.taxRate,
      status: data.status || "送付済",
      memo: data.memo,
      createdAt: new Date().toISOString()
    });
    persist();
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
            ${field("content", "内容", "text", "")}
            ${field("amount", "金額", "number", "")}
            ${selectField("status", "状態", ["作成中", "提出済", "受注", "失注", "保留"], "提出済")}
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
      ["content", "内容"], ["amount", "金額"], ["status", "状態"], ["linkedInvoiceNo", "請求書番号"], ["note", "メモ"]
    ]));
    bindTableActions();
  }

  function handleEstimateSubmit(event) {
    event.preventDefault();
    const data = formValues(event.currentTarget);
    state.estimates.push({
      id: uid("est"),
      estimateNo: data.estimateNo || nextEstimateNo(),
      date: data.date || TODAY,
      customer: data.customer,
      classification: data.classification,
      content: data.content,
      amount: num(data.amount),
      status: data.status,
      linkedInvoiceNo: data.linkedInvoiceNo,
      note: data.note,
      createdAt: new Date().toISOString()
    });
    persist();
    renderEstimates();
  }

  function renderSimpleLedger(type) {
    const title = ledgers[type];
    const items = fiscalItems(state[type], type === "payroll" ? "payMonth" : "date").sort(byDate(type === "payroll" ? "payMonth" : "date"));
    const forms = {
      trips: `
        ${field("date", "日付", "date", TODAY)}
        ${field("destination", "行先", "text", "")}
        ${field("purpose", "目的", "text", "")}
        ${field("transport", "移動手段", "text", "車")}
        ${field("mileage", "走行距離km", "number", "")}
        ${field("fuelClaim", "ガソリン請求", "number", "")}
        ${field("lodging", "宿泊費", "number", "")}
        ${field("total", "合計", "number", "")}
        <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note"></textarea></label>
      `,
      payroll: `
        ${field("payMonth", "対象月", "month", TODAY.slice(0, 7))}
        ${field("employee", "氏名", "text", "")}
        ${field("basePay", "基本給", "number", "")}
        ${field("allowance", "手当", "number", "")}
        ${field("deduction", "控除", "number", "")}
        ${field("netPay", "支給額", "number", "")}
        ${field("payDate", "支払日", "date", TODAY)}
        <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note"></textarea></label>
      `,
      hitech: `
        ${field("date", "日付", "date", TODAY)}
        ${field("sender", "送付元", "text", "")}
        ${field("instructor", "講師", "text", "")}
        ${field("course", "内容", "text", "")}
        ${field("amount", "金額", "number", "")}
        ${selectField("status", "状態", ["未処理", "確認済", "請求済", "入金済"], "未処理")}
        <label class="field" style="grid-column:1 / -1;"><span>メモ</span><textarea name="note"></textarea></label>
      `
    };

    app.innerHTML = `
      <section class="panel">
        <div class="panel-head"><h2>${title}入力</h2><button class="button secondary small" id="exportLedgerCsv" type="button">CSV</button></div>
        <div class="panel-body">
          <form id="ledgerForm" class="form-grid">
            ${forms[type]}
            <div class="actions" style="grid-column:1 / -1;"><button class="button" type="submit">登録</button></div>
          </form>
        </div>
      </section>
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>${title}一覧</h2><span class="badge">${items.length}件</span></div>
        <div class="panel-body">${renderLedgerTable(type, items)}</div>
      </section>
    `;
    document.getElementById("ledgerForm").addEventListener("submit", (event) => handleLedgerSubmit(event, type));
    document.getElementById("exportLedgerCsv").addEventListener("click", () => exportCsv(type, items, ledgerCsvFields(type)));
    bindTableActions();
  }

  function handleLedgerSubmit(event, type) {
    event.preventDefault();
    const data = formValues(event.currentTarget);
    const numericFields = ["mileage", "fuelClaim", "lodging", "total", "basePay", "allowance", "deduction", "netPay", "amount"];
    numericFields.forEach((key) => {
      if (key in data) data[key] = num(data[key]);
    });
    state[type].push({
      id: uid(type.slice(0, 3)),
      ...data,
      createdAt: new Date().toISOString()
    });
    persist();
    renderSimpleLedger(type);
  }

  function renderCards() {
    const cardExpenses = fiscalItems(state.expenses, "date").filter((item) => item.paymentMethod === "card").sort(byDate("date"));
    const missingT = cardExpenses.filter((item) => item.amount >= 10000 && item.invoiceEligible && !item.registrationNumber);
    const byMonth = groupByMonth(cardExpenses, "date");

    app.innerHTML = `
      <div class="grid cols-3">
        ${summaryCard("カード経費", yen(sum(cardExpenses, "amount")), `${cardExpenses.length}件`)}
        ${summaryCard("T番号確認", `${missingT.length}件`, "1万円以上・適格・未入力")}
        ${summaryCard("領収書添付", `${cardExpenses.filter((item) => item.proof).length}件`, "カード明細との照合")}
      </div>
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>カード明細</h2><button class="button secondary small" id="exportCardCsv" type="button">CSV</button></div>
        <div class="panel-body">
          ${missingT.length ? `<div class="notice danger" style="margin-bottom:12px;"><span class="red-note">担当税理士に確認が必要:</span> 1万円以上でT番号がないカード経費があります。</div>` : ""}
          ${renderExpenseTable(cardExpenses)}
        </div>
      </section>
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>月別カード合計</h2></div>
        <div class="panel-body">
          ${Object.keys(byMonth).length ? Object.entries(byMonth).map(([month, records]) => `
            <div class="receipt-month" style="margin-bottom:12px;">
              <div class="receipt-month-head"><h3>${esc(monthLabel(month))}</h3><span class="badge card">${yen(sum(records, "amount"))}</span></div>
            </div>
          `).join("") : `<div class="empty">カード経費はありません。</div>`}
        </div>
      </section>
    `;
    document.getElementById("exportCardCsv").addEventListener("click", () => exportCsv("card-ledger", cardExpenses, [
      ["date", "日付"], ["vendor", "取引先"], ["category", "科目"], ["itemName", "品名"],
      ["amount", "金額"], ["taxRate", "税区分"], ["registrationNumber", "T番号"], ["note", "摘要"]
    ]));
    bindTableActions();
  }

  function renderClosing() {
    const range = getFiscalRange(selectedFiscalYear);
    const months = monthsInRange(range.start, range.end);
    const closings = state.closings;
    const alerts = getAlerts();

    app.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <h2>締め登録</h2>
          <div class="actions">
            <button class="button secondary small" id="exportPackage" type="button">税理士提出パック</button>
            <button class="button secondary small" id="exportClosingCsv" type="button">締めCSV</button>
          </div>
        </div>
        <div class="panel-body">
          <form id="closingForm" class="form-grid">
            ${field("month", "対象月", "month", TODAY.slice(0, 7))}
            ${selectField("closeType", "締め", ["15日前後", "月末"], "15日前後")}
            ${field("closedBy", "担当", "text", "")}
            ${selectField("status", "状態", ["未着手", "確認中", "完了", "税理士へ提出"], "確認中")}
            <label class="field" style="grid-column:1 / -1;"><span>確認メモ</span><textarea name="note"></textarea></label>
            <div class="actions" style="grid-column:1 / -1;"><button class="button" type="submit">締め登録</button></div>
          </form>
        </div>
      </section>

      <div class="grid cols-2" style="margin-top:14px;">
        <section class="panel">
          <div class="panel-head"><h2>月次締め状況</h2></div>
          <div class="panel-body">${renderClosingMatrix(months, closings)}</div>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>提出前チェック</h2><span class="badge ${alerts.length ? "warn" : "good"}">${alerts.length}件</span></div>
          <div class="panel-body">${alerts.length ? `<div class="alert-list">${alerts.map(renderAlert).join("")}</div>` : `<div class="notice info">提出前の未確認はありません。</div>`}</div>
        </section>
      </div>
    `;

    document.getElementById("closingForm").addEventListener("submit", handleClosingSubmit);
    document.getElementById("exportPackage").addEventListener("click", exportAccountantPackage);
    document.getElementById("exportClosingCsv").addEventListener("click", () => exportCsv("closings", closings, [
      ["month", "対象月"], ["closeType", "締め"], ["closedBy", "担当"], ["status", "状態"], ["note", "確認メモ"]
    ]));
  }

  function handleClosingSubmit(event) {
    event.preventDefault();
    const data = formValues(event.currentTarget);
    state.closings.push({
      id: uid("cls"),
      month: data.month || TODAY.slice(0, 7),
      closeType: data.closeType,
      closedBy: data.closedBy,
      status: data.status,
      note: data.note,
      createdAt: new Date().toISOString()
    });
    persist();
    renderClosing();
  }

  function renderBooks() {
    const entries = fiscalBookEntries();
    const accountNames = bookAccountNames();
    if (!accountNames.includes(bookState.account)) bookState.account = accountNames[0] || "現金";

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

    bindBookEvents();
  }

  function renderJournalEntryPanel() {
    const accountOptions = bookAccountNames();
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>仕訳登録</h2>
          <span class="badge">手入力</span>
        </div>
        <div class="panel-body">
          <form id="journalForm" class="form-grid">
            ${field("date", "取引日", "date", TODAY)}
            ${field("no", "取引No", "text", nextJournalNo())}
            ${selectField("department", "部門", departments(), departments()[0])}
            ${selectField("debitAccount", "借方勘定科目", accountOptions, "現金")}
            ${field("debitSub", "借方補助科目", "text", "")}
            ${field("debitPartner", "借方取引先", "text", "")}
            ${selectField("debitTax", "借方税区分", taxRates, "不明")}
            ${field("debitAmount", "借方金額", "number", "")}
            ${selectField("creditAccount", "貸方勘定科目", accountOptions, "売上高")}
            ${field("creditSub", "貸方補助科目", "text", "")}
            ${field("creditPartner", "貸方取引先", "text", "")}
            ${selectField("creditTax", "貸方税区分", taxRates, "不明")}
            ${field("creditAmount", "貸方金額", "number", "")}
            <label class="field" style="grid-column:1 / -1;"><span>摘要</span><textarea name="summary" placeholder="税理士に伝わる内容を残す"></textarea></label>
            <div class="actions" style="grid-column:1 / -1;">
              <button class="button" type="submit">仕訳登録</button>
              <span class="muted">借方・貸方の金額が違う場合は登録時に確認します。</span>
            </div>
          </form>
        </div>
      </section>
    `;
  }

  function renderGeneralLedger(entries) {
    const selected = bookState.account;
    const rows = ledgerRowsForAccount(entries, selected);
    const range = getFiscalRange(selectedFiscalYear);
    return `
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head">
          <h2>総勘定元帳</h2>
          <button class="button secondary small" data-book-export="general" type="button">CSV</button>
        </div>
        <div class="panel-body">
          ${renderBookFilterPanel("general", entries)}
          <div class="notice info" style="margin-bottom:12px;">選択期間 ${formatDate(range.start)} 〜 ${formatDate(range.end)} / 登録済みデータから自動仕訳を作成しています。</div>
          ${renderLedgerTableForAccount(selected, rows)}
        </div>
      </section>
    `;
  }

  function renderSubsidiaryLedger(entries) {
    const selected = bookState.account;
    const subOptions = subAccountsForAccount(entries, selected);
    if (!subOptions.includes(bookState.subAccount)) bookState.subAccount = "全て";
    const rows = ledgerRowsForAccount(entries, selected).filter((row) => {
      if (bookState.subAccount === "全て") return true;
      return row.subAccount === bookState.subAccount;
    });

    return `
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head">
          <h2>補助元帳</h2>
          <button class="button secondary small" data-book-export="subsidiary" type="button">CSV</button>
        </div>
        <div class="panel-body">
          ${renderBookFilterPanel("subsidiary", entries)}
          ${renderLedgerTableForAccount(selected, rows, true)}
        </div>
      </section>
    `;
  }

  function renderTrialBalance(entries) {
    const rows = trialRows(entries, bookState.report);
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>残高試算表</h2>
          <button class="button secondary small" data-book-export="trial" type="button">CSV</button>
        </div>
        <div class="panel-body">
          ${renderReportControls()}
          ${renderTrialTable(rows)}
        </div>
      </section>
    `;
  }

  function renderTransitionReport(entries) {
    const periods = buildReportPeriods(bookState.period);
    const rows = transitionRows(entries, bookState.report, periods);
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>推移表</h2>
          <button class="button secondary small" data-book-export="transition" type="button">CSV</button>
        </div>
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
        <div class="panel-head">
          <h2>部門別集計表</h2>
          <button class="button secondary small" data-book-export="department" type="button">CSV</button>
        </div>
        <div class="panel-body">
          ${renderDepartmentControls()}
          ${renderDepartmentTable(rows, depts)}
        </div>
      </section>
    `;
  }

  function renderComparisonReport(entries) {
    const previousEntries = entriesForFiscalYear(selectedFiscalYear - 1);
    const rows = comparisonRows(entries, previousEntries, bookState.report);
    return `
      <section class="panel">
        <div class="panel-head">
          <h2>前期比較</h2>
          <button class="button secondary small" data-book-export="compare" type="button">CSV</button>
        </div>
        <div class="panel-body">
          ${renderComparisonControls()}
          ${renderComparisonTable(rows)}
        </div>
      </section>
    `;
  }

  function renderBookFilterPanel(mode, entries) {
    const range = getFiscalRange(selectedFiscalYear);
    const subOptions = subAccountsForAccount(entries, bookState.account);
    return `
      <div class="book-filter">
        <label class="field compact">
          <span>勘定科目</span>
          <select id="bookAccountSelect">
            ${bookAccountNames().map((account) => `<option value="${esc(account)}" ${account === bookState.account ? "selected" : ""}>${esc(account)}</option>`).join("")}
          </select>
        </label>
        ${mode === "subsidiary" ? `
          <label class="field compact">
            <span>補助科目</span>
            <select id="bookSubSelect">
              ${subOptions.map((sub) => `<option value="${esc(sub)}" ${sub === bookState.subAccount ? "selected" : ""}>${esc(sub)}</option>`).join("")}
            </select>
          </label>
        ` : ""}
        <span class="book-range">開始日 ${formatDate(range.start)}　終了日 ${formatDate(range.end)}</span>
        <label class="check-field"><input type="checkbox" checked disabled> 補助科目を表示</label>
        <span class="book-tax">消費税 <strong>${bookState.taxMode === "taxIncluded" ? "税込" : "税抜"}</strong></span>
      </div>
    `;
  }

  function renderReportControls() {
    return `
      <div class="report-toolbar">
        <div class="tabs" style="margin:0;">
          ${reportTab("bs", "貸借対照表")}
          ${reportTab("pl", "損益計算書")}
        </div>
        <div class="actions">
          <label class="check-field"><input type="checkbox" checked disabled> 補助科目を表示</label>
          <span class="book-tax">消費税 <strong>${bookState.taxMode === "taxIncluded" ? "税込" : "税抜"}</strong></span>
        </div>
      </div>
    `;
  }

  function renderDepartmentControls() {
    const range = getFiscalRange(selectedFiscalYear);
    return `
      <div class="report-toolbar stacked">
        <div class="tabs" style="margin:0;">
          ${reportTab("bs", "貸借対照表")}
          ${reportTab("pl", "損益計算書")}
        </div>
        <span class="book-range">選択期間 ${formatDate(range.start)} 〜 ${formatDate(range.end)}</span>
        <div class="actions">
          <label class="check-field"><input type="checkbox" checked disabled> 補助科目を表示</label>
          <span class="book-tax">消費税 <strong>${bookState.taxMode === "taxIncluded" ? "税込" : "税抜"}</strong></span>
          <label class="check-field"><input data-show-zero type="checkbox" ${bookState.showZero ? "checked" : ""}> 残高0円を表示</label>
        </div>
      </div>
    `;
  }

  function renderComparisonControls() {
    const range = getFiscalRange(selectedFiscalYear);
    const previous = getFiscalRange(selectedFiscalYear - 1);
    return `
      <div class="report-toolbar stacked">
        <div class="tabs" style="margin:0;">
          ${reportTab("bs", "貸借対照表")}
          ${reportTab("pl", "損益計算書")}
        </div>
        <span class="book-range">比較期間 ${formatDate(previous.start)} 〜 ${formatDate(previous.end)} / ${formatDate(range.start)} 〜 ${formatDate(range.end)}</span>
        <div class="actions">
          <label class="check-field"><input type="checkbox" checked disabled> 補助科目を表示</label>
          <span class="book-tax">消費税 <strong>${bookState.taxMode === "taxIncluded" ? "税込" : "税抜"}</strong></span>
          <label class="check-field"><input data-show-zero type="checkbox" ${bookState.showZero ? "checked" : ""}> 残高0円を表示</label>
        </div>
      </div>
    `;
  }

  function renderTransitionControls() {
    return `
      <div class="report-toolbar stacked">
        <div class="tabs" style="margin:0;">
          ${periodTab("monthly", "月次")}
          ${periodTab("quarterly", "四半期")}
          ${periodTab("half", "半期")}
          ${periodTab("yearly", "年次")}
        </div>
        <div class="tabs" style="margin:0;">
          ${reportTab("bs", "貸借対照表")}
          ${reportTab("pl", "損益計算書")}
        </div>
        <div class="actions">
          <label class="check-field"><input type="checkbox" checked disabled> 補助科目を表示</label>
          <span class="book-tax">消費税 <strong>${bookState.taxMode === "taxIncluded" ? "税込" : "税抜"}</strong></span>
        </div>
      </div>
    `;
  }

  function renderLedgerTableForAccount(account, rows, showSub) {
    if (!rows.length) return `<div class="empty">仕訳データがありません。</div>`;
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>取引No<br>取引日</th>
              ${showSub ? "<th>補助科目</th>" : ""}
              <th>取引先</th>
              <th>税区分<br>インボイス</th>
              <th>相手勘定科目<br>相手補助科目</th>
              <th>相手取引先</th>
              <th>相手税区分<br>相手インボイス</th>
              <th>摘要</th>
              <th class="num">借方金額</th>
              <th class="num">貸方金額</th>
              <th class="num">残高</th>
              <th>証憑/タグ/<br>メモ</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>${esc(row.no)}<br>${esc(formatDate(row.date))}</td>
                ${showSub ? `<td>${esc(row.subAccount || "補助科目なし")}</td>` : ""}
                <td>${esc(row.partner || "")}</td>
                <td>${esc(row.tax || "不明")}<br>${row.invoiceEligible ? "適格" : ""}</td>
                <td>${esc(row.counterAccount)}<br>${esc(row.counterSub || "")}</td>
                <td>${esc(row.counterPartner || "")}</td>
                <td>${esc(row.counterTax || "不明")}<br>${row.counterInvoiceEligible ? "適格" : ""}</td>
                <td>${esc(row.summary || "")}</td>
                <td class="num">${row.debitAmount ? yen(row.debitAmount) : ""}</td>
                <td class="num">${row.creditAmount ? yen(row.creditAmount) : ""}</td>
                <td class="num">${yen(row.balance)}</td>
                <td>${sourceBadge(row.sourceType)}${row.memo ? `<br>${esc(row.memo)}` : ""}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderTrialTable(rows) {
    return `
      <div class="table-wrap">
        <table class="book-table compact-table">
          <thead><tr><th>区分</th><th class="num">前期残高</th><th class="num">借方金額</th><th class="num">貸方金額</th><th class="num">期末残高</th><th class="num">構成比</th></tr></thead>
          <tbody>
            ${rows.map((row) => `
              <tr class="${row.kind === "total" ? "total-row" : ""}">
                <td style="padding-left:${row.level * 18 + 10}px;">${esc(row.label)}</td>
                <td class="num">${row.opening ? yen(row.opening) : "0"}</td>
                <td class="num">${row.debit ? yen(row.debit) : "0"}</td>
                <td class="num">${row.credit ? yen(row.credit) : "0"}</td>
                <td class="num">${yen(row.balance)}</td>
                <td class="num">${row.percent === null ? "-" : `${row.percent.toFixed(1)}%`}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderTransitionTable(rows, periods) {
    return `
      <div class="table-wrap">
        <table class="book-table transition-table">
          <thead>
            <tr><th>区分</th>${periods.map((period) => `<th class="num">${esc(period.label)}</th>`).join("")}<th class="num">合計</th></tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr class="${row.kind === "total" ? "total-row" : ""}">
                <td style="padding-left:${row.level * 18 + 10}px;">${esc(row.label)}</td>
                ${row.values.map((value) => `<td class="num">${yen(value)}</td>`).join("")}
                <td class="num">${yen(row.total)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderDepartmentTable(rows, depts) {
    return `
      <div class="table-wrap">
        <table class="book-table transition-table">
          <thead>
            <tr><th>区分</th>${depts.map((department) => `<th class="num">${esc(department)}</th>`).join("")}<th class="num">合計</th></tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr class="${row.kind === "total" ? "total-row" : ""}">
                <td style="padding-left:${row.level * 18 + 10}px;">${esc(row.label)}</td>
                ${row.values.map((value) => `<td class="num">${yen(value)}</td>`).join("")}
                <td class="num">${yen(row.total)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderComparisonTable(rows) {
    return `
      <div class="table-wrap">
        <table class="book-table transition-table">
          <thead>
            <tr><th>区分</th><th class="num">前期</th><th class="num">構成比</th><th class="num">当期</th><th class="num">構成比</th><th class="num">増減額</th><th class="num">増減率</th></tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr class="${row.kind === "total" ? "total-row" : ""}">
                <td style="padding-left:${row.level * 18 + 10}px;">${esc(row.label)}</td>
                <td class="num">${yen(row.previous)}</td>
                <td class="num">${formatPercent(row.previousPercent)}</td>
                <td class="num">${yen(row.current)}</td>
                <td class="num">${formatPercent(row.currentPercent)}</td>
                <td class="num">${yen(row.diff)}</td>
                <td class="num">${formatPercent(row.diffRate)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function bindBookEvents() {
    app.querySelectorAll("[data-book-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        bookState.tab = button.dataset.bookTab;
        renderBooks();
      });
    });

    app.querySelectorAll("[data-report]").forEach((button) => {
      button.addEventListener("click", () => {
        bookState.report = button.dataset.report;
        renderBooks();
      });
    });

    app.querySelectorAll("[data-period]").forEach((button) => {
      button.addEventListener("click", () => {
        bookState.period = button.dataset.period;
        renderBooks();
      });
    });

    const showZero = app.querySelector("[data-show-zero]");
    if (showZero) {
      showZero.addEventListener("change", () => {
        bookState.showZero = showZero.checked;
        renderBooks();
      });
    }

    const accountSelect = document.getElementById("bookAccountSelect");
    if (accountSelect) {
      accountSelect.addEventListener("change", () => {
        bookState.account = accountSelect.value;
        bookState.subAccount = "全て";
        renderBooks();
      });
    }

    const subSelect = document.getElementById("bookSubSelect");
    if (subSelect) {
      subSelect.addEventListener("change", () => {
        bookState.subAccount = subSelect.value;
        renderBooks();
      });
    }

    const journalForm = document.getElementById("journalForm");
    if (journalForm) journalForm.addEventListener("submit", handleJournalSubmit);

    app.querySelectorAll("[data-book-export]").forEach((button) => {
      button.addEventListener("click", () => exportBookCsv(button.dataset.bookExport));
    });
  }

  function handleJournalSubmit(event) {
    event.preventDefault();
    const data = formValues(event.currentTarget);
    const debitAmount = num(data.debitAmount);
    const creditAmount = num(data.creditAmount);
    if (!debitAmount || !creditAmount) {
      alert("借方金額と貸方金額を入力してください。");
      return;
    }
    if (debitAmount !== creditAmount && !confirm("借方と貸方の金額が一致していません。このまま登録しますか？")) return;

    state.journals.push({
      id: uid("jnl"),
      no: data.no || nextJournalNo(),
      date: data.date || TODAY,
      debitAccount: data.debitAccount,
      department: data.department || departments()[0],
      debitSub: data.debitSub,
      debitPartner: data.debitPartner,
      debitTax: data.debitTax,
      debitAmount,
      creditAccount: data.creditAccount,
      creditSub: data.creditSub,
      creditPartner: data.creditPartner,
      creditTax: data.creditTax,
      creditAmount,
      summary: data.summary,
      createdAt: new Date().toISOString()
    });
    persist();
    renderBooks();
  }

  function fiscalBookEntries() {
    return allBookEntries()
      .filter((entry) => entry.date && getFiscalYear(entry.date) === selectedFiscalYear)
      .sort((a, b) => `${a.date}-${a.no}`.localeCompare(`${b.date}-${b.no}`));
  }

  function allBookEntries() {
    const entries = [];

    state.expenses.forEach((item, index) => {
      const creditAccount = paymentAccount(item.paymentMethod);
      entries.push(bookEntry({
        id: `exp-${item.id}`,
        no: `EXP-${String(index + 1).padStart(4, "0")}`,
        date: item.date,
        debitAccount: item.category || "未分類",
        debitSub: item.itemName || "補助科目なし",
        debitPartner: item.vendor,
        debitTax: item.taxRate || "不明",
        debitInvoiceEligible: item.invoiceEligible,
        debitAmount: item.amount,
        creditAccount,
        creditSub: item.paymentMethod === "card" ? "カード明細" : creditAccount,
        creditPartner: item.vendor,
        creditTax: "対象外",
        creditAmount: item.amount,
        summary: item.note || item.itemName || item.vendor || "経費",
        sourceType: "経費",
        sourceId: item.id,
        department: item.department || departments()[0],
        proof: item.proof,
        memo: item.registrationNumber ? `T番号 ${item.registrationNumber}` : ""
      }));
    });

    state.sales.forEach((item, index) => {
      entries.push(bookEntry({
        id: `sale-${item.id}`,
        no: `SAL-${String(index + 1).padStart(4, "0")}`,
        date: item.date,
        debitAccount: "普通預金",
        debitSub: item.bankAccount || state.settings.bankAccount || "道銀",
        debitPartner: item.customer,
        debitTax: "対象外",
        debitAmount: item.amount,
        creditAccount: "売上高",
        creditSub: item.classification || "売上",
        creditPartner: item.customer,
        creditTax: "10%",
        creditAmount: item.amount,
        summary: [item.content, item.invoiceNo].filter(Boolean).join(" / ") || "売上入金",
        sourceType: "売上",
        sourceId: item.id,
        department: item.department || departments()[0],
        memo: item.note
      }));
    });

    state.invoices.forEach((item, index) => {
      const linkedSale = state.sales.some((sale) => sale.invoiceNo && sale.invoiceNo === item.invoiceNo);
      if (linkedSale || item.status === "入金済") return;
      entries.push(bookEntry({
        id: `inv-${item.id}`,
        no: item.invoiceNo || `INV-${String(index + 1).padStart(4, "0")}`,
        date: item.serviceDate || item.issueDate,
        debitAccount: "売掛金",
        debitSub: item.customer || "請求先未入力",
        debitPartner: item.customer,
        debitTax: "対象外",
        debitAmount: item.amount,
        creditAccount: "売上高",
        creditSub: item.classification || "請求売上",
        creditPartner: item.customer,
        creditTax: item.taxRate || "10%",
        creditAmount: item.amount,
        summary: `${item.content || "請求"} / 未入金`,
        sourceType: "請求書",
        sourceId: item.id,
        department: item.department || departments()[0],
        memo: fiscalCrossing(item) ? "担当税理士に確認が必要: 決算またぎ" : item.memo
      }));
    });

    state.payroll.forEach((item, index) => {
      const amount = num(item.netPay || item.basePay + item.allowance - item.deduction);
      if (!amount) return;
      entries.push(bookEntry({
        id: `pay-${item.id}`,
        no: `PAY-${String(index + 1).padStart(4, "0")}`,
        date: item.payDate || `${item.payMonth}-25`,
        debitAccount: "給与手当",
        debitSub: item.employee || "給与",
        debitPartner: item.employee,
        debitTax: "対象外",
        debitAmount: amount,
        creditAccount: "普通預金",
        creditSub: state.settings.bankAccount || "道銀",
        creditPartner: item.employee,
        creditTax: "対象外",
        creditAmount: amount,
        summary: `${item.payMonth || ""} 給与`,
        sourceType: "給与",
        sourceId: item.id,
        department: item.department || departments()[0],
        memo: item.note
      }));
    });

    state.journals.forEach((item) => {
      entries.push(bookEntry({
        id: `jnl-${item.id}`,
        no: item.no,
        date: item.date,
        debitAccount: item.debitAccount,
        debitSub: item.debitSub,
        debitPartner: item.debitPartner,
        debitTax: item.debitTax,
        debitAmount: item.debitAmount,
        creditAccount: item.creditAccount,
        creditSub: item.creditSub,
        creditPartner: item.creditPartner,
        creditTax: item.creditTax,
        creditAmount: item.creditAmount,
        summary: item.summary,
        sourceType: "手入力",
        sourceId: item.id,
        department: item.department || departments()[0]
      }));
    });

    return entries.filter((entry) => entry.date && (entry.debitAmount || entry.creditAmount));
  }

  function bookEntry(entry) {
    return {
      debitAmount: 0,
      creditAmount: 0,
      debitInvoiceEligible: false,
      creditInvoiceEligible: false,
      department: departments()[0],
      memo: "",
      ...entry
    };
  }

  function ledgerRowsForAccount(entries, account) {
    const normal = accountNormal(account);
    let balance = 0;
    return entries
      .filter((entry) => entry.debitAccount === account || entry.creditAccount === account)
      .map((entry) => {
        const isDebit = entry.debitAccount === account;
        const debitAmount = isDebit ? num(entry.debitAmount) : 0;
        const creditAmount = isDebit ? 0 : num(entry.creditAmount);
        balance += normal === "debit" ? debitAmount - creditAmount : creditAmount - debitAmount;
        return {
          id: entry.id,
          no: entry.no,
          date: entry.date,
          account,
          subAccount: isDebit ? entry.debitSub : entry.creditSub,
          partner: isDebit ? entry.debitPartner : entry.creditPartner,
          tax: isDebit ? entry.debitTax : entry.creditTax,
          invoiceEligible: isDebit ? entry.debitInvoiceEligible : entry.creditInvoiceEligible,
          counterAccount: isDebit ? entry.creditAccount : entry.debitAccount,
          counterSub: isDebit ? entry.creditSub : entry.debitSub,
          counterPartner: isDebit ? entry.creditPartner : entry.debitPartner,
          counterTax: isDebit ? entry.creditTax : entry.debitTax,
          counterInvoiceEligible: isDebit ? entry.creditInvoiceEligible : entry.debitInvoiceEligible,
          summary: entry.summary,
          debitAmount,
          creditAmount,
          balance,
          sourceType: entry.sourceType,
          sourceId: entry.sourceId,
          memo: entry.memo
        };
      });
  }

  function subAccountsForAccount(entries, account) {
    const subs = new Set(["全て"]);
    entries.forEach((entry) => {
      if (entry.debitAccount === account) subs.add(entry.debitSub || "補助科目なし");
      if (entry.creditAccount === account) subs.add(entry.creditSub || "補助科目なし");
    });
    return [...subs];
  }

  function summarizeAccountsForEntries(entries) {
    const summary = {};
    entries.forEach((entry) => {
      addAccountSide(summary, entry.debitAccount, "debit", entry.debitAmount);
      addAccountSide(summary, entry.creditAccount, "credit", entry.creditAmount);
    });
    return summary;
  }

  function addAccountSide(summary, account, side, amount) {
    if (!account) return;
    summary[account] = summary[account] || { debit: 0, credit: 0 };
    summary[account][side] += num(amount);
  }

  function accountBalance(summary, account) {
    const total = summary[account] || { debit: 0, credit: 0 };
    return accountNormal(account) === "debit" ? total.debit - total.credit : total.credit - total.debit;
  }

  function accountTotal(summary, account) {
    return summary[account] || { debit: 0, credit: 0 };
  }

  function trialRows(entries, report) {
    const summary = summarizeAccountsForEntries(entries);
    return report === "pl" ? profitLossRows(summary) : balanceSheetRows(summary);
  }

  function balanceSheetRows(summary) {
    const currentAssets = accountGroupRows(summary, assetAccounts, 1);
    const currentAssetTotal = sumRows(currentAssets);
    const liabilities = accountGroupRows(summary, liabilityAccounts, 1);
    const liabilityTotal = sumRows(liabilities);
    const profit = netProfit(summary);
    const equityRows = accountGroupRows(summary, equityAccounts, 1);
    const equityBase = sumRows(equityRows);
    const equityTotal = equityBase + profit;
    const totalBase = Math.max(currentAssetTotal, liabilityTotal + equityTotal, 1);

    return [
      totalRow("流動資産合計", currentAssetTotal, currentAssets, totalBase, 0),
      ...withPercent(currentAssets, totalBase),
      totalRow("固定資産合計", 0, [], totalBase, 0),
      totalRow("資産の部合計", currentAssetTotal, currentAssets, totalBase, 0),
      totalRow("流動負債合計", liabilityTotal, liabilities, totalBase, 0),
      ...withPercent(liabilities, totalBase),
      totalRow("負債の部合計", liabilityTotal, liabilities, totalBase, 0),
      totalRow("資本剰余金合計", equityBase, equityRows, totalBase, 0),
      ...withPercent(equityRows, totalBase),
      simpleReportRow("（うち当期純利益）", profit, 1, totalBase),
      totalRow("利益剰余金合計", profit, [], totalBase, 0),
      totalRow("株主資本合計", equityTotal, equityRows, totalBase, 0),
      totalRow("純資産の部合計", equityTotal, equityRows, totalBase, 0),
      totalRow("負債・純資産の部合計", liabilityTotal + equityTotal, [...liabilities, ...equityRows], totalBase, 0)
    ];
  }

  function profitLossRows(summary) {
    const sales = accountBalance(summary, "売上高");
    const cogs = accountBalance(summary, "売上原価");
    const expenseRows = accountGroupRows(summary, expenseAccounts().filter((name) => name !== "売上原価"), 1);
    const sga = sumRows(expenseRows);
    const grossProfit = sales - cogs;
    const operatingProfit = grossProfit - sga;
    const base = Math.max(Math.abs(sales), 1);
    return [
      simpleReportRow("売上高合計", sales, 0, base, "total"),
      simpleReportRow("売上原価", cogs, 0, base),
      simpleReportRow("売上総利益", grossProfit, 0, base, "total"),
      totalRow("販売費及び一般管理費合計", sga, expenseRows, base, 0),
      ...withPercent(expenseRows, base),
      simpleReportRow("営業利益", operatingProfit, 0, base, "total"),
      simpleReportRow("営業外収益合計", 0, 0, base),
      simpleReportRow("営業外費用合計", 0, 0, base),
      simpleReportRow("経常利益", operatingProfit, 0, base, "total"),
      simpleReportRow("特別利益合計", 0, 0, base),
      simpleReportRow("特別損失合計", 0, 0, base),
      simpleReportRow("税引前当期純利益", operatingProfit, 0, base, "total"),
      simpleReportRow("当期純利益", operatingProfit, 0, base, "total")
    ];
  }

  function accountGroupRows(summary, accounts, level) {
    return accounts
      .map((account) => {
        const total = accountTotal(summary, account);
        return {
          label: account,
          opening: 0,
          debit: total.debit,
          credit: total.credit,
          balance: accountBalance(summary, account),
          percent: null,
          level,
          kind: "account"
        };
      })
      .filter((row) => row.debit || row.credit || row.balance);
  }

  function simpleReportRow(label, balance, level, base, kind) {
    const debit = balance < 0 ? Math.abs(balance) : 0;
    const credit = balance > 0 ? balance : 0;
    return {
      label,
      opening: 0,
      debit,
      credit,
      balance,
      percent: base ? Math.round((Math.abs(balance) / base) * 1000) / 10 : null,
      level,
      kind: kind || "account"
    };
  }

  function totalRow(label, balance, children, base, level) {
    return {
      label,
      opening: 0,
      debit: sum(children, "debit"),
      credit: sum(children, "credit"),
      balance,
      percent: base ? Math.round((Math.abs(balance) / base) * 1000) / 10 : null,
      level,
      kind: "total"
    };
  }

  function withPercent(rows, base) {
    return rows.map((row) => ({ ...row, percent: base ? Math.round((Math.abs(row.balance) / base) * 1000) / 10 : null }));
  }

  function sumRows(rows) {
    return rows.reduce((total, row) => total + num(row.balance), 0);
  }

  function netProfit(summary) {
    const revenue = revenueAccounts.reduce((total, account) => total + accountBalance(summary, account), 0);
    const expenses = expenseAccounts().reduce((total, account) => total + accountBalance(summary, account), 0);
    return revenue - expenses;
  }

  function buildReportPeriods(mode) {
    const range = getFiscalRange(selectedFiscalYear);
    const months = monthsInRange(range.start, range.end);
    if (mode === "monthly") {
      return months.map((month) => ({
        label: `${Number(month.slice(5, 7))}月`,
        start: `${month}-01`,
        end: lastDayOfMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)))
      }));
    }
    if (mode === "quarterly") {
      return chunkPeriods(months, 3, ["第1四半期", "第2四半期", "第3四半期", "第4四半期"]);
    }
    if (mode === "half") {
      return chunkPeriods(months, 6, ["上半期", "下半期"]);
    }
    return [{ label: "当期", start: range.start, end: range.end }];
  }

  function chunkPeriods(months, size, labels) {
    const periods = [];
    for (let index = 0; index < months.length; index += size) {
      const chunk = months.slice(index, index + size);
      const first = chunk[0];
      const last = chunk[chunk.length - 1];
      periods.push({
        label: labels[periods.length] || `${periods.length + 1}`,
        start: `${first}-01`,
        end: lastDayOfMonth(Number(last.slice(0, 4)), Number(last.slice(5, 7)))
      });
    }
    return periods;
  }

  function transitionRows(entries, report, periods) {
    const labels = report === "pl"
      ? ["売上高合計", "売上原価", "売上総利益", "販売費及び一般管理費合計", "営業利益", "経常利益", "当期純利益"]
      : ["流動資産合計", "固定資産合計", "資産の部合計", "流動負債合計", "負債の部合計", "利益剰余金合計", "株主資本合計", "純資産の部合計", "負債・純資産の部合計"];

    return labels.map((label) => {
      const values = periods.map((period) => {
        const periodEntries = entries.filter((entry) => {
          if (report === "bs") return entry.date <= period.end;
          return entry.date >= period.start && entry.date <= period.end;
        });
        const row = trialRows(periodEntries, report).find((item) => item.label === label);
        return row ? row.balance : 0;
      });
      return {
        label,
        values,
        total: report === "bs" ? values[values.length - 1] || 0 : values.reduce((total, value) => total + value, 0),
        level: label.includes("合計") || ["営業利益", "経常利益", "当期純利益", "売上総利益"].includes(label) ? 0 : 1,
        kind: "total"
      };
    });
  }

  function entriesForFiscalYear(year) {
    return allBookEntries()
      .filter((entry) => entry.date && getFiscalYear(entry.date) === year)
      .sort((a, b) => `${a.date}-${a.no}`.localeCompare(`${b.date}-${b.no}`));
  }

  function departmentRows(entries, report, depts) {
    const totalRows = trialRows(entries, report);
    return totalRows
      .map((baseRow) => {
        const values = depts.map((department) => {
          const row = trialRows(entries.filter((entry) => entry.department === department), report).find((item) => item.label === baseRow.label);
          return row ? row.balance : 0;
        });
        return {
          label: baseRow.label,
          values,
          total: baseRow.balance,
          level: baseRow.level,
          kind: baseRow.kind
        };
      })
      .filter((row) => bookState.showZero || row.total || row.values.some(Boolean));
  }

  function comparisonRows(currentEntries, previousEntries, report) {
    const currentRows = trialRows(currentEntries, report);
    const previousRows = trialRows(previousEntries, report);
    const labels = [...new Set([...previousRows.map((row) => row.label), ...currentRows.map((row) => row.label)])];
    return labels
      .map((label) => {
        const current = currentRows.find((row) => row.label === label);
        const previous = previousRows.find((row) => row.label === label);
        const currentValue = current ? current.balance : 0;
        const previousValue = previous ? previous.balance : 0;
        const diff = currentValue - previousValue;
        return {
          label,
          previous: previousValue,
          previousPercent: previous ? previous.percent : null,
          current: currentValue,
          currentPercent: current ? current.percent : null,
          diff,
          diffRate: previousValue ? Math.round((diff / Math.abs(previousValue)) * 1000) / 10 : null,
          level: current?.level ?? previous?.level ?? 0,
          kind: current?.kind || previous?.kind || "account"
        };
      })
      .filter((row) => bookState.showZero || row.previous || row.current || row.diff);
  }

  function paymentAccount(method) {
    if (method === "cash") return "現金";
    if (method === "bank") return "普通預金";
    if (method === "card") return "クレジットカード未払";
    return "未払金";
  }

  function accountInfo(account) {
    return accountDefinitions.find((item) => item.name === account) || { name: account, type: "expense", group: "販売費及び一般管理費", normal: "debit" };
  }

  function accountNormal(account) {
    return accountInfo(account).normal;
  }

  function bookTab(value, label) {
    return `<button class="tab ${bookState.tab === value ? "is-active" : ""}" data-book-tab="${esc(value)}" type="button">${esc(label)}</button>`;
  }

  function reportTab(value, label) {
    return `<button class="tab ${bookState.report === value ? "is-active" : ""}" data-report="${esc(value)}" type="button">${esc(label)}</button>`;
  }

  function periodTab(value, label) {
    return `<button class="tab ${bookState.period === value ? "is-active" : ""}" data-period="${esc(value)}" type="button">${esc(label)}</button>`;
  }

  function formatPercent(value) {
    return value === null || value === undefined ? "-" : `${Number(value).toFixed(1)}%`;
  }

  function sourceBadge(value) {
    const cls = value === "手入力" ? "warn" : value === "売上" ? "good" : "";
    return `<span class="badge ${cls}">${esc(value || "自動")}</span>`;
  }

  function nextJournalNo() {
    const count = state.journals.filter((item) => getFiscalYear(item.date) === selectedFiscalYear).length + 1;
    return `JNL-${selectedFiscalYear}-${String(count).padStart(3, "0")}`;
  }

  function exportBookCsv(type) {
    if (type === "general" || type === "subsidiary") {
      const rows = ledgerRowsForAccount(fiscalBookEntries(), bookState.account);
      exportCsv(`books-${type}-${bookState.account}`, rows, [
        ["no", "取引No"], ["date", "取引日"], ["subAccount", "補助科目"], ["partner", "取引先"],
        ["tax", "税区分"], ["counterAccount", "相手勘定科目"], ["counterSub", "相手補助科目"],
        ["summary", "摘要"], ["debitAmount", "借方金額"], ["creditAmount", "貸方金額"], ["balance", "残高"], ["memo", "メモ"]
      ]);
      return;
    }

    const rows = type === "transition"
      ? transitionRows(fiscalBookEntries(), bookState.report, buildReportPeriods(bookState.period)).map((row) => ({
        label: row.label,
        total: row.total,
        values: row.values.join(" / ")
      }))
      : type === "department"
        ? departmentRows(fiscalBookEntries(), bookState.report, departments()).map((row) => ({
          label: row.label,
          total: row.total,
          values: row.values.join(" / ")
        }))
        : type === "compare"
          ? comparisonRows(fiscalBookEntries(), entriesForFiscalYear(selectedFiscalYear - 1), bookState.report)
      : trialRows(fiscalBookEntries(), bookState.report);
    exportCsv(`books-${type}-${bookState.report}`, rows, [
      ["label", "区分"], ["debit", "借方金額"], ["credit", "貸方金額"], ["balance", "残高"], ["percent", "構成比"], ["values", "推移"], ["total", "合計"],
      ["previous", "前期"], ["previousPercent", "前期構成比"], ["current", "当期"], ["currentPercent", "当期構成比"], ["diff", "増減額"], ["diffRate", "増減率"]
    ]);
  }

  function renderSettings() {
    app.innerHTML = `
      <section class="panel">
        <div class="panel-head"><h2>基本設定</h2></div>
        <div class="panel-body">
          <form id="settingsForm" class="form-grid">
            ${field("companyName", "会社名", "text", state.settings.companyName || "")}
            ${field("bankAccount", "売上通帳", "text", state.settings.bankAccount || "道銀")}
            ${selectField("fiscalStartMonth", "決算開始月", Array.from({ length: 12 }, (_, index) => [index + 1, `${index + 1}月`]), state.settings.fiscalStartMonth)}
            <label class="field" style="grid-column:1 / -1;"><span>税理士メモ</span><textarea name="accountantMemo">${esc(state.settings.accountantMemo || "")}</textarea></label>
            <label class="field" style="grid-column:1 / -1;"><span>経費科目</span><textarea name="categories">${esc(categories().join("\n"))}</textarea></label>
            <label class="field" style="grid-column:1 / -1;"><span>部門</span><textarea name="departments">${esc(departments().join("\n"))}</textarea></label>
            <div class="actions" style="grid-column:1 / -1;">
              <button class="button" type="submit">保存</button>
              <button class="button danger" id="clearSampleButton" type="button">全データ削除</button>
            </div>
          </form>
        </div>
      </section>
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>保存場所</h2></div>
        <div class="panel-body">
          <div class="notice info">
            <p>このアプリはブラウザのローカルストレージに保存します。別端末や税理士へ渡す場合は、締め・提出の「税理士提出パック」または全体エクスポートを使います。</p>
          </div>
        </div>
      </section>
    `;

    document.getElementById("settingsForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const data = formValues(event.currentTarget);
      state.settings.companyName = data.companyName || "CDP北海道";
      state.settings.bankAccount = data.bankAccount || "道銀";
      state.settings.fiscalStartMonth = Number(data.fiscalStartMonth) || DEFAULT_FISCAL_START_MONTH;
      state.settings.accountantMemo = data.accountantMemo;
      state.settings.categories = data.categories.split(/\r?\n/).map(clean).filter(Boolean);
      state.settings.departments = data.departments.split(/\r?\n/).map(clean).filter(Boolean);
      if (!state.settings.departments.length) state.settings.departments = defaultDepartments;
      selectedFiscalYear = getFiscalYear(TODAY);
      seedFiscalOptions();
      persist();
      renderSettings();
    });

    document.getElementById("clearSampleButton").addEventListener("click", () => {
      if (!confirm("全データを削除します。エクスポート済みか確認してください。")) return;
      localStorage.removeItem(STORAGE_KEY);
      state = loadState();
      persist();
      render();
    });
  }

  function renderExpenseTable(items) {
    if (!items.length) return `<div class="empty">データがありません。</div>`;
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>日付</th><th>科目</th><th>取引先</th><th>品名</th><th class="num">個数</th><th class="num">単価</th><th class="num">金額</th><th>支払</th><th>税区分</th><th>T番号</th><th>証憑</th><th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item) => `
              <tr>
                <td>${esc(formatDate(item.date))}</td>
                <td>${esc(item.category)}</td>
                <td>${esc(item.vendor)}</td>
                <td>${esc(item.itemName)}</td>
                <td class="num">${esc(item.quantity || "")}</td>
                <td class="num">${item.unitPrice ? yen(item.unitPrice) : ""}</td>
                <td class="num">${yen(item.amount)}</td>
                <td>${paymentBadge(item.paymentMethod)}</td>
                <td>${esc(item.taxRate || "")}</td>
                <td>${item.registrationNumber ? esc(item.registrationNumber) : (item.amount >= 10000 && item.invoiceEligible ? '<span class="badge bad">要確認</span>' : "")}</td>
                <td>${item.proof ? '<span class="badge good">有</span>' : '<span class="badge warn">無</span>'}</td>
                <td>${rowActions("expenses", item.id)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderSalesTable(items) {
    if (!items.length) return `<div class="empty">売上データがありません。</div>`;
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>入金日</th><th>取引先</th><th>項目</th><th>分類</th><th class="num">売上</th><th class="num">累計</th><th>通帳</th><th>請求書番号</th><th>操作</th></tr></thead>
          <tbody>
            ${items.map((item) => `
              <tr>
                <td>${esc(formatDate(item.date))}</td>
                <td>${esc(item.customer)}</td>
                <td>${esc(item.content)}</td>
                <td>${esc(item.classification)}</td>
                <td class="num">${yen(item.amount)}</td>
                <td class="num">${yen(item.cumulative)}</td>
                <td>${esc(item.bankAccount || "")}</td>
                <td>${esc(item.invoiceNo || "")}</td>
                <td>${rowActions("sales", item.id)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderInvoiceTable(items) {
    if (!items.length) return `<div class="empty">請求書データがありません。</div>`;
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>番号</th><th>請求日</th><th>実施日</th><th>支払期限</th><th>入金予定</th><th>入金日</th><th>請求先</th><th>内容</th><th class="num">金額</th><th>状態</th><th>確認</th><th>操作</th></tr></thead>
          <tbody>
            ${items.map((item) => {
              const crossing = fiscalCrossing(item);
              return `
                <tr>
                  <td>${esc(item.invoiceNo)}</td>
                  <td>${esc(formatDate(item.issueDate))}</td>
                  <td>${esc(formatDate(item.serviceDate))}</td>
                  <td>${esc(formatDate(item.dueDate))}</td>
                  <td>${esc(formatDate(item.expectedPaymentDate))}</td>
                  <td>${esc(formatDate(item.paymentDate))}</td>
                  <td>${esc(item.customer)}</td>
                  <td>${esc(item.content)}</td>
                  <td class="num">${yen(item.amount)}</td>
                  <td>${statusBadge(item.status)}</td>
                  <td>${crossing ? '<span class="badge bad">決算またぎ</span>' : ""}</td>
                  <td>${rowActions("invoices", item.id)} ${item.status !== "入金済" ? `<button class="button small secondary" data-action="make-sale" data-id="${esc(item.id)}" type="button">売上化</button>` : ""}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderEstimateTable(items) {
    if (!items.length) return `<div class="empty">見積データがありません。</div>`;
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>番号</th><th>日付</th><th>提出先</th><th>分類</th><th>内容</th><th class="num">金額</th><th>状態</th><th>請求書番号</th><th>操作</th></tr></thead>
          <tbody>${items.map((item) => `
            <tr><td>${esc(item.estimateNo)}</td><td>${esc(formatDate(item.date))}</td><td>${esc(item.customer)}</td><td>${esc(item.classification)}</td><td>${esc(item.content)}</td><td class="num">${yen(item.amount)}</td><td>${statusBadge(item.status)}</td><td>${esc(item.linkedInvoiceNo || "")}</td><td>${rowActions("estimates", item.id)}</td></tr>
          `).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function renderLedgerTable(type, items) {
    if (!items.length) return `<div class="empty">データがありません。</div>`;
    const renderers = {
      trips: () => `
        <div class="table-wrap"><table><thead><tr><th>日付</th><th>行先</th><th>目的</th><th>移動</th><th class="num">km</th><th class="num">燃料請求</th><th class="num">宿泊</th><th class="num">合計</th><th>操作</th></tr></thead>
        <tbody>${items.map((item) => `<tr><td>${esc(formatDate(item.date))}</td><td>${esc(item.destination)}</td><td>${esc(item.purpose)}</td><td>${esc(item.transport)}</td><td class="num">${esc(item.mileage || "")}</td><td class="num">${yen(item.fuelClaim)}</td><td class="num">${yen(item.lodging)}</td><td class="num">${yen(item.total)}</td><td>${rowActions(type, item.id)}</td></tr>`).join("")}</tbody></table></div>`,
      payroll: () => `
        <div class="table-wrap"><table><thead><tr><th>対象月</th><th>氏名</th><th class="num">基本給</th><th class="num">手当</th><th class="num">控除</th><th class="num">支給額</th><th>支払日</th><th>操作</th></tr></thead>
        <tbody>${items.map((item) => `<tr><td>${esc(item.payMonth)}</td><td>${esc(item.employee)}</td><td class="num">${yen(item.basePay)}</td><td class="num">${yen(item.allowance)}</td><td class="num">${yen(item.deduction)}</td><td class="num">${yen(item.netPay)}</td><td>${esc(formatDate(item.payDate))}</td><td>${rowActions(type, item.id)}</td></tr>`).join("")}</tbody></table></div>`,
      hitech: () => `
        <div class="table-wrap"><table><thead><tr><th>日付</th><th>送付元</th><th>講師</th><th>内容</th><th class="num">金額</th><th>状態</th><th>操作</th></tr></thead>
        <tbody>${items.map((item) => `<tr><td>${esc(formatDate(item.date))}</td><td>${esc(item.sender)}</td><td>${esc(item.instructor)}</td><td>${esc(item.course)}</td><td class="num">${yen(item.amount)}</td><td>${statusBadge(item.status)}</td><td>${rowActions(type, item.id)}</td></tr>`).join("")}</tbody></table></div>`
    };
    return renderers[type]();
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
          <tbody>
            ${months.map((month) => {
              const mid = closings.find((item) => item.month === month && item.closeType === "15日前後");
              const end = closings.find((item) => item.month === month && item.closeType === "月末");
              return `<tr>
                <td>${esc(month)}</td>
                <td>${mid ? statusBadge(mid.status) : '<span class="badge warn">未</span>'}</td>
                <td>${end ? statusBadge(end.status) : '<span class="badge warn">未</span>'}</td>
                <td>${esc([mid && mid.note, end && end.note].filter(Boolean).join(" / "))}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderExpenseChecks(expenses) {
    const checks = [];
    const missingProof = expenses.filter((item) => !item.proof);
    const missingRegistration = expenses.filter((item) => item.amount >= 10000 && item.invoiceEligible && !item.registrationNumber);
    const uncategorized = expenses.filter((item) => item.category === "未分類");
    if (missingProof.length) checks.push({ severity: "warn", title: "証憑未添付", body: `${missingProof.length}件あります。フォルダ提出前に確認。` });
    if (missingRegistration.length) checks.push({ severity: "bad", title: "T番号未入力", body: `${missingRegistration.length}件あります。1万円以上は担当税理士に確認が必要。` });
    if (uncategorized.length) checks.push({ severity: "warn", title: "未分類", body: `${uncategorized.length}件あります。税理士の分け方に合わせて科目を確認。` });
    if (!checks.length) return `<div class="notice info">経費表の提出前チェックは通っています。</div>`;
    return `<div class="alert-list">${checks.map(renderAlert).join("")}</div>`;
  }

  function getAlerts() {
    const fiscalExpenses = fiscalItems(state.expenses, "date");
    const alerts = [];
    const missingProof = fiscalExpenses.filter((item) => !item.proof);
    const missingRegistration = fiscalExpenses.filter((item) => item.amount >= 10000 && item.invoiceEligible && !item.registrationNumber);
    const unclassified = fiscalExpenses.filter((item) => item.category === "未分類");
    if (missingProof.length) alerts.push({ severity: "warn", title: "証憑未添付", body: `${missingProof.length}件の経費に画像またはPDFがありません。` });
    if (missingRegistration.length) alerts.push({ severity: "bad", title: "T番号確認", body: `${missingRegistration.length}件が1万円以上・適格・T番号未入力です。担当税理士に確認が必要。` });
    if (unclassified.length) alerts.push({ severity: "warn", title: "経費科目未分類", body: `${unclassified.length}件あります。` });
    return alerts.concat(getInvoiceIssues());
  }

  function getInvoiceIssues() {
    const issues = [];
    const today = new Date(TODAY);

    fiscalInvoices().forEach((invoice) => {
      const sale = state.sales.find((item) => item.invoiceNo && item.invoiceNo === invoice.invoiceNo);
      if (invoice.status !== "入金済" && invoice.dueDate && new Date(invoice.dueDate) < today) {
        issues.push({ severity: "bad", title: `期限超過 ${invoice.invoiceNo}`, body: `${invoice.customer || "請求先未入力"} / ${yen(invoice.amount)} が未入金です。` });
      }
      if (invoice.status === "入金済" && !sale) {
        issues.push({ severity: "warn", title: `売上未照合 ${invoice.invoiceNo}`, body: "入金済みですが売上一覧に同じ請求書番号がありません。" });
      }
      if (fiscalCrossing(invoice)) {
        issues.push({ severity: "bad", title: `決算またぎ ${invoice.invoiceNo}`, body: "実施日が5月末以前、入金予定または入金が6月以降です。担当税理士に確認が必要。" });
      }
    });

    fiscalItems(state.sales, "date").forEach((sale) => {
      if (sale.invoiceNo && !state.invoices.some((invoice) => invoice.invoiceNo === sale.invoiceNo)) {
        issues.push({ severity: "warn", title: `請求書なし売上 ${sale.invoiceNo}`, body: `${formatDate(sale.date)} / ${yen(sale.amount)} の請求書番号が請求書一覧にありません。` });
      }
    });

    return issues;
  }

  function fiscalCrossing(invoice) {
    const serviceDate = invoice.serviceDate || invoice.issueDate;
    const paymentDate = invoice.paymentDate || invoice.expectedPaymentDate;
    if (!serviceDate || !paymentDate) return false;
    const serviceFiscal = getFiscalYear(serviceDate);
    const paymentFiscal = getFiscalYear(paymentDate);
    return serviceFiscal !== paymentFiscal && paymentFiscal > serviceFiscal;
  }

  function markInvoicePaidFromSale(sale) {
    if (!sale.invoiceNo) return;
    const invoice = state.invoices.find((item) => item.invoiceNo === sale.invoiceNo);
    if (!invoice) return;
    invoice.status = "入金済";
    invoice.paymentDate = sale.date;
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
        if (!confirm("この行を削除します。")) return;
        state[collection] = state[collection].filter((item) => item.id !== id);
        persist();
        render();
      });
    });

    app.querySelectorAll("[data-action='detail']").forEach((button) => {
      button.addEventListener("click", () => showDetail(button.dataset.collection, button.dataset.id));
    });

    app.querySelectorAll("[data-action='preview']").forEach((button) => {
      button.addEventListener("click", () => showDetail("expenses", button.dataset.id));
    });

    app.querySelectorAll("[data-action='make-sale']").forEach((button) => {
      button.addEventListener("click", () => {
        const invoice = state.invoices.find((item) => item.id === button.dataset.id);
        if (!invoice) return;
        const paymentDate = invoice.paymentDate || invoice.expectedPaymentDate || TODAY;
        state.sales.push({
          id: uid("sale"),
          date: paymentDate,
          customer: invoice.customer,
          content: invoice.content,
          classification: invoice.classification,
          amount: invoice.amount,
          invoiceNo: invoice.invoiceNo,
          bankAccount: state.settings.bankAccount || "道銀",
          note: "請求書から売上登録",
          createdAt: new Date().toISOString()
        });
        invoice.status = "入金済";
        invoice.paymentDate = paymentDate;
        persist();
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
      .filter(([key]) => !["id", "proof", "createdAt"].includes(key))
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

  function displayValue(key, value) {
    if (value === null || value === undefined) return "";
    if (key.toLowerCase().includes("date")) return formatDate(value);
    if (["amount", "unitPrice", "fuelClaim", "lodging", "total", "basePay", "allowance", "deduction", "netPay"].includes(key)) return yen(value);
    if (key === "paymentMethod") return paymentLabel(value);
    return String(value);
  }

  function exportAllData() {
    downloadJson(`cdp-accounting-all-${TODAY}.json`, state);
  }

  function exportAccountantPackage() {
    const payload = {
      exportedAt: new Date().toISOString(),
      fiscalYear: selectedFiscalYear,
      fiscalRange: getFiscalRange(selectedFiscalYear),
      settings: state.settings,
      checks: getAlerts(),
      expenses: fiscalItems(state.expenses, "date"),
      sales: fiscalItems(state.sales, "date"),
      invoices: fiscalInvoices(),
      estimates: fiscalItems(state.estimates, "date"),
      trips: fiscalItems(state.trips, "date"),
      payroll: fiscalItems(state.payroll, "payMonth"),
      hitech: fiscalItems(state.hitech, "date"),
      closings: state.closings.filter((item) => item.month && getFiscalYear(`${item.month}-01`) === selectedFiscalYear),
      journals: fiscalItems(state.journals, "date"),
      bookEntries: fiscalBookEntries()
    };
    downloadJson(`税理士提出パック-${selectedFiscalYear}年度-${TODAY}.json`, payload);
  }

  async function importAllData(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      if (!imported.settings) throw new Error("invalid");
      state = {
        ...loadState(),
        ...imported,
        settings: { ...loadState().settings, ...imported.settings }
      };
      persist();
      render();
    } catch (error) {
      alert("JSONを読み込めませんでした。");
    } finally {
      event.target.value = "";
    }
  }

  function exportCsv(name, rows, fields) {
    const header = fields.map(([, label]) => label);
    const body = rows.map((row) => fields.map(([key]) => csvCell(displayValue(key, row[key]))));
    const csv = [header.map(csvCell).join(","), ...body.map((line) => line.join(","))].join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(`${name}-${selectedFiscalYear}-${TODAY}.csv`, blob);
  }

  function downloadJson(name, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    downloadBlob(name, blob);
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
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, type: file.type, dataUrl: reader.result });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function getFileName(input) {
    return input.files && input.files[0] ? input.files[0].name : "";
  }

  function field(name, label, type, value, placeholder) {
    return `
      <label class="field">
        <span>${esc(label)}</span>
        <input name="${esc(name)}" type="${esc(type)}" value="${esc(value || "")}" placeholder="${esc(placeholder || "")}">
      </label>
    `;
  }

  function selectField(name, label, options, selected) {
    const optionHtml = options.map((option) => {
      const value = Array.isArray(option) ? option[0] : option;
      const text = Array.isArray(option) ? option[1] : option;
      return `<option value="${esc(value)}" ${String(value) === String(selected) ? "selected" : ""}>${esc(text)}</option>`;
    }).join("");
    return `
      <label class="field">
        <span>${esc(label)}</span>
        <select name="${esc(name)}">${optionHtml}</select>
      </label>
    `;
  }

  function summaryCard(label, value, sub) {
    return `<div class="summary-card"><small>${esc(label)}</small><strong>${esc(value)}</strong><div class="sub">${esc(sub || "")}</div></div>`;
  }

  function receiptFilterTab(value, label) {
    return `<button class="tab ${receiptPaymentFilter === value ? "is-active" : ""}" data-filter="${esc(value)}" type="button">${esc(label)}</button>`;
  }

  function renderAlert(alert) {
    const cls = alert.severity === "bad" ? "bad" : alert.severity === "good" ? "good" : "";
    return `<div class="alert-item ${cls}"><div><strong>${esc(alert.title)}</strong><div class="muted">${esc(alert.body)}</div></div></div>`;
  }

  function rowActions(collection, id) {
    return `
      <div class="actions">
        <button class="button small secondary" data-action="detail" data-collection="${esc(collection)}" data-id="${esc(id)}" type="button">詳細</button>
        <button class="button small danger" data-action="delete" data-collection="${esc(collection)}" data-id="${esc(id)}" type="button">削除</button>
      </div>
    `;
  }

  function paymentBadge(value) {
    return `<span class="badge ${esc(value || "")}">${esc(paymentLabel(value))}</span>`;
  }

  function paymentLabel(value) {
    return (paymentMethods.find((item) => item.value === value) || { label: "その他" }).label;
  }

  function statusBadge(value) {
    const bad = ["期限超過", "保留", "失注"].includes(value);
    const good = ["入金済", "完了", "税理士へ提出", "受注", "確認済"].includes(value);
    return `<span class="badge ${bad ? "bad" : good ? "good" : "warn"}">${esc(value || "未設定")}</span>`;
  }

  function categories() {
    return Array.isArray(state.settings.categories) && state.settings.categories.length ? state.settings.categories : expenseCategories;
  }

  function departments() {
    return Array.isArray(state.settings.departments) && state.settings.departments.length ? state.settings.departments : defaultDepartments;
  }

  function formValues(form) {
    return Object.fromEntries([...new FormData(form).entries()].map(([key, value]) => [key, clean(value)]));
  }

  function clean(value) {
    return String(value || "").trim();
  }

  function num(value) {
    const normalized = String(value || "").replace(/[^\d.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function sum(items, key) {
    return items.reduce((total, item) => total + num(item[key]), 0);
  }

  function summarizeExpenses(items) {
    const total = sum(items, "amount");
    const map = new Map();
    items.forEach((item) => map.set(item.category || "未分類", (map.get(item.category || "未分類") || 0) + num(item.amount)));
    return [...map.entries()]
      .map(([category, amount]) => ({ category, amount, percent: total ? Math.round((amount / total) * 1000) / 10 : 0 }))
      .sort((a, b) => b.amount - a.amount);
  }

  function fiscalItems(items, dateKey) {
    return items.filter((item) => {
      const value = item[dateKey];
      if (!value) return false;
      const date = value.length === 7 ? `${value}-01` : value;
      return getFiscalYear(date) === selectedFiscalYear;
    });
  }

  function fiscalInvoices() {
    return state.invoices.filter((invoice) => {
      const dates = [invoice.issueDate, invoice.serviceDate, invoice.expectedPaymentDate, invoice.paymentDate].filter(Boolean);
      return dates.some((value) => getFiscalYear(value.length === 7 ? `${value}-01` : value) === selectedFiscalYear);
    });
  }

  function getFiscalYear(dateText) {
    const date = new Date(dateText);
    if (Number.isNaN(date.getTime())) return new Date().getFullYear();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return month >= Number(state?.settings?.fiscalStartMonth || DEFAULT_FISCAL_START_MONTH) ? year : year - 1;
  }

  function getFiscalRange(year) {
    const startMonth = Number(state.settings.fiscalStartMonth || DEFAULT_FISCAL_START_MONTH);
    const endMonth = startMonth === 1 ? 12 : startMonth - 1;
    const endYear = startMonth === 1 ? year : year + 1;
    const start = `${year}-${String(startMonth).padStart(2, "0")}-01`;
    const end = lastDayOfMonth(endYear, endMonth);
    return { start, end };
  }

  function lastDayOfMonth(year, month) {
    const date = new Date(year, month, 0);
    return dateToInput(date);
  }

  function monthsInRange(start, end) {
    const months = [];
    const date = new Date(start);
    const last = new Date(end);
    while (date <= last) {
      months.push(dateToInput(date).slice(0, 7));
      date.setMonth(date.getMonth() + 1);
    }
    return months;
  }

  function groupByMonth(items, key) {
    return items.reduce((acc, item) => {
      if (!item[key]) return acc;
      const month = item[key].slice(0, 7);
      acc[month] = acc[month] || [];
      acc[month].push(item);
      return acc;
    }, {});
  }

  function byDate(key) {
    return (a, b) => String(a[key] || "").localeCompare(String(b[key] || ""));
  }

  function formatDate(value) {
    if (!value) return "";
    if (String(value).length === 7) return value;
    return String(value).replaceAll("-", "/");
  }

  function monthLabel(month) {
    return `${month.slice(0, 4)}年${Number(month.slice(5, 7))}月`;
  }

  function yen(value) {
    return `${num(value).toLocaleString("ja-JP")}円`;
  }

  function addDays(dateText, days) {
    const date = new Date(dateText);
    date.setDate(date.getDate() + days);
    return dateToInput(date);
  }

  function dateToInput(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function detectPayment(text) {
    const value = String(text || "").toLowerCase();
    if (/(カード|クレジット|visa|master|jcb|amex|一括|リボ|card|credit)/i.test(value)) return "card";
    if (/(現金|cash|お預り|お釣り|預り)/i.test(value)) return "cash";
    if (/(振込|入金|銀行|道銀|bank)/i.test(value)) return "bank";
    return "";
  }

  function normalizeRegistration(value) {
    const text = clean(value).toUpperCase();
    if (!text) return "";
    const numbers = text.replace(/[^\d]/g, "");
    return numbers.length === 13 ? `T${numbers}` : text;
  }

  function nextInvoiceNo() {
    const year = selectedFiscalYear;
    const count = state.invoices.filter((item) => getFiscalYear(item.issueDate) === year).length + 1;
    return `INV-${year}-${String(count).padStart(3, "0")}`;
  }

  function nextEstimateNo() {
    const year = selectedFiscalYear;
    const count = state.estimates.filter((item) => getFiscalYear(item.date) === year).length + 1;
    return `EST-${year}-${String(count).padStart(3, "0")}`;
  }

  function labelFor(key) {
    const labels = {
      date: "日付",
      vendor: "取引先",
      category: "科目",
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
      issueDate: "請求日",
      serviceDate: "実施日",
      dueDate: "支払期限",
      expectedPaymentDate: "入金予定日",
      paymentDate: "入金日",
      customer: "取引先",
      content: "内容",
      classification: "分類",
      status: "状態",
      memo: "税理士メモ",
      bankAccount: "通帳",
      estimateNo: "見積番号",
      linkedInvoiceNo: "関連請求書",
      destination: "行先",
      purpose: "目的",
      transport: "移動手段",
      mileage: "走行距離",
      fuelClaim: "ガソリン請求",
      lodging: "宿泊費",
      total: "合計",
      payMonth: "対象月",
      employee: "氏名",
      basePay: "基本給",
      allowance: "手当",
      deduction: "控除",
      netPay: "支給額",
      payDate: "支払日",
      sender: "送付元",
      instructor: "講師",
      course: "内容",
      closeType: "締め",
      closedBy: "担当"
    };
    return labels[key] || key;
  }

  function ledgerCsvFields(type) {
    const fields = {
      trips: [["date", "日付"], ["destination", "行先"], ["purpose", "目的"], ["transport", "移動"], ["mileage", "km"], ["fuelClaim", "ガソリン請求"], ["lodging", "宿泊"], ["total", "合計"], ["note", "メモ"]],
      payroll: [["payMonth", "対象月"], ["employee", "氏名"], ["basePay", "基本給"], ["allowance", "手当"], ["deduction", "控除"], ["netPay", "支給額"], ["payDate", "支払日"], ["note", "メモ"]],
      hitech: [["date", "日付"], ["sender", "送付元"], ["instructor", "講師"], ["course", "内容"], ["amount", "金額"], ["status", "状態"], ["note", "メモ"]]
    };
    return fields[type];
  }

  function switchView(view) {
    activeView = view;
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("is-active", item.dataset.view === view));
    render();
  }

  function csvCell(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
