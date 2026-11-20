import {
  BankAccount,
  CheckNoteRecord,
  EmployeeCard,
  EquipmentRecord,
  ErpNotification,
  ErpProject,
  ExpenseRecord,
  GanttTask,
  GuaranteeLetter,
  InvoiceRecord,
  PaymentRecord,
  ProgressPayment,
  ProjectBudget,
  PurchaseOrder,
  SiteLogRecord,
  StockItem,
  SubcontractorCard,
  SupplierQuote,
  TimesheetEntry,
  WarehouseRecord,
  WorkItem,
} from '../types/erp';

export interface ProjectFinancialMetrics {
  projectId: string;
  currentContractValueKurus: number; // Güncel sözleşme değeri
  budgetTargetKurus: number;
  materialCostKurus: number;
  laborCostKurus: number;
  subcontractorCostKurus: number;
  machineCostKurus: number;
  transportCostKurus: number;
  siteOverheadKurus: number;
  allocatedCompanyOverheadKurus: number;
  financingCostKurus: number;
  deductibleVatKurus: number;
  totalActualCostKurus: number;
  unbilledCommitmentsKurus: number;
  estRemainingCostKurus: number;
  estTotalCostAtCompletionKurus: number;
  expectedFinalProfitKurus: number;
  expectedProfitMarginPct: number;
  billedProgressKurus: number; // Düzenlenen hakediş
  collectedProgressKurus: number; // Tahsil edilen hakediş
  pendingProgressKurus: number;
  periodRealizedPerformanceKurus: number; // Aktif dönemsel performans (Hakediş - Maliyet)
  budgetBurnPct: number;
  budgetAlertLevel: 'normal' | 'info' | 'warning' | 'critical' | 'overrun';
  burnDivergenceAlert: boolean;
}

export interface ExecutiveKpis {
  totalContractValueKurus: number;
  activeProjectsCount: number;
  completedProjectsCount: number;
  totalActualCostKurus: number;
  totalProgressBilledKurus: number;
  totalProgressCollectedKurus: number;
  pendingProgressReceivableKurus: number;
  supplierPayablesKurus: number;
  subcontractorPayablesKurus: number;
  employeePayablesKurus: number;
  totalVatNetKurus: number;
  totalCashBalanceKurus: number;
  expectedTotalProfitKurus: number;
  realizedTotalProfitKurus: number;
  averageProfitMarginPct: number;
  totalGuaranteePrincipalKurus: number;
  upcomingPaymentsKurus: number;
}

export interface ErpDatasetSnapshot {
  projects: ErpProject[];
  budgets: ProjectBudget[];
  purchases: PurchaseOrder[];
  invoices: InvoiceRecord[];
  progressPayments: ProgressPayment[];
  subcontractors: SubcontractorCard[];
  employees: EmployeeCard[];
  timesheets: TimesheetEntry[];
  expenses: ExpenseRecord[];
  payments: PaymentRecord[];
  bankAccounts: BankAccount[];
  checks: CheckNoteRecord[];
  guarantees: GuaranteeLetter[];
  stockItems: StockItem[];
  supplierQuotes: SupplierQuote[];
  workItems?: WorkItem[];
  siteLogs?: SiteLogRecord[];
  tasks?: GanttTask[];
  equipment?: EquipmentRecord[];
  warehouses?: WarehouseRecord[];
}

export function computeProjectFinancials(
  project: ErpProject,
  data: ErpDatasetSnapshot
): ProjectFinancialMetrics {
  const pid = project.id;

  const currentContractValueKurus =
    (project.contractAmountKurus || 0) +
    (project.approvedIncreaseKurus || 0) -
    (project.approvedDecreaseKurus || 0) +
    (project.priceDiffKurus || 0);

  const budgetDoc = data.budgets.find((b) => b.projectId === pid);
  const budgetTargetKurus = budgetDoc?.totalBudgetKurus || 0;

  // Expenses directly posted or allocated to this project (excluding deductible VAT!)
  const projExpenses = data.expenses.filter((e) => e.projectId === pid && !e.reversalOfId);

  let materialCostKurus = 0;
  let laborCostKurus = 0;
  let subcontractorCostKurus = 0;
  let machineCostKurus = 0;
  let transportCostKurus = 0;
  let siteOverheadKurus = 0;
  let allocatedCompanyOverheadKurus = 0;
  let financingCostKurus = 0;
  let deductibleVatKurus = 0;

  for (const exp of projExpenses) {
    const costPortion = exp.deductibleVat ? exp.netKurus : exp.grossKurus;
    if (exp.deductibleVat) deductibleVatKurus += exp.vatKurus;

    const sub = exp.categorySub.toLocaleLowerCase('tr-TR');
    const grp = exp.categoryGroup.toLocaleLowerCase('tr-TR');

    if (exp.sourceType === 'subcontractor' || sub === 'taşeron') {
      subcontractorCostKurus += costPortion;
    } else if (exp.sourceType === 'payroll' || sub === 'işçilik' || sub === 'sgk') {
      laborCostKurus += costPortion;
    } else if (sub === 'nakliye') {
      transportCostKurus += costPortion;
    } else if (sub === 'iş makinesi' || sub === 'vinç' || sub === 'araç kiralama') {
      machineCostKurus += costPortion;
    } else if (
      exp.sourceType === 'guarantee_commission' ||
      sub === 'banka komisyonları' ||
      sub === 'kredi faizleri' ||
      sub === 'teminat komisyonları'
    ) {
      financingCostKurus += costPortion;
    } else if (sub === 'ofis giderleri') {
      allocatedCompanyOverheadKurus += costPortion;
    } else if (
      grp.includes('inşaat') ||
      grp.includes('mekanik') ||
      grp.includes('elektrik')
    ) {
      materialCostKurus += costPortion;
    } else {
      siteOverheadKurus += costPortion;
    }
  }

  // Add payroll timesheet costs for this project that haven't been posted as ExpenseRecord yet
  const postedPayrollIds = new Set(
    projExpenses.filter((e) => e.sourceType === 'payroll' && e.sourceId).map((e) => e.sourceId!)
  );
  for (const ts of data.timesheets) {
    if (ts.projectId === pid && !postedPayrollIds.has(ts.id)) {
      laborCostKurus += ts.employerCostKurus || 0;
    }
  }

  // Add guarantee letter commissions (NEVER principal!) for this project if not yet posted
  const postedGuaranteeIds = new Set(
    projExpenses
      .filter((e) => e.sourceType === 'guarantee_commission' && e.sourceId)
      .map((e) => e.sourceId!)
  );
  for (const g of data.guarantees) {
    if (g.projectId === pid && !postedGuaranteeIds.has(g.id)) {
      financingCostKurus += g.commissionExpenseKurus || 0;
    }
  }

  const totalActualCostKurus =
    materialCostKurus +
    laborCostKurus +
    subcontractorCostKurus +
    machineCostKurus +
    transportCostKurus +
    siteOverheadKurus +
    allocatedCompanyOverheadKurus +
    financingCostKurus;

  // Unbilled commitments: approved/ordered purchases for this project without invoice
  const unbilledCommitmentsKurus = data.purchases
    .filter(
      (p) =>
        p.projectId === pid &&
        !p.invoiceNo &&
        p.status !== 'İptal Edildi' &&
        p.status !== 'Talep Oluşturuldu'
    )
    .reduce((s, p) => s + p.netTotalKurus, 0);

  const estRemainingCostKurus = project.estimatedRemainingCostKurus || 0;
  const estTotalCostAtCompletionKurus =
    totalActualCostKurus + unbilledCommitmentsKurus + estRemainingCostKurus;

  const expectedFinalProfitKurus =
    currentContractValueKurus - estTotalCostAtCompletionKurus;
  const expectedProfitMarginPct =
    currentContractValueKurus > 0
      ? Number(((expectedFinalProfitKurus / currentContractValueKurus) * 100).toFixed(2))
      : 0;

  // Hakediş stats
  const projHakedisler = data.progressPayments.filter((h) => h.projectId === pid);
  const billedProgressKurus = projHakedisler.reduce((s, h) => s + (h.netPayableKurus || 0), 0);
  const collectedProgressKurus = projHakedisler.reduce((s, h) => s + (h.collectedKurus || 0), 0);
  const pendingProgressKurus = Math.max(0, billedProgressKurus - collectedProgressKurus);

  const periodRealizedPerformanceKurus = billedProgressKurus - totalActualCostKurus;

  const budgetBurnPct =
    budgetTargetKurus > 0
      ? Number(((totalActualCostKurus / budgetTargetKurus) * 100).toFixed(1))
      : 0;

  const thr = project.warnThresholds || {
    infoPct: 70,
    warningPct: 85,
    criticalPct: 95,
    overrunPct: 100,
    burnDivergencePct: 15,
  };

  let budgetAlertLevel: ProjectFinancialMetrics['budgetAlertLevel'] = 'normal';
  if (budgetTargetKurus > 0) {
    if (budgetBurnPct > thr.overrunPct) budgetAlertLevel = 'overrun';
    else if (budgetBurnPct >= thr.criticalPct) budgetAlertLevel = 'critical';
    else if (budgetBurnPct >= thr.warningPct) budgetAlertLevel = 'warning';
    else if (budgetBurnPct >= thr.infoPct) budgetAlertLevel = 'info';
  }

  const burnDivergenceAlert =
    budgetTargetKurus > 0 &&
    budgetBurnPct - (project.physicalProgressPct || 0) >= (thr.burnDivergencePct || 15);

  return {
    projectId: pid,
    currentContractValueKurus,
    budgetTargetKurus,
    materialCostKurus,
    laborCostKurus,
    subcontractorCostKurus,
    machineCostKurus,
    transportCostKurus,
    siteOverheadKurus,
    allocatedCompanyOverheadKurus,
    financingCostKurus,
    deductibleVatKurus,
    totalActualCostKurus,
    unbilledCommitmentsKurus,
    estRemainingCostKurus,
    estTotalCostAtCompletionKurus,
    expectedFinalProfitKurus,
    expectedProfitMarginPct,
    billedProgressKurus,
    collectedProgressKurus,
    pendingProgressKurus,
    periodRealizedPerformanceKurus,
    budgetBurnPct,
    budgetAlertLevel,
    burnDivergenceAlert,
  };
}

export function computeExecutiveKpis(data: ErpDatasetSnapshot): ExecutiveKpis {
  const projectMetrics = data.projects.map((p) => computeProjectFinancials(p, data));

  const totalContractValueKurus = projectMetrics.reduce(
    (s, m) => s + m.currentContractValueKurus,
    0
  );
  const completedStatuses = new Set(['Tamamlandı', 'Kesin Kabul', 'Tasfiye Edildi']);
  const completedProjectsCount = data.projects.filter((p) => completedStatuses.has(p.status)).length;
  const activeProjectsCount = data.projects.length - completedProjectsCount;

  const totalActualCostKurus = projectMetrics.reduce((s, m) => s + m.totalActualCostKurus, 0);
  const totalProgressBilledKurus = projectMetrics.reduce((s, m) => s + m.billedProgressKurus, 0);
  const totalProgressCollectedKurus = projectMetrics.reduce(
    (s, m) => s + m.collectedProgressKurus,
    0
  );
  const pendingProgressReceivableKurus = Math.max(
    0,
    totalProgressBilledKurus - totalProgressCollectedKurus
  );

  // Supplier payables strictly from Invoices (remainingDebtKurus)
  const supplierPayablesKurus = data.invoices
    .filter((i) => !i.reversalOfId)
    .reduce((s, i) => s + Math.max(0, i.remainingDebtKurus || 0), 0);

  const subcontractorPayablesKurus = data.subcontractors.reduce(
    (s, sc) => s + Math.max(0, sc.remainingDebtKurus || 0),
    0
  );

  const employeePayablesKurus = data.timesheets.reduce(
    (s, t) => s + Math.max(0, (t.employerCostKurus || 0) - (t.paidWageKurus || 0) - (t.advanceKurus || 0)),
    0
  );

  // Net VAT = Output VAT (Hakediş KDV) - Deductible Input VAT (Fatura KDV)
  const outputVat = data.progressPayments.reduce((s, h) => s + (h.vatAmountKurus || 0), 0);
  const inputVat = data.invoices
    .filter((i) => !i.reversalOfId && i.deductibleVat)
    .reduce((s, i) => s + (i.vatTotalKurus || 0), 0);
  const totalVatNetKurus = outputVat - inputVat;

  const totalCashBalanceKurus = data.bankAccounts.reduce((s, b) => s + (b.balanceKurus || 0), 0);
  const expectedTotalProfitKurus = projectMetrics.reduce(
    (s, m) => s + m.expectedFinalProfitKurus,
    0
  );
  const realizedTotalProfitKurus = totalProgressBilledKurus - totalActualCostKurus;
  const averageProfitMarginPct =
    totalContractValueKurus > 0
      ? Number(((expectedTotalProfitKurus / totalContractValueKurus) * 100).toFixed(2))
      : 0;

  const totalGuaranteePrincipalKurus = data.guarantees
    .filter((g) => !g.returned)
    .reduce((s, g) => s + (g.principalAmountKurus || 0), 0);

  const now = Date.now();
  const in14Days = now + 14 * 86400_000;
  const upcomingInvoices = data.invoices
    .filter((i) => i.remainingDebtKurus > 0 && i.dueDate)
    .filter((i) => new Date(i.dueDate).getTime() <= in14Days)
    .reduce((s, i) => s + i.remainingDebtKurus, 0);
  const upcomingChecks = data.checks
    .filter((c) => c.direction === 'Verilen' && c.status === 'Portföyde' && c.dueDate)
    .filter((c) => new Date(c.dueDate).getTime() <= in14Days)
    .reduce((s, c) => s + c.amountKurus, 0);

  return {
    totalContractValueKurus,
    activeProjectsCount,
    completedProjectsCount,
    totalActualCostKurus,
    totalProgressBilledKurus,
    totalProgressCollectedKurus,
    pendingProgressReceivableKurus,
    supplierPayablesKurus,
    subcontractorPayablesKurus,
    employeePayablesKurus,
    totalVatNetKurus,
    totalCashBalanceKurus,
    expectedTotalProfitKurus,
    realizedTotalProfitKurus,
    averageProfitMarginPct,
    totalGuaranteePrincipalKurus,
    upcomingPaymentsKurus: upcomingInvoices + upcomingChecks,
  };
}

export function calculateProgressPayment(input: {
  previousTotalKurus: number;
  currentWorkKurus: number;
  priceDiffKurus: number;
  vatRate: number;
  vatWithholdingRate: number; // e.g., 40 means 4/10 (40%) of VAT withheld
  advanceDeductionRate: number;
  retentionRate: number;
  taxDeductionKurus: number;
  sgkDeductionKurus: number;
  penaltyDeductionKurus: number;
  otherDeductionKurus: number;
  collectedKurus: number;
}) {
  const cumulativeWorkKurus = (input.previousTotalKurus || 0) + (input.currentWorkKurus || 0);
  const grossAmountKurus = (input.currentWorkKurus || 0) + (input.priceDiffKurus || 0);
  const vatAmountKurus = Math.round((grossAmountKurus * (input.vatRate || 0)) / 100);
  const vatWithholdingKurus = Math.round(
    (vatAmountKurus * (input.vatWithholdingRate || 0)) / 100
  );
  const advanceDeductionKurus = Math.round(
    (grossAmountKurus * (input.advanceDeductionRate || 0)) / 100
  );
  const retentionKurus = Math.round((grossAmountKurus * (input.retentionRate || 0)) / 100);

  const totalWithDeductions =
    grossAmountKurus +
    vatAmountKurus -
    vatWithholdingKurus -
    advanceDeductionKurus -
    retentionKurus -
    (input.taxDeductionKurus || 0) -
    (input.sgkDeductionKurus || 0) -
    (input.penaltyDeductionKurus || 0) -
    (input.otherDeductionKurus || 0);

  const netPayableKurus = Math.max(0, totalWithDeductions);
  const remainingReceivableKurus = Math.max(0, netPayableKurus - (input.collectedKurus || 0));

  return {
    cumulativeWorkKurus,
    grossAmountKurus,
    vatAmountKurus,
    vatWithholdingKurus,
    advanceDeductionKurus,
    retentionKurus,
    netPayableKurus,
    remainingReceivableKurus,
  };
}

export function computeErpNotifications(data: ErpDatasetSnapshot): ErpNotification[] {
  const alerts: ErpNotification[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 1. Guarantee Expiry (30, 15, 7, 1 days)
  for (const g of data.guarantees) {
    if (g.returned || !g.endDate) continue;
    const end = new Date(g.endDate);
    const diffDays = Math.ceil((end.getTime() - today.getTime()) / 86400_000);
    if (diffDays <= 30) {
      alerts.push({
        id: `n-guar-${g.id}`,
        severity: diffDays <= 7 ? 'critical' : 'warning',
        category: 'Teminat Süresi',
        title: `${g.type} (${g.letterNo}) Süresi Yaklaşıyor`,
        description:
          diffDays < 0
            ? `${Math.abs(diffDays)} gün önce süresi doldu (${g.bankName}).`
            : `${diffDays} gün içinde vadesi doluyor (${g.bankName}).`,
        projectId: g.projectId,
        targetMenu: 'guarantees',
        dueDate: g.endDate,
      });
    }
  }

  // 2. Overdue & Upcoming Invoices (<= 7 days)
  for (const inv of data.invoices) {
    if (inv.remainingDebtKurus <= 0 || !inv.dueDate) continue;
    const due = new Date(inv.dueDate);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86400_000);
    if (diffDays <= 7) {
      alerts.push({
        id: `n-inv-${inv.id}`,
        severity: diffDays < 0 ? 'critical' : 'warning',
        category: diffDays < 0 ? 'Gecikmiş Tedarikçi Borcu' : 'Yaklaşan Fatura Ödemesi',
        title: `${inv.supplierName} — Fatura #${inv.invoiceNo}`,
        description:
          diffDays < 0
            ? `Vadesi ${Math.abs(diffDays)} gün geçti.`
            : `Vadesine ${diffDays} gün kaldı.`,
        projectId: inv.projectId,
        targetMenu: 'invoices',
        dueDate: inv.dueDate,
      });
    }
  }

  // 3. Budget Early Warning & Burn Divergence
  for (const prj of data.projects) {
    const m = computeProjectFinancials(prj, data);
    if (m.budgetAlertLevel !== 'normal') {
      alerts.push({
        id: `n-bdg-${prj.id}`,
        severity:
          m.budgetAlertLevel === 'overrun' || m.budgetAlertLevel === 'critical'
            ? 'critical'
            : m.budgetAlertLevel === 'warning'
              ? 'warning'
              : 'info',
        category: 'Bütçe Kontrolü',
        title: `${prj.shortName} — Bütçe Tüketimi %${m.budgetBurnPct}`,
        description:
          m.budgetAlertLevel === 'overrun'
            ? 'Gerçekleşen maliyet hedef bütçeyi aştı!'
            : `Hedef bütçenin %${m.budgetBurnPct} seviyesine ulaşıldı.`,
        projectId: prj.id,
        targetMenu: 'projects',
      });
    }
    if (m.burnDivergenceAlert) {
      alerts.push({
        id: `n-div-${prj.id}`,
        severity: 'critical',
        category: 'İlerleme / Bütçe Sapması',
        title: `${prj.shortName} — Erken Maliyet Riski`,
        description: `Fiziki ilerleme %${prj.physicalProgressPct} iken bütçenin %${m.budgetBurnPct} kısmı kullanıldı.`,
        projectId: prj.id,
        targetMenu: 'projects',
      });
    }
  }

  // 4. Low Stock Alerts
  for (const st of data.stockItems) {
    if (st.minStockLevel > 0 && st.quantity <= st.minStockLevel) {
      alerts.push({
        id: `n-stk-${st.id}`,
        severity: st.quantity === 0 ? 'critical' : 'warning',
        category: 'Düşük Stok',
        title: `${st.name} (${st.quantity} ${st.unit})`,
        description: `Minimum stok seviyesi (${st.minStockLevel} ${st.unit}) altına düştü.`,
        targetMenu: 'warehouse',
      });
    }
  }

  // 5. Pending Progress Payments
  for (const hk of data.progressPayments) {
    if (hk.remainingReceivableKurus > 0 && hk.status !== 'Taslak') {
      alerts.push({
        id: `n-hk-${hk.id}`,
        severity: 'info',
        category: 'Bekleyen Hakediş',
        title: `Hakediş #${hk.hakedisNo} (${hk.period})`,
        description: `Tahsilat bekleyen bakiye mevcut (${hk.status}).`,
        projectId: hk.projectId,
        targetMenu: 'progressPayments',
        dueDate: hk.expectedPaymentDate,
      });
    }
  }

  return alerts;
}
