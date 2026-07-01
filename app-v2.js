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
  const expenseEligibilityOptions = [
    ["auto", "自動判定"],
    ["eligible", "適格"],
    ["ineligible", "不適格"]
  ];
  const expenseEligibilityEditOptions = expenseEligibilityOptions.filter(([value]) => value !== "auto");
  const invoiceStatuses = ["未入金", "入金予定", "入金済", "保留"];
  const paymentRequestStatuses = ["下書き", "申請中", "差し戻し", "承認済", "支払済"];
  const receivedDocTypes = ["請求書", "領収書", "納品書", "見積書", "契約書", "振込実行結果", "その他"];
  const receivedDocStatuses = ["未確認", "保管", "支払依頼待ち", "申請中", "承認済", "支払済"];
  const documentSourceCategories = ["通帳", "クレジットカード", "売上請求書", "支払請求書", "賃金", "ハイテク", "WEB振込", "受領書類", "その他"];
  const documentSourceFormats = ["PDF", "Excel", "CSV", "ZIP", "画像", "テキスト", "その他"];
  const documentExtractStatuses = ["未読取", "読取済", "照合中", "要確認", "反映済", "対象外"];
  const documentConfidenceOptions = ["高", "中", "低"];
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
    documentExtracts: ["資料読取", "PDF・Excel・画像から吸い上げたテキストと数字を台帳化"],
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
  let lastLocalOcrResult = null;
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

  pageMeta.taxAccountant = ["税理士連携", "通帳・カード明細・請求書・賃金台帳を提出資料としてまとめて照合"];

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    ensureHistoryNav();
    seedFiscalOptions();
    bindGlobalEvents();
    applyBundledReceiptMigrations();
    applyBundledBankbookMigrations();
    applyBundledBankbookNmrMigrations();
    applyBundledHitechMigrations();
    applyBundledWebTransferMigrations();
    applyBundledDocumentExtractMigrations();
    applyExpenseEligibilityDefaults();
    persist("自動保存");
    render();
  }

  function ensureHistoryNav() {
    const nav = document.querySelector(".nav");
    if (!nav) return;
    ensureNavItem(nav, "documentExtracts", "資料読取", "dataLink");
    ensureNavItem(nav, "taxAccountant", "税理士連携", "closing");
    ensureNavItem(nav, "history", "履歴", "settings");
  }

  function ensureNavItem(nav, view, label, beforeView) {
    if (nav.querySelector(`[data-view="${view}"]`)) return;
    const button = document.createElement("button");
    button.className = "nav-item";
    button.dataset.view = view;
    button.type = "button";
    button.textContent = label;
    nav.insertBefore(button, nav.querySelector(`[data-view="${beforeView}"]`) || null);
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
      bankbookEntries: [],
      documentExtracts: [],
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
      taxAccountantPacks: [],
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
      "bankbookEntries",
      "documentExtracts",
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
      "taxAccountantPacks",
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

  function applyBundledReceiptMigrations() {
    const migrationId = "receipt-157347-2026-03-v2";
    state.settings.appliedMigrations = Array.isArray(state.settings.appliedMigrations) ? state.settings.appliedMigrations : [];
    if (!state.settings.appliedMigrations.includes(migrationId)) {

      state.expenses = Array.isArray(state.expenses) ? state.expenses : [];
      const staleBefore = state.expenses.length;
      state.expenses = state.expenses.filter((item) => !(
        item.date === "2026-03-01"
        && item.vendor === "ツルハドラッグ 福井店"
        && num(item.amount) === 22436
        && !item.splitGroupId
      ));

      let addedCount = 0;
      let updatedCount = 0;
      bundledReceipt157347Expenses().forEach((record) => {
        const existing = state.expenses.find((item) => item.id === record.id);
        if (existing) {
          Object.assign(existing, record, {
            createdAt: existing.createdAt || record.createdAt,
            updatedAt: new Date().toISOString()
          });
          updatedCount += 1;
          return;
        }
        state.expenses.push(record);
        addedCount += 1;
      });
      state.settings.appliedMigrations.push(migrationId);
      if (addedCount || updatedCount || staleBefore !== state.expenses.length) {
        addAudit("157347領収書台紙反映", {
          added: addedCount,
          updated: updatedCount,
          replaced: staleBefore - state.expenses.length + addedCount
        });
      }
    }
    applyBundledExpenseMigration("receipt-202603-additional-boards-v1", bundledReceipt202603AdditionalExpenses(), "2026年3月追加領収書台紙反映");
    applyBundledExpenseMigration("receipt-202603-more-boards-v1", bundledReceipt202603MoreExpenses(), "2026年3月追加領収書台紙反映2");
    applyBundledExpenseMigration("receipt-202604-board-batch-v1", bundledReceipt202604Expenses(), "2026年4月領収書台紙反映");
    applyBundledExpenseMigration("receipt-202604-remaining-boards-v1", bundledReceipt202604RemainingExpenses(), "2026年4月追加領収書台紙反映");
    applyBundledExpenseMigration("receipt-202605-board-batch-v1", bundledReceipt202605Expenses(), "2026年5月領収書台紙反映");
    applyBundledExpenseMigration("receipt-202605-remaining-boards-v1", bundledReceipt202605RemainingExpenses(), "2026年5月追加領収書台紙反映");
  }

  function applyBundledExpenseMigration(migrationId, records, auditName) {
    state.settings.appliedMigrations = Array.isArray(state.settings.appliedMigrations) ? state.settings.appliedMigrations : [];
    if (state.settings.appliedMigrations.includes(migrationId)) return;

    state.expenses = Array.isArray(state.expenses) ? state.expenses : [];
    let addedCount = 0;
    let updatedCount = 0;
    records.forEach((record) => {
      const existing = state.expenses.find((item) => item.id === record.id);
      if (existing) {
        Object.assign(existing, record, {
          createdAt: existing.createdAt || record.createdAt,
          updatedAt: new Date().toISOString()
        });
        updatedCount += 1;
        return;
      }
      state.expenses.push(record);
      addedCount += 1;
    });
    state.settings.appliedMigrations.push(migrationId);
    if (addedCount || updatedCount) {
      addAudit(auditName, {
        added: addedCount,
        updated: updatedCount
      });
    }
  }

  function applyBundledBankbookMigrations() {
    const migrationId = "bankbook-20260625-pdf-partial-v1";
    state.settings.appliedMigrations = Array.isArray(state.settings.appliedMigrations) ? state.settings.appliedMigrations : [];
    if (state.settings.appliedMigrations.includes(migrationId)) return;

    state.bankbookEntries = Array.isArray(state.bankbookEntries) ? state.bankbookEntries : [];
    let addedCount = 0;
    bundledBankbook20260625Entries().forEach((record) => {
      const existing = state.bankbookEntries.find((item) => item.id === record.id);
      if (existing) {
        Object.assign(existing, record, {
          createdAt: existing.createdAt || record.createdAt,
          updatedAt: new Date().toISOString()
        });
        return;
      }
      state.bankbookEntries.push(record);
      addedCount += 1;
    });
    state.settings.appliedMigrations.push(migrationId);
    if (addedCount) {
      addAudit("通帳PDF読み取り結果反映", {
        sourceFile: "2026-6-25_(2).pdf",
        added: addedCount
      });
    }
  }

  function applyBundledBankbookNmrMigrations() {
    const migrationId = "bankbook-nmr20260701073104-visible-v1";
    state.settings.appliedMigrations = Array.isArray(state.settings.appliedMigrations) ? state.settings.appliedMigrations : [];
    if (state.settings.appliedMigrations.includes(migrationId)) return;

    state.bankbookEntries = Array.isArray(state.bankbookEntries) ? state.bankbookEntries : [];
    const record = {
      id: "bankbook-nmr20260701073104-20260601-social-insurance",
      date: "2026-06-01",
      statementDateText: "2026年06月01日",
      sourceFile: "nmr20260701073104",
      sourcePage: "貼付画像 1行目",
      direction: "出金",
      summary: "社会保険料",
      amount: 285216,
      balance: 3200560,
      classification: "社会保険料",
      status: "未照合",
      linkedTo: "",
      confidence: "高",
      note: "照会口座: ソヨ支店(166)。番号: 1。取引区分: 出金。摘要は画像上の「シャカイホケンリョウ」から社会保険料として登録。給与・社会保険関係資料と照合してください。",
      createdAt: "2026-07-01T00:00:00.000+09:00"
    };
    const existing = state.bankbookEntries.find((item) => item.id === record.id);
    if (existing) {
      Object.assign(existing, record, {
        createdAt: existing.createdAt || record.createdAt,
        updatedAt: new Date().toISOString()
      });
    } else {
      state.bankbookEntries.push(record);
    }
    state.settings.appliedMigrations.push(migrationId);
    addAudit("通帳明細読み取り結果反映", {
      sourceFile: record.sourceFile,
      added: existing ? 0 : 1,
      updated: existing ? 1 : 0
    });
  }

  function applyBundledHitechMigrations() {
    const migrationId = "hitech-detail-202506-visible-v1";
    state.settings.appliedMigrations = Array.isArray(state.settings.appliedMigrations) ? state.settings.appliedMigrations : [];
    if (state.settings.appliedMigrations.includes(migrationId)) return;

    state.hitech = Array.isArray(state.hitech) ? state.hitech : [];
    const record = bundledHitech202506Detail();
    const existing = state.hitech.find((item) => item.id === record.id);
    if (existing) {
      Object.assign(existing, record, {
        createdAt: existing.createdAt || record.createdAt,
        updatedAt: new Date().toISOString()
      });
    } else {
      state.hitech.push(record);
    }
    state.settings.appliedMigrations.push(migrationId);
    addAudit("ハイテク明細読み取り結果反映", {
      sourceFile: record.sourceFile,
      added: existing ? 0 : 1,
      updated: existing ? 1 : 0
    });
  }

  function applyBundledWebTransferMigrations() {
    const migrationId = "web-transfer-20260625-0625003-visible-v1";
    state.settings.appliedMigrations = Array.isArray(state.settings.appliedMigrations) ? state.settings.appliedMigrations : [];
    if (state.settings.appliedMigrations.includes(migrationId)) return;

    state.receivedDocs = Array.isArray(state.receivedDocs) ? state.receivedDocs : [];
    state.importBatches = Array.isArray(state.importBatches) ? state.importBatches : [];

    const receivedDoc = bundledWebTransfer20260625ReceivedDoc();
    const batch = bundledWebTransfer20260625ImportBatch();
    const existingDoc = state.receivedDocs.find((item) => item.id === receivedDoc.id);
    const existingBatch = state.importBatches.find((item) => item.id === batch.id);

    if (existingDoc) {
      Object.assign(existingDoc, receivedDoc, {
        createdAt: existingDoc.createdAt || receivedDoc.createdAt,
        updatedAt: new Date().toISOString()
      });
    } else {
      state.receivedDocs.push(receivedDoc);
    }

    if (existingBatch) {
      Object.assign(existingBatch, batch, {
        createdAt: existingBatch.createdAt || batch.createdAt,
        updatedAt: new Date().toISOString()
      });
    } else {
      state.importBatches.push(batch);
    }

    state.settings.appliedMigrations.push(migrationId);
    addAudit("WEB振込実行結果 読み取り反映", {
      sourceFile: "WEB振込2025.6～ (5).zip",
      receivedDocs: existingDoc ? "更新" : "追加",
      importBatches: existingBatch ? "更新" : "追加",
      receiptNo: "0625003"
    });
  }

  function applyBundledDocumentExtractMigrations() {
    const migrationId = "document-extracts-visible-tax-files-v1";
    state.settings.appliedMigrations = Array.isArray(state.settings.appliedMigrations) ? state.settings.appliedMigrations : [];
    if (state.settings.appliedMigrations.includes(migrationId)) return;

    state.documentExtracts = Array.isArray(state.documentExtracts) ? state.documentExtracts : [];
    const records = [
      {
        id: "extract-bankbook-20260625-pdf-visible",
        documentDate: "2026-06-25",
        sourceCategory: "通帳",
        sourceFormat: "PDF",
        sourceFile: "2026-6-25_(2).pdf",
        documentTitle: "通帳明細 2026年4月末ページ",
        counterparty: "道銀 / ソヨ支店(166)",
        primaryAmount: 1577019,
        taxAmount: "",
        grossAmount: 1577019,
        rowCount: 7,
        targetLedger: "通帳明細",
        linkedRecordId: "bankbookEntries:7件",
        status: "照合中",
        confidence: "中",
        extractedText: "貼付画像で読める範囲: AIGソンポ18,370円、オガサキサトシ455,818円、ZHTクラチセツイリョウ33,482円、カガレン16,000円、社会保険料283,008円、カ)ヤマギシコヒーセンタ616,000円、公金/ノボリベツシッタイドウ154,341円。",
        numericMemo: "読取行の合計 1,577,019円。差引残高は各行にあり。PDF原本で前後ページを確認してください。",
        issueMemo: "摘要の読み取りに揺れがあるため、請求書・入金先と照合が必要です。",
        createdAt: "2026-07-01T00:00:00.000+09:00"
      },
      {
        id: "extract-hitech-202506-zip-visible",
        documentDate: "2026-06-01",
        sourceCategory: "ハイテク",
        sourceFormat: "ZIP",
        sourceFile: "ハイテク明細　2025.6～.zip",
        documentTitle: "ハイテク明細 支給額",
        counterparty: "ハイテク明細",
        primaryAmount: 467520,
        taxAmount: "",
        grossAmount: 467520,
        rowCount: 1,
        targetLedger: "ハイテク台帳",
        linkedRecordId: "hitech-202506-visible-001",
        status: "反映済",
        confidence: "中",
        extractedText: "講師料448,800円、交通費18,720円、総支給額467,520円、控除合計0円、差引支給467,520円、支給額累計1,723,900円、JID45,785。",
        numericMemo: "448,800 + 18,720 = 467,520円。ハイテク台帳へ反映済み。",
        issueMemo: "講師名・対象月の詳細は原本ZIP内の明細で確認してください。",
        createdAt: "2026-07-01T00:00:00.000+09:00"
      },
      {
        id: "extract-bankbook-nmr20260701073104-visible",
        documentDate: "2026-06-01",
        sourceCategory: "通帳",
        sourceFormat: "Excel",
        sourceFile: "nmr20260701073104",
        documentTitle: "通帳明細CSV 2026/06/01",
        counterparty: "ソヨ支店(166)",
        primaryAmount: 285216,
        taxAmount: "",
        grossAmount: 285216,
        rowCount: 1,
        targetLedger: "通帳明細",
        linkedRecordId: "bankbook-nmr20260701073104-20260601-social-insurance",
        status: "反映済",
        confidence: "高",
        extractedText: "照会口座: ソヨ支店(166)。番号1。勘定日2026年06月01日。出金金額285,216円。残高3,200,560円。取引区分: 出金。摘要: シャカイホケンリョウ。",
        numericMemo: "出金285,216円、残高3,200,560円。社会保険料候補として通帳明細へ反映済み。",
        issueMemo: "給与・社会保険料資料と照合してください。",
        createdAt: "2026-07-01T00:00:00.000+09:00"
      },
      {
        id: "extract-web-transfer-20260625-0625003-visible",
        documentDate: "2026-06-25",
        sourceCategory: "WEB振込",
        sourceFormat: "ZIP",
        sourceFile: "WEB振込2025.6～ (5).zip",
        documentTitle: "WEB振込 実行結果 受付番号0625003",
        counterparty: "北海道銀行 道銀ビジネスWEBサービス",
        primaryAmount: "",
        taxAmount: "",
        grossAmount: "",
        rowCount: 1,
        targetLedger: "受領書類",
        linkedRecordId: "received-web-transfer-20260625-0625003",
        status: "要確認",
        confidence: "中",
        extractedText: "状態: 受付済み。処理日時: 2026年06月25日 09時51分52秒。受付番号: 0625003。取引種類: 振込振替。指定日: 2026年06月25日。取引名: 06月25日取引。振込依頼人名: -。支払口座: 雁来支店(166) 普通1226349。",
        numericMemo: "貼付画像では振込先口座・金額が見えていないため未記入。",
        issueMemo: "振込先口座・振込金額は原本ZIP/PDFの別ページで確認が必要です。",
        createdAt: "2026-07-01T00:00:00.000+09:00"
      }
    ];

    let added = 0;
    let updated = 0;
    records.forEach((record) => {
      const existing = state.documentExtracts.find((item) => item.id === record.id);
      if (existing) {
        Object.assign(existing, record, {
          createdAt: existing.createdAt || record.createdAt,
          updatedAt: new Date().toISOString()
        });
        updated += 1;
      } else {
        state.documentExtracts.push(record);
        added += 1;
      }
    });
    state.settings.appliedMigrations.push(migrationId);
    addAudit("資料読取台帳 初期反映", {
      added,
      updated,
      sourceFiles: records.map((item) => item.sourceFile).join(" / ")
    });
  }

  function bundledWebTransfer20260625ReceivedDoc() {
    return {
      id: "received-web-transfer-20260625-0625003",
      receivedDate: "2026-06-25",
      documentType: "振込実行結果",
      vendor: "北海道銀行 道銀ビジネスWEBサービス",
      title: "WEB振込 受付番号0625003",
      amount: "",
      dueDate: "",
      category: "未分類",
      department: "共通費",
      status: "未確認",
      paymentRequestNo: "",
      paymentRequestStatus: "",
      file: null,
      note: "元資料: WEB振込2025.6～ (5).zip。状態: 受付済み。処理日時: 2026年06月25日 09時51分52秒。取引種類: 振込振替。指定日: 2026年06月25日。取引名: 06月25日取引。振込依頼人名: -。支払口座: 雁来支店(166) 普通 1226349。振込先口座・金額は貼付画像では未確認のため、原本ZIPの下部または別ページで確認してください。",
      createdAt: "2026-07-01T00:00:00.000+09:00"
    };
  }

  function bundledWebTransfer20260625ImportBatch() {
    return {
      id: "import-web-transfer-20260625-0625003",
      importedAt: "2026-07-01T00:00:00.000+09:00",
      importDate: "2026-06-25",
      sourceType: "web-transfer",
      fileName: "WEB振込2025.6～ (5).zip",
      rowCount: 1,
      createdCount: 1,
      amountTotal: "",
      target: "receivedDocs",
      status: "確認中",
      note: "受付番号0625003 / 受付済み / 指定日2026年06月25日 / 支払口座 雁来支店(166) 普通1226349。振込先・金額は未確認。",
      createdAt: "2026-07-01T00:00:00.000+09:00"
    };
  }

  function bundledHitech202506Detail() {
    return {
      id: "hitech-202506-visible-001",
      date: "2026-06-01",
      sourcePeriod: "2025.6～",
      sender: "ハイテク明細",
      instructor: "未確認",
      course: "講師料 448,800円 / 交通費 18,720円 / 総支給額 467,520円",
      amount: 467520,
      status: "確認中",
      sourceFile: "ハイテク明細　2025.6～.zip",
      sourcePage: "貼付画像",
      teachingFee: 448800,
      transportation: 18720,
      grossPayment: 467520,
      deductionTotal: 0,
      netPayment: 467520,
      cumulativePayment: 1723900,
      jid: "45,785",
      confidence: "中",
      linkedTo: "",
      note: "画像から読める範囲で登録。対象月・支払日・講師名は画像内で未確認のため、原本ZIPの明細で確認してください。表示用の日付は2026/06/01で仮登録。支給額累計 1,723,900円、JID 45,785。",
      createdAt: "2026-07-01T00:00:00.000+09:00"
    };
  }

  function bundledBankbook20260625Entries() {
    const createdAt = "2026-07-01T00:00:00.000+09:00";
    const sourceFile = "2026-6-25_(2).pdf";
    const sourcePage = "貼付画像";
    const baseNote = "通帳PDF画像から読める範囲で登録。摘要・名義は原本PDFで再確認してください。";
    return [
      {
        id: "bankbook-20260625-20260427-aig",
        date: "2026-04-27",
        statementDateText: "08-04-27",
        sourceFile,
        sourcePage,
        direction: "出金",
        summary: "AIGソンポ",
        amount: 18370,
        balance: 8314981,
        classification: "保険料候補",
        status: "未照合",
        linkedTo: "",
        confidence: "中",
        note: baseNote,
        createdAt
      },
      {
        id: "bankbook-20260625-20260427-okazaki",
        date: "2026-04-27",
        statementDateText: "08-04-27",
        sourceFile,
        sourcePage,
        direction: "入金",
        summary: "オカザキ キサト（読取不確実）",
        amount: 455818,
        balance: 8770799,
        classification: "売上入金候補",
        status: "未照合",
        linkedTo: "",
        confidence: "低",
        note: `${baseNote} 請求書番号・売上先との紐づけが必要。`,
        createdAt
      },
      {
        id: "bankbook-20260625-20260428-zhsakura",
        date: "2026-04-28",
        statementDateText: "08-04-28",
        sourceFile,
        sourcePage,
        direction: "出金",
        summary: "ZHサクラナビ / イトウショウ（読取不確実）",
        amount: 33482,
        balance: 8737317,
        classification: "支払候補",
        status: "未照合",
        linkedTo: "",
        confidence: "低",
        note: baseNote,
        createdAt
      },
      {
        id: "bankbook-20260625-20260428-transfer",
        date: "2026-04-28",
        statementDateText: "08-04-28",
        sourceFile,
        sourcePage,
        direction: "入金",
        summary: "振込名義未確認",
        amount: 16000,
        balance: 8753317,
        classification: "売上入金候補",
        status: "未照合",
        linkedTo: "",
        confidence: "低",
        note: `${baseNote} 振込名義が画像では判読しづらいため原本確認。`,
        createdAt
      },
      {
        id: "bankbook-20260625-20260430-social-insurance",
        date: "2026-04-30",
        statementDateText: "08-04-30",
        sourceFile,
        sourcePage,
        direction: "出金",
        summary: "社会保険料",
        amount: 283008,
        balance: 8470309,
        classification: "社会保険料",
        status: "未照合",
        linkedTo: "",
        confidence: "高",
        note: "給与・社会保険関係資料と照合してください。",
        createdAt
      },
      {
        id: "bankbook-20260625-20260430-yamagishi",
        date: "2026-04-30",
        statementDateText: "08-04-30",
        sourceFile,
        sourcePage,
        direction: "入金",
        summary: "カ)ヤマギシコピ-センタ（読取不確実）",
        amount: 616000,
        balance: 9086309,
        classification: "売上入金候補",
        status: "未照合",
        linkedTo: "",
        confidence: "低",
        note: `${baseNote} 請求書・売上請求書フォルダと照合してください。`,
        createdAt
      },
      {
        id: "bankbook-20260625-20260430-public",
        date: "2026-04-30",
        statementDateText: "08-04-30",
        sourceFile,
        sourcePage,
        direction: "入金",
        summary: "公金 / 名義未確認",
        amount: 154341,
        balance: 9240650,
        classification: "公金・還付/補助金候補",
        status: "未照合",
        linkedTo: "",
        confidence: "低",
        note: `${baseNote} 売上ではない可能性があるため入金内容確認。`,
        createdAt
      }
    ];
  }

  function bundledReceipt157347Expenses() {
    const createdAt = "2026-06-23T00:00:00.000+09:00";
    const base = {
      department: "共通費",
      quantity: 1,
      unit: "式",
      paymentMethod: "card",
      invoiceEligible: true,
      createdAt
    };
    const proof = (fileName, label) => ({
      name: label,
      type: "image/jpeg",
      size: 0,
      dataUrl: `assets/receipts/${fileName}`,
      fullDataUrl: "assets/receipts/157347.jpg",
      fullName: "157347_領収書台紙_全体.jpg"
    });
    return [
      {
        ...base,
        id: "exp-157347-tsuruha-10",
        date: "2026-03-01",
        vendor: "ツルハドラッグ 福井店",
        category: "消耗品費",
        itemName: "ツルハ購入分 10%対象",
        unitPrice: 8716,
        amount: 8716,
        taxRate: "10%",
        registrationNumber: "T1430001010672",
        expenseEligibility: "eligible",
        expenseEligibilityReason: "10%対象分は消耗品として登録。業務用購入分である前提で適格。",
        splitGroupId: "split-157347-tsuruha",
        proof: proof("157347-tsuruha.jpg", "157347_ツルハドラッグ福井店.jpg"),
        note: "157347台紙より登録。領収書の10%対象額。支払区分は台紙のクレジット表記でカード。"
      },
      {
        ...base,
        id: "exp-157347-tsuruha-8",
        date: "2026-03-01",
        vendor: "ツルハドラッグ 福井店",
        category: "消耗品費",
        itemName: "ツルハ購入分 8%対象",
        unitPrice: 13720,
        amount: 13720,
        taxRate: "8%",
        registrationNumber: "T1430001010672",
        expenseEligibility: "ineligible",
        expenseEligibilityReason: "8%対象分は飲食・食品等の可能性があり、業務用途の説明が不足しているため不適格。",
        splitGroupId: "split-157347-tsuruha",
        proof: proof("157347-tsuruha.jpg", "157347_ツルハドラッグ福井店.jpg"),
        note: "157347台紙より登録。領収書の8%対象額。支払区分は台紙のクレジット表記でカード。"
      },
      {
        ...base,
        id: "exp-157347-cosmo",
        date: "2026-03-03",
        vendor: "キタセキ北海道 札幌新川SS",
        category: "車両費",
        itemName: "洗車（泡＋ワックス等）",
        unitPrice: 1000,
        amount: 1000,
        taxRate: "10%",
        registrationNumber: "T1370801000359",
        expenseEligibility: "eligible",
        expenseEligibilityReason: "車両関連の洗車代として業務利用車両に紐づけられるため適格。",
        proof: proof("157347-cosmo.jpg", "157347_COSMO洗車.jpg"),
        note: "157347台紙より登録。AMEX下4桁1006。車両関連洗車代。"
      },
      {
        ...base,
        id: "exp-157347-lucky",
        date: "2026-03-03",
        vendor: "ラッキー 篠路店",
        category: "交際費",
        itemName: "スーパードライ等",
        quantity: 3,
        unitPrice: 5046,
        amount: 15138,
        taxRate: "10%",
        registrationNumber: "T4430001015181",
        expenseEligibility: "ineligible",
        expenseEligibilityReason: "スーパー購入分で業務用途・利用目的が未記載のため不適格。業務用であれば理由を追記して変更。",
        proof: proof("157347-lucky.jpg", "157347_LUCKY篠路店.jpg"),
        note: "157347台紙より登録。クレジット。用途は税理士確認推奨。"
      },
      {
        ...base,
        id: "exp-157347-airport-parking",
        date: "2026-03-03",
        vendor: "北海道エアポート 新千歳空港A駐車場",
        category: "旅費交通費",
        itemName: "新千歳空港A駐車場 駐車料金",
        unitPrice: 1000,
        amount: 1000,
        taxRate: "10%",
        registrationNumber: "T7430001079728",
        expenseEligibility: "eligible",
        expenseEligibilityReason: "移動時の駐車料金として業務移動に紐づけられるため適格。",
        proof: proof("157347-parking.jpg", "157347_新千歳空港A駐車場.jpg"),
        note: "157347台紙より登録。JCBカード。駐車時間1時間17分。"
      },
      {
        ...base,
        id: "exp-157347-shinshin",
        date: "2026-03-03",
        vendor: "芯々",
        category: "交際費",
        itemName: "飲食代",
        unitPrice: 67155,
        amount: 67155,
        taxRate: "10%",
        registrationNumber: "T8430001067178",
        expenseEligibility: "ineligible",
        expenseEligibilityReason: "飲食代は相手先・人数・目的が未記載のため不適格。接待交際費なら内容を追記して変更。",
        proof: proof("157347-shinshin.jpg", "157347_芯々飲食代.jpg"),
        note: "157347台紙より登録。「ご飲食代として」。日付と支払区分は台紙情報から登録。"
      }
    ];
  }

  function bundledReceipt202603AdditionalExpenses() {
    const createdAt = "2026-06-23T00:00:00.000+09:00";
    const base = {
      department: "共通費",
      quantity: 1,
      unit: "式",
      paymentMethod: "card",
      invoiceEligible: true,
      createdAt
    };
    const proof = (boardFile, fileName, label) => ({
      name: label,
      type: "image/jpeg",
      size: 0,
      dataUrl: `assets/receipts/${fileName}`,
      fullDataUrl: `assets/receipts/${boardFile}`,
      fullName: `${boardFile.replace(".jpg", "")}_領収書台紙_全体.jpg`
    });
    return [
      {
        ...base,
        id: "exp-157352-skyshop-ogasawara",
        date: "2026-03-18",
        vendor: "スカイショップ小笠原",
        category: "交際費",
        itemName: "マルセイバターサンド",
        quantity: 2,
        unitPrice: 4950,
        amount: 9900,
        taxRate: "8%",
        registrationNumber: "T5430001044080",
        expenseEligibility: "ineligible",
        expenseEligibilityReason: "土産・食品の購入で、渡した相手先・業務目的が未記載のため不適格。贈答・接待目的なら相手先と理由を追記して変更。",
        proof: proof("157352_0.jpg", "157352-skyshop.jpg", "157352_スカイショップ小笠原.jpg"),
        note: "157352台紙より登録。クレジット。軽減税率8%対象。"
      },
      {
        ...base,
        id: "exp-157352-airport-b-parking",
        date: "2026-03-18",
        vendor: "北海道エアポート 新千歳空港B駐車場",
        category: "旅費交通費",
        itemName: "新千歳空港B駐車場 駐車料金",
        unitPrice: 12500,
        amount: 12500,
        taxRate: "10%",
        registrationNumber: "T7430001079728",
        expenseEligibility: "eligible",
        expenseEligibilityReason: "移動時の駐車料金として業務移動に紐づけられるため適格。",
        proof: proof("157352_0.jpg", "157352-airport-b.jpg", "157352_新千歳空港B駐車場.jpg"),
        note: "157352台紙より登録。JCBカード。駐車時間2日13時間26分。"
      },
      {
        ...base,
        id: "exp-157352-nihon-kotsu-taxi",
        date: "2026-03-18",
        vendor: "日本交通グループ 旭日交通",
        category: "旅費交通費",
        itemName: "タクシー代",
        unitPrice: 2700,
        amount: 2700,
        taxRate: "10%",
        registrationNumber: "T9011801008643",
        expenseEligibility: "eligible",
        expenseEligibilityReason: "移動時のタクシー代として業務移動に紐づけられるため適格。",
        proof: proof("157352_0.jpg", "157352-nichiko-taxi.jpg", "157352_日本交通タクシー.jpg"),
        note: "157352台紙より登録。クレジットカード支払。"
      },
      {
        ...base,
        id: "exp-157352-daiwa-taxi",
        date: "2026-03-19",
        vendor: "省東自動車株式会社 DAIWA TAXI GROUP",
        category: "旅費交通費",
        itemName: "タクシー代",
        unitPrice: 4000,
        amount: 4000,
        taxRate: "10%",
        registrationNumber: "T1011401003119",
        expenseEligibility: "eligible",
        expenseEligibilityReason: "移動時のタクシー代として業務移動に紐づけられるため適格。",
        proof: proof("157352_0.jpg", "157352-daiwa-taxi.jpg", "157352_DAIWAタクシー.jpg"),
        note: "157352台紙より登録。JCBカード。"
      },
      {
        ...base,
        id: "exp-157352-minacia",
        date: "2026-03-18",
        vendor: "株式会社ミナシア",
        category: "交際費",
        itemName: "飲食代",
        unitPrice: 73160,
        amount: 73160,
        taxRate: "10%",
        registrationNumber: "T3010001187428",
        expenseEligibility: "ineligible",
        expenseEligibilityReason: "飲食代は相手先・人数・目的が未記載のため不適格。接待交際費なら内容を追記して変更。",
        proof: proof("157352_0.jpg", "157352-minacia.jpg", "157352_株式会社ミナシア飲食代.jpg"),
        note: "157352台紙より登録。25点。用途は税理士確認推奨。"
      },
      {
        ...base,
        id: "exp-157352-ichozaka",
        date: "2026-03-18",
        vendor: "BISTRO JAPONaIS ICHOZAKA",
        category: "交際費",
        itemName: "カフェ利用",
        unitPrice: 1808,
        amount: 1808,
        taxRate: "10%",
        registrationNumber: "T5013301022046",
        expenseEligibility: "ineligible",
        expenseEligibilityReason: "飲食代は相手先・人数・目的が未記載のため不適格。打合せ利用なら相手先と目的を追記して変更。",
        proof: proof("157352_0.jpg", "157352-ichozaka.jpg", "157352_イチョウザカ飲食代.jpg"),
        note: "157352台紙より登録。クレジット。日付は台紙情報から登録。"
      },
      {
        ...base,
        id: "exp-157351-joyful-large",
        date: "2026-03-10",
        vendor: "ジョイフルエーケー 屯田店",
        category: "消耗品費",
        itemName: "ホームセンター購入分",
        unitPrice: 28145,
        amount: 28145,
        taxRate: "10%",
        registrationNumber: "T5430001027374",
        expenseEligibility: "eligible",
        expenseEligibilityReason: "ホームセンターでの業務用資材・消耗品購入として登録するため適格。",
        proof: proof("157351_0.jpg", "157351-joyful-large.jpg", "157351_ジョイフルエーケー28145円.jpg"),
        note: "157351台紙より登録。クレジット。85点。"
      },
      {
        ...base,
        id: "exp-157351-joyful-small",
        date: "2026-03-10",
        vendor: "ジョイフルエーケー 屯田店",
        category: "消耗品費",
        itemName: "ホームセンター購入分",
        unitPrice: 8279,
        amount: 8279,
        taxRate: "10%",
        registrationNumber: "T5430001027374",
        expenseEligibility: "eligible",
        expenseEligibilityReason: "ホームセンターでの業務用資材・消耗品購入として登録するため適格。",
        proof: proof("157351_0.jpg", "157351-joyful-small.jpg", "157351_ジョイフルエーケー8279円.jpg"),
        note: "157351台紙より登録。クレジット。2点。"
      },
      {
        ...base,
        id: "exp-157351-eneos-gas",
        date: "2026-03-12",
        vendor: "北海道エネルギー セルフ新川SS",
        category: "燃料費",
        itemName: "ガソリン代",
        unitPrice: 11958,
        amount: 11958,
        taxRate: "10%",
        registrationNumber: "T9430001037048",
        expenseEligibility: "eligible",
        expenseEligibilityReason: "移動・車両利用に伴う燃料費として業務利用車両に紐づけられるため適格。",
        proof: proof("157351_0.jpg", "157351-eneos-gas.jpg", "157351_ENEOS燃料費.jpg"),
        note: "157351台紙より登録。JCBカード。軽油79.01L。"
      },
      {
        ...base,
        id: "exp-157351-cosmo",
        date: "2026-03-12",
        vendor: "キタセキ北海道 札幌新川SS",
        category: "車両費",
        itemName: "洗車・ワイパー等",
        unitPrice: 1200,
        amount: 1200,
        taxRate: "10%",
        registrationNumber: "T1370801000359",
        expenseEligibility: "eligible",
        expenseEligibilityReason: "車両関連の洗車・備品代として業務利用車両に紐づけられるため適格。",
        proof: proof("157351_0.jpg", "157351-cosmo.jpg", "157351_COSMO車両費.jpg"),
        note: "157351台紙より登録。JCBカード。"
      },
      {
        ...base,
        id: "exp-157351-joyful-right",
        date: "2026-03-10",
        vendor: "ジョイフルエーケー 屯田店",
        category: "消耗品費",
        itemName: "ホームセンター購入分",
        unitPrice: 2098,
        amount: 2098,
        taxRate: "10%",
        registrationNumber: "T5430001027374",
        expenseEligibility: "eligible",
        expenseEligibilityReason: "ホームセンターでの業務用資材・消耗品購入として登録するため適格。",
        proof: proof("157351_0.jpg", "157351-joyful-right.jpg", "157351_ジョイフルエーケー2098円.jpg"),
        note: "157351台紙より登録。クレジット。日付は台紙情報から登録。"
      },
      {
        ...base,
        id: "exp-157351-restaurant-8",
        date: "2026-03-12",
        vendor: "半田屋 北33条東店",
        category: "交際費",
        itemName: "飲食代 8%対象",
        unitPrice: 1229,
        amount: 1229,
        taxRate: "8%",
        registrationNumber: "T3010001260886",
        expenseEligibility: "ineligible",
        expenseEligibilityReason: "飲食代は相手先・人数・目的が未記載のため不適格。業務上の打合せや接待なら内容を追記して変更。",
        splitGroupId: "split-157351-restaurant",
        proof: proof("157351_0.jpg", "157351-restaurant.jpg", "157351_半田屋飲食代.jpg"),
        note: "157351台紙より登録。税率別に8%対象額を分割。クレジット。"
      },
      {
        ...base,
        id: "exp-157351-restaurant-10",
        date: "2026-03-12",
        vendor: "半田屋 北33条東店",
        category: "交際費",
        itemName: "飲食代 10%対象",
        unitPrice: 1617,
        amount: 1617,
        taxRate: "10%",
        registrationNumber: "T3010001260886",
        expenseEligibility: "ineligible",
        expenseEligibilityReason: "飲食代は相手先・人数・目的が未記載のため不適格。業務上の打合せや接待なら内容を追記して変更。",
        splitGroupId: "split-157351-restaurant",
        proof: proof("157351_0.jpg", "157351-restaurant.jpg", "157351_半田屋飲食代.jpg"),
        note: "157351台紙より登録。税率別に10%対象額を分割。クレジット。"
      },
      {
        ...base,
        id: "exp-157353-parking",
        date: "2026-03-24",
        vendor: "ハーフネット札幌すすきの南5西6",
        category: "旅費交通費",
        itemName: "駐車料金",
        unitPrice: 1200,
        amount: 1200,
        taxRate: "10%",
        registrationNumber: "T7140001082323",
        expenseEligibility: "eligible",
        expenseEligibilityReason: "移動時の駐車料金として業務移動に紐づけられるため適格。100円クーポン券は経費登録対象外。",
        proof: proof("157353_0.jpg", "157353-parking.jpg", "157353_ハーフネット駐車場.jpg"),
        note: "157353台紙より登録。100円クーポン券は未使用券のため登録対象外。"
      },
      {
        ...base,
        id: "exp-157353-eneos-wash",
        date: "2026-03-24",
        vendor: "北海道エネルギー DDチャレンジ恵み野SS",
        category: "車両費",
        itemName: "洗車・下部洗浄",
        unitPrice: 3190,
        amount: 3190,
        taxRate: "10%",
        registrationNumber: "T9430001037048",
        expenseEligibility: "eligible",
        expenseEligibilityReason: "車両関連の洗車代として業務利用車両に紐づけられるため適格。",
        proof: proof("157353_0.jpg", "157353-eneos-wash.jpg", "157353_ENEOS洗車.jpg"),
        note: "157353台紙より登録。クレジット一括払い。"
      },
      {
        ...base,
        id: "exp-157350-barcelona-receipt",
        date: "2026-03-04",
        vendor: "BARCELONA P&J",
        category: "交際費",
        itemName: "飲食代",
        unitPrice: 12200,
        amount: 12200,
        taxRate: "10%",
        registrationNumber: "T8430001073408",
        expenseEligibility: "ineligible",
        expenseEligibilityReason: "飲食代は相手先・人数・目的が未記載のため不適格。接待交際費なら内容を追記して変更。",
        proof: proof("157350_0.jpg", "157350-barcelona-receipt.jpg", "157350_BARCELONA_12200円.jpg"),
        note: "157350台紙より登録。JCBカード。"
      },
      {
        ...base,
        id: "exp-157350-barcelona-formal",
        date: "2026-03-03",
        vendor: "BARCELONA P&J",
        category: "交際費",
        itemName: "飲食代",
        unitPrice: 201200,
        amount: 201200,
        taxRate: "10%",
        registrationNumber: "T8430001073408",
        expenseEligibility: "ineligible",
        expenseEligibilityReason: "高額飲食代で、相手先・人数・目的が未記載のため不適格。接待交際費なら参加者と目的を必ず追記。",
        proof: proof("157350_0.jpg", "157350-barcelona-formal.jpg", "157350_BARCELONA_201200円.jpg"),
        note: "157350台紙より登録。手書き領収証。税理士確認推奨。"
      },
      {
        ...base,
        id: "exp-157350-times-parking",
        date: "2026-03-03",
        vendor: "タイムズすすきの新南町通り",
        category: "旅費交通費",
        itemName: "駐車料金",
        unitPrice: 3200,
        amount: 3200,
        taxRate: "10%",
        registrationNumber: "T4010001137274",
        expenseEligibility: "eligible",
        expenseEligibilityReason: "移動時の駐車料金として業務移動に紐づけられるため適格。",
        proof: proof("157350_0.jpg", "157350-times.jpg", "157350_タイムズ駐車場.jpg"),
        note: "157350台紙より登録。クレジット。"
      },
      {
        ...base,
        id: "exp-157350-miyanomori",
        date: "2026-03-05",
        vendor: "宮の森珈琲 山の手店",
        category: "交際費",
        itemName: "飲食代",
        unitPrice: 2300,
        amount: 2300,
        taxRate: "10%",
        registrationNumber: "T8430002031934",
        expenseEligibility: "ineligible",
        expenseEligibilityReason: "飲食代は相手先・人数・目的が未記載のため不適格。打合せ利用なら相手先と目的を追記して変更。",
        proof: proof("157350_0.jpg", "157350-miyanomori.jpg", "157350_宮の森珈琲.jpg"),
        note: "157350台紙より登録。クレジット。"
      }
    ];
  }

  function bundledReceipt202603MoreExpenses() {
    const createdAt = "2026-06-23T00:00:00.000+09:00";
    const base = {
      department: "共通費",
      quantity: 1,
      unit: "式",
      paymentMethod: "cash",
      invoiceEligible: true,
      createdAt
    };
    const proof = (boardFile, fileName, label) => ({
      name: label,
      type: "image/jpeg",
      size: 0,
      dataUrl: `assets/receipts/${fileName}`,
      fullDataUrl: `assets/receipts/${boardFile}`,
      fullName: `${boardFile.replace(".jpg", "")}_領収書台紙_全体.jpg`
    });
    const eligible = "業務利用のための支出として領収書から内容を確認できるため適格。";
    const travelEligible = "業務移動に伴う交通費・駐車料金として確認できるため適格。";
    const fuelEligible = "業務利用車両に関する燃料費として確認できるため適格。";
    const foodIneligible = "飲食代は相手先・人数・目的が未記載のため不適格。打合せ・接待利用なら相手先と目的を追記して変更。";
    const unknownTax = "税率またはT番号が画像だけでは判読できないため、未記入として税理士確認。";
    const records = [
      {
        id: "exp-157364-sports-gym",
        date: "2026-03-24",
        vendor: "NPO法人恵庭市スポーツ協会",
        category: "研修費",
        itemName: "島松体育館 アリーナ利用料",
        amount: 3412,
        taxRate: "10%",
        registrationNumber: "T4430005006177",
        expenseEligibility: "eligible",
        expenseEligibilityReason: eligible,
        board: "157364_0.jpg",
        image: "157364-sports-gym.jpg",
        label: "157364_島松体育館利用料.jpg",
        note: "157364台紙より登録。利用日2026/04/15、アリーナ1/2A・1/2B、暖房。"
      },
      {
        id: "exp-157356-sports-gym",
        date: "2026-03-04",
        vendor: "NPO法人恵庭市スポーツ協会",
        category: "研修費",
        itemName: "島松体育館 アリーナ利用料",
        amount: 1462,
        taxRate: "10%",
        registrationNumber: "T4430005006177",
        expenseEligibility: "eligible",
        expenseEligibilityReason: eligible,
        board: "157356_0.jpg",
        image: "157356-sports-gym.jpg",
        label: "157356_島松体育館利用料.jpg",
        note: "157356台紙より登録。利用日2026/03/11、アリーナ1/2A、暖房。支払方法は現金。"
      },
      {
        id: "exp-157363-tanyo",
        date: "2026-03-23",
        vendor: "丹陽株式会社",
        category: "交際費",
        itemName: "飲食代",
        amount: 2880,
        taxRate: "10%",
        registrationNumber: "T8430001079099",
        expenseEligibility: "ineligible",
        expenseEligibilityReason: foodIneligible,
        board: "157363_0.jpg",
        image: "157363-tanyo.jpg",
        label: "157363_丹陽飲食代.jpg",
        note: "157363台紙より登録。飲食代として。"
      },
      {
        id: "exp-157363-eneos",
        date: "2026-03-24",
        vendor: "北海道エネルギー D.Dチャレンジ恵み野セルフ",
        category: "燃料費",
        itemName: "レギュラーガソリン",
        amount: 7113,
        taxRate: "10%",
        registrationNumber: "T9430001037048",
        expenseEligibility: "eligible",
        expenseEligibilityReason: fuelEligible,
        board: "157363_0.jpg",
        image: "157363-eneos.jpg",
        label: "157363_ENEOSガソリン.jpg",
        note: "157363台紙より登録。42.09L、現金フリー表記。"
      },
      {
        id: "exp-157363-kaorich",
        date: "2026-03-24",
        vendor: "Kaorich 奥山かおり",
        category: "交際費",
        itemName: "飲食代",
        amount: 15000,
        taxRate: "不明",
        registrationNumber: "",
        invoiceEligible: false,
        expenseEligibility: "ineligible",
        expenseEligibilityReason: foodIneligible,
        board: "157363_0.jpg",
        image: "157363-kaorich.jpg",
        label: "157363_Kaorich飲食代.jpg",
        note: `157363台紙より登録。手書き領収証。${unknownTax}`
      },
      {
        id: "exp-157362-hifumi",
        date: "2026-03-19",
        vendor: "ひふみどき 札幌駅前店",
        category: "交際費",
        itemName: "飲食代",
        amount: 31741,
        taxRate: "10%",
        registrationNumber: "T6010701005431",
        expenseEligibility: "ineligible",
        expenseEligibilityReason: foodIneligible,
        board: "157362_0.jpg",
        image: "157362-hifumi.jpg",
        label: "157362_ひふみどき飲食代.jpg",
        note: "157362台紙より登録。飲食代として。"
      },
      {
        id: "exp-157362-jr-charge",
        date: "2026-03-20",
        vendor: "JR東日本",
        category: "旅費交通費",
        itemName: "交通系ICチャージ",
        amount: 10000,
        taxRate: "不明",
        registrationNumber: "T4430001005643",
        paymentMethod: "card",
        expenseEligibility: "eligible",
        expenseEligibilityReason: "移動に使う交通系ICチャージとして登録。実際の利用区間は別途確認。",
        board: "157362_0.jpg",
        image: "157362-jr-charge.jpg",
        label: "157362_JR東日本ICチャージ.jpg",
        note: "157362台紙より登録。浜松町駅、チャージ金10,000円。"
      },
      {
        id: "exp-157362-miyako-taxi",
        date: "2026-03-20",
        vendor: "帝都自動車交通株式会社",
        category: "旅費交通費",
        itemName: "タクシー代",
        amount: 600,
        taxRate: "10%",
        registrationNumber: "T1010601027134",
        expenseEligibility: "eligible",
        expenseEligibilityReason: travelEligible,
        board: "157362_0.jpg",
        image: "157362-miyako-taxi.jpg",
        label: "157362_帝都自動車交通タクシー.jpg",
        note: "157362台紙より登録。タクシー領収書。"
      },
      {
        id: "exp-157362-yamate-taxi",
        date: "2026-03-20",
        vendor: "山手タクシー株式会社",
        category: "旅費交通費",
        itemName: "タクシー代",
        amount: 8300,
        taxRate: "10%",
        registrationNumber: "T5030001008497",
        expenseEligibility: "eligible",
        expenseEligibilityReason: travelEligible,
        board: "157362_0.jpg",
        image: "157362-yamate-taxi.jpg",
        label: "157362_山手タクシー.jpg",
        note: "157362台紙より登録。支払方法は領収書内に現金・チケット・カード等の表記あり。"
      },
      {
        id: "exp-157362-joyful",
        date: "2026-03-21",
        vendor: "ジョイフルエーケー屯田店",
        category: "消耗品費",
        itemName: "明細記載の商品代",
        amount: 469,
        taxRate: "10%",
        registrationNumber: "T4010001253022",
        expenseEligibility: "eligible",
        expenseEligibilityReason: "ホームセンターの業務用消耗品購入として登録するため適格。",
        board: "157362_0.jpg",
        image: "157362-joyful.jpg",
        label: "157362_ジョイフルエーケー.jpg",
        note: "157362台紙より登録。明細記載の商品代。"
      },
      {
        id: "exp-157362-fuel-left",
        date: "2026-03-21",
        vendor: "給油所（名称判読困難）",
        category: "燃料費",
        itemName: "灯油",
        amount: 4608,
        taxRate: "10%",
        registrationNumber: "",
        invoiceEligible: false,
        expenseEligibility: "eligible",
        expenseEligibilityReason: fuelEligible,
        board: "157362_0.jpg",
        image: "157362-fuel-left.jpg",
        label: "157362_給油灯油.jpg",
        note: `157362台紙より登録。${unknownTax}`
      },
      {
        id: "exp-157362-fuel-center",
        date: "2026-03-21",
        vendor: "給油所（名称判読困難）",
        category: "燃料費",
        itemName: "軽油",
        amount: 5364,
        taxRate: "10%",
        registrationNumber: "",
        invoiceEligible: false,
        expenseEligibility: "eligible",
        expenseEligibilityReason: fuelEligible,
        board: "157362_0.jpg",
        image: "157362-fuel-center.jpg",
        label: "157362_給油軽油.jpg",
        note: `157362台紙より登録。${unknownTax}`
      },
      {
        id: "exp-157362-fuel-right",
        date: "2026-03-22",
        vendor: "給油所（名称判読困難）",
        category: "燃料費",
        itemName: "軽油",
        amount: 4000,
        taxRate: "10%",
        registrationNumber: "T4010001253022",
        expenseEligibility: "eligible",
        expenseEligibilityReason: fuelEligible,
        board: "157362_0.jpg",
        image: "157362-fuel-right.jpg",
        label: "157362_給油軽油4000円.jpg",
        note: "157362台紙より登録。店舗名は画像で判読困難。"
      },
      {
        id: "exp-157361-okamoto-fuel",
        date: "2026-03-12",
        vendor: "株式会社オカモト セルフ恵庭恵み野",
        category: "燃料費",
        itemName: "レギュラーガソリン",
        amount: 9957,
        taxRate: "10%",
        registrationNumber: "T4460101000213",
        expenseEligibility: "eligible",
        expenseEligibilityReason: fuelEligible,
        board: "157361_0.jpg",
        image: "157361-okamoto-fuel.jpg",
        label: "157361_オカモト給油.jpg",
        note: "157361台紙より登録。"
      },
      {
        id: "exp-157361-grand-hotel",
        date: "2026-03-14",
        vendor: "士別グランドホテル",
        category: "旅費交通費",
        itemName: "宿泊WEB（大人）",
        amount: 92400,
        taxRate: "10%",
        registrationNumber: "T9450001007585",
        paymentMethod: "",
        expenseEligibility: "eligible",
        expenseEligibilityReason: "出張時の宿泊費として確認できるため適格。",
        board: "157361_0.jpg",
        image: "157361-grand-hotel.jpg",
        label: "157361_士別グランドホテル宿泊.jpg",
        note: "157361台紙より登録。宿泊期間2026/03/09-03/13、2名×5泊。支払区分は画像で未確認。"
      },
      {
        id: "exp-157361-parking-left",
        date: "2026-03-17",
        vendor: "駐車場（名称判読困難）",
        category: "旅費交通費",
        itemName: "駐車料金",
        amount: 500,
        taxRate: "10%",
        registrationNumber: "",
        invoiceEligible: false,
        expenseEligibility: "eligible",
        expenseEligibilityReason: travelEligible,
        board: "157361_0.jpg",
        image: "157361-parking-left.jpg",
        label: "157361_駐車場500円.jpg",
        note: `157361台紙より登録。${unknownTax}`
      },
      {
        id: "exp-157361-yabu",
        date: "2026-03-18",
        vendor: "日本ばし やぶ 両国江戸NOREN店",
        category: "交際費",
        itemName: "飲食代",
        amount: 5280,
        taxRate: "10%",
        registrationNumber: "T6010601050635",
        expenseEligibility: "ineligible",
        expenseEligibilityReason: foodIneligible,
        board: "157361_0.jpg",
        image: "157361-yabu.jpg",
        label: "157361_日本ばしやぶ.jpg",
        note: "157361台紙より登録。飲食代として。"
      },
      {
        id: "exp-157361-parking-right",
        date: "2026-03-19",
        vendor: "駐車場（名称判読困難）",
        category: "旅費交通費",
        itemName: "駐車料金",
        amount: 700,
        taxRate: "10%",
        registrationNumber: "",
        invoiceEligible: false,
        expenseEligibility: "eligible",
        expenseEligibilityReason: travelEligible,
        board: "157361_0.jpg",
        image: "157361-parking-right.jpg",
        label: "157361_駐車場700円.jpg",
        note: `157361台紙より登録。${unknownTax}`
      },
      {
        id: "exp-157360-shibetsu-center",
        date: "2026-03-12",
        vendor: "士別市勤労者センター",
        category: "研修費",
        itemName: "施設利用料",
        amount: 19320,
        taxRate: "不明",
        registrationNumber: "",
        invoiceEligible: false,
        expenseEligibility: "eligible",
        expenseEligibilityReason: eligible,
        board: "157360_0.jpg",
        image: "157360-shibetsu-center.jpg",
        label: "157360_士別市勤労者センター.jpg",
        note: `157360台紙より登録。3/9サークル室、3/10-3/12体育室。${unknownTax}`
      },
      {
        id: "exp-157360-tsuruha-10",
        date: "2026-03-12",
        vendor: "ツルハドラッグ 士別中央店",
        category: "消耗品費",
        itemName: "ツルハ購入分 10%対象",
        amount: 2926,
        taxRate: "10%",
        registrationNumber: "T1430001010672",
        expenseEligibility: "eligible",
        expenseEligibilityReason: "10%対象分は消耗品として登録。業務用購入分である前提で適格。",
        splitGroupId: "split-157360-tsuruha",
        board: "157360_0.jpg",
        image: "157360-tsuruha.jpg",
        label: "157360_ツルハドラッグ士別中央店.jpg",
        note: "157360台紙より登録。領収書の10%対象額。"
      },
      {
        id: "exp-157360-tsuruha-8",
        date: "2026-03-12",
        vendor: "ツルハドラッグ 士別中央店",
        category: "消耗品費",
        itemName: "ツルハ購入分 8%対象",
        amount: 400,
        taxRate: "8%",
        registrationNumber: "T1430001010672",
        expenseEligibility: "ineligible",
        expenseEligibilityReason: "8%対象分は飲食・食品等の可能性があり、業務用途の説明が不足しているため不適格。",
        splitGroupId: "split-157360-tsuruha",
        board: "157360_0.jpg",
        image: "157360-tsuruha.jpg",
        label: "157360_ツルハドラッグ士別中央店.jpg",
        note: "157360台紙より登録。領収書の8%対象額。"
      },
      {
        id: "exp-157360-tsubo8",
        date: "2026-03-12",
        vendor: "つぼ八 士別店",
        category: "交際費",
        itemName: "飲食代",
        amount: 8228,
        taxRate: "10%",
        registrationNumber: "T3450001007681",
        expenseEligibility: "ineligible",
        expenseEligibilityReason: foodIneligible,
        board: "157360_0.jpg",
        image: "157360-tsubo8.jpg",
        label: "157360_つぼ八士別店.jpg",
        note: "157360台紙より登録。食事代として。"
      },
      {
        id: "exp-157360-hokuren-left",
        date: "2026-03-14",
        vendor: "ホクレン士別南4条セルフ",
        category: "燃料費",
        itemName: "灯油",
        amount: 3220,
        taxRate: "10%",
        registrationNumber: "",
        invoiceEligible: false,
        expenseEligibility: "eligible",
        expenseEligibilityReason: fuelEligible,
        board: "157360_0.jpg",
        image: "157360-hokuren-left.jpg",
        label: "157360_ホクレン灯油.jpg",
        note: `157360台紙より登録。${unknownTax}`
      },
      {
        id: "exp-157360-hokuren-center",
        date: "2026-03-14",
        vendor: "ホクレン士別南4条セルフ",
        category: "燃料費",
        itemName: "軽油",
        amount: 4530,
        taxRate: "10%",
        registrationNumber: "",
        invoiceEligible: false,
        expenseEligibility: "eligible",
        expenseEligibilityReason: fuelEligible,
        board: "157360_0.jpg",
        image: "157360-hokuren-center.jpg",
        label: "157360_ホクレン軽油.jpg",
        note: `157360台紙より登録。${unknownTax}`
      },
      {
        id: "exp-157360-parking",
        date: "2026-03-13",
        vendor: "駐車場（名称判読困難）",
        category: "旅費交通費",
        itemName: "駐車料金",
        amount: 1100,
        taxRate: "不明",
        registrationNumber: "",
        invoiceEligible: false,
        expenseEligibility: "eligible",
        expenseEligibilityReason: travelEligible,
        board: "157360_0.jpg",
        image: "157360-parking.jpg",
        label: "157360_駐車場1100円.jpg",
        note: `157360台紙より登録。${unknownTax}`
      },
      {
        id: "exp-157357-paraka-parking",
        date: "2026-03-05",
        vendor: "パラカ株式会社",
        category: "旅費交通費",
        itemName: "駐車料金",
        amount: 1000,
        taxRate: "10%",
        registrationNumber: "T8010401043696",
        expenseEligibility: "eligible",
        expenseEligibilityReason: travelEligible,
        board: "157357_0.jpg",
        image: "157357-paraka-parking.jpg",
        label: "157357_パラカ駐車場.jpg",
        note: "157357台紙より登録。"
      },
      {
        id: "exp-157357-japan-post",
        date: "2026-03-08",
        vendor: "日本郵便株式会社",
        category: "通信費",
        itemName: "ゆうパック送料",
        amount: 1590,
        taxRate: "10%",
        registrationNumber: "T1010001112577",
        expenseEligibility: "eligible",
        expenseEligibilityReason: "業務書類・荷物の発送費として確認できるため適格。",
        board: "157357_0.jpg",
        image: "157357-japan-post.jpg",
        label: "157357_日本郵便ゆうパック.jpg",
        note: "157357台紙より登録。"
      },
      {
        id: "exp-157357-eneos",
        date: "2026-03-06",
        vendor: "北海道エネルギー D.Dチャレンジ恵み野セルフ",
        category: "燃料費",
        itemName: "レギュラーガソリン",
        amount: 6826,
        taxRate: "10%",
        registrationNumber: "T9430001037048",
        expenseEligibility: "eligible",
        expenseEligibilityReason: fuelEligible,
        board: "157357_0.jpg",
        image: "157357-eneos.jpg",
        label: "157357_ENEOSガソリン.jpg",
        note: "157357台紙より登録。"
      },
      {
        id: "exp-157357-okamoto",
        date: "2026-03-06",
        vendor: "株式会社オカモト セルフ恵庭恵み野",
        category: "燃料費",
        itemName: "レギュラーガソリン",
        amount: 6000,
        taxRate: "10%",
        registrationNumber: "T4460101000213",
        expenseEligibility: "eligible",
        expenseEligibilityReason: fuelEligible,
        board: "157357_0.jpg",
        image: "157357-okamoto.jpg",
        label: "157357_オカモト給油.jpg",
        note: "157357台紙より登録。"
      },
      {
        id: "exp-157357-fuel-left",
        date: "2026-03-08",
        vendor: "株式会社オカモト セルフ千歳",
        category: "燃料費",
        itemName: "軽油",
        amount: 4000,
        taxRate: "10%",
        registrationNumber: "T4460101000213",
        expenseEligibility: "eligible",
        expenseEligibilityReason: fuelEligible,
        board: "157357_0.jpg",
        image: "157357-fuel-left.jpg",
        label: "157357_オカモト軽油.jpg",
        note: "157357台紙より登録。"
      },
      {
        id: "exp-157357-apollo",
        date: "2026-03-09",
        vendor: "出光リテール販売株式会社",
        category: "燃料費",
        itemName: "ガソリン代",
        amount: 4000,
        taxRate: "10%",
        registrationNumber: "T2010001126403",
        expenseEligibility: "eligible",
        expenseEligibilityReason: fuelEligible,
        board: "157357_0.jpg",
        image: "157357-apollo.jpg",
        label: "157357_apollo給油.jpg",
        note: "157357台紙より登録。"
      },
      {
        id: "exp-157357-cosmo",
        date: "2026-03-09",
        vendor: "北日本エネルギー 苫小牧販売支店",
        category: "燃料費",
        itemName: "ガソリン代",
        amount: 4614,
        taxRate: "10%",
        registrationNumber: "T4010001253022",
        paymentMethod: "other",
        expenseEligibility: "eligible",
        expenseEligibilityReason: fuelEligible,
        board: "157357_0.jpg",
        image: "157357-cosmo.jpg",
        label: "157357_COSMO給油.jpg",
        note: "157357台紙より登録。d払い表記。"
      },
      {
        id: "exp-157359-rbp",
        date: "2026-03-11",
        vendor: "恵庭リサーチ・ビジネスパーク株式会社",
        category: "研修費",
        itemName: "研修室S-306利用料",
        amount: 10120,
        taxRate: "10%",
        registrationNumber: "T6430001043453",
        expenseEligibility: "eligible",
        expenseEligibilityReason: eligible,
        board: "157359_0.jpg",
        image: "157359-rbp.jpg",
        label: "157359_恵庭リサーチビジネスパーク.jpg",
        note: "157359台紙より登録。2026/03/11、13:00-18:00、5時間。"
      },
      {
        id: "exp-157358-car-service-parking",
        date: "2026-03-09",
        vendor: "カービスパーク北17西1",
        category: "旅費交通費",
        itemName: "駐車料金",
        amount: 400,
        taxRate: "10%",
        registrationNumber: "T6430001029485",
        expenseEligibility: "eligible",
        expenseEligibilityReason: travelEligible,
        board: "157358_0.jpg",
        image: "157358-car-service-parking.jpg",
        label: "157358_カービスパーク.jpg",
        note: "157358台紙より登録。"
      },
      {
        id: "exp-157358-restaurant-6000",
        date: "2026-03-10",
        vendor: "飲食店（名称判読困難）",
        category: "交際費",
        itemName: "飲食代",
        amount: 6000,
        taxRate: "不明",
        registrationNumber: "",
        invoiceEligible: false,
        expenseEligibility: "ineligible",
        expenseEligibilityReason: foodIneligible,
        board: "157358_0.jpg",
        image: "157358-restaurant-6000.jpg",
        label: "157358_飲食代6000円.jpg",
        note: `157358台紙より登録。手書き領収証。${unknownTax}`
      },
      {
        id: "exp-157358-bar-goat",
        date: "2026-03-11",
        vendor: "BAR GOAT",
        category: "交際費",
        itemName: "飲食代",
        amount: 19000,
        taxRate: "不明",
        registrationNumber: "",
        invoiceEligible: false,
        expenseEligibility: "ineligible",
        expenseEligibilityReason: foodIneligible,
        board: "157358_0.jpg",
        image: "157358-bar-goat.jpg",
        label: "157358_BAR_GOAT飲食代.jpg",
        note: `157358台紙より登録。手書き領収証。${unknownTax}`
      },
      {
        id: "exp-157358-sapporo-parking",
        date: "2026-03-11",
        vendor: "札幌コンベンションセンター駐車場",
        category: "旅費交通費",
        itemName: "駐車料金",
        amount: 1100,
        taxRate: "10%",
        registrationNumber: "T6010001019202",
        expenseEligibility: "eligible",
        expenseEligibilityReason: travelEligible,
        board: "157358_0.jpg",
        image: "157358-sapporo-parking.jpg",
        label: "157358_札幌コンベンションセンター駐車場.jpg",
        note: "157358台紙より登録。"
      },
      {
        id: "exp-157358-tanyo",
        date: "2026-03-11",
        vendor: "丹陽株式会社",
        category: "交際費",
        itemName: "飲食代",
        amount: 1930,
        taxRate: "10%",
        registrationNumber: "T8430001079099",
        expenseEligibility: "ineligible",
        expenseEligibilityReason: foodIneligible,
        board: "157358_0.jpg",
        image: "157358-tanyo.jpg",
        label: "157358_丹陽飲食代.jpg",
        note: "157358台紙より登録。食事代として。"
      },
      {
        id: "exp-157355-importcar",
        date: "2026-03-01",
        vendor: "有限会社インポートカーセールス ウエスティル",
        category: "車両費",
        itemName: "ハイエース修理代",
        amount: 349800,
        taxRate: "不明",
        registrationNumber: "",
        paymentMethod: "",
        invoiceEligible: false,
        expenseEligibility: "eligible",
        expenseEligibilityReason: "業務利用車両の修理代として確認できるため適格。",
        board: "157355_0.jpg",
        image: "157355-importcar.jpg",
        label: "157355_ハイエース修理代.jpg",
        note: `157355台紙より登録。収入印紙200円あり。${unknownTax}`
      },
      {
        id: "exp-157355-officeplay",
        date: "2026-03-03",
        vendor: "株式会社オフィスプレイ",
        category: "通信費",
        itemName: "電話代行料",
        amount: 12900,
        taxRate: "不明",
        registrationNumber: "T6430001040319",
        paymentMethod: "",
        expenseEligibility: "eligible",
        expenseEligibilityReason: "業務用の電話代行料として確認できるため適格。",
        board: "157355_0.jpg",
        image: "157355-officeplay.jpg",
        label: "157355_オフィスプレイ電話代行料.jpg",
        note: "157355台紙より登録。手書き領収証。"
      },
      {
        id: "exp-157355-bank-withdrawal",
        date: "2026-03-01",
        vendor: "NTTファイナンス株式会社",
        category: "通信費",
        itemName: "通信費等",
        amount: 8476,
        taxRate: "不明",
        registrationNumber: "",
        paymentMethod: "bank",
        invoiceEligible: false,
        expenseEligibility: "eligible",
        expenseEligibilityReason: "通信費等の支払として登録。請求明細との照合が必要。",
        board: "157355_0.jpg",
        image: "157355-bank-withdrawal.jpg",
        label: "157355_NTTファイナンス払込.jpg",
        note: `157355台紙より登録。払込票。${unknownTax}`
      },
      {
        id: "exp-157355-tendon",
        date: "2026-03-05",
        vendor: "天丼店（名称判読困難）",
        category: "交際費",
        itemName: "飲食代",
        amount: 3150,
        taxRate: "10%",
        registrationNumber: "T6430003001723",
        expenseEligibility: "ineligible",
        expenseEligibilityReason: foodIneligible,
        board: "157355_0.jpg",
        image: "157355-tendon.jpg",
        label: "157355_天丼飲食代.jpg",
        note: "157355台紙より登録。店名は画像で一部判読困難。"
      },
      {
        id: "exp-157355-tanyo",
        date: "2026-03-04",
        vendor: "丹陽株式会社",
        category: "交際費",
        itemName: "飲食代",
        amount: 1930,
        taxRate: "10%",
        registrationNumber: "T8430001079099",
        expenseEligibility: "ineligible",
        expenseEligibilityReason: foodIneligible,
        board: "157355_0.jpg",
        image: "157355-tanyo.jpg",
        label: "157355_丹陽飲食代.jpg",
        note: "157355台紙より登録。飲食代として。"
      }
    ];

    return records.map(({ board, image, label, ...record }) => ({
      ...base,
      ...record,
      unitPrice: record.unitPrice || record.amount,
      proof: proof(board, image, label)
    }));
  }

  function bundledReceipt202604Expenses() {
    const createdAt = "2026-06-23T00:00:00.000+09:00";
    const base = {
      department: "共通費",
      quantity: 1,
      unit: "式",
      paymentMethod: "card",
      invoiceEligible: true,
      createdAt
    };
    const proof = (boardFile, fileName, label) => ({
      name: label,
      type: "image/jpeg",
      size: 0,
      dataUrl: `assets/receipts/${fileName}`,
      fullDataUrl: `assets/receipts/${boardFile}`,
      fullName: `${boardFile.replace(".jpg", "")}_領収書台紙_全体.jpg`
    });
    const eligible = "業務利用の支出として証憑から内容を確認できるため適格。";
    const travelEligible = "業務移動に伴う交通費・駐車料金として確認できるため適格。";
    const fuelEligible = "業務車両の燃料費・車両関連費として確認できるため適格。";
    const foodIneligible = "飲食代は相手先・人数・目的が未記入のため不適格。接待・打合せ利用の場合は相手先と目的を追記して見直し。";
    const unknownIneligible = "カード売上票だけでは取引内容・T番号・用途が不足しているため不適格。領収書または明細確認後に見直し。";
    const records = [
      { id: "exp-157387-japan-taxi", date: "2026-04-30", vendor: "日本自動車交通株式会社", category: "旅費交通費", itemName: "タクシー代", amount: 2200, taxRate: "10%", registrationNumber: "T6011201004114", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157387_0.jpg", image: "157387-japan-taxi.jpg", label: "157387_日本自動車交通タクシー.jpg", note: "2026年4月台紙8。クレジット支払。" },
      { id: "exp-157387-capital-auto", date: "2026-04-30", vendor: "キャピタルオート株式会社", category: "旅費交通費", itemName: "タクシー代", amount: 1200, taxRate: "10%", registrationNumber: "T7011301011042", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157387_0.jpg", image: "157387-capital-auto.jpg", label: "157387_キャピタルオートタクシー.jpg", note: "2026年4月台紙8。クレジット支払。" },
      { id: "exp-157386-ippin-10", date: "2026-04-28", vendor: "十勝豚丼いっぴん 札幌北十条店", category: "交際費", itemName: "飲食代 10%対象", amount: 1500, taxRate: "10%", registrationNumber: "T1430001048424", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, splitGroupId: "split-157386-ippin", board: "157386_0.jpg", image: "157386-ippin.jpg", label: "157386_十勝豚丼いっぴん10%.jpg", note: "税率混在のため10%対象分を分割登録。" },
      { id: "exp-157386-ippin-8", date: "2026-04-28", vendor: "十勝豚丼いっぴん 札幌北十条店", category: "交際費", itemName: "飲食代 8%対象", amount: 2713, taxRate: "8%", registrationNumber: "T1430001048424", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, splitGroupId: "split-157386-ippin", board: "157386_0.jpg", image: "157386-ippin.jpg", label: "157386_十勝豚丼いっぴん8%.jpg", note: "税率混在のため8%対象分を分割登録。" },
      { id: "exp-157386-meals", date: "2026-04-28", vendor: "Asian Dining THE MEALS", category: "交際費", itemName: "飲食代", amount: 2800, taxRate: "10%", registrationNumber: "T9011002025307", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157386_0.jpg", image: "157386-meals.jpg", label: "157386_Asian Dining THE MEALS.jpg", note: "2026年4月台紙7。飲食目的未記入。" },
      { id: "exp-157386-airport-b-1000", date: "2026-04-30", vendor: "北海道エアポート株式会社 新千歳空港B駐車場", category: "旅費交通費", itemName: "駐車料金", amount: 1000, taxRate: "10%", registrationNumber: "T7430001079728", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157386_0.jpg", image: "157386-airport-b-1000.jpg", label: "157386_新千歳空港B駐車場1000円.jpg", note: "業務移動時の駐車料金。" },
      { id: "exp-157386-akasia", date: "2026-04-30", vendor: "アカシア 新宿本店", category: "交際費", itemName: "飲食代", amount: 4280, taxRate: "10%", registrationNumber: "T1011102000299", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157386_0.jpg", image: "157386-akasia.jpg", label: "157386_アカシア新宿本店.jpg", note: "飲食目的・相手先未記入。" },
      { id: "exp-157386-airport-b-9000", date: "2026-04-30", vendor: "北海道エアポート株式会社 新千歳空港B駐車場", category: "旅費交通費", itemName: "駐車料金", amount: 9000, taxRate: "10%", registrationNumber: "T7430001079728", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157386_0.jpg", image: "157386-airport-b-9000.jpg", label: "157386_新千歳空港B駐車場9000円.jpg", note: "業務移動時の駐車料金。" },
      { id: "exp-157380-cosmo-600", date: "2026-04-08", vendor: "キタセキ北海道 札幌新川SS", category: "車両費", itemName: "リヤワイパー", amount: 600, taxRate: "10%", registrationNumber: "T1370801000359", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157380_0.jpg", image: "157380-cosmo-600.jpg", label: "157380_COSMOリヤワイパー.jpg", note: "車両関連用品。" },
      { id: "exp-157380-daiko-3320-1", date: "2026-04-08", vendor: "5588運転代行", category: "旅費交通費", itemName: "運転代行料金", amount: 3320, taxRate: "不明", registrationNumber: "", invoiceEligible: false, expenseEligibility: "ineligible", expenseEligibilityReason: unknownIneligible, board: "157380_0.jpg", image: "157380-daiko-3320-1.jpg", label: "157380_運転代行3320円1.jpg", note: "カード売上票のみ。領収書または明細確認が必要。" },
      { id: "exp-157380-kakoiya", date: "2026-04-09", vendor: "個室×北海道 増毛食材商家 かこいや", category: "交際費", itemName: "飲食代", amount: 39950, taxRate: "10%", registrationNumber: "T3430001080961", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157380_0.jpg", image: "157380-kakoiya.jpg", label: "157380_かこいや飲食代.jpg", note: "高額飲食。相手先・人数・目的を追記して見直し。" },
      { id: "exp-157380-npc-parking-1200-1", date: "2026-04-08", vendor: "NPC24H南4西1P", category: "旅費交通費", itemName: "駐車料金", amount: 1200, taxRate: "10%", registrationNumber: "T7010001068319", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157380_0.jpg", image: "157380-npc-parking-1200-1.jpg", label: "157380_NPC駐車券1200円1.jpg", note: "業務移動時の駐車料金。" },
      { id: "exp-157380-npc-parking-1200-2", date: "2026-04-10", vendor: "NPC24H南4西1P", category: "旅費交通費", itemName: "駐車料金", amount: 1200, taxRate: "10%", registrationNumber: "T7010001068319", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157380_0.jpg", image: "157380-npc-parking-1200-2.jpg", label: "157380_NPC駐車券1200円2.jpg", note: "業務移動時の駐車料金。" },
      { id: "exp-157380-daiko-3320-2", date: "2026-04-10", vendor: "5588運転代行", category: "旅費交通費", itemName: "運転代行料金", amount: 3320, taxRate: "不明", registrationNumber: "", invoiceEligible: false, expenseEligibility: "ineligible", expenseEligibilityReason: unknownIneligible, board: "157380_0.jpg", image: "157380-daiko-3320-2.jpg", label: "157380_運転代行3320円2.jpg", note: "カード売上票のみ。領収書または明細確認が必要。" },
      { id: "exp-157381-eneos-5035", date: "2026-04-13", vendor: "北海道エネルギー D.Dチャレンジ恵み野SS", category: "燃料費", itemName: "軽油", amount: 5035, taxRate: "10%", registrationNumber: "T9430001037048", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157381_0.jpg", image: "157381-eneos-5035.jpg", label: "157381_ENEOS軽油5035円.jpg", note: "業務車両燃料費。" },
      { id: "exp-157381-eneos-1800", date: "2026-04-13", vendor: "北海道エネルギー D.Dチャレンジ恵み野SS", category: "燃料費", itemName: "レギュラーガソリン", amount: 1800, taxRate: "10%", registrationNumber: "T9430001037048", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157381_0.jpg", image: "157381-eneos-1800.jpg", label: "157381_ENEOS燃料1800円.jpg", note: "業務車両燃料費。" },
      { id: "exp-157381-parknet-1200", date: "2026-04-14", vendor: "パークネット札幌すすきの南5西6", category: "旅費交通費", itemName: "駐車料金", amount: 1200, taxRate: "10%", registrationNumber: "T7140001082323", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157381_0.jpg", image: "157381-parknet-1200.jpg", label: "157381_パークネット駐車券.jpg", note: "業務移動時の駐車料金。" },
      { id: "exp-157381-yuzuru", date: "2026-04-16", vendor: "遊鶴 札幌南8条店", category: "交際費", itemName: "飲食代", amount: 3310, taxRate: "10%", registrationNumber: "T7430001013389", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157381_0.jpg", image: "157381-yuzuru.jpg", label: "157381_遊鶴飲食代.jpg", note: "飲食目的・相手先未記入。" },
      { id: "exp-157381-cosmo-800", date: "2026-04-16", vendor: "キタセキ北海道 札幌新川SS", category: "車両費", itemName: "リヤワイパー", amount: 800, taxRate: "10%", registrationNumber: "T1370801000359", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157381_0.jpg", image: "157381-cosmo-800.jpg", label: "157381_COSMOリヤワイパー.jpg", note: "車両関連用品。" },
      { id: "exp-157381-newgate", date: "2026-04-17", vendor: "bar NEWGATE", category: "交際費", itemName: "飲食代", amount: 19000, taxRate: "10%", registrationNumber: "T7430003015870", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157381_0.jpg", image: "157381-newgate.jpg", label: "157381_bar NEWGATE.jpg", note: "高額飲食。相手先・人数・目的を追記して見直し。" },
      { id: "exp-157382-aburishun", date: "2026-04-17", vendor: "炙り旬 狸小路駅前店", category: "交際費", itemName: "飲食代", amount: 28500, taxRate: "10%", registrationNumber: "T8430001046306", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157382_0.jpg", image: "157382-aburishun.jpg", label: "157382_炙り旬飲食代.jpg", note: "高額飲食。相手先・人数・目的を追記して見直し。" },
      { id: "exp-157382-tsubame-taxi", date: "2026-04-18", vendor: "つばめタクシー", category: "旅費交通費", itemName: "タクシー代", amount: 2400, taxRate: "10%", registrationNumber: "T8430001010658", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157382_0.jpg", image: "157382-tsubame-taxi.jpg", label: "157382_つばめタクシー.jpg", note: "業務移動時のタクシー代。" },
      { id: "exp-157382-eneos-6403", date: "2026-04-20", vendor: "北海道エネルギー D.Dチャレンジ恵み野セルフ", category: "燃料費", itemName: "軽油", amount: 6403, taxRate: "10%", registrationNumber: "T9430001037048", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157382_0.jpg", image: "157382-eneos-6403.jpg", label: "157382_ENEOS軽油6403円.jpg", note: "業務車両燃料費。" },
      { id: "exp-157383-dcm-932", date: "2026-04-20", vendor: "DCM恵庭店", category: "消耗品費", itemName: "Pカットロープ", amount: 932, taxRate: "10%", registrationNumber: "T7010701039115", expenseEligibility: "eligible", expenseEligibilityReason: eligible, board: "157383_0.jpg", image: "157383-dcm-932.jpg", label: "157383_DCM消耗品.jpg", note: "業務用消耗品として登録。" },
      { id: "exp-157383-2ndstreet", date: "2026-04-20", vendor: "2nd STREET 恵み野店", category: "消耗品費", itemName: "アウトドア用品", amount: 5434, taxRate: "10%", registrationNumber: "T8180001139119", expenseEligibility: "ineligible", expenseEligibilityReason: "用途が未記入のため不適格。業務用品であれば用途を追記して見直し。", board: "157383_0.jpg", image: "157383-2ndstreet.jpg", label: "157383_2nd STREET.jpg", note: "用途確認が必要。" },
      { id: "exp-157384-dcm-1118", date: "2026-04-20", vendor: "DCMニコット", category: "消耗品費", itemName: "発泡面木・ステンレスリッドバケツ", amount: 1118, taxRate: "10%", registrationNumber: "T7010701039115", expenseEligibility: "eligible", expenseEligibilityReason: eligible, board: "157384_0.jpg", image: "157384-dcm-1118.jpg", label: "157384_DCMニコット消耗品.jpg", note: "業務用消耗品として登録。" },
      { id: "exp-157383-airport-b-1000", date: "2026-04-21", vendor: "北海道エアポート株式会社 新千歳空港B駐車場", category: "旅費交通費", itemName: "駐車料金", amount: 1000, taxRate: "10%", registrationNumber: "T7430001079728", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157383_0.jpg", image: "157383-airport-b-1000.jpg", label: "157383_新千歳空港B駐車場.jpg", note: "業務移動時の駐車料金。" },
      { id: "exp-157383-yoshiyuki-ss", date: "2026-04-21", vendor: "株式会社オカモト 36号千歳SS", category: "燃料費", itemName: "軽油", amount: 8290, taxRate: "10%", registrationNumber: "T6010601030604", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157383_0.jpg", image: "157383-yoshiyuki-ss.jpg", label: "157383_オカモト36号千歳SS.jpg", note: "業務車両燃料費。" },
      { id: "exp-157383-barcelona", date: "2026-04-22", vendor: "BARCELONA P&J", category: "交際費", itemName: "飲食代", amount: 303075, taxRate: "10%", registrationNumber: "T8430001073408", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157383_0.jpg", image: "157383-barcelona.jpg", label: "157383_BARCELONA P&J.jpg", note: "高額飲食。相手先・人数・目的を追記して見直し。" },
      { id: "exp-157385-card-104330", date: "2026-04-21", vendor: "加盟店名判読困難（カード売上票）", category: "雑費", itemName: "カード売上票", amount: 104330, taxRate: "不明", registrationNumber: "", expenseEligibility: "ineligible", expenseEligibilityReason: unknownIneligible, board: "157385_0.jpg", image: "157385-card-104330.jpg", label: "157385_カード売上票104330円.jpg", note: "T番号・取引内容未記入。領収書またはカード明細確認が必要。" },
      { id: "exp-157385-parknet-1200", date: "2026-04-22", vendor: "パークネット札幌すすきの南5西6", category: "旅費交通費", itemName: "駐車料金", amount: 1200, taxRate: "10%", registrationNumber: "T7140001082323", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157385_0.jpg", image: "157385-parknet-1200.jpg", label: "157385_パークネット1200円.jpg", note: "業務移動時の駐車料金。" },
      { id: "exp-157385-parknet-800", date: "2026-04-22", vendor: "パークネット札幌すすきの南5西6", category: "旅費交通費", itemName: "駐車料金", amount: 800, taxRate: "10%", registrationNumber: "T7140001082323", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157385_0.jpg", image: "157385-parknet-800.jpg", label: "157385_パークネット800円.jpg", note: "業務移動時の駐車料金。" },
      { id: "exp-157385-cardnet-3140", date: "2026-04-23", vendor: "加盟店名判読困難（CARDNET）", category: "雑費", itemName: "カード売上票", amount: 3140, taxRate: "不明", registrationNumber: "", invoiceEligible: false, expenseEligibility: "ineligible", expenseEligibilityReason: unknownIneligible, board: "157385_0.jpg", image: "157385-cardnet-3140.jpg", label: "157385_CARDNET3140円.jpg", note: "T番号・取引内容未記入。領収書またはカード明細確認が必要。" },
      { id: "exp-157385-food-9054", date: "2026-04-25", vendor: "飲食店名判読困難", category: "交際費", itemName: "飲食代", amount: 9054, taxRate: "10%", registrationNumber: "", invoiceEligible: false, expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157385_0.jpg", image: "157385-food-9054.jpg", label: "157385_飲食代9054円.jpg", note: "店名・T番号確認が必要。" },
      { id: "exp-157379-mcdonalds", date: "2026-04-02", vendor: "マクドナルド 平岸店", category: "交際費", itemName: "飲食代", amount: 1430, taxRate: "10%", registrationNumber: "T6430001049252", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157379_0.jpg", image: "157379-mcdonalds.jpg", label: "157379_マクドナルド平岸店.jpg", note: "飲食目的・相手先未記入。" },
      { id: "exp-157379-yangyuango", date: "2026-04-07", vendor: "中国料理 養源郷", category: "交際費", itemName: "飲食代", amount: 3938, taxRate: "10%", registrationNumber: "T3430001010489", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157379_0.jpg", image: "157379-yangyuango.jpg", label: "157379_中国料理養源郷.jpg", note: "飲食目的・相手先未記入。" },
      { id: "exp-157379-merchant-213004", date: "2026-04-06", vendor: "加盟店名判読困難（MERCHANTカード売上票）", category: "雑費", itemName: "カード売上票", amount: 213004, taxRate: "不明", registrationNumber: "", expenseEligibility: "ineligible", expenseEligibilityReason: unknownIneligible, board: "157379_0.jpg", image: "157379-merchant-213004.jpg", label: "157379_MERCHANTカード売上票.jpg", note: "T番号・取引内容未記入。領収書またはカード明細確認が必要。" },
      { id: "exp-157379-eneos-4830", date: "2026-04-07", vendor: "北海道エネルギー チャレンジ栄町通SS", category: "燃料費", itemName: "レギュラーガソリン", amount: 4830, taxRate: "10%", registrationNumber: "T9430001037048", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157379_0.jpg", image: "157379-eneos-4830.jpg", label: "157379_ENEOS燃料4830円.jpg", note: "業務車両燃料費。" },
      { id: "exp-157379-airport-a-2000", date: "2026-04-08", vendor: "北海道エアポート株式会社 新千歳空港A駐車場", category: "旅費交通費", itemName: "駐車料金", amount: 2000, taxRate: "10%", registrationNumber: "T7430001079728", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157379_0.jpg", image: "157379-airport-a-2000.jpg", label: "157379_新千歳空港A駐車場.jpg", note: "業務移動時の駐車料金。" }
    ];

    return records.map(({ board, image, label, ...record }) => ({
      ...base,
      ...record,
      unitPrice: record.unitPrice || record.amount,
      proof: proof(board, image, label)
    }));
  }

  function bundledReceipt202604RemainingExpenses() {
    const createdAt = "2026-06-23T00:00:00.000+09:00";
    const base = {
      department: "共通費",
      quantity: 1,
      unit: "式",
      paymentMethod: "cash",
      invoiceEligible: true,
      createdAt
    };
    const proof = (boardFile, fileName, label) => ({
      name: label,
      type: "image/jpeg",
      size: 0,
      dataUrl: `assets/receipts/${fileName}`,
      fullDataUrl: `assets/receipts/${boardFile}`,
      fullName: `${boardFile.replace(".jpg", "")}_領収書台紙全体.jpg`
    });
    const eligible = "領収書で日付・金額・支払内容を確認。事業用経費として処理候補。";
    const travelEligible = "移動・駐車に伴う支出として事業用経費候補。";
    const fuelEligible = "移動時の車両燃料費として事業用経費候補。";
    const foodIneligible = "飲食・食品購入のため、業務用途・相手先・人数が未記入。税理士確認が必要。";
    const unclearIneligible = "用途・相手先・T番号の一部が読み取り不鮮明。税理士確認が必要。";
    const records = [
      { id: "exp-157369-receipt-28314", date: "2026-04-01", vendor: "店舗名未記入", category: "消耗品費", itemName: "領収書まとめ", amount: 28314, taxRate: "10%", registrationNumber: "T7430001013595", paymentMethod: "card", expenseEligibility: "ineligible", expenseEligibilityReason: unclearIneligible, board: "157369_0.jpg", image: "157369_receipt_28314.jpg", label: "4月1日 領収書 28,314円", note: "店名・用途が読み取り不鮮明。金額は領収書記載の合計。" },
      { id: "exp-157369-japanpost-860", date: "2026-04-03", vendor: "日本郵便", category: "通信費", itemName: "レターパックライト 2枚", amount: 860, taxRate: "10%", registrationNumber: "T1010001112577", expenseEligibility: "eligible", expenseEligibilityReason: eligible, board: "157369_0.jpg", image: "157369_japanpost_860.jpg", label: "4月3日 日本郵便 860円", note: "郵送費として登録。" },
      { id: "exp-157369-cosmo-3000", date: "2026-04-05", vendor: "北日本エネルギー COSMO", category: "燃料費", itemName: "レギュラーガソリン", amount: 3000, taxRate: "10%", registrationNumber: "T4010001253022", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157369_0.jpg", image: "157369_cosmo_3000.jpg", label: "4月5日 COSMO 燃料 3,000円", note: "現金払い。" },
      { id: "exp-157369-seven-cert-250-1", date: "2026-04-05", vendor: "セブン-イレブン 札幌八軒8条店", category: "支払手数料", itemName: "地方公共団体証明書", amount: 250, taxRate: "非課税", registrationNumber: "", invoiceEligible: false, expenseEligibility: "eligible", expenseEligibilityReason: eligible, board: "157369_0.jpg", image: "157369_seven_cert_250_1.jpg", label: "4月5日 証明書 250円 1", note: "地方公共団体証明書代として登録。" },
      { id: "exp-157369-seven-cert-250-2", date: "2026-04-05", vendor: "セブン-イレブン 札幌八軒8条店", category: "支払手数料", itemName: "地方公共団体証明書", amount: 250, taxRate: "非課税", registrationNumber: "", invoiceEligible: false, expenseEligibility: "eligible", expenseEligibilityReason: eligible, board: "157369_0.jpg", image: "157369_seven_cert_250_2.jpg", label: "4月5日 証明書 250円 2", note: "地方公共団体証明書代として登録。" },
      { id: "exp-157370-hokuren-3000", date: "2026-04-05", vendor: "ホクレン 南幌給油所", category: "燃料費", itemName: "レギュラーガソリン", amount: 3000, taxRate: "10%", registrationNumber: "T7450005002502", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157370_0.jpg", image: "157370_hokuren_3000.jpg", label: "4月5日 ホクレン 燃料 3,000円", note: "現金払い。" },
      { id: "exp-157370-royal-limo-21300", date: "2026-04-06", vendor: "ロイヤルリムジン札幌", category: "旅費交通費", itemName: "運転代行", amount: 21300, taxRate: "10%", registrationNumber: "T5130001110455", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157370_0.jpg", image: "157370_royal_limo_21300.jpg", label: "4月6日 運転代行 21,300円", note: "移動関連費として登録。" },
      { id: "exp-157370-carpark-800", date: "2026-04-06", vendor: "カービスパーク南6西8", category: "旅費交通費", itemName: "駐車料金", amount: 800, taxRate: "10%", registrationNumber: "T6430001029485", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157370_0.jpg", image: "157370_carpark_800.jpg", label: "4月6日 駐車料金 800円", note: "駐車料金。" },
      { id: "exp-157370-endo-parking-600", date: "2026-04-06", vendor: "遠藤興産 南2西4パーキング", category: "旅費交通費", itemName: "駐車料金", amount: 600, taxRate: "10%", registrationNumber: "T3430001002478", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157370_0.jpg", image: "157370_endo_parking_600.jpg", label: "4月6日 駐車料金 600円", note: "駐車料金。" },
      { id: "exp-157370-endo-parking-800", date: "2026-04-06", vendor: "遠藤興産 南2西4パーキング", category: "旅費交通費", itemName: "駐車料金", amount: 800, taxRate: "10%", registrationNumber: "T3430001002478", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157370_0.jpg", image: "157370_endo_parking_800.jpg", label: "4月6日 駐車料金 800円", note: "駐車料金。" },
      { id: "exp-157370-cosmo-8607", date: "2026-04-06", vendor: "北日本エネルギー COSMO", category: "燃料費", itemName: "レギュラーガソリン", amount: 8607, taxRate: "10%", registrationNumber: "T4010001253022", paymentMethod: "card", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157370_0.jpg", image: "157370_cosmo_8607.jpg", label: "4月6日 COSMO 燃料 8,607円", note: "d払い表記あり。" },
      { id: "exp-157371-okamoto-8843", date: "2026-04-08", vendor: "オカモトセルフ", category: "燃料費", itemName: "燃料購入", amount: 8843, taxRate: "10%", registrationNumber: "T4460101000213", paymentMethod: "card", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157371_0.jpg", image: "157371_okamoto_8843.jpg", label: "4月8日 オカモト 8,843円", note: "カード支払。" },
      { id: "exp-157371-seicomart-6436", date: "2026-04-08", vendor: "セイコーマート", category: "交際費", itemName: "飲食物等", amount: 6436, taxRate: "10%", registrationNumber: "T7430001030315", paymentMethod: "card", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157371_0.jpg", image: "157371_seicomart_6436.jpg", label: "4月8日 セイコーマート 6,436円", note: "飲食・食品の可能性。業務用途を追記して税理士確認。" },
      { id: "exp-157371-receipt-1430", date: "2026-04-08", vendor: "店舗名未記入", category: "旅費交通費", itemName: "領収書 1,430円", amount: 1430, taxRate: "10%", registrationNumber: "", invoiceEligible: false, expenseEligibility: "ineligible", expenseEligibilityReason: unclearIneligible, board: "157371_0.jpg", image: "157371_receipt_1430.jpg", label: "4月8日 領収書 1,430円", note: "店名・用途・T番号確認が必要。" },
      { id: "exp-157371-parking-900", date: "2026-04-08", vendor: "駐車場ジャンボ1000", category: "旅費交通費", itemName: "駐車料金", amount: 900, taxRate: "10%", registrationNumber: "T9430001008668", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157371_0.jpg", image: "157371_parking_900.jpg", label: "4月8日 駐車料金 900円", note: "駐車料金。" },
      { id: "exp-157371-receipt-1200", date: "2026-04-09", vendor: "店舗名未記入", category: "旅費交通費", itemName: "領収書 1,200円", amount: 1200, taxRate: "10%", registrationNumber: "", invoiceEligible: false, expenseEligibility: "ineligible", expenseEligibilityReason: unclearIneligible, board: "157371_0.jpg", image: "157371_receipt_1200.jpg", label: "4月9日 領収書 1,200円", note: "店名・用途・T番号確認が必要。" },
      { id: "exp-157371-parking-800", date: "2026-04-09", vendor: "カービスパーク南6西8", category: "旅費交通費", itemName: "駐車料金", amount: 800, taxRate: "10%", registrationNumber: "T6430001029485", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157371_0.jpg", image: "157371_parking_800.jpg", label: "4月9日 駐車料金 800円", note: "駐車料金。" },
      { id: "exp-157371-airport-b-1000", date: "2026-04-08", vendor: "新千歳空港B駐車場", category: "旅費交通費", itemName: "駐車料金", amount: 1000, taxRate: "10%", registrationNumber: "T7430001079728", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157371_0.jpg", image: "157371_airport_b_1000.jpg", label: "4月8日 新千歳空港B 1,000円", note: "駐車料金。" },
      { id: "exp-157372-receipt-1260", date: "2026-04-10", vendor: "店舗名未記入", category: "旅費交通費", itemName: "領収書 1,260円", amount: 1260, taxRate: "10%", registrationNumber: "", invoiceEligible: false, expenseEligibility: "ineligible", expenseEligibilityReason: unclearIneligible, board: "157372_0.jpg", image: "157372_receipt_1260.jpg", label: "4月10日 領収書 1,260円", note: "店名・用途・T番号確認が必要。" },
      { id: "exp-157372-yellow-500", date: "2026-04-10", vendor: "店舗名未記入", category: "旅費交通費", itemName: "領収書 500円", amount: 500, taxRate: "10%", registrationNumber: "", invoiceEligible: false, expenseEligibility: "ineligible", expenseEligibilityReason: unclearIneligible, board: "157372_0.jpg", image: "157372_yellow_500.jpg", label: "4月10日 領収書 500円", note: "店名・用途・T番号確認が必要。" },
      { id: "exp-157372-taxi-10000", date: "2026-04-09", vendor: "Higuchi TAXI", category: "旅費交通費", itemName: "タクシー代", amount: 10000, taxRate: "10%", registrationNumber: "", invoiceEligible: false, expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157372_0.jpg", image: "157372_taxi_10000.jpg", label: "4月9日 タクシー 10,000円", note: "T番号未記入。領収証として保存。" },
      { id: "exp-157372-receipt-600", date: "2026-04-10", vendor: "店舗名未記入", category: "旅費交通費", itemName: "領収書 600円", amount: 600, taxRate: "10%", registrationNumber: "", invoiceEligible: false, expenseEligibility: "ineligible", expenseEligibilityReason: unclearIneligible, board: "157372_0.jpg", image: "157372_receipt_600.jpg", label: "4月10日 領収書 600円", note: "店名・用途・T番号確認が必要。" },
      { id: "exp-157372-parking-1700", date: "2026-04-10", vendor: "タイムズジャンボ1000", category: "旅費交通費", itemName: "駐車料金", amount: 1700, taxRate: "10%", registrationNumber: "T9430001008668", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157372_0.jpg", image: "157372_parking_1700.jpg", label: "4月10日 駐車料金 1,700円", note: "駐車料金。" },
      { id: "exp-157372-receipt-3892", date: "2026-04-10", vendor: "店舗名未記入", category: "旅費交通費", itemName: "領収書 3,892円", amount: 3892, taxRate: "10%", registrationNumber: "", invoiceEligible: false, expenseEligibility: "ineligible", expenseEligibilityReason: unclearIneligible, board: "157372_0.jpg", image: "157372_receipt_3892.jpg", label: "4月10日 領収書 3,892円", note: "店名・用途・T番号確認が必要。" },
      { id: "exp-157372-taxi-1000", date: "2026-04-10", vendor: "Higuchi TAXI", category: "旅費交通費", itemName: "タクシー代", amount: 1000, taxRate: "10%", registrationNumber: "", invoiceEligible: false, expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157372_0.jpg", image: "157372_taxi_1000.jpg", label: "4月10日 タクシー 1,000円", note: "T番号未記入。領収証として保存。" },
      { id: "exp-157373-parking-8844", date: "2026-04-17", vendor: "3・5狸パーキング", category: "旅費交通費", itemName: "駐車料金", amount: 8844, taxRate: "10%", registrationNumber: "", invoiceEligible: false, expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157373_0.jpg", image: "157373_parking_8844.jpg", label: "4月17日 駐車料金 8,844円", note: "T番号確認が必要。" },
      { id: "exp-157373-eneos-6968", date: "2026-04-14", vendor: "ENEOS", category: "燃料費", itemName: "燃料購入", amount: 6968, taxRate: "10%", registrationNumber: "T9430001037048", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157373_0.jpg", image: "157373_eneos_6968.jpg", label: "4月14日 ENEOS 6,968円", note: "燃料費。" },
      { id: "exp-157373-kizuna-2700", date: "2026-04-13", vendor: "絆珈琲店", category: "交際費", itemName: "飲食代", amount: 2700, taxRate: "10%", registrationNumber: "", invoiceEligible: false, expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157373_0.jpg", image: "157373_kizuna_2700.jpg", label: "4月13日 絆珈琲店 2,700円", note: "飲食代。相手先・目的の追記が必要。" },
      { id: "exp-157373-sk-parking-1800-1", date: "2026-04-17", vendor: "SK南2西8パーキング", category: "旅費交通費", itemName: "駐車料金", amount: 1800, taxRate: "10%", registrationNumber: "T1430001019318", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157373_0.jpg", image: "157373_sk_parking_1800_1.jpg", label: "4月17日 駐車料金 1,800円 1", note: "駐車料金。" },
      { id: "exp-157373-sk-parking-1800-2", date: "2026-04-17", vendor: "SK南2西8パーキング", category: "旅費交通費", itemName: "駐車料金", amount: 1800, taxRate: "10%", registrationNumber: "T1430001019318", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157373_0.jpg", image: "157373_sk_parking_1800_2.jpg", label: "4月17日 駐車料金 1,800円 2", note: "駐車料金。" },
      { id: "exp-157373-okamoto-5000", date: "2026-04-16", vendor: "オカモトセルフ", category: "燃料費", itemName: "燃料購入", amount: 5000, taxRate: "10%", registrationNumber: "T4460101000213", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157373_0.jpg", image: "157373_okamoto_5000.jpg", label: "4月16日 オカモト 5,000円", note: "燃料費。" },
      { id: "exp-157373-times-1000", date: "2026-04-16", vendor: "タイムズ", category: "旅費交通費", itemName: "駐車料金", amount: 1000, taxRate: "10%", registrationNumber: "", invoiceEligible: false, expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157373_0.jpg", image: "157373_times_1000.jpg", label: "4月16日 タイムズ 1,000円", note: "T番号確認が必要。" },
      { id: "exp-157375-cosmo-5000", date: "2026-04-24", vendor: "北日本エネルギー COSMO", category: "燃料費", itemName: "燃料購入", amount: 5000, taxRate: "10%", registrationNumber: "T4010001253022", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157375_0.jpg", image: "157375_cosmo_5000.jpg", label: "4月24日 COSMO 5,000円", note: "燃料費。" },
      { id: "exp-157375-corner-oil-5000", date: "2026-04-23", vendor: "コーナーオイル", category: "燃料費", itemName: "燃料購入", amount: 5000, taxRate: "10%", registrationNumber: "T7430001006271", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157375_0.jpg", image: "157375_corner_oil_5000.jpg", label: "4月23日 コーナーオイル 5,000円", note: "燃料費。" },
      { id: "exp-157375-sagawa-1460", date: "2026-04-25", vendor: "佐川急便", category: "通信費", itemName: "送料", amount: 1460, taxRate: "10%", registrationNumber: "T8130001000053", expenseEligibility: "eligible", expenseEligibilityReason: eligible, board: "157375_0.jpg", image: "157375_sagawa_1460.jpg", label: "4月25日 佐川急便 1,460円", note: "送料。" },
      { id: "exp-157375-eneos-8000", date: "2026-04-24", vendor: "ENEOS", category: "燃料費", itemName: "燃料購入", amount: 8000, taxRate: "10%", registrationNumber: "T9430001037048", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157375_0.jpg", image: "157375_eneos_8000.jpg", label: "4月24日 ENEOS 8,000円", note: "燃料費。" },
      { id: "exp-157375-bikkuri-3420", date: "2026-04-24", vendor: "びっくりドンキー", category: "交際費", itemName: "飲食代", amount: 3420, taxRate: "10%", registrationNumber: "", invoiceEligible: false, expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157375_0.jpg", image: "157375_bikkuri_3420.jpg", label: "4月24日 びっくりドンキー 3,420円", note: "飲食代。相手先・目的の追記が必要。" },
      { id: "exp-157375-parking-600-1", date: "2026-04-25", vendor: "サ・パーク第1・3", category: "旅費交通費", itemName: "駐車料金", amount: 600, taxRate: "10%", registrationNumber: "", invoiceEligible: false, expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157375_0.jpg", image: "157375_parking_600_1.jpg", label: "4月25日 駐車料金 600円 1", note: "T番号確認が必要。" },
      { id: "exp-157375-parking-600-2", date: "2026-04-25", vendor: "サ・パーク第1・3", category: "旅費交通費", itemName: "駐車料金", amount: 600, taxRate: "10%", registrationNumber: "", invoiceEligible: false, expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157375_0.jpg", image: "157375_parking_600_2.jpg", label: "4月25日 駐車料金 600円 2", note: "T番号確認が必要。" },
      { id: "exp-157377-sagawa-1460", date: "2026-04-28", vendor: "佐川急便", category: "通信費", itemName: "送料", amount: 1460, taxRate: "10%", registrationNumber: "T1300001000053", expenseEligibility: "eligible", expenseEligibilityReason: eligible, board: "157377_0.jpg", image: "157377_sagawa_1460.jpg", label: "4月28日 佐川急便 1,460円", note: "送料。" },
      { id: "exp-157377-rikka-680", date: "2026-04-26", vendor: "六花亭 北大エルム店", category: "交際費", itemName: "マルセイバターサンド", amount: 680, taxRate: "8%", registrationNumber: "T9460101001966", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157377_0.jpg", image: "157377_rikka_680.jpg", label: "4月26日 六花亭 680円", note: "食品購入。贈答・接待なら相手先と目的を追記。" },
      { id: "exp-157377-rikka-3140", date: "2026-04-26", vendor: "六花亭 北大エルム店", category: "交際費", itemName: "六花撰", amount: 3140, taxRate: "8%", registrationNumber: "T9460101001966", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157377_0.jpg", image: "157377_rikka_3140.jpg", label: "4月26日 六花亭 3,140円", note: "食品購入。贈答・接待なら相手先と目的を追記。" },
      { id: "exp-157377-parknet-1200", date: "2026-04-28", vendor: "パークネット札幌すすきの南5西6", category: "旅費交通費", itemName: "駐車料金", amount: 1200, taxRate: "10%", registrationNumber: "T7140001082323", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157377_0.jpg", image: "157377_parknet_1200.jpg", label: "4月28日 駐車料金 1,200円", note: "駐車料金。" }
    ];

    return records.map(({ board, image, label, ...record }) => ({
      ...base,
      ...record,
      unitPrice: record.unitPrice || record.amount,
      proof: proof(board, image, label)
    }));
  }

  function bundledReceipt202605Expenses() {
    const createdAt = "2026-06-23T00:00:00.000+09:00";
    const base = {
      department: "共通費",
      quantity: 1,
      unit: "式",
      paymentMethod: "cash",
      invoiceEligible: true,
      createdAt
    };
    const proof = (boardFile, fileName, label) => ({
      name: label,
      type: "image/jpeg",
      size: 0,
      dataUrl: `assets/receipts/${fileName}`,
      fullDataUrl: `assets/receipts/${boardFile}`,
      fullName: `${boardFile.replace(".jpg", "")}_領収書台紙_全体.jpg`
    });
    const eligible = "業務利用の支出として証憑から内容を確認できるため適格。";
    const travelEligible = "業務移動に伴う交通費・駐車料金として確認できるため適格。";
    const fuelEligible = "業務車両の燃料費・車両関連費として確認できるため適格。";
    const foodIneligible = "飲食代は相手先・人数・目的が未記入のため不適格。接待・打合せ利用の場合は相手先と目的を追記して見直し。";
    const unclearIneligible = "用途または内容が画像だけでは不足しているため不適格。業務用途が分かるメモを追記して見直し。";
    const records = [
      { id: "exp-157399-auto-tax", date: "2026-05-07", vendor: "北海道札幌道税事務所", category: "租税公課", itemName: "自動車税種別割", amount: 17600, taxRate: "非課税", registrationNumber: "", invoiceEligible: false, expenseEligibility: "eligible", expenseEligibilityReason: "業務車両に関する税金として証憑から確認できるため適格。", board: "157399_0.jpg", image: "157399-auto-tax.jpg", label: "157399_自動車税17600円.jpg", note: "2026年5月台紙4。納税通知書兼領収証書。" },
      { id: "exp-157399-seven-430", date: "2026-05-21", vendor: "セブン-イレブン 札幌保生橋店", category: "消耗品費", itemName: "非課税商品", amount: 430, taxRate: "非課税", registrationNumber: "T3430002040824", expenseEligibility: "ineligible", expenseEligibilityReason: unclearIneligible, board: "157399_0.jpg", image: "157399-seven-430.jpg", label: "157399_セブンイレブン430円.jpg", note: "品名・用途が不足。業務用途なら追記して見直し。" },
      { id: "exp-157399-daiso-440", date: "2026-05-21", vendor: "ダイソー", category: "消耗品費", itemName: "消耗品", amount: 440, taxRate: "10%", registrationNumber: "T7240001022681", expenseEligibility: "eligible", expenseEligibilityReason: eligible, board: "157399_0.jpg", image: "157399-daiso-440.jpg", label: "157399_DAISO440円.jpg", note: "業務用消耗品として登録。用途詳細があれば追記。" },
      { id: "exp-157399-japan-post-10", date: "2026-05-21", vendor: "日本郵便株式会社", category: "通信費", itemName: "第一種定形外郵便 10%対象", amount: 180, taxRate: "10%", registrationNumber: "T1010001112577", expenseEligibility: "eligible", expenseEligibilityReason: "業務書類の郵送費として確認できるため適格。", splitGroupId: "split-157399-japan-post", board: "157399_0.jpg", image: "157399-japan-post-320.jpg", label: "157399_日本郵便10%対象.jpg", note: "税区分が混在しているため10%対象分を分割登録。" },
      { id: "exp-157399-japan-post-exempt", date: "2026-05-21", vendor: "日本郵便株式会社", category: "通信費", itemName: "普通切手・ヤマブキ 140円", amount: 140, taxRate: "非課税", registrationNumber: "T1010001112577", expenseEligibility: "eligible", expenseEligibilityReason: "業務書類の郵送費として確認できるため適格。", splitGroupId: "split-157399-japan-post", board: "157399_0.jpg", image: "157399-japan-post-320.jpg", label: "157399_日本郵便非課税対象.jpg", note: "税区分が混在しているため非課税分を分割登録。" },
      { id: "exp-157402-eneos-6306", date: "2026-05-27", vendor: "北海道エネルギー チャレンジふじの里SS", category: "燃料費", itemName: "レギュラーガソリン", amount: 6306, taxRate: "10%", registrationNumber: "T9430001037048", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157402_0.jpg", image: "157402-eneos-6306.jpg", label: "157402_ENEOS燃料6306円.jpg", note: "157401_0.jpgと同じ台紙のため、見やすい157402_0.jpgで登録。" },
      { id: "exp-157402-seven-540", date: "2026-05-27", vendor: "セブン-イレブン 恵庭恵み野西店", category: "消耗品費", itemName: "購入品", amount: 540, taxRate: "10%", registrationNumber: "T4430001052431", expenseEligibility: "ineligible", expenseEligibilityReason: unclearIneligible, board: "157402_0.jpg", image: "157402-seven-540.jpg", label: "157402_セブンイレブン540円.jpg", note: "品名・用途が不足。業務用途なら追記して見直し。" },
      { id: "exp-157402-seven-80", date: "2026-05-28", vendor: "セブン-イレブン 士別東6条店", category: "消耗品費", itemName: "購入品", amount: 80, taxRate: "10%", registrationNumber: "T9810606509771", expenseEligibility: "ineligible", expenseEligibilityReason: unclearIneligible, board: "157402_0.jpg", image: "157402-seven-80.jpg", label: "157402_セブンイレブン80円.jpg", note: "品名・用途が不足。業務用途なら追記して見直し。" },
      { id: "exp-157402-chillin-30000", date: "2026-05-28", vendor: "Chillin", category: "交際費", itemName: "飲食代", amount: 30000, taxRate: "10%", registrationNumber: "T4810460066049", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157402_0.jpg", image: "157402-chillin-30000.jpg", label: "157402_Chillin飲食代30000円.jpg", note: "高額飲食。相手先・人数・目的を追記して見直し。" },
      { id: "exp-157402-hokuren-7831", date: "2026-05-29", vendor: "ホクレン剣淵給油所", category: "燃料費", itemName: "軽油", amount: 7831, taxRate: "10%", registrationNumber: "T7450005002502", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157402_0.jpg", image: "157402-hokuren-7831.jpg", label: "157402_ホクレン軽油7831円.jpg", note: "業務車両燃料費。" },
      { id: "exp-157400-sapporo-waste-4290", date: "2026-05-21", vendor: "札幌市", category: "支払手数料", itemName: "くみ取り手数料", amount: 4290, taxRate: "10%", registrationNumber: "T9000020011002", expenseEligibility: "eligible", expenseEligibilityReason: eligible, board: "157400_0.jpg", image: "157400-sapporo-waste-4290.jpg", label: "157400_札幌市くみ取り手数料.jpg", note: "納入通知書兼領収書。" },
      { id: "exp-157400-okamoto-7856", date: "2026-05-22", vendor: "株式会社オカモト セルフ恵庭むつみ野", category: "燃料費", itemName: "レギュラーガソリン", amount: 7856, taxRate: "10%", registrationNumber: "T4460101000213", paymentMethod: "card", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157400_0.jpg", image: "157400-okamoto-7856.jpg", label: "157400_オカモト燃料7856円.jpg", note: "領収書上は一般クレジット支払。" },
      { id: "exp-157400-npc-parking-1200", date: "2026-05-22", vendor: "NPC24H南4西1P", category: "旅費交通費", itemName: "駐車料金", amount: 1200, taxRate: "10%", registrationNumber: "T7010001068319", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157400_0.jpg", image: "157400-npc-parking-1200.jpg", label: "157400_NPC駐車券1200円.jpg", note: "業務移動時の駐車料金。" },
      { id: "exp-157400-eneos-5000", date: "2026-05-27", vendor: "北海道エネルギー", category: "燃料費", itemName: "軽油", amount: 5000, taxRate: "10%", registrationNumber: "T9430001037048", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157400_0.jpg", image: "157400-eneos-5000.jpg", label: "157400_ENEOS軽油5000円.jpg", note: "業務車両燃料費。" },
      { id: "exp-157398-super-arcs-2592", date: "2026-05-12", vendor: "SUPER ARCS", category: "交際費", itemName: "食品購入", amount: 2592, taxRate: "8%", registrationNumber: "T2430001028268", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157398_0.jpg", image: "157398-super-arcs-2592.jpg", label: "157398_SUPER ARCS食品2592円.jpg", note: "食品購入。業務用途・相手先を追記して見直し。" },
      { id: "exp-157398-car-service-800", date: "2026-05-12", vendor: "株式会社カービスネオ カービスパーク南6西8", category: "旅費交通費", itemName: "駐車料金", amount: 800, taxRate: "10%", registrationNumber: "T6430001029485", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157398_0.jpg", image: "157398-car-service-800.jpg", label: "157398_カービスパーク800円.jpg", note: "業務移動時の駐車料金。" },
      { id: "exp-157398-alpha-park-800", date: "2026-05-14", vendor: "アルファパーク北18", category: "旅費交通費", itemName: "駐車料金", amount: 800, taxRate: "10%", registrationNumber: "T4810463102379", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157398_0.jpg", image: "157398-alpha-park-800.jpg", label: "157398_アルファパーク800円.jpg", note: "業務移動時の駐車料金。" },
      { id: "exp-157398-cosmo-5000", date: "2026-05-14", vendor: "キタセキ北海道 札幌新川SS", category: "車両費", itemName: "洗車", amount: 5000, taxRate: "10%", registrationNumber: "T1370801000359", paymentMethod: "other", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157398_0.jpg", image: "157398-cosmo-5000.jpg", label: "157398_COSMO洗車5000円.jpg", note: "プリペイドカード支払。業務車両関連費。" },
      { id: "exp-157398-seven-430", date: "2026-05-15", vendor: "セブン-イレブン 恵庭恵み野西店", category: "消耗品費", itemName: "非課税商品", amount: 430, taxRate: "非課税", registrationNumber: "T4430001052431", expenseEligibility: "ineligible", expenseEligibilityReason: unclearIneligible, board: "157398_0.jpg", image: "157398-seven-430.jpg", label: "157398_セブンイレブン430円.jpg", note: "品名・用途が不足。業務用途なら追記して見直し。" },
      { id: "exp-157398-tsubame-1200", date: "2026-05-16", vendor: "つばめタクシー", category: "旅費交通費", itemName: "タクシー代", amount: 1200, taxRate: "10%", registrationNumber: "T8430001010658", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157398_0.jpg", image: "157398-tsubame-1200.jpg", label: "157398_つばめタクシー1200円.jpg", note: "業務移動時のタクシー代。" },
      { id: "exp-157398-billy-8460", date: "2026-05-16", vendor: "串かつBILLY 軒琴似店", category: "交際費", itemName: "飲食代", amount: 8460, taxRate: "不明", registrationNumber: "", invoiceEligible: false, expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157398_0.jpg", image: "157398-billy-8460.jpg", label: "157398_串かつBILLY8460円.jpg", note: "飲食目的・相手先・T番号確認が必要。" },
      { id: "exp-157397-eneos-6000", date: "2026-05-08", vendor: "北海道エネルギー チャレンジ西5条セルフ", category: "燃料費", itemName: "軽油", amount: 6000, taxRate: "10%", registrationNumber: "T9430001037048", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157397_0.jpg", image: "157397-eneos-6000.jpg", label: "157397_ENEOS軽油6000円.jpg", note: "業務車両燃料費。" },
      { id: "exp-157397-gift-3283", date: "2026-05-08", vendor: "株式会社サイロックス", category: "交際費", itemName: "ソフトカステラ巻", amount: 3283, taxRate: "8%", registrationNumber: "T6460101000836", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157397_0.jpg", image: "157397-gift-3283.jpg", label: "157397_食品3283円.jpg", note: "食品購入。渡した相手・目的を追記して見直し。" },
      { id: "exp-157397-sumire-4900", date: "2026-05-07", vendor: "すみれ 里塚店", category: "交際費", itemName: "飲食代", amount: 4900, taxRate: "10%", registrationNumber: "T3430001039735", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157397_0.jpg", image: "157397-sumire-4900.jpg", label: "157397_すみれ里塚店4900円.jpg", note: "飲食目的・相手先未記入。" },
      { id: "exp-157397-seven-430", date: "2026-05-11", vendor: "セブン-イレブン 札幌篠路店", category: "消耗品費", itemName: "非課税商品", amount: 430, taxRate: "非課税", registrationNumber: "T3430002040824", expenseEligibility: "ineligible", expenseEligibilityReason: unclearIneligible, board: "157397_0.jpg", image: "157397-seven-430.jpg", label: "157397_セブンイレブン430円.jpg", note: "品名・用途が不足。業務用途なら追記して見直し。" },
      { id: "exp-157397-kushiyaki-11000", date: "2026-05-10", vendor: "串焼 涼", category: "交際費", itemName: "飲食代", amount: 11000, taxRate: "不明", registrationNumber: "", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157397_0.jpg", image: "157397-kushiyaki-11000.jpg", label: "157397_串焼涼11000円.jpg", note: "高額飲食。相手先・人数・目的・T番号を確認。" },
      { id: "exp-157396-okamoto-4000", date: "2026-05-02", vendor: "株式会社オカモト セルフ恵庭むつみ野", category: "燃料費", itemName: "レギュラーガソリン", amount: 4000, taxRate: "10%", registrationNumber: "T4460101000213", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157396_0.jpg", image: "157396-okamoto-4000.jpg", label: "157396_オカモト燃料4000円.jpg", note: "現金支払。業務車両燃料費。" },
      { id: "exp-157396-okamoto-6087", date: "2026-05-02", vendor: "株式会社オカモト セルフ恵庭むつみ野", category: "燃料費", itemName: "レギュラーガソリン", amount: 6087, taxRate: "10%", registrationNumber: "T4460101000213", paymentMethod: "card", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157396_0.jpg", image: "157396-okamoto-6087.jpg", label: "157396_オカモト燃料6087円.jpg", note: "領収書上はクレジット支払。" },
      { id: "exp-157396-camp-1400", date: "2026-05-03", vendor: "湖畔木辺の里財田キャンプ場", category: "旅費交通費", itemName: "フリーサイト管理協力金", amount: 1400, taxRate: "不明", registrationNumber: "", invoiceEligible: false, expenseEligibility: "eligible", expenseEligibilityReason: "出張・現地利用に伴う支出として台紙上で確認できるため適格。", board: "157396_0.jpg", image: "157396-camp-1400.jpg", label: "157396_財田キャンプ場1400円.jpg", note: "T番号なし。用途詳細があれば追記。" },
      { id: "exp-157396-city-tax-27600", date: "2026-05-06", vendor: "札幌市", category: "租税公課", itemName: "市税等納付", amount: 27600, taxRate: "非課税", registrationNumber: "", invoiceEligible: false, expenseEligibility: "eligible", expenseEligibilityReason: "公租公課として証憑から確認できるため適格。", board: "157396_0.jpg", image: "157396-city-tax-27600.jpg", label: "157396_札幌市納付27600円.jpg", note: "納入通知書兼領収証書。" },
      { id: "exp-157396-ntt-8698", date: "2026-05-06", vendor: "NTTファイナンス株式会社", category: "通信費", itemName: "電話料金等 2026年4月請求分", amount: 8698, taxRate: "10%", registrationNumber: "", invoiceEligible: false, expenseEligibility: "eligible", expenseEligibilityReason: "業務通信費として払込受領証から確認できるため適格。", board: "157396_0.jpg", image: "157396-ntt-8698.jpg", label: "157396_NTTファイナンス8698円.jpg", note: "払込受領証。請求明細と照合推奨。" },
      { id: "exp-157396-water-1375", date: "2026-05-06", vendor: "札幌市水道事業管理者", category: "水道光熱費", itemName: "上下水道使用料", amount: 1375, taxRate: "10%", registrationNumber: "", invoiceEligible: false, expenseEligibility: "eligible", expenseEligibilityReason: "事業所利用の水道光熱費として確認できるため適格。", board: "157396_0.jpg", image: "157396-water-1375.jpg", label: "157396_札幌市水道1375円.jpg", note: "領収証書。請求明細と照合推奨。" },
      { id: "exp-157396-times-900", date: "2026-05-06", vendor: "タイムズすすきの6・6", category: "旅費交通費", itemName: "駐車料金", amount: 900, taxRate: "10%", registrationNumber: "T4010001137274", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157396_0.jpg", image: "157396-times-900.jpg", label: "157396_タイムズ駐車券900円.jpg", note: "業務移動時の駐車料金。" }
    ];

    return records.map(({ board, image, label, ...record }) => ({
      ...base,
      ...record,
      unitPrice: record.unitPrice || record.amount,
      proof: proof(board, image, label)
    }));
  }

  function bundledReceipt202605RemainingExpenses() {
    const createdAt = "2026-06-23T12:00:00.000+09:00";
    const base = {
      department: "共通費",
      quantity: 1,
      unit: "式",
      paymentMethod: "card",
      invoiceEligible: true,
      createdAt
    };
    const proof = (boardFile, fileName, label) => ({
      name: label,
      type: "image/jpeg",
      size: 0,
      dataUrl: `assets/receipts/${fileName}`,
      fullDataUrl: `assets/receipts/${boardFile}`,
      fullName: `${boardFile.replace(".jpg", "")}_領収書台紙全体.jpg`
    });
    const eligible = "領収書画像から業務利用の支出として確認できるため適格。";
    const fuelEligible = "業務車両の燃料費・車両関連費として確認できるため適格。";
    const travelEligible = "業務移動に伴う交通費・駐車料金として確認できるため適格。";
    const foodIneligible = "飲食代は相手先・人数・目的が未記入のため不適格。業務利用の場合は用途を追記して見直し。";
    const unclearIneligible = "用途または内容が画像だけでは不足しているため不適格。業務用途が分かるメモを追記して見直し。";
    const cardOnlyIneligible = "カード売上票のみで領収書・明細・T番号の確認が不足しているため不適格。";
    const records = [
      { id: "exp-157388-idemitsu-6887", date: "2026-05-03", vendor: "出光 セルフ石山SS", category: "燃料費", itemName: "軽油", amount: 6887, taxRate: "10%", registrationNumber: "T1430001021249", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157388_0.jpg", image: "157388-idemitsu-6887.jpg", label: "157388_出光軽油6887円.jpg", note: "2026年5月台紙1。カード払い。" },
      { id: "exp-157388-cosmo-600", date: "2026-05-06", vendor: "キタセキ北海道 札幌新川SS", category: "車両費", itemName: "ワックス・リヤワイパー", amount: 600, taxRate: "10%", registrationNumber: "T1370801000359", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157388_0.jpg", image: "157388-cosmo-600.jpg", label: "157388_COSMO車両用品600円.jpg", note: "2026年5月台紙1。カード払い。" },
      { id: "exp-157388-times-900", date: "2026-05-06", vendor: "タイムズすすきの6・6", category: "旅費交通費", itemName: "駐車料金", amount: 900, taxRate: "10%", registrationNumber: "T4010001137274", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157388_0.jpg", image: "157388-times-900.jpg", label: "157388_タイムズ駐車料金900円.jpg", note: "2026年5月台紙1。カード払い。" },
      { id: "exp-157388-parknet-600", date: "2026-05-07", vendor: "パークネット札幌南1西12", category: "旅費交通費", itemName: "駐車料金", amount: 600, taxRate: "10%", registrationNumber: "T7140001082323", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157388_0.jpg", image: "157388-parknet-600.jpg", label: "157388_パークネット駐車料金600円.jpg", note: "2026年5月台紙1。カード払い。" },
      { id: "exp-157388-lawson-1723", date: "2026-05-08", vendor: "ローソン札幌北24条十二丁目店", category: "交際費", itemName: "食品・飲料購入", amount: 1723, taxRate: "8%", registrationNumber: "T8430002042196", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157388_0.jpg", image: "157388-lawson-1723.jpg", label: "157388_ローソン1723円.jpg", note: "2026年5月台紙1。飲食・食品用途は相手先と目的の追記が必要。" },
      { id: "exp-157389-polo-33440", date: "2026-05-09", vendor: "Polo Ralph Lauren Factory Store", category: "消耗品費", itemName: "衣類 ジャケット", amount: 33440, taxRate: "10%", registrationNumber: "T5011001059326", expenseEligibility: "ineligible", expenseEligibilityReason: "衣類購入は業務用途が未記入のため不適格。制服・撮影衣装等であれば用途を追記して見直し。", board: "157389_0.jpg", image: "157389-polo-33440.jpg", label: "157389_POLO衣類33440円.jpg", note: "2026年5月台紙2。カード払い。" },
      { id: "exp-157389-pear-8", date: "2026-05-09", vendor: "パールモンドール", category: "交際費", itemName: "菓子代 8%対象", amount: 5950, taxRate: "8%", registrationNumber: "T5430001020395", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, splitGroupId: "split-157389-pear", board: "157389_0.jpg", image: "157389-pear-6170.jpg", label: "157389_パールモンドール8%対象5950円.jpg", note: "8%と10%が混ざるため税率別に分割登録。" },
      { id: "exp-157389-pear-10", date: "2026-05-09", vendor: "パールモンドール", category: "交際費", itemName: "ナンバーキャンドル 10%対象", amount: 220, taxRate: "10%", registrationNumber: "T5430001020395", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, splitGroupId: "split-157389-pear", board: "157389_0.jpg", image: "157389-pear-6170.jpg", label: "157389_パールモンドール10%対象220円.jpg", note: "8%と10%が混ざるため税率別に分割登録。" },
      { id: "exp-157390-lacoste-18480", date: "2026-05-09", vendor: "LACOSTE 三井アウトレットパーク札幌北広島店", category: "消耗品費", itemName: "衣類", amount: 18480, taxRate: "10%", registrationNumber: "T8011001047745", expenseEligibility: "ineligible", expenseEligibilityReason: "衣類購入は業務用途が未記入のため不適格。業務用であれば用途を追記して見直し。", board: "157390_0.jpg", image: "157390-lacoste-18480.jpg", label: "157390_LACOSTE18480円.jpg", note: "2026年5月台紙3。157388_0.jpgにカード売上票あり。二重計上防止のため領収書側で登録。" },
      { id: "exp-157390-mcdonalds-1300", date: "2026-05-12", vendor: "マクドナルド 藤野川店", category: "交際費", itemName: "飲食代", amount: 1300, taxRate: "10%", registrationNumber: "T8430001074604", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157390_0.jpg", image: "157390-mcdonalds-1300.jpg", label: "157390_マクドナルド1300円.jpg", note: "相手先・人数・目的の追記が必要。" },
      { id: "exp-157390-miyanomori-3000", date: "2026-05-12", vendor: "宮の森珈琲 山の手店", category: "交際費", itemName: "飲食代", amount: 3000, taxRate: "不明", registrationNumber: "", invoiceEligible: false, expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157390_0.jpg", image: "157390-miyanomori-3000.jpg", label: "157390_宮の森珈琲3000円.jpg", note: "カード売上票・領収証一部のみ。T番号と利用目的の確認が必要。" },
      { id: "exp-157392-times-5600", date: "2026-05-13", vendor: "タイムズ北2西3", category: "旅費交通費", itemName: "駐車料金", amount: 5600, taxRate: "10%", registrationNumber: "T4010001137274", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157392_0.jpg", image: "157392-times-5600.jpg", label: "157392_タイムズ駐車料金5600円.jpg", note: "157391_0.jpgと同じ台紙の写り違い。見やすい157392_0.jpgで登録。" },
      { id: "exp-157392-cosmo-800", date: "2026-05-14", vendor: "キタセキ北海道 札幌新川SS", category: "車両費", itemName: "ワックス・リヤワイパー", amount: 800, taxRate: "10%", registrationNumber: "T1370801000359", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157392_0.jpg", image: "157392-cosmo-800.jpg", label: "157392_COSMO車両用品800円.jpg", note: "157391_0.jpgと同じ台紙の写り違い。見やすい157392_0.jpgで登録。" },
      { id: "exp-157392-escon-fullswing-10", date: "2026-05-16", vendor: "ES CON FIELD HOKKAIDO Full Swing", category: "交際費", itemName: "飲食代 10%対象", amount: 650, taxRate: "10%", registrationNumber: "T2370001010208", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, splitGroupId: "split-157392-escon-fullswing", board: "157392_0.jpg", image: "157392-escon-fullswing-1150.jpg", label: "157392_ES CON飲食10%650円.jpg", note: "10%と8%が混ざるため税率別に分割登録。" },
      { id: "exp-157392-escon-fullswing-8", date: "2026-05-16", vendor: "ES CON FIELD HOKKAIDO Full Swing", category: "交際費", itemName: "飲食代 8%対象", amount: 500, taxRate: "8%", registrationNumber: "T2370001010208", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, splitGroupId: "split-157392-escon-fullswing", board: "157392_0.jpg", image: "157392-escon-fullswing-1150.jpg", label: "157392_ES CON飲食8%500円.jpg", note: "10%と8%が混ざるため税率別に分割登録。" },
      { id: "exp-157392-escon-raizan-12320", date: "2026-05-16", vendor: "焼肉と韓国料理 羅山", category: "交際費", itemName: "飲食代", amount: 12320, taxRate: "10%", registrationNumber: "T9430001058283", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157392_0.jpg", image: "157392-escon-raizan-12320.jpg", label: "157392_羅山飲食12320円.jpg", note: "相手先・人数・目的の追記が必要。" },
      { id: "exp-157392-fighters-12900", date: "2026-05-16", vendor: "FIGHTERS OFFICIAL STORE", category: "消耗品費", itemName: "物販購入", amount: 12900, taxRate: "不明", registrationNumber: "T3011003008357", expenseEligibility: "ineligible", expenseEligibilityReason: unclearIneligible, board: "157392_0.jpg", image: "157392-fighters-12900.jpg", label: "157392_FIGHTERS12900円.jpg", note: "購入品と業務用途の確認が必要。" },
      { id: "exp-157393-okamoto-6335", date: "2026-05-18", vendor: "オカモト セルフ恵庭むつみ野", category: "燃料費", itemName: "レギュラーガソリン", amount: 6335, taxRate: "10%", registrationNumber: "T4460101000213", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157393_0.jpg", image: "157393-okamoto-6335.jpg", label: "157393_オカモト燃料6335円.jpg", note: "2026年5月台紙5。カード払い。" },
      { id: "exp-157393-okamoto-5000", date: "2026-05-19", vendor: "オカモト セルフ恵庭むつみ野", category: "燃料費", itemName: "軽油", amount: 5000, taxRate: "10%", registrationNumber: "T4460101000213", paymentMethod: "cash", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157393_0.jpg", image: "157393-okamoto-5000.jpg", label: "157393_オカモト軽油5000円.jpg", note: "現金払い。ENEOSお釣引換券は経費ではないため未登録。" },
      { id: "exp-157393-times-2000", date: "2026-05-20", vendor: "タイムズすすきの6・6", category: "旅費交通費", itemName: "駐車料金", amount: 2000, taxRate: "10%", registrationNumber: "T4010001137274", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157393_0.jpg", image: "157393-times-2000.jpg", label: "157393_タイムズ駐車料金2000円.jpg", note: "カード払い。" },
      { id: "exp-157393-long-3400", date: "2026-05-20", vendor: "Long 定額代行", category: "旅費交通費", itemName: "運転代行代", amount: 3400, taxRate: "不明", registrationNumber: "T5430001086651", expenseEligibility: "eligible", expenseEligibilityReason: "業務移動に伴う運転代行代として台紙上で確認できるため適格。私用利用の場合は不適格へ変更。", board: "157393_0.jpg", image: "157393-long-3400.jpg", label: "157393_Long運転代行3400円.jpg", note: "業務移動目的の確認メモがあると安全。" },
      { id: "exp-157394-dining-57400", date: "2026-05-22", vendor: "飲食店名未確認", category: "交際費", itemName: "飲食代", amount: 57400, taxRate: "10%", registrationNumber: "T6430101044787", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157394_0.jpg", image: "157394-dining-57400.jpg", label: "157394_飲食代57400円.jpg", note: "店舗名・相手先・人数・目的の確認が必要。高額飲食のため税理士確認推奨。" },
      { id: "exp-157394-yamada-3490", date: "2026-05-22", vendor: "ヤマダデンキ Tecc LIFE SELECT 札幌本店", category: "消耗品費", itemName: "備品・消耗品", amount: 3490, taxRate: "10%", registrationNumber: "T20700010036729", expenseEligibility: "eligible", expenseEligibilityReason: eligible, board: "157394_0.jpg", image: "157394-yamada-3490.jpg", label: "157394_ヤマダデンキ3490円.jpg", note: "業務用備品として登録。用途詳細があれば追記。" },
      { id: "exp-157394-card-122880", date: "2026-05-22", vendor: "カード売上票 加盟店名未確認", category: "雑費", itemName: "カード売上票のみ", amount: 122880, taxRate: "不明", registrationNumber: "", invoiceEligible: false, expenseEligibility: "ineligible", expenseEligibilityReason: cardOnlyIneligible, board: "157394_0.jpg", image: "157394-card-122880.jpg", label: "157394_カード売上票122880円.jpg", note: "領収書または明細確認が必要。二重計上注意。" },
      { id: "exp-157394-jingisukan-31405", date: "2026-05-20", vendor: "焼肉神楽 すすきの本店", category: "交際費", itemName: "飲食代", amount: 31405, taxRate: "10%", registrationNumber: "T2430001094855", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157394_0.jpg", image: "157394-jingisukan-31405.jpg", label: "157394_焼肉神楽31405円.jpg", note: "相手先・人数・目的の追記が必要。" },
      { id: "exp-157395-mobius-7551", date: "2026-05-28", vendor: "モビウス石油", category: "燃料費", itemName: "軽油", amount: 7551, taxRate: "10%", registrationNumber: "T5460001000526", expenseEligibility: "eligible", expenseEligibilityReason: fuelEligible, board: "157395_0.jpg", image: "157395-mobius-7551.jpg", label: "157395_モビウス石油7551円.jpg", note: "2026年5月台紙7。カード払い。" },
      { id: "exp-157395-luckymart-2276", date: "2026-05-25", vendor: "LUCKYmart 幌向店", category: "交際費", itemName: "食品・飲料購入", amount: 2276, taxRate: "8%", registrationNumber: "T1430001015181", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157395_0.jpg", image: "157395-luckymart-2276.jpg", label: "157395_LUCKYmart2276円.jpg", note: "飲食・食品用途は相手先と目的の追記が必要。" },
      { id: "exp-157395-parknet-1200", date: "2026-05-26", vendor: "パークネット札幌すすきの南5西6", category: "旅費交通費", itemName: "駐車料金", amount: 1200, taxRate: "10%", registrationNumber: "T7140001082323", expenseEligibility: "eligible", expenseEligibilityReason: travelEligible, board: "157395_0.jpg", image: "157395-parknet-1200.jpg", label: "157395_パークネット駐車料金1200円.jpg", note: "カード払い。" },
      { id: "exp-157395-lawson-2904", date: "2026-05-26", vendor: "ローソン", category: "交際費", itemName: "食品・飲料購入", amount: 2904, taxRate: "8%", registrationNumber: "T8430001062721", expenseEligibility: "ineligible", expenseEligibilityReason: foodIneligible, board: "157395_0.jpg", image: "157395-lawson-2904.jpg", label: "157395_ローソン2904円.jpg", note: "飲食・食品用途は相手先と目的の追記が必要。" },
      { id: "exp-157395-cardnet-18590", date: "2026-05-28", vendor: "CARDNET加盟店 カード売上票", category: "雑費", itemName: "カード売上票のみ", amount: 18590, taxRate: "不明", registrationNumber: "", invoiceEligible: false, expenseEligibility: "ineligible", expenseEligibilityReason: cardOnlyIneligible, board: "157395_0.jpg", image: "157395-cardnet-18590.jpg", label: "157395_CARDNET18590円.jpg", note: "領収書または明細確認が必要。二重計上注意。" },
      { id: "exp-157395-gmofg-16040", date: "2026-05-28", vendor: "GMO-FG加盟店 カード売上票", category: "雑費", itemName: "カード売上票のみ", amount: 16040, taxRate: "不明", registrationNumber: "", invoiceEligible: false, expenseEligibility: "ineligible", expenseEligibilityReason: cardOnlyIneligible, board: "157395_0.jpg", image: "157395-gmofg-16040.jpg", label: "157395_GMO-FG16040円.jpg", note: "領収書または明細確認が必要。二重計上注意。" }
    ];

    return records.map(({ board, image, label, ...record }) => ({
      ...base,
      ...record,
      unitPrice: record.unitPrice || record.amount,
      proof: proof(board, image, label)
    }));
  }

  function applyExpenseEligibilityDefaults() {
    state.expenses = Array.isArray(state.expenses) ? state.expenses : [];
    let changedCount = 0;
    state.expenses.forEach((item) => {
      const normalized = normalizeExpenseEligibility(item.expenseEligibility);
      if (normalized) {
        item.expenseEligibility = normalized;
        if (!clean(item.expenseEligibilityReason)) {
          item.expenseEligibilityReason = inferExpenseEligibility(item).reason;
          changedCount += 1;
        }
        return;
      }
      applyExpenseEligibility(item);
      changedCount += 1;
    });
    if (changedCount) addAudit("経費適格判定初期設定", { count: changedCount });
  }

  function applyExpenseEligibility(record, selectedValue, reason) {
    const selected = normalizeExpenseEligibility(selectedValue);
    const inferred = inferExpenseEligibility(record);
    record.expenseEligibility = selected || inferred.value;
    record.expenseEligibilityReason = clean(reason) || record.expenseEligibilityReason || inferred.reason;
    return record;
  }

  function inferExpenseEligibility(item = {}) {
    const preset = {
      "exp-157347-tsuruha-10": ["eligible", "10%対象分は消耗品として登録。業務用購入分である前提で適格。"],
      "exp-157347-tsuruha-8": ["ineligible", "8%対象分は飲食・食品等の可能性があり、業務用途の説明が不足しているため不適格。"],
      "exp-157347-cosmo": ["eligible", "車両関連の洗車代として業務利用車両に紐づけられるため適格。"],
      "exp-157347-lucky": ["ineligible", "スーパー購入分で業務用途・利用目的が未記載のため不適格。"],
      "exp-157347-airport-parking": ["eligible", "移動時の駐車料金として業務移動に紐づけられるため適格。"],
      "exp-157347-shinshin": ["ineligible", "飲食代は相手先・人数・目的が未記載のため不適格。"]
    };
    if (preset[item.id]) return { value: preset[item.id][0], reason: preset[item.id][1] };

    const text = [item.vendor, item.category, item.itemName, item.note].filter(Boolean).join(" ");
    if (/ツルハ/.test(text) && item.taxRate === "8%") {
      return { value: "ineligible", reason: "ツルハの8%対象分は飲食・食品等の可能性があり、業務用途の説明が不足しているため不適格。" };
    }
    if (/ツルハ/.test(text) && item.taxRate === "10%") {
      return { value: "eligible", reason: "ツルハの10%対象分は消耗品として登録。業務用購入分である前提で適格。" };
    }
    if (/駐車|ガソリン|燃料|洗車|車両|交通|旅費|出張|宿泊|高速|タクシー|通信|会議|研修|書籍|新聞|消耗品|事務|備品/.test(text)) {
      return { value: "eligible", reason: "業務に使う内容として説明しやすい科目・品名のため適格。" };
    }
    if (/スーパー|飲食|食事|ランチ|居酒屋|レストラン|食品|食料|私用|個人/.test(text)) {
      return { value: "ineligible", reason: "業務目的・相手先・利用理由の説明が不足しているため不適格。" };
    }
    return { value: "ineligible", reason: "業務用途の説明が未入力のため不適格。必要な場合は理由を追記して適格に変更。" };
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
      documentExtracts: renderDocumentExtracts,
      taxAccountant: renderTaxAccountant,
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
    const monthlyRows = monthlyReceiptSummaryRows(expenses);
    const filtered = receiptPaymentFilter === "all" ? expenses : expenses.filter((item) => item.paymentMethod === receiptPaymentFilter);
    const grouped = groupByMonth(filtered, "date");

    app.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <h2>レシート登録</h2>
          <span class="badge">${esc(state.settings.companyName)}</span>
        </div>
        <div class="panel-body">
          ${renderLocalOcrPanel()}
          ${expenseForm("receiptForm", "登録", true)}
        </div>
      </section>

      <section class="panel" style="margin-top:14px;">
        <div class="panel-head">
          <h2>月別集計表</h2>
          <div class="actions">
            <span class="badge">${yen(sum(monthlyRows, "total"))}</span>
            <button class="button secondary small" id="exportReceiptMonthlyCsv" type="button">CSV</button>
          </div>
        </div>
        <div class="panel-body">
          ${renderReceiptMonthlySummary(monthlyRows)}
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
    document.getElementById("exportReceiptMonthlyCsv").addEventListener("click", () => exportCsv("receipt-monthly-summary", monthlyRows, receiptMonthlySummaryCsvFields()));
    bindExpenseFormHelpers("receiptForm");
    bindLocalOcrPanel();
    bindReceiptActions();
  }

  function monthlyReceiptSummaryRows(expenses) {
    const grouped = groupByMonth(expenses, "date");
    return fiscalMonths(selectedFiscalYear).map((month) => {
      const records = grouped[month] || [];
      const categoryTotals = records.reduce((acc, item) => {
        const key = item.category || "未分類";
        acc[key] = (acc[key] || 0) + num(item.amount);
        return acc;
      }, {});
      const mainCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([category, amount]) => `${category} ${yen(amount)}`)
        .join(" / ");
      return {
        month,
        count: records.length,
        total: sum(records, "amount"),
        cardTotal: sum(records.filter((item) => item.paymentMethod === "card"), "amount"),
        cashTotal: sum(records.filter((item) => item.paymentMethod === "cash"), "amount"),
        bankTotal: sum(records.filter((item) => item.paymentMethod === "bank"), "amount"),
        otherPaymentTotal: sum(records.filter((item) => !["card", "cash", "bank"].includes(item.paymentMethod)), "amount"),
        tax10Total: sum(records.filter((item) => item.taxRate === "10%"), "amount"),
        tax8Total: sum(records.filter((item) => item.taxRate === "8%"), "amount"),
        otherTaxTotal: sum(records.filter((item) => !["10%", "8%"].includes(item.taxRate)), "amount"),
        proofAttached: records.filter((item) => item.proof).length,
        proofMissing: records.filter((item) => !item.proof).length,
        eligibleCount: records.filter((item) => expenseEligibilityValue(item) === "eligible").length,
        ineligibleCount: records.filter((item) => expenseEligibilityValue(item) === "ineligible").length,
        registrationMissing: records.filter((item) => num(item.amount) >= 10000 && item.invoiceEligible && !isValidRegistration(item.registrationNumber)).length,
        mainCategories
      };
    });
  }

  function renderReceiptMonthlySummary(rows) {
    const nonEmptyCount = rows.filter((row) => row.count).length;
    return `
      <div class="table-wrap monthly-summary-table">
        <table>
          <thead>
            <tr>
              <th>月</th>
              <th class="num">件数</th>
              <th class="num">合計</th>
              <th class="num">カード</th>
              <th class="num">現金</th>
              <th class="num">口座振込</th>
              <th class="num">その他支払</th>
              <th class="num">10%</th>
              <th class="num">8%</th>
              <th class="num">その他税</th>
              <th>証憑</th>
              <th>T番号不足</th>
              <th>経費適格</th>
              <th>主な科目</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `<tr class="${row.count ? "" : "is-empty"}">
              <td><strong>${esc(monthLabel(row.month))}</strong></td>
              <td class="num">${row.count}</td>
              <td class="num">${yen(row.total)}</td>
              <td class="num">${yen(row.cardTotal)}</td>
              <td class="num">${yen(row.cashTotal)}</td>
              <td class="num">${yen(row.bankTotal)}</td>
              <td class="num">${yen(row.otherPaymentTotal)}</td>
              <td class="num">${yen(row.tax10Total)}</td>
              <td class="num">${yen(row.tax8Total)}</td>
              <td class="num">${yen(row.otherTaxTotal)}</td>
              <td>${row.count ? `${row.proofAttached}/${row.count}件${row.proofMissing ? ` <span class="badge warn">不足${row.proofMissing}</span>` : ` <span class="badge good">OK</span>`}` : "-"}</td>
              <td>${row.registrationMissing ? `<span class="badge bad">${row.registrationMissing}件</span>` : "-"}</td>
              <td>${row.count ? `${row.eligibleCount}/${row.count}件${row.ineligibleCount ? ` <span class="badge bad">不適格${row.ineligibleCount}</span>` : ` <span class="badge good">OK</span>`}` : "-"}</td>
              <td>${esc(row.mainCategories || "-")}</td>
            </tr>`).join("")}
          </tbody>
          <tfoot>
            <tr>
              <th>年度合計</th>
              <th class="num">${sum(rows, "count")}</th>
              <th class="num">${yen(sum(rows, "total"))}</th>
              <th class="num">${yen(sum(rows, "cardTotal"))}</th>
              <th class="num">${yen(sum(rows, "cashTotal"))}</th>
              <th class="num">${yen(sum(rows, "bankTotal"))}</th>
              <th class="num">${yen(sum(rows, "otherPaymentTotal"))}</th>
              <th class="num">${yen(sum(rows, "tax10Total"))}</th>
              <th class="num">${yen(sum(rows, "tax8Total"))}</th>
              <th class="num">${yen(sum(rows, "otherTaxTotal"))}</th>
              <th>${sum(rows, "proofAttached")}/${sum(rows, "count")}件</th>
              <th>${sum(rows, "registrationMissing")}件</th>
              <th>${sum(rows, "eligibleCount")}/${sum(rows, "count")}件</th>
              <th>${nonEmptyCount}か月分</th>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  function receiptMonthlySummaryCsvFields() {
    return [
      ["month", "月"],
      ["count", "件数"],
      ["total", "合計"],
      ["cardTotal", "カード"],
      ["cashTotal", "現金"],
      ["bankTotal", "口座振込"],
      ["otherPaymentTotal", "その他支払"],
      ["tax10Total", "10%"],
      ["tax8Total", "8%"],
      ["otherTaxTotal", "その他税区分"],
      ["proofAttached", "証憑あり"],
      ["proofMissing", "証憑不足"],
      ["registrationMissing", "T番号不足"],
      ["eligibleCount", "経費適格"],
      ["ineligibleCount", "経費不適格"],
      ["mainCategories", "主な科目"]
    ];
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
      ["paymentRequestNo", "支払依頼番号"], ["paymentRequestStatus", "支払依頼状態"], ["taxRate", "税区分"], ["registrationNumber", "T番号"], ["invoiceEligible", "インボイス適格"], ["expenseEligibility", "経費適格"], ["expenseEligibilityReason", "判定理由"], ["splitGroupId", "税率分割ID"], ["note", "摘要"]
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

  function renderLocalOcrPanel() {
    const status = getLocalOcrEngineStatus();
    return `
      <div class="local-ocr-panel" data-local-ocr>
        <div class="local-ocr-head">
          <div>
            <h3>ローカルOCR</h3>
            <p>画像はこのブラウザ内で読み取ります。クラウドOCRや外部AIには送信しません。</p>
          </div>
          <div class="actions">
            <span class="badge good">外部送信なし</span>
            <span class="badge ${esc(status.badge)}">${esc(status.label)}</span>
          </div>
        </div>
        <div class="local-ocr-grid">
          <label class="field">
            <span>読取画像</span>
            <input id="localOcrFile" type="file" accept="image/*" multiple>
            <small>台紙写真は候補に分けて確認します。切り抜き済み画像は複数選択できます。</small>
          </label>
          <label class="field">
            <span>読み取り文字を貼付</span>
            <textarea id="localOcrPaste" placeholder="OCR済みテキストを貼る場合はこちら。画像OCRが未対応のブラウザでも、貼り付けた文字から日付・金額・T番号を整理できます。"></textarea>
          </label>
        </div>
        <div class="actions local-ocr-actions">
          <button class="button secondary" id="localOcrRun" type="button">画像から読取</button>
          <button class="button secondary" id="localOcrParseText" type="button">貼付文字を解析</button>
          <button class="button" id="localOcrApply" type="button" ${lastLocalOcrResult ? "" : "disabled"}>フォームへ反映</button>
        </div>
        <div id="localOcrMessage" class="local-ocr-message">${esc(status.detail)}</div>
        <div id="localOcrResult">
          ${renderLocalOcrResult(lastLocalOcrResult)}
        </div>
      </div>
    `;
  }

  function bindLocalOcrPanel() {
    const panel = app.querySelector("[data-local-ocr]");
    if (!panel) return;
    const fileInput = panel.querySelector("#localOcrFile");
    const pasteInput = panel.querySelector("#localOcrPaste");
    const runButton = panel.querySelector("#localOcrRun");
    const parseButton = panel.querySelector("#localOcrParseText");
    const applyButton = panel.querySelector("#localOcrApply");

    if (runButton) {
      runButton.addEventListener("click", async () => {
        const files = fileInput && fileInput.files ? Array.from(fileInput.files) : [];
        if (!files.length) {
          setLocalOcrMessage("画像ファイルを選択してください。", "warn");
          return;
        }
        runButton.disabled = true;
        setLocalOcrMessage(`ローカルOCRで読み取り中です。外部送信はしていません。${files.length}件の画像を処理します。`, "info");
        try {
          const results = [];
          for (let index = 0; index < files.length; index += 1) {
            const file = files[index];
            setLocalOcrMessage(`ローカルOCRで読み取り中です。外部送信はしていません。${index + 1}/${files.length}: ${file.name}`, "info");
            const proof = await readFile(file);
            const ocrPayload = await runLocalOcrFromFile(file, (message) => setLocalOcrMessage(`${index + 1}/${files.length}: ${message}`, "info"));
            results.push(buildLocalOcrResult(ocrPayload, {
              fileName: file.name,
              proof,
              sourceKind: "画像OCR"
            }));
          }
          lastLocalOcrResult = mergeLocalOcrResults(results);
          saveLocalOcrExtract(lastLocalOcrResult);
          syncLocalOcrResult();
          setLocalOcrMessage(localOcrDoneMessage(lastLocalOcrResult), lastLocalOcrResult.missingFields.length || localOcrCandidateCount(lastLocalOcrResult) > 1 || localOcrWarningCount(lastLocalOcrResult) ? "warn" : "good");
        } catch (error) {
          console.error(error);
          setLocalOcrMessage(error.message || "ローカルOCRを実行できませんでした。", "bad");
        } finally {
          runButton.disabled = false;
        }
      });
    }

    if (parseButton) {
      parseButton.addEventListener("click", () => {
        const text = pasteInput ? pasteInput.value : "";
        if (!clean(text)) {
          setLocalOcrMessage("解析する文字を貼り付けてください。", "warn");
          return;
        }
        lastLocalOcrResult = buildLocalOcrResult(text, {
          fileName: "貼付テキスト",
          proof: null,
          sourceKind: "貼付文字"
        });
        saveLocalOcrExtract(lastLocalOcrResult);
        syncLocalOcrResult();
        setLocalOcrMessage(localOcrDoneMessage(lastLocalOcrResult), lastLocalOcrResult.missingFields.length || localOcrCandidateCount(lastLocalOcrResult) > 1 || localOcrWarningCount(lastLocalOcrResult) ? "warn" : "good");
      });
    }

    if (applyButton) {
      applyButton.addEventListener("click", applyLocalOcrResultToReceiptForm);
    }
    const resultBox = panel.querySelector("#localOcrResult");
    if (resultBox) {
      resultBox.addEventListener("click", (event) => {
        const button = event.target.closest("[data-local-ocr-apply-candidate]");
        if (!button || !lastLocalOcrResult) return;
        lastLocalOcrResult.activeIndex = Number(button.dataset.localOcrApplyCandidate) || 0;
        syncLocalOcrResult();
        applyLocalOcrResultToReceiptForm();
      });
    }
  }

  function getLocalOcrEngineStatus() {
    if (window.Tesseract && typeof window.Tesseract.recognize === "function") {
      return { badge: "good", label: "Tesseract同梱", detail: "同梱OCRエンジンを使用できます。" };
    }
    if ("TextDetector" in window) {
      return { badge: "good", label: "ブラウザ内OCR", detail: "ブラウザ内TextDetectorを使用できます。精度は環境に依存します。" };
    }
    return {
      badge: "warn",
      label: "エンジン確認前",
      detail: "同梱Tesseract.jsがある場合は画像読取時に読み込みます。見つからない場合、外部送信せず未対応として止まります。"
    };
  }

  function setLocalOcrMessage(message, tone = "info") {
    const element = document.getElementById("localOcrMessage");
    if (!element) return;
    element.className = `local-ocr-message ${esc(tone)}`;
    element.textContent = message;
  }

  function syncLocalOcrResult() {
    const result = document.getElementById("localOcrResult");
    if (result) result.innerHTML = renderLocalOcrResult(lastLocalOcrResult);
    const applyButton = document.getElementById("localOcrApply");
    if (applyButton) applyButton.disabled = !lastLocalOcrResult;
  }

  function renderLocalOcrResult(result) {
    if (!result) {
      return `<div class="local-ocr-empty">画像を選んで「画像から読取」を押すと、日付・取引先・金額・税区分・T番号の下書きを作ります。</div>`;
    }
    const candidates = Array.isArray(result.candidates) && result.candidates.length ? result.candidates : [result];
    const activeIndex = Math.min(Math.max(Number(result.activeIndex) || 0, 0), candidates.length - 1);
    if (candidates.length > 1) {
      return `
        <div class="local-ocr-candidate-summary">
          <strong>候補 ${candidates.length}件</strong>
          <span>台紙写真の中でレシート候補を分けました。内容を確認して、1枚ずつフォームへ反映してください。</span>
        </div>
        <div class="local-ocr-candidates">
          ${candidates.map((candidate, index) => renderLocalOcrCandidateCard(candidate, {
            index,
            active: index === activeIndex,
            showApply: true
          })).join("")}
        </div>
        <details class="local-ocr-text">
          <summary>台紙全体の読み取り文字を確認</summary>
          <pre>${esc(result.text || "")}</pre>
        </details>
      `;
    }
    return renderLocalOcrCandidateCard(candidates[0], { index: 0, active: true, showApply: false });
  }

  function renderLocalOcrCandidateCard(result, options = {}) {
    if (!result) return "";
    const fields = [
      ["date", "日付"],
      ["vendor", "取引先"],
      ["category", "経費科目"],
      ["itemName", "品名"],
      ["amount", "金額"],
      ["paymentMethod", "支払区分"],
      ["taxRate", "税区分"],
      ["registrationNumber", "T番号"]
    ];
    const missingCount = (result.missingFields || []).length;
    const warnings = result.warnings || [];
    const sourceTitle = [result.candidateLabel || result.sourceKind || "画像OCR", result.fileName].filter(Boolean).join(" / ");
    return `
      <div class="local-ocr-result-card ${options.active ? "is-active" : ""}">
        <div class="local-ocr-result-head">
          <strong>${esc(sourceTitle)}</strong>
          <span class="badge ${missingCount || warnings.length ? "warn" : "good"}">${missingCount ? `未記入 ${missingCount}` : warnings.length ? `要確認 ${warnings.length}` : "下書きOK"}</span>
        </div>
        <div class="local-ocr-result-grid">
          ${fields.map(([key, label]) => `
            <div>
              <span>${esc(label)}</span>
              <strong>${localOcrDisplayValue(result.fields[key], key)}</strong>
            </div>
          `).join("")}
        </div>
        ${Array.isArray(result.missingFields) && result.missingFields.length ? `
          <div class="missing-alert">未記入: ${esc(result.missingFields.join("、"))}</div>
        ` : ""}
        ${warnings.length ? `
          <div class="ocr-warning-list">
            <strong>確認が必要</strong>
            <ul>
              ${warnings.map((warning) => `<li>${esc(warning)}</li>`).join("")}
            </ul>
          </div>
        ` : ""}
        ${result.fields.split10Amount || result.fields.split8Amount ? `
          <div class="local-ocr-split-note">
            10%対象 ${result.fields.split10Amount ? yen(result.fields.split10Amount) : missingValueHtml()} /
            8%対象 ${result.fields.split8Amount ? yen(result.fields.split8Amount) : missingValueHtml()}
          </div>
        ` : ""}
        ${options.showApply ? `
          <div class="local-ocr-result-actions">
            <button class="button small" type="button" data-local-ocr-apply-candidate="${Number(options.index) || 0}">この候補をフォームへ反映</button>
          </div>
        ` : ""}
        <details class="local-ocr-text">
          <summary>読み取り文字を確認</summary>
          <pre>${esc(result.text)}</pre>
        </details>
      </div>
    `;
  }

  function localOcrDisplayValue(value, key) {
    if (!hasDisplayValue(value)) return missingValueHtml();
    if (key === "amount") return esc(yen(value));
    if (key === "paymentMethod") return esc(paymentLabel(value));
    return esc(value);
  }

  async function runLocalOcrFromFile(file, report) {
    if (window.Tesseract && typeof window.Tesseract.recognize === "function") {
      return runTesseractLocalOcr(file, report);
    }
    await loadBundledTesseract();
    if (window.Tesseract && typeof window.Tesseract.recognize === "function") {
      return runTesseractLocalOcr(file, report);
    }
    if ("TextDetector" in window) {
      return runBrowserTextDetectorOcr(file);
    }
    throw new Error("OCRエンジンが同梱されていないか、このブラウザがローカルOCRに未対応です。外部送信はしていません。");
  }

  function loadBundledTesseract() {
    if (window.Tesseract) return Promise.resolve();
    const existing = document.querySelector("script[data-local-ocr-engine]");
    if (existing) {
      return new Promise((resolve, reject) => {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", () => reject(new Error("同梱OCRエンジンを読み込めませんでした。")), { once: true });
      }).catch(() => undefined);
    }
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "vendor/tesseract/tesseract.min.js";
      script.defer = true;
      script.dataset.localOcrEngine = "true";
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  }

  async function runTesseractLocalOcr(file, report) {
    const result = await window.Tesseract.recognize(file, "jpn+eng", {
      workerPath: "vendor/tesseract/worker.min.js",
      corePath: "vendor/tesseract/core",
      langPath: "vendor/tesseract/lang-data",
      logger(message) {
        if (!report || !message) return;
        const progress = typeof message.progress === "number" ? ` ${Math.round(message.progress * 100)}%` : "";
        report(`${message.status || "OCR"}${progress}`);
      }
    });
    const data = result && result.data ? result.data : {};
    return {
      text: data.text || "",
      lines: extractTesseractLines(data)
    };
  }

  async function runBrowserTextDetectorOcr(file) {
    const Detector = window.TextDetector;
    const detector = new Detector();
    const bitmap = await createImageBitmap(file);
    const detections = await detector.detect(bitmap);
    if (bitmap.close) bitmap.close();
    return {
      text: (detections || []).map((item) => item.rawValue || item.rawText || item.text || "").filter(Boolean).join("\n"),
      lines: (detections || []).map((item) => {
        const text = item.rawValue || item.rawText || item.text || "";
        return { text, ...normalizeOcrBox(item) };
      }).filter((line) => line.text)
    };
  }

  function extractTesseractLines(data) {
    const sourceLines = Array.isArray(data.lines) ? data.lines : [];
    return sourceLines.map((line) => ({
      text: clean(line.text || ""),
      ...normalizeOcrBox(line)
    })).filter((line) => line.text);
  }

  function normalizeOcrBox(item) {
    const box = item && (item.bbox || item.boundingBox || item.box || item) || {};
    const x0 = Number(box.x0 ?? box.left ?? box.x ?? 0);
    const y0 = Number(box.y0 ?? box.top ?? box.y ?? 0);
    const width = Number(box.width ?? 0);
    const height = Number(box.height ?? 0);
    const x1 = Number(box.x1 ?? box.right ?? (x0 + width));
    const y1 = Number(box.y1 ?? box.bottom ?? (y0 + height));
    return {
      x0: Number.isFinite(x0) ? x0 : 0,
      y0: Number.isFinite(y0) ? y0 : 0,
      x1: Number.isFinite(x1) ? x1 : 0,
      y1: Number.isFinite(y1) ? y1 : 0
    };
  }

  function buildLocalOcrResult(payload, meta = {}) {
    const ocrPayload = typeof payload === "string" ? { text: payload } : payload || {};
    const text = cleanMultiline(ocrPayload.text || "");
    const candidateTexts = splitLocalOcrCandidateTexts(text, ocrPayload);
    const candidates = candidateTexts.map((candidate, index) => buildLocalOcrCandidate(candidate.text || candidate, meta, index, candidate.label));
    const primary = candidates[0] || buildLocalOcrCandidate(text, meta, 0, "");
    const missingFields = primary.missingFields || [];
    return {
      id: uid("ocr"),
      createdAt: new Date().toISOString(),
      sourceKind: meta.sourceKind || "ローカルOCR",
      fileName: meta.fileName || "",
      proof: meta.proof || null,
      text,
      fields: primary.fields,
      missingFields,
      warnings: primary.warnings || [],
      confidence: primary.confidence,
      candidates,
      activeIndex: 0,
      needsCandidateReview: candidates.length > 1 || hasMultipleReceiptSignals(text)
    };
  }

  function buildLocalOcrCandidate(text, meta = {}, index = 0, label = "") {
    const cleanedText = cleanMultiline(text);
    const fields = parseReceiptOcrText(cleanedText);
    const missingFields = localOcrMissingFields(fields);
    const warnings = localOcrWarnings(fields, cleanedText, {
      candidateIndex: index,
      fileName: meta.fileName || ""
    });
    return {
      id: uid("ocr_candidate"),
      createdAt: new Date().toISOString(),
      sourceKind: meta.sourceKind || "ローカルOCR",
      fileName: meta.fileName || "",
      proof: meta.proof || null,
      text: cleanedText,
      fields,
      missingFields,
      warnings,
      confidence: localOcrConfidence(fields, missingFields, warnings),
      candidateLabel: label || `候補${index + 1}`,
      candidateIndex: index
    };
  }

  function mergeLocalOcrResults(results) {
    const cleanResults = (results || []).filter(Boolean);
    if (!cleanResults.length) return null;
    if (cleanResults.length === 1) return cleanResults[0];
    const candidates = cleanResults.flatMap((result) => {
      const resultCandidates = Array.isArray(result.candidates) && result.candidates.length ? result.candidates : [result];
      return resultCandidates.map((candidate, index) => ({
        ...candidate,
        candidateLabel: `${result.fileName || "画像"} / ${candidate.candidateLabel || `候補${index + 1}`}`,
        proof: candidate.proof || result.proof || null,
        fileName: candidate.fileName || result.fileName || ""
      }));
    });
    const primary = candidates[0];
    return {
      id: uid("ocr_batch"),
      createdAt: new Date().toISOString(),
      sourceKind: "画像OCR一括",
      fileName: `${cleanResults.length}件の画像`,
      proof: primary ? primary.proof : null,
      text: cleanResults.map((result) => `--- ${result.fileName || "画像"} ---\n${result.text || ""}`).join("\n\n"),
      fields: primary ? primary.fields : {},
      missingFields: primary ? primary.missingFields : [],
      warnings: primary ? primary.warnings || [] : [],
      confidence: primary ? primary.confidence : "低",
      candidates,
      activeIndex: 0,
      needsCandidateReview: true
    };
  }

  function splitLocalOcrCandidateTexts(text, payload = {}) {
    const geometryCandidates = splitLocalOcrByLineGeometry(payload.lines || []);
    if (geometryCandidates.length > 1) return geometryCandidates;
    const textCandidates = splitLocalOcrByTextMarkers(text);
    if (textCandidates.length > 1) return textCandidates;
    return [{ label: "全体", text }];
  }

  function splitLocalOcrByLineGeometry(lines) {
    const validLines = (lines || [])
      .map((line) => ({ ...line, text: clean(line.text || "") }))
      .filter((line) => line.text && line.x1 > line.x0 && line.y1 > line.y0);
    if (validLines.length < 8) return [];
    const groups = [];
    [...validLines].sort((a, b) => (a.y0 - b.y0) || (a.x0 - b.x0)).forEach((line) => {
      const target = groups.find((group) => ocrBoxesNear(group.box, line, 34, 42));
      if (target) {
        target.lines.push(line);
        target.box = mergeOcrBoxes(target.box, line);
      } else {
        groups.push({ box: { ...line }, lines: [line] });
      }
    });
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < groups.length; i += 1) {
        for (let j = i + 1; j < groups.length; j += 1) {
          if (ocrBoxesNear(groups[i].box, groups[j].box, 24, 30)) {
            groups[i].lines.push(...groups[j].lines);
            groups[i].box = mergeOcrBoxes(groups[i].box, groups[j].box);
            groups.splice(j, 1);
            merged = true;
            break;
          }
        }
        if (merged) break;
      }
    }
    return groups
      .map((group) => {
        const ordered = group.lines.sort((a, b) => (a.y0 - b.y0) || (a.x0 - b.x0));
        return {
          box: group.box,
          text: ordered.map((line) => line.text).join("\n")
        };
      })
      .filter((candidate) => localOcrReceiptEvidenceScore(candidate.text) >= 2)
      .sort((a, b) => (a.box.y0 - b.box.y0) || (a.box.x0 - b.box.x0))
      .map((candidate, index) => ({ label: `候補${index + 1}`, text: candidate.text }));
  }

  function ocrBoxesNear(a, b, marginX, marginY) {
    return !(
      a.x1 + marginX < b.x0
      || b.x1 + marginX < a.x0
      || a.y1 + marginY < b.y0
      || b.y1 + marginY < a.y0
    );
  }

  function mergeOcrBoxes(a, b) {
    return {
      x0: Math.min(a.x0, b.x0),
      y0: Math.min(a.y0, b.y0),
      x1: Math.max(a.x1, b.x1),
      y1: Math.max(a.y1, b.y1)
    };
  }

  function splitLocalOcrByTextMarkers(text) {
    const lines = cleanMultiline(text).split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length < 8) return [];
    const blocks = [];
    let current = [];
    lines.forEach((line) => {
      if (isLocalOcrReceiptStartLine(line) && current.length >= 4 && localOcrReceiptEvidenceScore(current.join("\n")) >= 2) {
        blocks.push(current);
        current = [];
      }
      current.push(line);
    });
    if (current.length) blocks.push(current);
    return blocks
      .map((block, index) => ({ label: `候補${index + 1}`, text: block.join("\n") }))
      .filter((candidate) => localOcrReceiptEvidenceScore(candidate.text) >= 2);
  }

  function isLocalOcrReceiptStartLine(line) {
    return /領収|領収証|領収書|納品書|売上票|レシート|COSMO|ENEOS|セブン|ローソン|タイムズ|FIGHTERS|ES CON|FIELD|JCB|クレジット|駐車|ガソリン|LACOSTE|DCM|オカモト|ホクレン|佐川|マクドナルド|LUCKY|ラッキー|ツルハ|apollo|出光|宮の森|LAWSON|POLO/i.test(line);
  }

  function localOcrReceiptEvidenceScore(text) {
    const source = normalizeOcrText(text);
    let score = 0;
    if (isLocalOcrReceiptStartLine(source)) score += 1;
    if (extractYenNumbers(source).length) score += 1;
    if (extractOcrDate(source)) score += 1;
    if (detectPayment(source)) score += 1;
    if (extractOcrRegistrationNumber(source)) score += 1;
    return score;
  }

  function hasMultipleReceiptSignals(text) {
    const source = normalizeOcrText(text);
    const starts = source.split("\n").filter((line) => isLocalOcrReceiptStartLine(line)).length;
    const totals = source.split("\n").filter((line) => /合計|小計|領収金額|請求金額|クレジット|現金|支払/.test(line) && extractYenNumbers(line).length).length;
    return starts >= 3 || totals >= 3;
  }

  function localOcrCandidateCount(result) {
    return result && Array.isArray(result.candidates) && result.candidates.length ? result.candidates.length : result ? 1 : 0;
  }

  function localOcrWarningCount(result) {
    if (!result) return 0;
    const candidates = Array.isArray(result.candidates) && result.candidates.length ? result.candidates : [result];
    return candidates.reduce((total, candidate) => total + ((candidate.warnings || []).length), 0);
  }

  function localOcrDoneMessage(result) {
    const count = localOcrCandidateCount(result);
    const warnings = localOcrWarningCount(result);
    if (count > 1) return `読み取り結果を${count}件の候補に分けました。確認項目が${warnings}件あります。経費には自動登録せず、候補ごとに原本画像と照合してからフォームへ反映してください。`;
    if (result && result.missingFields && result.missingFields.length) return `読み取り結果を作成しました。未記入と確認項目${warnings}件を確認してからフォームへ反映してください。`;
    if (warnings) return `読み取り結果を作成しました。確認項目が${warnings}件あります。日付・金額・支払区分・T番号は原本で確認してください。`;
    return "読み取り結果を作成しました。フォームへ反映できます。";
  }

  function getActiveLocalOcrCandidate(result = lastLocalOcrResult) {
    if (!result) return null;
    const candidates = Array.isArray(result.candidates) && result.candidates.length ? result.candidates : [result];
    const index = Math.min(Math.max(Number(result.activeIndex) || 0, 0), candidates.length - 1);
    return candidates[index] || null;
  }

  function getLocalOcrProofById(id, result = lastLocalOcrResult) {
    if (!id || !result) return null;
    if (result.id === id && result.proof) return result.proof;
    const candidates = Array.isArray(result.candidates) ? result.candidates : [];
    const found = candidates.find((candidate) => candidate.id === id);
    return found ? found.proof || result.proof || null : null;
  }

  function parseReceiptOcrText(text) {
    const source = normalizeOcrText(text);
    const vendor = extractOcrVendor(source);
    const amount = extractOcrAmount(source);
    const category = inferOcrCategory(source, vendor);
    const itemName = inferOcrItemName(source, category);
    const split = extractOcrTaxSplit(source);
    const taxRate = split.amount10 && split.amount8 ? "不明" : extractOcrTaxRate(source);
    return {
      date: extractOcrDate(source),
      vendor,
      category,
      itemName,
      quantity: "1",
      unitPrice: amount || "",
      amount,
      paymentMethod: detectPayment(source) || "",
      taxRate,
      registrationNumber: normalizeRegistration(extractOcrRegistrationNumber(source)),
      split10Amount: split.amount10 || "",
      split8Amount: split.amount8 || "",
      splitMemo: split.amount10 || split.amount8 ? "ローカルOCRで税率別対象額を検出" : "",
      note: localOcrNote(source, split)
    };
  }

  function normalizeOcrText(text) {
    return String(text || "")
      .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
      .replace(/[Ａ-Ｚａ-ｚ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
      .replace(/[￥¥]/g, "¥")
      .replace(/[，]/g, ",")
      .replace(/[－ー―]/g, "-")
      .replace(/\r/g, "\n");
  }

  function cleanMultiline(text) {
    return normalizeOcrText(text)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n")
      .slice(0, 5000);
  }

  function extractOcrDate(text) {
    const normalized = normalizeOcrText(text);
    const reiwa = normalized.match(/令和\s*(\d{1,2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
    if (reiwa) return toDateInputSafe(2018 + Number(reiwa[1]), reiwa[2], reiwa[3]);
    const western = normalized.match(/(20\d{2}|\d{2})\s*[年\/.\-]\s*(\d{1,2})\s*[月\/.\-]\s*(\d{1,2})/);
    if (!western) return "";
    const year = Number(western[1]) < 100 ? 2000 + Number(western[1]) : Number(western[1]);
    return toDateInputSafe(year, western[2], western[3]);
  }

  function toDateInputSafe(year, month, day) {
    let y = Number(year);
    const m = Number(month);
    const d = Number(day);
    const currentYear = Number(new Date().getFullYear());
    if (y >= 2070 && y <= 2079) y = 2020 + (y % 10);
    if (y > currentYear + 2 || y < 2000) return "";
    if (!y || !m || !d || m > 12 || d > 31) return "";
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function extractOcrRegistrationNumber(text) {
    const match = normalizeOcrText(text).match(/T\s*([0-9]{13})/i);
    return match ? `T${match[1]}` : "";
  }

  function extractOcrAmount(text) {
    const bestCandidate = collectOcrMoneyCandidates(text)[0];
    if (bestCandidate && bestCandidate.score >= 4) return bestCandidate.value;
    const lines = normalizeOcrText(text).split("\n").map((line) => line.trim()).filter(Boolean);
    const priority = lines.filter((line) => /合計|領収金額|請求金額|支払金額|ご請求|お買上|税込|領収額/.test(line));
    const prioritized = [...priority].reverse().map(extractLastYenNumber).find((value) => value > 0);
    if (prioritized) return prioritized;
    const all = lines.flatMap((line) => extractYenNumbers(line)).filter((value) => value > 0 && value < 10000000);
    return all.length ? Math.max(...all) : "";
  }

  function extractYenNumbers(text) {
    const values = [];
    const regex = /(?:¥|\b)?\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,8})\s*(?:円)?/g;
    let match = regex.exec(text);
    while (match) {
      values.push(num(match[1]));
      match = regex.exec(text);
    }
    return values;
  }

  function extractLastYenNumber(text) {
    const values = extractYenNumbers(text);
    return values.length ? values[values.length - 1] : 0;
  }

  function extractOcrVendor(text) {
    const known = ["ツルハ", "ENEOS", "COSMO", "ローソン", "セブン", "オカモト", "タイムズ", "佐川", "マクドナルド", "LACOSTE", "ラッキー", "LUCKY", "DCM", "ホクレン", "出光", "アポロ", "宮の森珈琲"];
    const knownHit = known.find((name) => text.toUpperCase().includes(name.toUpperCase()));
    if (knownHit) return knownHit;
    const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
    const line = lines.find((candidate) => (
      candidate.length >= 3
      && !/領収|合計|小計|消費税|税率|登録番号|TEL|電話|日付|No\.?|クレジット|カード|現金|お釣|お預/.test(candidate)
      && !/[0-9]{4}[年\/.\-]/.test(candidate)
      && !/¥|円/.test(candidate)
    ));
    return clean(line);
  }

  function inferOcrCategory(text, vendor) {
    const source = `${text} ${vendor || ""}`;
    if (/ガソリン|軽油|燃料|ENEOS|COSMO|出光|ホクレン|オカモト/.test(source)) return "燃料費";
    if (/駐車|パーキング|高速|タクシー|交通|電車|バス|佐川|送料/.test(source)) return "旅費交通費";
    if (/電話|通信|郵便|切手/.test(source)) return "通信費";
    if (/会議|打合|珈琲|コーヒー|レストラン|食事|弁当|マクドナルド/.test(source)) return "会議費";
    if (/文具|事務|コピー|消耗|ツルハ|DCM|セブン|ローソン/.test(source)) return "消耗品費";
    return "未分類";
  }

  function inferOcrItemName(text, category) {
    if (/ガソリン|軽油|燃料/.test(text) || category === "燃料費") return "ガソリン・燃料";
    if (/駐車|パーキング/.test(text)) return "駐車料金";
    if (/洗車/.test(text)) return "洗車";
    if (/送料|佐川|郵便/.test(text)) return "送料";
    if (/飲食|食事|弁当|コーヒー|珈琲|マクドナルド/.test(text)) return "飲食・会議用";
    if (/消耗|文具|コピー/.test(text)) return "消耗品";
    return "レシート購入分";
  }

  function extractOcrTaxRate(text) {
    const source = normalizeOcrText(text);
    if (/8\s*%/.test(source) && !/10\s*%/.test(source)) return "8%";
    if (/10\s*%/.test(source)) return "10%";
    if (/非課税|不課税|対象外/.test(source)) return "非課税";
    return "不明";
  }

  function extractOcrTaxSplit(text) {
    const source = normalizeOcrText(text);
    return {
      amount10: extractTaxAmountForRate(source, 10),
      amount8: extractTaxAmountForRate(source, 8)
    };
  }

  function extractTaxAmountForRate(text, rate) {
    const regex = new RegExp(`${rate}\\s*%[^\\n]{0,24}?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{2,8})`, "i");
    const match = normalizeOcrText(text).match(regex);
    return match ? num(match[1]) : "";
  }

  function localOcrNote(text, split) {
    const notes = ["ローカルOCR下書き。登録前に原本画像と照合してください。"];
    if (split.amount10 || split.amount8) notes.push(`税率別候補: 10% ${split.amount10 ? yen(split.amount10) : "未記入"} / 8% ${split.amount8 ? yen(split.amount8) : "未記入"}`);
    if (/カード|JCB|VISA|Master|AMEX|クレジット/.test(text)) notes.push("支払区分候補: カード");
    return notes.join(" ");
  }

  function localOcrMissingFields(fields) {
    const required = [
      ["date", "日付"],
      ["vendor", "取引先"],
      ["amount", "金額"],
      ["paymentMethod", "支払区分"],
      ["taxRate", "税区分"]
    ];
    return required.filter(([key]) => !hasDisplayValue(fields[key]) || fields[key] === "不明").map(([, label]) => label);
  }

  function localOcrWarnings(fields, text, context = {}) {
    const source = normalizeOcrText(text);
    const warnings = [];
    const moneyCandidates = collectOcrMoneyCandidates(source);
    const paymentSignals = detectOcrPaymentSignals(source);
    const amount = num(fields.amount);
    if (hasMultipleReceiptSignals(source) || Number(context.candidateIndex) > 0) {
      warnings.push("台紙分割候補です。元画像でこの候補が1枚のレシートか確認してください。");
    }
    if (!fields.date) {
      warnings.push("日付が未記入です。2026を2076/2028などに誤読しやすいため原本確認が必要です。");
    } else if (localOcrDateLooksSuspicious(fields.date, source)) {
      warnings.push("日付が誤読されている可能性があります。原本の日付を確認してください。");
    }
    if (!amount) {
      warnings.push("合計金額が未記入です。小計・税額・お釣り・電話番号を拾っていないか確認してください。");
    } else if (ocrAmountLooksAmbiguous(source, amount, moneyCandidates)) {
      warnings.push("金額候補が複数あります。登録金額が合計金額か確認してください。");
    }
    if (taxSplitNeedsReview(source, fields)) {
      warnings.push("10%と8%が混在している可能性があります。税率別登録または金額分割を確認してください。");
    }
    if (amount >= 10000 && !isValidRegistration(fields.registrationNumber)) {
      warnings.push("1万円以上でT番号が未確認です。適格請求書として扱う前にT番号を確認してください。");
    } else if (fields.registrationNumber && !isValidRegistration(fields.registrationNumber)) {
      warnings.push("T番号の形式が不正です。1桁違い・電話番号の誤読がないか確認してください。");
    }
    if (paymentSignals.length > 1) {
      warnings.push("支払区分の候補が複数あります。カード・現金・電子マネー・振込のどれか確認してください。");
    }
    if (ocrVendorNeedsReview(fields.vendor)) {
      warnings.push("取引先名が弱いです。ロゴ名・運営会社名・支店名の取り違えを確認してください。");
    }
    if (!fields.category || fields.category === "不明" || String(fields.category).includes("未")) {
      warnings.push("経費科目は未確定です。税理士の分類に合わせて選び直してください。");
    }
    if (localOcrNeedsBusinessPurpose(fields, source)) {
      warnings.push("飲食・衣類・物販系は業務用途、相手先、人数、目的をメモしてください。");
    }
    if (ocrImageQualityNeedsReview(source)) {
      warnings.push("OCR文字量が少ない、または画像品質の影響を受けています。拡大して原本確認してください。");
    }
    warnings.push("税理士提出前に原本画像・金額・日付・支払区分を人が確認してください。");
    return [...new Set(warnings)];
  }

  function collectOcrMoneyCandidates(text) {
    return normalizeOcrText(text)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line, index) => extractYenNumbers(line)
        .filter((value) => value > 0 && value < 10000000)
        .map((value) => ({ value, line, index, score: localOcrAmountLineScore(line, value) })))
      .filter((candidate) => candidate.score > -4)
      .sort((a, b) => (b.score - a.score) || (b.value - a.value) || (a.index - b.index));
  }

  function localOcrAmountLineScore(line, value) {
    let score = 0;
    if (/合計金額|合計|領収金額|領収額|請求金額|支払金額|カード計|クレジット計|現金計|お買上|お買い上げ|税込合計|売上合計/.test(line)) score += 5;
    if (/クレジット|カード|現金|cash|visa|master|jcb|amex/i.test(line)) score += 2;
    if (/小計|税抜|対象額/.test(line)) score -= 1;
    if (/消費税|内税|外税|税額|お釣|おつり|釣銭|お預|預り|ポイント|割引|値引|クーポン|TEL|電話|登録番号|T\d{10,}|No\.?|伝票|時刻|時間|駐車時間|承認|会員|端末|バーコード|個|点|枚|L\/|km|リットル/i.test(line)) score -= 4;
    if (value < 100) score -= 3;
    return score;
  }

  function localOcrDateLooksSuspicious(dateValue, source) {
    const year = Number(String(dateValue || "").slice(0, 4));
    const currentYear = new Date().getFullYear();
    if (!year || year < 2024 || year > currentYear + 1) return true;
    return /(207\d|202[789])/.test(source);
  }

  function ocrAmountLooksAmbiguous(source, selectedAmount, moneyCandidates) {
    const strongValues = [...new Set((moneyCandidates || [])
      .filter((candidate) => candidate.score >= 4)
      .map((candidate) => candidate.value))]
      .filter((value) => value > 0);
    if (strongValues.length >= 2 && !strongValues.includes(selectedAmount)) return true;
    const visibleValues = [...new Set(extractYenNumbers(source).filter((value) => value > 0 && value < 10000000))];
    return visibleValues.length >= 6 && strongValues.length !== 1;
  }

  function taxSplitNeedsReview(source, fields) {
    const has10 = /10\s*%|10％/.test(source);
    const has8 = /8\s*%|8％/.test(source);
    if (has10 && has8 && (!fields.split10Amount || !fields.split8Amount)) return true;
    return fields.taxRate === "混在" && (!fields.split10Amount || !fields.split8Amount);
  }

  function detectOcrPaymentSignals(text) {
    const source = String(text || "").toLowerCase();
    const signals = [];
    if (/カード|card|visa|master|jcb|amex|クレジット/.test(source)) signals.push("card");
    if (/現金|cash|お預|お釣|釣銭/.test(source)) signals.push("cash");
    if (/振込|口座|銀行|道銀|bank/.test(source)) signals.push("bank");
    if (/電子マネー|paypay|suica|pasmo|nanaco|waon|edy|\bid\b|quicpay/.test(source)) signals.push("electronic");
    return [...new Set(signals)];
  }

  function ocrVendorNeedsReview(vendor) {
    const value = clean(vendor);
    if (!value || value.length < 2) return true;
    return /領収|合計|カード|加盟店|売上票|納品書|請求|登録番号|TEL|電話|No\.?|様|JCB|VISA|Master|AMEX/i.test(value);
  }

  function localOcrNeedsBusinessPurpose(fields, source) {
    const haystack = `${fields.vendor || ""} ${fields.category || ""} ${fields.itemName || ""} ${source}`;
    return /飲食|食事|弁当|焼肉|珈琲|コーヒー|カフェ|レストラン|マクドナルド|ラーメン|居酒屋|衣類|服|LACOSTE|POLO|FIGHTERS|ES CON|ギフト|土産|食べ放題/i.test(haystack);
  }

  function ocrImageQualityNeedsReview(source) {
    const lines = normalizeOcrText(source).split("\n").map((line) => line.trim()).filter(Boolean);
    return lines.length < 5 || normalizeOcrText(source).replace(/\s/g, "").length < 60;
  }

  function localOcrConfidence(fields, missingFields, warnings = []) {
    const filled = ["date", "vendor", "amount", "paymentMethod", "taxRate", "registrationNumber"].filter((key) => hasDisplayValue(fields[key]) && fields[key] !== "不明").length;
    if ((warnings || []).length >= 5 || missingFields.length >= 2) return "低";
    if (!missingFields.length && filled >= 5 && !(warnings || []).length) return "高";
    if (filled >= 3) return "中";
    return "低";
  }

  function saveLocalOcrExtract(result) {
    if (!result) return;
    state.documentExtracts = Array.isArray(state.documentExtracts) ? state.documentExtracts : [];
    const candidates = Array.isArray(result.candidates) && result.candidates.length ? result.candidates : [result];
    const createdAt = result.createdAt || new Date().toISOString();
    candidates.forEach((candidate, index) => {
      const fields = candidate.fields || {};
      const missingFields = candidate.missingFields || [];
      const warnings = candidate.warnings || [];
      state.documentExtracts.push({
        id: uid("extract"),
        documentDate: fields.date || TODAY,
        sourceCategory: "受領書類",
        sourceFormat: candidate.proof || result.proof ? "画像" : "テキスト",
        sourceFile: candidate.fileName || result.fileName || "",
        documentTitle: candidates.length > 1 ? `ローカルOCRレシート ${candidate.candidateLabel || `候補${index + 1}`}` : "ローカルOCRレシート",
        counterparty: fields.vendor || "",
        primaryAmount: num(fields.amount),
        taxAmount: "",
        grossAmount: num(fields.amount),
        rowCount: candidate.text ? candidate.text.split("\n").length : 0,
        targetLedger: "経費",
        linkedRecordId: "",
        status: missingFields.length || warnings.length ? "要確認" : "読取済",
        confidence: candidate.confidence || result.confidence,
        extractedText: candidate.text || "",
        numericMemo: [
          fields.amount ? `金額 ${yen(fields.amount)}` : "",
          fields.split10Amount ? `10% ${yen(fields.split10Amount)}` : "",
          fields.split8Amount ? `8% ${yen(fields.split8Amount)}` : ""
        ].filter(Boolean).join(" / "),
        issueMemo: [
          candidates.length > 1 ? "台紙写真から分割した候補。登録前に原本画像と照合してください。" : "",
          missingFields.length ? `未記入: ${missingFields.join("、")}` : "",
          warnings.length ? `確認: ${warnings.join(" / ")}` : ""
        ].filter(Boolean).join(" "),
        createdAt,
        updatedAt: createdAt
      });
    });
    if (state.documentExtracts.length > 600) state.documentExtracts = state.documentExtracts.slice(-600);
    addAudit("ローカルOCR読取", {
      file: result.fileName,
      candidates: candidates.length,
      missing: candidates.flatMap((candidate) => candidate.missingFields || []).join("、"),
      warnings: candidates.flatMap((candidate) => candidate.warnings || []).length
    });
    persist("ローカルOCR保存");
  }

  function applyLocalOcrResultToReceiptForm() {
    const form = document.getElementById("receiptForm");
    if (!form || !lastLocalOcrResult) return;
    const activeResult = getActiveLocalOcrCandidate();
    if (!activeResult) return;
    const fields = activeResult.fields || {};
    setFormValue(form, "date", fields.date);
    setFormValue(form, "vendor", fields.vendor);
    setFormValue(form, "category", fields.category);
    setFormValue(form, "department", departments()[0]);
    setFormValue(form, "paymentMethod", fields.paymentMethod);
    setFormValue(form, "itemName", fields.itemName);
    setFormValue(form, "quantity", fields.quantity || "1");
    setFormValue(form, "unitPrice", fields.unitPrice);
    setFormValue(form, "amount", fields.amount);
    setFormValue(form, "taxRate", fields.taxRate);
    setFormValue(form, "registrationNumber", fields.registrationNumber);
    setFormValue(form, "split10Amount", fields.split10Amount);
    setFormValue(form, "split8Amount", fields.split8Amount);
    setFormValue(form, "splitMemo", fields.splitMemo);
    if (form.elements.invoiceEligible) form.elements.invoiceEligible.checked = Boolean(fields.registrationNumber);
    if (form.elements.expenseEligibility) form.elements.expenseEligibility.value = "auto";
    if (form.elements.note) {
      const warnings = activeResult.warnings || [];
      const warningNote = warnings.length ? `OCR確認項目:\n- ${warnings.join("\n- ")}` : "";
      form.elements.note.value = [fields.note, warningNote, activeResult.text ? `読み取り文字:\n${activeResult.text}` : ""].filter(Boolean).join("\n\n");
    }
    const proof = activeResult.proof || lastLocalOcrResult.proof;
    if (proof) form.dataset.ocrProofId = activeResult.id || lastLocalOcrResult.id;
    setLocalOcrMessage(
      "選択した候補をフォームへ反映しました。未記入や確認項目がある場合は、登録前に原本画像で確認してください。",
      (activeResult.missingFields || []).length || (activeResult.warnings || []).length ? "warn" : "good"
    );
  }

  function setFormValue(form, name, value) {
    if (!form.elements[name] || !hasDisplayValue(value)) return;
    form.elements[name].value = value;
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
    form.elements.expenseEligibility.value = "auto";
    form.elements.expenseEligibilityReason.value = "10%対象は消耗品として適格、8%対象は用途未記載のため不適格で自動判定";
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
        ${selectField("expenseEligibility", "経費適格", expenseEligibilityOptions, "auto")}
        ${field("expenseEligibilityReason", "判定理由", "text", "", "例: 業務用の消耗品、出張時の駐車料金")}
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
    let proof = proofFile && proofFile.size ? await readFile(proofFile) : null;
    if (!proof && form.dataset.ocrProofId) proof = getLocalOcrProofById(form.dataset.ocrProofId);
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
      expenseEligibility: "",
      expenseEligibilityReason: "",
      note: clean(data.get("note")),
      proof,
      createdAt: new Date().toISOString()
    };
    applyExpenseEligibility(record, data.get("expenseEligibility"), data.get("expenseEligibilityReason"));
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

    return splitRows.map((row) => {
      const record = {
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
      };
      return applyExpenseEligibility(record, data.get("expenseEligibility"), data.get("expenseEligibilityReason"));
    });
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
      ["amount", "金額"], ["taxRate", "税区分"], ["registrationNumber", "T番号"], ["invoiceEligible", "インボイス適格"], ["expenseEligibility", "経費適格"], ["expenseEligibilityReason", "判定理由"], ["splitGroupId", "税率分割ID"], ["note", "摘要"]
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
    const bankbookEntries = (state.bankbookEntries || []).slice().sort(byDate("date"));
    const bankbookUnmatched = bankbookEntries.filter((item) => !["照合済", "対象外"].includes(item.status)).length;
    const documentExtracts = (state.documentExtracts || [])
      .slice()
      .sort((a, b) => String(b.documentDate || b.createdAt || "").localeCompare(String(a.documentDate || a.createdAt || "")));
    const extractNeedsReview = documentExtracts.filter((item) => item.status === "要確認" || clean(item.issueMemo)).length;

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
            ${summaryCard("通帳明細", `${bankbookEntries.length}件`, `未照合 ${bankbookUnmatched}件`)}
            ${summaryCard("資料読取", `${documentExtracts.length}件`, `要確認 ${extractNeedsReview}件 / ${yen(sum(documentExtracts, "primaryAmount"))}`)}
          </div>
          <div class="notice info" style="margin-top:12px;">
            通帳CSVは売上一覧へ、カードCSVはカード支払の経費として登録します。PDF・Excel・ZIP・画像から読めた文字と数字は資料読取台帳に残し、税理士提出パックにも含めます。
          </div>
          <div class="actions" style="margin-top:12px;">
            <button class="button secondary small" data-view-jump="sales" type="button">売上一覧を確認</button>
            <button class="button secondary small" data-view-jump="cards" type="button">カード台帳を確認</button>
            <button class="button secondary small" data-view-jump="documentExtracts" type="button">資料読取を確認</button>
            <button class="button secondary small" id="exportImportBatchCsv" type="button">取込履歴CSV</button>
          </div>
        </div>
      </section>
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head">
          <h2>PDF・Excel・画像の読取結果</h2>
          <div class="actions">
            <span class="badge">${documentExtracts.length}件</span>
            <button class="button secondary small" id="exportDocumentExtractCsvFromDataLink" type="button">読取台帳CSV</button>
          </div>
        </div>
        <div class="panel-body">
          ${renderDocumentExtractTable(documentExtracts)}
        </div>
      </section>
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>取込履歴</h2><span class="badge">${batches.length}件</span></div>
        <div class="panel-body">
          ${renderImportBatchTable(batches)}
        </div>
      </section>
      <section class="panel" style="margin-top:14px;">
        <div class="panel-head">
          <h2>通帳明細読み取り結果</h2>
          <div class="actions">
            <span class="badge">${bankbookEntries.length}件</span>
            <button class="button secondary small" id="exportBankbookCsv" type="button">通帳明細 CSV</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="notice info" style="margin-bottom:12px;">
            2026-6-25_(2).pdf の貼付画像から読める範囲を未照合で保存しています。読取確度が低い行は、原本PDF・請求書・支払資料で確認してください。
          </div>
          ${renderBankbookEntryTable(bankbookEntries)}
        </div>
      </section>
    `;

    document.getElementById("dataLinkSalesImport").addEventListener("change", importSalesCsv);
    document.getElementById("dataLinkCardImport").addEventListener("change", importCardCsv);
    document.getElementById("exportImportBatchCsv").addEventListener("click", () => exportCsv("import-history", batches, importBatchCsvFields()));
    document.getElementById("exportBankbookCsv").addEventListener("click", () => exportCsv("bankbook-data", bankbookEntries, bankbookCsvFields()));
    document.getElementById("exportDocumentExtractCsvFromDataLink").addEventListener("click", () => exportCsv("document-extracts", documentExtracts, documentExtractCsvFields()));
    app.querySelectorAll("[data-view-jump]").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.viewJump));
    });
    bindTableActions();
  }

  function renderDocumentExtracts() {
    const rows = (state.documentExtracts || [])
      .slice()
      .sort((a, b) => String(b.documentDate || b.createdAt || "").localeCompare(String(a.documentDate || a.createdAt || "")));
    const reflected = rows.filter((item) => item.status === "反映済");
    const needsReview = rows.filter((item) => item.status === "要確認" || (item.issueMemo || "").trim());

    app.innerHTML = `
      <section class="panel">
        <div class="panel-head">
          <h2>資料読取結果</h2>
          <div class="actions">
            <button class="button secondary small" id="exportDocumentExtractCsv" type="button">読取台帳CSV</button>
            <button class="button secondary small" data-view-jump="taxAccountant" type="button">税理士連携へ</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="grid cols-4">
            ${summaryCard("読取資料", `${rows.length}件`, "PDF・Excel・ZIP・画像・CSV")}
            ${summaryCard("抽出金額", yen(sum(rows, "primaryAmount")), "読取済みの主金額合計")}
            ${summaryCard("反映済", `${reflected.length}件`, "台帳・売上・受領書類へ連携")}
            ${summaryCard("要確認", `${needsReview.length}件`, "金額・相手先・原本確認")}
          </div>
          <div class="notice info" style="margin-top:12px;">
            保存フォルダのリンクだけで終わらせず、PDF・Excel・画像から読めた文字と数字をここに保存します。税理士提出、台帳照合、分類別集計、統計に使うための中間台帳です。
          </div>
        </div>
      </section>

      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>読取結果を登録</h2><span class="badge">原本から吸い上げた内容</span></div>
        <form id="documentExtractForm" class="panel-body form-grid">
          ${field("documentDate", "資料日付", "date", TODAY)}
          ${selectField("sourceCategory", "資料分類", documentSourceCategories.map((item) => [item, item]), "通帳")}
          ${selectField("sourceFormat", "形式", documentSourceFormats.map((item) => [item, item]), "PDF")}
          ${field("sourceFile", "元ファイル名", "text", "", "例: 202606meisai.pdf")}
          ${field("documentTitle", "資料名", "text", "", "例: JCBカード明細 2026年6月")}
          ${field("counterparty", "相手先・口座", "text", "", "例: 道銀 / JCB / 講師名")}
          ${field("primaryAmount", "主金額", "number", "", "読取金額")}
          ${field("taxAmount", "税額", "number", "", "消費税・控除額など")}
          ${field("grossAmount", "総額", "number", "", "税込・総支給など")}
          ${field("rowCount", "読取行数", "number", "1")}
          ${selectField("targetLedger", "反映先", documentExtractTargetOptions(), "未選択")}
          ${field("linkedRecordId", "紐づけID", "text", "", "例: invoice-001 / bankbookEntries:7件")}
          ${selectField("status", "状態", documentExtractStatuses.map((item) => [item, item]), "読取済")}
          ${selectField("confidence", "読取確度", documentConfidenceOptions.map((item) => [item, item]), "中")}
          <label class="field" style="grid-column:1 / -1;"><span>読み取ったテキスト</span><textarea name="extractedText" placeholder="PDFやExcelから吸い上げた本文、摘要、明細の文字を貼り付けます。"></textarea></label>
          <label class="field" style="grid-column:1 / -1;"><span>数字メモ</span><textarea name="numericMemo" placeholder="金額の内訳、行別合計、税額、控除、残高などを残します。"></textarea></label>
          <label class="field" style="grid-column:1 / -1;"><span>未確認・確認依頼</span><textarea name="issueMemo" placeholder="読取不能、金額不明、原本確認、税理士確認が必要な内容を残します。"></textarea></label>
          <div class="actions" style="grid-column:1 / -1;">
            <button class="button" type="submit">読取結果を保存</button>
            <button class="button secondary" type="reset">クリア</button>
          </div>
        </form>
      </section>

      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>読取台帳</h2><span class="badge">${rows.length}件</span></div>
        <div class="panel-body">
          ${renderDocumentExtractTable(rows)}
        </div>
      </section>

      <section class="panel" style="margin-top:14px;">
        <div class="panel-head"><h2>統計用サマリー</h2><span class="badge">分類別</span></div>
        <div class="panel-body">
          ${renderDocumentExtractStats(rows)}
        </div>
      </section>
    `;

    document.getElementById("documentExtractForm").addEventListener("submit", createDocumentExtract);
    document.getElementById("exportDocumentExtractCsv").addEventListener("click", () => exportCsv("document-extracts", rows, documentExtractCsvFields()));
    app.querySelectorAll("[data-view-jump]").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.viewJump));
    });
    bindTableActions();
  }

  function documentExtractTargetOptions() {
    return ["未選択", "通帳明細", "カード台帳", "経費表", "売上", "請求書", "受領書類", "支払依頼", "給与台帳", "ハイテク台帳", "税理士提出資料"].map((item) => [item, item]);
  }

  function createDocumentExtract(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = formValues(form);
    state.documentExtracts = Array.isArray(state.documentExtracts) ? state.documentExtracts : [];
    const record = {
      id: uid("doc-extract"),
      documentDate: values.documentDate || TODAY,
      sourceCategory: values.sourceCategory || "その他",
      sourceFormat: values.sourceFormat || "その他",
      sourceFile: clean(values.sourceFile),
      documentTitle: clean(values.documentTitle),
      counterparty: clean(values.counterparty),
      primaryAmount: hasDisplayValue(values.primaryAmount) ? num(values.primaryAmount) : "",
      taxAmount: hasDisplayValue(values.taxAmount) ? num(values.taxAmount) : "",
      grossAmount: hasDisplayValue(values.grossAmount) ? num(values.grossAmount) : "",
      rowCount: hasDisplayValue(values.rowCount) ? num(values.rowCount) : 0,
      targetLedger: clean(values.targetLedger) || "未選択",
      linkedRecordId: clean(values.linkedRecordId),
      status: values.status || "読取済",
      confidence: values.confidence || "中",
      extractedText: clean(values.extractedText),
      numericMemo: clean(values.numericMemo),
      issueMemo: clean(values.issueMemo),
      createdAt: new Date().toISOString()
    };
    state.documentExtracts.push(record);
    addAudit("資料読取結果登録", record);
    persist("資料読取保存");
    form.reset();
    render();
  }

  function renderDocumentExtractTable(items) {
    if (!items.length) return `<div class="empty">資料読取結果はまだありません。</div>`;
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>資料日付</th><th>分類</th><th>形式</th><th>元ファイル</th><th>資料名</th><th>相手先</th>
              <th class="num">主金額</th><th class="num">税額</th><th class="num">総額</th><th class="num">行数</th>
              <th>反映先</th><th>状態</th><th>確度</th><th>未確認</th><th>操作</th>
            </tr>
          </thead>
          <tbody>${items.map((item) => `<tr>
            <td>${dateOrMissing(item.documentDate)}</td>
            <td>${displayOrMissing(item.sourceCategory)}</td>
            <td>${displayOrMissing(item.sourceFormat)}</td>
            <td>${displayOrMissing(item.sourceFile)}</td>
            <td>${displayOrMissing(item.documentTitle)}</td>
            <td>${displayOrMissing(item.counterparty)}</td>
            <td class="num">${moneyOrMissing(item.primaryAmount)}</td>
            <td class="num">${moneyOrMissing(item.taxAmount)}</td>
            <td class="num">${moneyOrMissing(item.grossAmount)}</td>
            <td class="num">${displayOrMissing(item.rowCount)}</td>
            <td>${displayOrMissing(item.targetLedger)}</td>
            <td>${statusBadge(item.status || "読取済")}</td>
            <td>${bankbookConfidenceBadge(item.confidence)}</td>
            <td>${(item.issueMemo || "").trim() ? `<strong class="red-note">${esc(item.issueMemo)}</strong>` : '<span class="badge good">なし</span>'}</td>
            <td>${rowActions("documentExtracts", item.id)}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function renderDocumentExtractStats(rows) {
    const byCategory = groupDocumentExtracts(rows, "sourceCategory");
    const byTarget = groupDocumentExtracts(rows, "targetLedger");
    return `
      <div class="grid cols-2">
        ${renderDocumentExtractStatsTable("資料分類別", byCategory)}
        ${renderDocumentExtractStatsTable("反映先別", byTarget)}
      </div>
    `;
  }

  function groupDocumentExtracts(rows, key) {
    const map = new Map();
    rows.forEach((row) => {
      const label = clean(row[key]) || "未記入";
      const current = map.get(label) || { label, count: 0, amount: 0, needsReview: 0 };
      current.count += 1;
      current.amount += num(row.primaryAmount);
      if (row.status === "要確認" || clean(row.issueMemo)) current.needsReview += 1;
      map.set(label, current);
    });
    return [...map.values()].sort((a, b) => b.amount - a.amount || b.count - a.count);
  }

  function renderDocumentExtractStatsTable(title, rows) {
    if (!rows.length) return `<div class="empty">${esc(title)}はまだありません。</div>`;
    return `
      <div class="table-wrap">
        <h3>${esc(title)}</h3>
        <table>
          <thead><tr><th>区分</th><th class="num">件数</th><th class="num">抽出金額</th><th class="num">要確認</th></tr></thead>
          <tbody>${rows.map((row) => `<tr><td>${esc(row.label)}</td><td class="num">${row.count}</td><td class="num">${yen(row.amount)}</td><td class="num">${row.needsReview}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function taxSubmissionStatuses() {
    return ["詳細待ち", "照合中", "不足あり", "提出準備OK", "提出済"];
  }

  function defaultTaxSubmissionItems() {
    return [
      {
        id: "bank",
        no: "①",
        title: "通帳",
        driveUrl: "https://drive.google.com/open?id=13tqcdPCDGaAllAduae-QpAVG_SSHPIgz&usp=drive_copy",
        description: "通帳PDF、ハイテク明細、WEB振込を売上・入金・ハイテク台帳と照合します。",
        files: ["2026-6-25_(2).pdf", "ハイテク明細　2025.6～.zip", "WEB振込2025.6～ (5).zip", "nmr20260701073104"],
        linkedViews: [
          { view: "sales", label: "売上" },
          { view: "dataLink", label: "データ連携" },
          { view: "documentExtracts", label: "資料読取" },
          { view: "receivedDocs", label: "受領書類" },
          { view: "hitech", label: "ハイテク台帳" }
        ],
        checks: [
          { id: "bank-imported", label: "通帳・WEB振込の入金を売上一覧へ反映済み" },
          { id: "bank-invoice", label: "請求書番号と入金を紐づけ済み" },
          { id: "bank-hitech", label: "ハイテク明細をハイテク台帳と照合済み" }
        ]
      },
      {
        id: "jcb",
        no: "②",
        title: "クレジットカード明細（JCB）",
        driveUrl: "https://drive.google.com/open?id=1TWu5YWSoNMbr_US8TCIrWQmtXVS4U2n0&usp=drive_copy",
        description: "カード明細とAmazon等の適格請求書をカード台帳・レシート画像と照合します。",
        files: ["カード明細", "202606meisai.pdf", "202607meisai.pdf", "カードインボイス2025.6～.zip　→Amazonの適格請求書"],
        linkedViews: [
          { view: "documentExtracts", label: "資料読取" },
          { view: "cards", label: "カード台帳" },
          { view: "receipts", label: "レシート管理" },
          { view: "expenses", label: "経費表" }
        ],
        checks: [
          { id: "jcb-statement", label: "カード明細をカード台帳へ反映済み" },
          { id: "jcb-invoice", label: "Amazon等の適格請求書を証憑として確認済み" },
          { id: "jcb-duplicate", label: "現金・通帳取込との二重登録がないことを確認済み" }
        ]
      },
      {
        id: "sales",
        no: "③",
        title: "売上請求書 / カード支払記録簿",
        driveUrl: "https://drive.google.com/open?id=1LFYUd0jadsYlTDBrgsfJ7lpcdaPp1XzQ&usp=drive_copy",
        description: "売上請求書とカード支払記録簿を売上・請求書番号・入金とつなげます。",
        files: ["売り上げ2025506～.zip", "カード支払い記録簿2025年度.xlsx"],
        linkedViews: [
          { view: "documentExtracts", label: "資料読取" },
          { view: "invoices", label: "請求書" },
          { view: "sales", label: "売上" },
          { view: "salesFlow", label: "販売管理" }
        ],
        checks: [
          { id: "sales-invoices", label: "請求書番号・請求日・支払期限を確認済み" },
          { id: "sales-payment", label: "入金日と売上計上の確認メモを残した" },
          { id: "sales-card-record", label: "カード支払記録簿と請求書・領収書の関係を確認済み" }
        ]
      },
      {
        id: "payables",
        no: "④",
        title: "支払請求書",
        driveUrl: "https://drive.google.com/open?id=1KJ1h5vJBJ_7HxT7lfdUFk03wZfj2NZ5M&usp=drive_copy",
        description: "お客様月別請求書とCDP宛請求書を、支払依頼・受領書類・経費に紐づけます。",
        files: ["お客様月別請求書CDP2025.6～.zip", "CDP宛請求書2025.6～.zip"],
        linkedViews: [
          { view: "documentExtracts", label: "資料読取" },
          { view: "paymentRequests", label: "支払依頼" },
          { view: "receivedDocs", label: "受領書類" },
          { view: "expenses", label: "経費表" }
        ],
        checks: [
          { id: "payables-vendor", label: "CDP宛請求書を支払依頼・経費へ反映済み" },
          { id: "payables-customer", label: "お客様月別請求書を案件・売上側と照合済み" },
          { id: "payables-proof", label: "未払い・二重支払・証憑不足がないか確認済み" }
        ]
      },
      {
        id: "payroll",
        no: "⑤",
        title: "賃金",
        driveUrl: "",
        description: "賃金台帳を給与台帳と照合し、提出用に不足がないか確認します。",
        files: ["賃金台帳2026.zip"],
        linkedViews: [
          { view: "documentExtracts", label: "資料読取" },
          { view: "payroll", label: "給与台帳" },
          { view: "closing", label: "締め登録" }
        ],
        checks: [
          { id: "payroll-ledger", label: "賃金台帳を給与台帳へ反映済み" },
          { id: "payroll-period", label: "対象期間・支払日・金額を確認済み" },
          { id: "payroll-submit", label: "税理士へ渡すZIP名と中身を確認済み" }
        ]
      }
    ];
  }

  function getTaxAccountantPack() {
    if (!Array.isArray(state.taxAccountantPacks)) state.taxAccountantPacks = [];
    const packId = `tax-accountant-${selectedFiscalYear}`;
    let pack = state.taxAccountantPacks.find((item) => item.fiscalYear === selectedFiscalYear || item.id === packId);
    if (!pack) {
      pack = {
        id: packId,
        fiscalYear: selectedFiscalYear,
        createdAt: new Date().toISOString(),
        updatedAt: "",
        items: []
      };
      state.taxAccountantPacks.push(pack);
    }

    const previousItems = Array.isArray(pack.items) ? pack.items : [];
    pack.items = defaultTaxSubmissionItems().map((base) => {
      const existing = previousItems.find((item) => item.id === base.id) || {};
      const previousChecks = Array.isArray(existing.checks) ? existing.checks : [];
      return {
        ...base,
        status: existing.status || "詳細待ち",
        note: existing.note || "",
        driveUrl: existing.driveUrl !== undefined ? existing.driveUrl : base.driveUrl,
        files: Array.isArray(existing.files) && existing.files.length ? existing.files : base.files,
        checks: base.checks.map((check) => {
          const old = previousChecks.find((item) => item.id === check.id) || {};
          return { ...check, done: Boolean(old.done) };
        })
      };
    });
    return pack;
  }

  function taxSubmissionCheckCount(items) {
    const checks = items.flatMap((item) => item.checks || []);
    return {
      total: checks.length,
      done: checks.filter((check) => check.done).length
    };
  }

  function taxSubmissionStatusBadge(status) {
    const classes = {
      "提出済": "good",
      "提出準備OK": "good",
      "不足あり": "bad",
      "照合中": "warn",
      "詳細待ち": "warn"
    };
    return `<span class="badge ${classes[status] || "warn"}">${esc(status || "詳細待ち")}</span>`;
  }

  function renderTaxAccountant() {
    const pack = getTaxAccountantPack();
    const items = pack.items || [];
    const checks = taxSubmissionCheckCount(items);
    const readyCount = items.filter((item) => ["提出準備OK", "提出済"].includes(item.status)).length;
    const missingCount = items.filter((item) => !item.driveUrl || !(item.note || "").trim()).length;
    const documentExtracts = state.documentExtracts || [];
    const extractNeedsReview = documentExtracts.filter((item) => item.status === "要確認" || clean(item.issueMemo)).length;

    app.innerHTML = `
      <div class="grid cols-4">
        ${summaryCard("提出カテゴリ", `${items.length}件`, "通帳・カード・売上・支払・賃金")}
        ${summaryCard("照合チェック", `${checks.done}/${checks.total}`, "台帳や請求書との紐づけ")}
        ${summaryCard("提出準備", `${readyCount}件`, "提出準備OKまたは提出済")}
        ${summaryCard("未記入注意", `${missingCount}件`, "リンクまたはメモの不足")}
        ${summaryCard("資料読取", `${documentExtracts.length}件`, `要確認 ${extractNeedsReview}件 / ${yen(sum(documentExtracts, "primaryAmount"))}`)}
      </div>

      <section class="panel" style="margin-top:14px;">
        <div class="panel-head">
          <h2>税理士提出資料の連携</h2>
          <div class="actions">
            <button class="button secondary small" id="exportTaxDocumentExtractCsv" type="button">読取台帳CSV</button>
            <button class="button secondary small" id="exportTaxSubmissionHtml" type="button">提出一覧HTML</button>
            <button class="button secondary small" data-view-jump="documentExtracts" type="button">資料読取へ</button>
            <button class="button secondary small" data-view-jump="closing" type="button">締め登録へ</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="notice info">
            ここでは提出予定の資料を「どの台帳・売上・支払と照合するか」まで管理します。各資料の中身は資料読取台帳にテキスト・数字として保存し、リンクだけで終わらせない運用にします。
          </div>
          <div class="tax-pack-layout">
            ${items.map(renderTaxSubmissionCard).join("")}
          </div>
        </div>
      </section>
    `;

    bindTaxAccountantActions();
    const extractCsvButton = document.getElementById("exportTaxDocumentExtractCsv");
    if (extractCsvButton) extractCsvButton.addEventListener("click", () => exportCsv("tax-document-extracts", documentExtracts, documentExtractCsvFields()));
  }

  function renderTaxSubmissionCard(item) {
    const statusOptions = taxSubmissionStatuses()
      .map((status) => `<option value="${esc(status)}" ${item.status === status ? "selected" : ""}>${esc(status)}</option>`)
      .join("");
    const noteState = (item.note || "").trim() ? "記入済み" : `<strong class="red-note">未記入</strong>`;
    const driveState = item.driveUrl
      ? `<a class="tax-link" href="${esc(item.driveUrl)}" target="_blank" rel="noopener">Google Driveを開く</a>`
      : `<strong class="red-note">未記入</strong>`;

    return `
      <article class="tax-pack-card">
        <div class="tax-pack-card-head">
          <div>
            <div class="tax-pack-title-line"><span class="badge">${esc(item.no)}</span><h3>${esc(item.title)}</h3></div>
            <p>${esc(item.description)}</p>
          </div>
          ${taxSubmissionStatusBadge(item.status)}
        </div>

        <div class="tax-pack-meta">
          <span>Drive: ${driveState}</span>
          <span>詳細メモ: ${noteState}</span>
        </div>

        <div class="tax-pack-file-list">
          <strong>提出予定ファイル</strong>
          <ul>${(item.files || []).map((file) => `<li>${esc(file)}</li>`).join("")}</ul>
        </div>

        ${renderTaxSubmissionExtracts(item)}

        <div class="tax-pack-links">
          <strong>照合する画面</strong>
          <div class="actions">
            ${(item.linkedViews || []).map((link) => `<button class="button secondary small" data-view-jump="${esc(link.view)}" type="button">${esc(link.label)}</button>`).join("")}
          </div>
        </div>

        <div class="form-grid tax-pack-form">
          <label class="field">
            <span>状態</span>
            <select data-tax-status="${esc(item.id)}">${statusOptions}</select>
          </label>
          <label class="field">
            <span>Driveリンク</span>
            <input data-tax-drive="${esc(item.id)}" type="url" value="${esc(item.driveUrl || "")}" placeholder="Google DriveのURL">
          </label>
          <label class="field" style="grid-column:1 / -1;">
            <span>詳細メモ</span>
            <textarea data-tax-note="${esc(item.id)}" placeholder="資料の中身、照合結果、不足、税理士への確認事項を記入">${esc(item.note || "")}</textarea>
          </label>
        </div>

        <div class="tax-pack-check-list">
          ${(item.checks || []).map((check) => `
            <label class="check-field">
              <input type="checkbox" data-tax-check="${esc(item.id)}" data-check-id="${esc(check.id)}" ${check.done ? "checked" : ""}>
              <span>${esc(check.label)}</span>
            </label>
          `).join("")}
        </div>
      </article>
    `;
  }

  function taxExtractsForSubmission(itemId) {
    const rows = state.documentExtracts || [];
    const categoryMap = {
      bank: ["通帳", "WEB振込", "ハイテク"],
      jcb: ["クレジットカード"],
      sales: ["売上請求書"],
      payables: ["支払請求書", "受領書類"],
      payroll: ["賃金"]
    };
    const targetMap = {
      bank: ["通帳明細", "ハイテク台帳", "受領書類"],
      jcb: ["カード台帳", "経費表"],
      sales: ["売上", "請求書"],
      payables: ["支払依頼", "受領書類", "経費表"],
      payroll: ["給与台帳"]
    };
    const categories = categoryMap[itemId] || [];
    const targets = targetMap[itemId] || [];
    return rows
      .filter((row) => categories.includes(row.sourceCategory) || targets.includes(row.targetLedger))
      .sort((a, b) => String(b.documentDate || b.createdAt || "").localeCompare(String(a.documentDate || a.createdAt || "")));
  }

  function renderTaxSubmissionExtracts(item) {
    const rows = taxExtractsForSubmission(item.id);
    if (!rows.length) {
      return `
        <div class="tax-pack-file-list">
          <strong>読取済みデータ</strong>
          <p><strong class="red-note">未記入</strong> PDF・Excel・画像から吸い上げたテキストや数字がまだありません。</p>
        </div>
      `;
    }
    return `
      <div class="tax-pack-file-list">
        <strong>読取済みデータ</strong>
        <ul>${rows.slice(0, 5).map((row) => `
          <li>
            ${esc(formatDate(row.documentDate))} / ${esc(row.sourceFile || row.documentTitle || row.sourceCategory)}
            / ${moneyOrMissing(row.primaryAmount)}
            / ${statusBadge(row.status || "読取済")}
            ${clean(row.issueMemo) ? ` / <strong class="red-note">${esc(row.issueMemo)}</strong>` : ""}
          </li>
        `).join("")}</ul>
        ${rows.length > 5 ? `<p class="muted">ほか ${rows.length - 5}件</p>` : ""}
      </div>
    `;
  }

  function bindTaxAccountantActions() {
    const exportButton = document.getElementById("exportTaxSubmissionHtml");
    if (exportButton) exportButton.addEventListener("click", exportTaxAccountantSubmissionHtml);
    app.querySelectorAll("[data-view-jump]").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.viewJump));
    });
    app.querySelectorAll("[data-tax-status]").forEach((select) => {
      select.addEventListener("change", () => {
        updateTaxSubmissionItem(select.dataset.taxStatus, (item) => {
          item.status = select.value;
        }, "税理士提出資料の状態更新");
      });
    });
    app.querySelectorAll("[data-tax-drive]").forEach((input) => {
      input.addEventListener("change", () => {
        updateTaxSubmissionItem(input.dataset.taxDrive, (item) => {
          item.driveUrl = input.value.trim();
        }, "税理士提出資料のDriveリンク更新");
      });
    });
    app.querySelectorAll("[data-tax-note]").forEach((textarea) => {
      textarea.addEventListener("change", () => {
        updateTaxSubmissionItem(textarea.dataset.taxNote, (item) => {
          item.note = textarea.value.trim();
        }, "税理士提出資料のメモ更新");
      });
    });
    app.querySelectorAll("[data-tax-check]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        updateTaxSubmissionItem(checkbox.dataset.taxCheck, (item) => {
          const check = (item.checks || []).find((entry) => entry.id === checkbox.dataset.checkId);
          if (check) check.done = checkbox.checked;
        }, "税理士提出資料の照合チェック更新");
      });
    });
  }

  function updateTaxSubmissionItem(itemId, updater, action) {
    const pack = getTaxAccountantPack();
    const item = (pack.items || []).find((entry) => entry.id === itemId);
    if (!item) return;
    updater(item);
    pack.updatedAt = new Date().toISOString();
    addAudit(action, { fiscalYear: selectedFiscalYear, item: item.title });
    persist(action);
    renderTaxAccountant();
  }

  function exportTaxAccountantSubmissionHtml() {
    const pack = getTaxAccountantPack();
    const rows = (pack.items || []).map((item) => {
      const checkText = (item.checks || []).map((check) => `${check.done ? "済" : "未確認"}：${esc(check.label)}`).join("<br>");
      const fileText = (item.files || []).map((file) => esc(file)).join("<br>");
      const driveText = item.driveUrl ? `<a href="${esc(item.driveUrl)}">${esc(item.driveUrl)}</a>` : `<strong class="bad">未記入</strong>`;
      const noteText = (item.note || "").trim() ? esc(item.note) : `<strong class="bad">未記入</strong>`;
      return `<tr>
        <td>${esc(item.no)} ${esc(item.title)}</td>
        <td>${esc(item.status || "詳細待ち")}</td>
        <td>${driveText}</td>
        <td>${fileText}</td>
        <td>${checkText}</td>
        <td>${noteText}</td>
      </tr>`;
    }).join("");
    const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>税理士提出資料一覧 ${selectedFiscalYear}年度</title>
  <style>
    body{font-family:"Yu Gothic",Meiryo,sans-serif;color:#172033;margin:28px;line-height:1.55}
    h1{font-size:24px;margin-bottom:4px}.muted{color:#637087}
    table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #d8dee8;padding:8px;vertical-align:top;text-align:left}th{background:#e7f0fb}
    .bad{color:#b73838;font-weight:800}
  </style>
</head>
<body>
  <h1>${esc(state.settings.companyName)} 税理士提出資料一覧</h1>
  <p class="muted">${selectedFiscalYear}年度 / ${formatDate(getFiscalRange(selectedFiscalYear).start)} - ${formatDate(getFiscalRange(selectedFiscalYear).end)} / 出力日 ${formatDate(TODAY)}</p>
  <table>
    <thead><tr><th>資料</th><th>状態</th><th>Drive</th><th>予定ファイル</th><th>照合チェック</th><th>詳細メモ</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
    addAudit("税理士提出資料一覧HTML出力", { fiscalYear: selectedFiscalYear });
    persist("税理士提出資料一覧HTML出力");
    downloadBlob(`税理士提出資料一覧-${selectedFiscalYear}年度-${TODAY}.html`, new Blob([html], { type: "text/html;charset=utf-8" }));
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
    if (collection === "documentExtracts") return [record.documentDate, record.createdAt].filter(Boolean);
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
    if (collection === "documentExtracts") return [record.sourceCategory, record.documentTitle || record.sourceFile, record.status].filter(Boolean).join(" / ");
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
      documentExtracts: "資料読取",
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
      return matchesQuery(item, filter.query, ["date", "vendor", "category", "department", "itemName", "amount", "paymentMethod", "registrationNumber", "expenseEligibility", "expenseEligibilityReason", "note"]);
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
          <thead><tr><th>日付</th><th>科目</th><th>部門</th><th>取引先</th><th>品名</th><th class="num">個数</th><th class="num">単価</th><th class="num">金額</th><th>支払</th><th>経費適格</th><th>税区分</th><th>T番号</th><th>証憑</th><th>申請</th><th>操作</th></tr></thead>
          <tbody>${items.map((item) => `<tr>
            <td>${dateOrMissing(item.date)}</td><td>${displayOrMissing(item.category)}</td><td>${displayOrMissing(item.department || departments()[0])}</td><td>${displayOrMissing(item.vendor)}</td><td>${displayOrMissing(item.itemName)} ${item.splitGroupId ? '<span class="badge">税率分割</span>' : ""}</td>
            <td class="num">${displayOrMissing(item.quantity)}</td><td class="num">${moneyOrMissing(item.unitPrice)}</td><td class="num">${yen(item.amount)}</td>
            <td>${paymentBadge(item.paymentMethod)}</td><td>${expenseEligibilityBadge(item)}</td><td>${displayOrMissing(item.taxRate)}</td>
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
          <td>${dateOrMissing(item.receivedDate)}</td><td>${displayOrMissing(item.documentType)}</td><td>${displayOrMissing(item.vendor)}</td><td>${displayOrMissing(item.title)}</td>
          <td class="num">${moneyOrMissing(item.amount)}</td><td>${dateOrMissing(item.dueDate)}</td><td>${statusBadge(item.status)}</td>
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
            <td class="num">${moneyOrMissing(item.amountTotal)}</td>
            <td>${esc(importTargetLabel(item.target))}</td>
            <td>${statusBadge(item.status || "取込済")}</td>
            <td>${esc(item.note || "")}</td>
            <td>${importBatchActions(item)}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function renderBankbookEntryTable(items) {
    if (!items.length) return `<div class="empty">通帳明細の読み取り結果はまだありません。</div>`;
    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>日付</th>
              <th>通帳表記日</th>
              <th>入出金</th>
              <th>摘要/名義</th>
              <th class="num">金額</th>
              <th class="num">差引残高</th>
              <th>分類候補</th>
              <th>照合状態</th>
              <th>読取確度</th>
              <th>元資料</th>
              <th>メモ</th>
            </tr>
          </thead>
          <tbody>${items.map((item) => `<tr>
            <td>${esc(formatDate(item.date))}</td>
            <td>${esc(item.statementDateText || "")}</td>
            <td>${bankbookDirectionBadge(item.direction)}</td>
            <td>${esc(item.summary || "")}</td>
            <td class="num">${yen(item.amount)}</td>
            <td class="num">${yen(item.balance)}</td>
            <td>${esc(item.classification || "")}</td>
            <td>${statusBadge(item.status || "未照合")}</td>
            <td>${bankbookConfidenceBadge(item.confidence)}</td>
            <td>${esc(item.sourceFile || "")}${item.sourcePage ? `<br><span class="muted">${esc(item.sourcePage)}</span>` : ""}</td>
            <td>${esc(item.note || "")}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
    `;
  }

  function bankbookDirectionBadge(direction) {
    if (direction === "入金") return '<span class="badge good">入金</span>';
    if (direction === "出金") return '<span class="badge warn">出金</span>';
    return `<span class="badge">${esc(direction || "未確認")}</span>`;
  }

  function bankbookConfidenceBadge(confidence) {
    if (confidence === "高") return '<span class="badge good">高</span>';
    if (confidence === "中") return '<span class="badge warn">中</span>';
    return '<span class="badge bad">低 / 原本確認</span>';
  }

  function importSourceBadge(sourceType) {
    if (sourceType === "bank") return '<span class="badge bank">通帳</span>';
    if (sourceType === "card") return '<span class="badge card">カード</span>';
    if (sourceType === "web-transfer") return '<span class="badge bank">WEB振込</span>';
    return '<span class="badge">CSV</span>';
  }

  function importTargetLabel(target) {
    if (target === "sales") return "売上一覧";
    if (target === "expenses") return "経費表・カード台帳";
    if (target === "receivedDocs") return "受領書類";
    if (target === "documentExtracts") return "資料読取";
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
    if (type === "hitech") {
      return `<div class="table-wrap"><table><thead><tr><th>日付</th><th>元資料</th><th>講師</th><th>内容</th><th class="num">講師料</th><th class="num">交通費</th><th class="num">差引支給</th><th>状態</th><th>メモ</th><th>操作</th></tr></thead><tbody>${items.map((item) => `<tr><td>${dateOrMissing(item.date)}</td><td>${esc(item.sourceFile || item.sender || "")}</td><td>${displayOrMissing(item.instructor)}</td><td>${displayOrMissing(item.course)}</td><td class="num">${moneyOrMissing(item.teachingFee)}</td><td class="num">${moneyOrMissing(item.transportation)}</td><td class="num"><strong>${moneyOrMissing(item.netPayment !== undefined ? item.netPayment : item.amount)}</strong></td><td>${statusBadge(item.status)}</td><td>${displayOrMissing(item.note)}</td><td>${rowActions(type, item.id)}</td></tr>`).join("")}</tbody></table></div>`;
    }
    if (type === "payroll") {
      return `<div class="table-wrap"><table><thead><tr><th>対象月</th><th>氏名</th><th class="num">基本給</th><th class="num">手当</th><th class="num">控除</th><th class="num">支給額</th><th>支払日</th><th>操作</th></tr></thead><tbody>${items.map((item) => `<tr><td>${esc(item.payMonth)}</td><td>${esc(item.employee)}</td><td class="num">${yen(item.basePay)}</td><td class="num">${yen(item.allowance)}</td><td class="num">${yen(item.deduction)}</td><td class="num">${yen(item.netPay)}</td><td>${esc(formatDate(item.payDate))}</td><td>${rowActions(type, item.id)}</td></tr>`).join("")}</tbody></table></div>`;
    }
    return `<div class="table-wrap"><table><thead><tr><th>日付</th><th>送付元</th><th>講師</th><th>内容</th><th class="num">金額</th><th>状態</th><th>操作</th></tr></thead><tbody>${items.map((item) => `<tr><td>${esc(formatDate(item.date))}</td><td>${esc(item.sender)}</td><td>${esc(item.instructor)}</td><td>${esc(item.course)}</td><td class="num">${yen(item.amount)}</td><td>${statusBadge(item.status)}</td><td>${rowActions(type, item.id)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function renderReceiptMonth(month, records) {
    const sorted = [...records].sort(byDate("date"));
    const groups = receiptSourceGroups(sorted);
    return `
      <div class="receipt-month" style="margin-bottom:14px;">
        <div class="receipt-month-head">
          <h3>${esc(monthLabel(month))}</h3>
          <div class="actions"><span class="badge">${sorted.length}件</span><span class="badge">${yen(sum(sorted, "amount"))}</span><button class="button secondary small" data-action="month-handoff" data-month="${esc(month)}" type="button">提出HTML</button></div>
        </div>
        <div class="receipt-month-table">
          ${groups.map(renderReceiptSourceGroup).join("")}
        </div>
      </div>
    `;
  }

  function receiptSourceGroups(records) {
    const groups = new Map();
    records.forEach((item, index) => {
      const proof = item.proof;
      const sourceUrl = proof && (proof.fullDataUrl || proof.dataUrl) ? (proof.fullDataUrl || proof.dataUrl) : "";
      const sourceName = proof && (proof.fullName || proof.name) ? (proof.fullName || proof.name) : "証憑なし";
      const key = sourceUrl || `no-proof-${sourceName}-${index}`;
      if (!groups.has(key)) groups.set(key, { key, sourceUrl, sourceName, records: [] });
      groups.get(key).records.push(item);
    });
    return [...groups.values()];
  }

  function renderReceiptSourceGroup(group) {
    const hasSource = Boolean(group.sourceUrl);
    return `
      <section class="receipt-source-group">
        <div class="receipt-source-head">
          ${hasSource ? `
            <a class="receipt-source-photo" href="${esc(group.sourceUrl)}" target="_blank" rel="noopener" aria-label="元写真を拡大">
              <img src="${esc(group.sourceUrl)}" alt="${esc(group.sourceName)}">
            </a>
          ` : `<div class="receipt-source-photo is-empty">元写真なし</div>`}
          <div class="receipt-source-meta">
            <strong>元写真グループ</strong>
            <span>${esc(group.sourceName)}</span>
            <div class="actions">
              <span class="badge">${group.records.length}件</span>
              <span class="badge">${yen(sum(group.records, "amount"))}</span>
              ${hasSource ? `<a class="button secondary small" href="${esc(group.sourceUrl)}" target="_blank" rel="noopener">元写真を拡大</a>` : ""}
            </div>
          </div>
        </div>
        ${renderReceiptDetailTable(group.records)}
      </section>
    `;
  }

  function renderReceiptDetailTable(records) {
    return `
      <div class="table-wrap receipt-detail-table">
        <table>
          <thead>
            <tr>
              <th>証憑</th>
              <th>日付</th>
              <th>取引先</th>
              <th>科目</th>
              <th>品名</th>
              <th class="num">個数</th>
              <th class="num">単価</th>
              <th>税区分</th>
              <th>T番号</th>
              <th>支払</th>
              <th>経費適格</th>
              <th class="num">金額</th>
              <th>メモ</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((item) => `<tr>
              <td>${receiptProofThumb(item)}</td>
              <td>${dateOrMissing(item.date)}</td>
              <td><strong>${displayOrMissing(item.vendor)}</strong></td>
              <td>${displayOrMissing(item.category)}</td>
              <td>${displayOrMissing(item.itemName)}</td>
              <td class="num">${displayOrMissing(item.quantity)}</td>
              <td class="num">${moneyOrMissing(item.unitPrice)}</td>
              <td>${displayOrMissing(item.taxRate)} ${item.splitGroupId ? '<span class="badge warn">税率分割</span>' : ""}</td>
              <td>${registrationBadge(item)}</td>
              <td>${paymentBadge(item.paymentMethod)}</td>
              <td>${expenseEligibilityBadge(item)}</td>
              <td class="num"><strong>${yen(item.amount)}</strong></td>
              <td class="receipt-note-cell">${displayOrMissing(item.note)}</td>
              <td><div class="actions">${splitProofAction(item)}${rowActions("expenses", item.id)}</div></td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function receiptProofThumb(item) {
    const proof = item.proof;
    if (proof && proof.type && proof.type.startsWith("image/")) {
      return `<button class="receipt-thumb mini receipt-table-thumb" data-action="preview" data-id="${esc(item.id)}" type="button" aria-label="証憑を表示"><img src="${esc(proof.dataUrl)}" alt="${esc(proof.name || "証憑")}"></button>`;
    }
    return `<button class="receipt-thumb mini receipt-table-thumb" data-action="preview" data-id="${esc(item.id)}" type="button" aria-label="証憑を表示"><span>${proof ? esc(proof.name) : "なし"}</span></button>`;
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
    alerts.push(...documentExtractAlerts());
    alerts.push(...getInvoiceIssues());
    return alerts;
  }

  function documentExtractAlerts() {
    const alerts = [];
    const rows = fiscalItems(state.documentExtracts || [], "documentDate");
    const needsReview = rows.filter((item) => item.status === "要確認" || clean(item.issueMemo));
    const missingCore = rows.filter((item) => {
      return !hasDisplayValue(item.sourceFile) || !hasDisplayValue(item.documentTitle) || !hasDisplayValue(item.primaryAmount) || !hasDisplayValue(item.targetLedger) || item.targetLedger === "未選択";
    });
    if (needsReview.length) alerts.push({ severity: "warn", title: "資料読取の要確認", body: `${needsReview.length}件あります。PDF・Excel・ZIP元資料と読取結果の金額・日付・反映先を確認してください。` });
    if (missingCore.length) alerts.push({ severity: "bad", title: "資料読取の未記入", body: `${missingCore.length}件で元ファイル名・資料名・主金額・反映先のいずれかが未記入です。税理士提出前に補完してください。` });
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
      .map(([key, value]) => `<dt>${esc(labelFor(key))}</dt><dd>${displayValueHtml(key, value)}</dd>`)
      .join("");
    const proofHtml = proof ? (proof.type && proof.type.startsWith("image/")
      ? `<div class="proof-preview">
          <div class="proof-actions">
            <a class="button secondary small" href="${esc(proof.dataUrl)}" target="_blank" rel="noopener">画像を拡大</a>
            ${proof.fullDataUrl ? `<a class="button secondary small" href="${esc(proof.fullDataUrl)}" target="_blank" rel="noopener">台紙全体を開く</a>` : ""}
          </div>
          <a class="proof-image-link" href="${esc(proof.dataUrl)}" target="_blank" rel="noopener" title="画像を拡大">
            <img class="preview-image" src="${esc(proof.dataUrl)}" alt="${esc(proof.name)}">
          </a>
        </div>`
      : `<div class="notice info">${esc(proof.name)} を保存済みです。</div>`) : "";
    dialogBody.innerHTML = `
      ${proofHtml}
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
        ${selectField("expenseEligibility", "経費適格", expenseEligibilityEditOptions, expenseEligibilityValue(item))}
        ${field("expenseEligibilityReason", "判定理由", "text", item.expenseEligibilityReason || inferExpenseEligibility(item).reason)}
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
    if (collection === "documentExtracts") {
      return `
        ${field("documentDate", "資料日付", "date", item.documentDate || TODAY)}
        ${selectField("sourceCategory", "資料分類", documentSourceCategories.map((entry) => [entry, entry]), item.sourceCategory || "その他")}
        ${selectField("sourceFormat", "形式", documentSourceFormats.map((entry) => [entry, entry]), item.sourceFormat || "その他")}
        ${field("sourceFile", "元ファイル名", "text", item.sourceFile || "")}
        ${field("documentTitle", "資料名", "text", item.documentTitle || "")}
        ${field("counterparty", "相手先・口座", "text", item.counterparty || "")}
        ${field("primaryAmount", "主金額", "number", hasDisplayValue(item.primaryAmount) ? item.primaryAmount : "")}
        ${field("taxAmount", "税額", "number", hasDisplayValue(item.taxAmount) ? item.taxAmount : "")}
        ${field("grossAmount", "総額", "number", hasDisplayValue(item.grossAmount) ? item.grossAmount : "")}
        ${field("rowCount", "読取行数", "number", hasDisplayValue(item.rowCount) ? item.rowCount : "")}
        ${selectField("targetLedger", "反映先", documentExtractTargetOptions(), item.targetLedger || "未選択")}
        ${field("linkedRecordId", "紐づけID", "text", item.linkedRecordId || "")}
        ${selectField("status", "状態", documentExtractStatuses.map((entry) => [entry, entry]), item.status || "読取済")}
        ${selectField("confidence", "読取確度", documentConfidenceOptions.map((entry) => [entry, entry]), item.confidence || "中")}
        <label class="field" style="grid-column:1 / -1;"><span>読み取ったテキスト</span><textarea name="extractedText">${esc(item.extractedText || "")}</textarea></label>
        <label class="field" style="grid-column:1 / -1;"><span>数字メモ</span><textarea name="numericMemo">${esc(item.numericMemo || "")}</textarea></label>
        <label class="field" style="grid-column:1 / -1;"><span>未確認・確認依頼</span><textarea name="issueMemo">${esc(item.issueMemo || "")}</textarea></label>
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
    const numericFields = ["quantity", "unitPrice", "amount", "mileage", "fuelClaim", "lodging", "total", "basePay", "allowance", "deduction", "netPay", "dayOfMonth", "primaryAmount", "taxAmount", "grossAmount", "rowCount"];

    Object.entries(data).forEach(([key, value]) => {
      if (key === "proof" || key === "file" || key === "invoiceEligible") return;
      if (/^line(ItemName|Quantity|Unit|UnitPrice|TaxRate)\d+$/.test(key)) return;
      item[key] = numericFields.includes(key) ? num(value) : clean(value);
    });

    if (collection === "expenses") {
      item.invoiceEligible = Boolean(formData.get("invoiceEligible"));
      item.registrationNumber = normalizeRegistration(item.registrationNumber);
      item.expenseEligibility = normalizeExpenseEligibility(item.expenseEligibility) || inferExpenseEligibility(item).value;
      if (!clean(item.expenseEligibilityReason)) item.expenseEligibilityReason = inferExpenseEligibility(item).reason;
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
    const taxAccountantPack = getTaxAccountantPack();
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
      bankbookEntries: state.bankbookEntries || [],
      documentExtracts: state.documentExtracts || [],
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
      taxAccountantPacks: [taxAccountantPack],
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
    const bankbookEntries = state.bankbookEntries || [];
    const bankbookUnmatched = bankbookEntries.filter((item) => !["照合済", "対象外"].includes(item.status)).length;
    const hitechRows = fiscalItems(state.hitech || [], "date");
    const hitechPending = hitechRows.filter((item) => item.status !== "完了").length;
    const documentExtracts = state.documentExtracts || [];
    const extractNeedsReview = documentExtracts.filter((item) => item.status === "要確認" || clean(item.issueMemo)).length;
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
    <tr><th>通帳明細読み取り</th><td>${bankbookEntries.length}件 / 未照合 ${bankbookUnmatched}件</td></tr>
    <tr><th>ハイテク明細</th><td>${hitechRows.length}件 / 未完了 ${hitechPending}件</td></tr>
    <tr><th>資料読取</th><td>${documentExtracts.length}件 / 要確認 ${extractNeedsReview}件 / 抽出金額 ${yen(sum(documentExtracts, "primaryAmount"))}</td></tr>
    <tr><th>未確認</th><td>${alerts.length}件</td></tr>
  </tbody></table>
  <h2>要確認事項</h2>
  ${alerts.length ? `<table><thead><tr><th>重要度</th><th>項目</th><th>内容</th></tr></thead><tbody>${alerts.map((alert) => `<tr><td class="${alert.severity === "bad" ? "bad" : "warn"}">${alert.severity === "bad" ? "要対応" : "確認"}</td><td>${esc(alert.title)}</td><td>${esc(alert.body)}</td></tr>`).join("")}</tbody></table>` : "<p>提出前の大きな未確認はありません。</p>"}
  <h2>資料読取台帳</h2>
  ${documentExtracts.length ? `<table><thead><tr><th>資料日付</th><th>分類</th><th>元ファイル</th><th>資料名</th><th>反映先</th><th class="num">主金額</th><th>状態</th><th>未確認・確認依頼</th></tr></thead><tbody>${documentExtracts.map((row) => `<tr><td>${esc(formatDate(row.documentDate))}</td><td>${esc(row.sourceCategory || "")}</td><td>${esc(row.sourceFile || "")}</td><td>${esc(row.documentTitle || "")}</td><td>${esc(row.targetLedger || "")}</td><td class="num">${hasDisplayValue(row.primaryAmount) ? yen(row.primaryAmount) : '<strong class="bad">未記入</strong>'}</td><td>${esc(row.status || "")}</td><td>${clean(row.issueMemo) ? `<strong class="bad">${esc(row.issueMemo)}</strong>` : ""}</td></tr>`).join("")}</tbody></table>` : "<p>資料読取台帳はありません。</p>"}
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
    const ineligibleExpenses = data.expenses.filter((item) => expenseEligibilityValue(item) === "ineligible");
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
    if (ineligibleExpenses.length) issues.push({ severity: "bad", title: "経費不適格候補", body: `${ineligibleExpenses.length}件あります。税理士提出前に業務用途・相手先・目的を確認してください。` });
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
  ${data.expenses.length ? `<table><thead><tr><th>日付</th><th>支払</th><th>取引先/品名</th><th>科目</th><th>経費適格</th><th class="num">金額</th><th>T番号</th><th>証憑</th></tr></thead><tbody>${data.expenses.map((item) => `
    <tr>
      <td>${esc(formatDate(item.date))}</td><td>${esc(paymentLabel(item.paymentMethod))}</td><td>${esc([item.vendor, item.itemName].filter(Boolean).join(" / "))}</td>
      <td>${esc(item.category || "")}</td><td class="${expenseEligibilityValue(item) === "ineligible" ? "bad" : "good"}">${esc(expenseEligibilityLabel(item.expenseEligibility))}</td><td class="num">${esc(yen(item.amount))}</td><td>${esc(item.registrationNumber || "")}</td><td>${handoffProofCell(item)}</td>
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
      if (imported && imported.type === "expense-append" && Array.isArray(imported.expenses)) {
        state.expenses = Array.isArray(state.expenses) ? state.expenses : [];
        const replaceMatches = Array.isArray(imported.replaceMatches) ? imported.replaceMatches : [];
        let replacedCount = 0;
        if (replaceMatches.length) {
          const beforeCount = state.expenses.length;
          state.expenses = state.expenses.filter((item) => !replaceMatches.some((match) => (
            (!match.date || item.date === match.date)
            && (!match.vendor || item.vendor === match.vendor)
            && (!num(match.amount) || num(item.amount) === num(match.amount))
            && (!match.taxRate || item.taxRate === match.taxRate)
          )));
          replacedCount = beforeCount - state.expenses.length;
        }
        const existingIds = new Set((state.expenses || []).map((item) => item.id));
        const incomingExpenses = imported.expenses.map((item) => ({
          ...item,
          id: item.id && !existingIds.has(item.id) ? item.id : uid("exp"),
          createdAt: item.createdAt || new Date().toISOString()
        }));
        incomingExpenses.forEach((item) => existingIds.add(item.id));
        state.expenses.push(...incomingExpenses);
        if (Array.isArray(imported.receivedDocs) && imported.receivedDocs.length) {
          state.receivedDocs = Array.isArray(state.receivedDocs) ? state.receivedDocs : [];
          state.receivedDocs.push(...imported.receivedDocs.map((item) => ({
            ...item,
            id: item.id || uid("doc"),
            createdAt: item.createdAt || new Date().toISOString()
          })));
        }
        addAudit("経費追加取込", { file: file.name, count: incomingExpenses.length, replacedCount });
        persist("経費追加取込");
        if (incomingExpenses[0] && incomingExpenses[0].date) showFiscalYearForDate(incomingExpenses[0].date);
        render();
        alert(`${incomingExpenses.length}件の経費を追加しました。${replacedCount ? `${replacedCount}件を置き換えました。` : ""}`);
        return;
      }
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
          expenseEligibility: "",
          expenseEligibilityReason: "",
          note: `カードCSV取込: ${file.name}`,
          proof: null,
          createdAt: new Date().toISOString()
        };
        applyExpenseEligibility(record);
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

  function bankbookCsvFields() {
    return [
      ["date", "日付"],
      ["statementDateText", "通帳表記日"],
      ["direction", "入出金"],
      ["summary", "摘要/名義"],
      ["amount", "金額"],
      ["balance", "差引残高"],
      ["classification", "分類候補"],
      ["status", "照合状態"],
      ["confidence", "読取確度"],
      ["sourceFile", "元資料"],
      ["sourcePage", "元ページ"],
      ["linkedTo", "紐づけ先"],
      ["note", "メモ"]
    ];
  }

  function documentExtractCsvFields() {
    return [
      ["documentDate", "資料日付"],
      ["sourceCategory", "資料分類"],
      ["sourceFormat", "形式"],
      ["sourceFile", "元ファイル名"],
      ["documentTitle", "資料名"],
      ["counterparty", "相手先・口座"],
      ["primaryAmount", "主金額"],
      ["taxAmount", "税額"],
      ["grossAmount", "総額"],
      ["rowCount", "読取行数"],
      ["targetLedger", "反映先"],
      ["linkedRecordId", "紐づけID"],
      ["status", "状態"],
      ["confidence", "読取確度"],
      ["extractedText", "読み取ったテキスト"],
      ["numericMemo", "数字メモ"],
      ["issueMemo", "未確認・確認依頼"],
      ["createdAt", "登録日時"],
      ["updatedAt", "更新日時"]
    ];
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
    if (!hasDisplayValue(value)) return missingValueHtml();
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

  function normalizeExpenseEligibility(value) {
    if (value === true || value === "true" || value === "eligible" || value === "適格") return "eligible";
    if (value === false || value === "false" || value === "ineligible" || value === "不適格") return "ineligible";
    return "";
  }

  function expenseEligibilityValue(item) {
    return normalizeExpenseEligibility(item && item.expenseEligibility) || inferExpenseEligibility(item || {}).value;
  }

  function expenseEligibilityLabel(value) {
    return normalizeExpenseEligibility(value) === "ineligible" ? "不適格" : "適格";
  }

  function expenseEligibilityBadge(item) {
    const value = expenseEligibilityValue(item);
    const label = value === "ineligible" ? "不適格" : "適格";
    const cls = value === "ineligible" ? "bad" : "good";
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function registrationBadge(item) {
    if (item.registrationNumber && isValidRegistration(item.registrationNumber)) return esc(item.registrationNumber);
    if (item.registrationNumber) return `<span class="badge bad">${esc(item.registrationNumber)}</span>`;
    if (num(item.amount) >= 10000 && item.invoiceEligible) return `${missingValueHtml()} <span class="badge bad">T番号要確認</span>`;
    return missingValueHtml();
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
    if (type === "hitech") return [["date", "日付"], ["sourcePeriod", "元資料期間"], ["sender", "送付元"], ["instructor", "講師"], ["course", "内容"], ["teachingFee", "講師料"], ["transportation", "交通費"], ["grossPayment", "総支給額"], ["deductionTotal", "控除合計"], ["netPayment", "差引支給"], ["cumulativePayment", "支給額累計"], ["jid", "JID"], ["amount", "台帳金額"], ["status", "状態"], ["confidence", "情報確度"], ["sourceFile", "元資料"], ["sourcePage", "元ページ"], ["note", "メモ"]];
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

  function hasDisplayValue(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === "number") return Number.isFinite(value);
    return clean(value) !== "";
  }

  function missingValueHtml() {
    return '<span class="missing-value">未記入</span>';
  }

  function displayOrMissing(value) {
    return hasDisplayValue(value) ? esc(value) : missingValueHtml();
  }

  function dateOrMissing(value) {
    return displayOrMissing(formatDate(value));
  }

  function moneyOrMissing(value) {
    return hasDisplayValue(value) ? yen(value) : missingValueHtml();
  }

  function displayValueHtml(key, value) {
    const moneyKeys = ["amount", "amountTotal", "unitPrice", "fuelClaim", "lodging", "total", "basePay", "allowance", "deduction", "netPay", "debit", "credit", "balance", "previous", "current", "diff", "primaryAmount", "taxAmount", "grossAmount"];
    if (moneyKeys.includes(key) && !hasDisplayValue(value)) return missingValueHtml();
    const displayed = displayValue(key, value);
    return hasDisplayValue(displayed) ? esc(displayed) : missingValueHtml();
  }

  function displayValue(key, value) {
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return key === "lines" ? documentLinesSummary(value) : JSON.stringify(value);
    if (key.toLowerCase().includes("date") || key === "createdAt" || key === "deletedAt" || key === "at") return String(value).includes("T") ? formatDateTime(value) : formatDate(value);
    if (["amount", "amountTotal", "unitPrice", "fuelClaim", "lodging", "total", "basePay", "allowance", "deduction", "netPay", "debit", "credit", "balance", "previous", "current", "diff", "primaryAmount", "taxAmount", "grossAmount"].includes(key)) return yen(value);
    if (key === "paymentMethod") return paymentLabel(value);
    if (key === "expenseEligibility") return expenseEligibilityLabel(value);
    if (key === "sourceType") return value === "bank" ? "通帳" : value === "card" ? "カード" : value === "web-transfer" ? "WEB振込" : String(value);
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
      sourceCategory: "資料分類",
      sourceFormat: "形式",
      sourceFile: "元ファイル名",
      fileName: "ファイル名",
      documentDate: "資料日付",
      documentTitle: "資料名",
      counterparty: "相手先・口座",
      primaryAmount: "主金額",
      taxAmount: "税額",
      grossAmount: "総額",
      targetLedger: "反映先",
      linkedRecordId: "紐づけID",
      confidence: "読取確度",
      extractedText: "読み取ったテキスト",
      numericMemo: "数字メモ",
      issueMemo: "未確認・確認依頼",
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
      expenseEligibility: "経費適格",
      expenseEligibilityReason: "判定理由",
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
