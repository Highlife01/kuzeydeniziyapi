import { describe, expect, it } from 'vitest';
import {
  ErpDatasetSnapshot,
  calculateProgressPayment,
  computeErpNotifications,
  computeExecutiveKpis,
  computeProjectFinancials,
} from '../services/financeEngine';
import { hydrateLegacyProjectToErp } from '../services/erpStore';
import { toKurus } from '../utils/money';
import { ExpenseRecord, GuaranteeLetter, InvoiceRecord, ProgressPayment, ProjectBudget } from '../types/erp';

function createEmptySnapshot(): ErpDatasetSnapshot {
  return {
    projects: [],
    budgets: [],
    purchases: [],
    invoices: [],
    progressPayments: [],
    subcontractors: [],
    employees: [],
    timesheets: [],
    expenses: [],
    payments: [],
    bankAccounts: [],
    checks: [],
    guarantees: [],
    stockItems: [],
    supplierQuotes: [],
  };
}

describe('financeEngine (Hakediş, Project P&L, Guarantees & Budget Warnings)', () => {
  it('computes Hakediş net payable with VAT withholding (tevkifat), advance, retention, tax & SGK deductions', () => {
    const hk = calculateProgressPayment({
      previousTotalKurus: toKurus(500_000),
      currentWorkKurus: toKurus(1_000_000),
      priceDiffKurus: toKurus(100_000),
      vatRate: 20,
      vatWithholdingRate: 40, // 4/10 KDV tevkifatı
      advanceDeductionRate: 10,
      retentionRate: 5,
      taxDeductionKurus: toKurus(9_480), // Damga vergisi vb.
      sgkDeductionKurus: toKurus(15_000),
      penaltyDeductionKurus: 0,
      otherDeductionKurus: 0,
      collectedKurus: toKurus(500_000),
    });

    // gross = 1,100,000 TL; vat = 220,000 TL; withholding = 88,000 TL
    // advance = 110,000 TL; retention = 55,000 TL; tax+sgk = 24,480 TL
    // netPayable = 1,100,000 + 220,000 - 88,000 - 110,000 - 55,000 - 24,480 = 1,042,520 TL
    expect(hk.cumulativeWorkKurus).toBe(toKurus(1_500_000));
    expect(hk.grossAmountKurus).toBe(toKurus(1_100_000));
    expect(hk.vatAmountKurus).toBe(toKurus(220_000));
    expect(hk.vatWithholdingKurus).toBe(toKurus(88_000));
    expect(hk.netPayableKurus).toBe(toKurus(1_042_520));
    expect(hk.remainingReceivableKurus).toBe(toKurus(542_520));
  });

  it('separates deductible VAT from project P&L cost and excludes guarantee letter principal from expenses', () => {
    const prj = hydrateLegacyProjectToErp(
      {
        id: 'prj-adliye',
        code: 'CB-01',
        title: 'Adana Adliyesi Çatı Yenileme',
        contractAmountKurus: toKurus(5_000_000),
        approvedIncreaseKurus: toKurus(500_000),
        priceDiffKurus: toKurus(250_000),
        physicalProgressPct: 40,
        status: 'Devam Ediyor',
      },
      'info@kuzeydeniziyapi.com.tr'
    );

    const budget: ProjectBudget = {
      id: 'bdg-1',
      organizationId: 'kuzeydenizi',
      projectId: prj.id,
      constructionKurus: toKurus(1_000_000),
      mechanicalKurus: 0,
      electricalKurus: 0,
      laborKurus: 0,
      subcontractorKurus: 0,
      generalKurus: 0,
      totalBudgetKurus: toKurus(1_000_000),
      notes: '',
      createdBy: 'test',
      createdAt: '2026-01-01',
      updatedBy: 'test',
      updatedAt: '2026-01-01',
    };

    const materialExpense: ExpenseRecord = {
      id: 'exp-1',
      organizationId: 'kuzeydenizi',
      projectId: prj.id,
      categoryGroup: 'İnşaat ve Yapı Malzemeleri',
      categorySub: 'Çatı malzemeleri',
      description: 'Kenet sac',
      date: '2026-05-01',
      netKurus: toKurus(900_000),
      vatRate: 20,
      vatKurus: toKurus(180_000),
      grossKurus: toKurus(1_080_000),
      deductibleVat: true,
      sourceType: 'invoice',
      locked: true,
      createdBy: 'test',
      createdAt: '2026-05-01',
      updatedBy: 'test',
      updatedAt: '2026-05-01',
    };

    // Reversal entry must NOT inflate project cost
    const reversalExp: ExpenseRecord = {
      ...materialExpense,
      id: 'exp-rev',
      reversalOfId: 'exp-1',
      netKurus: -toKurus(100_000),
    };

    // Guarantee: 600,000 TL principal MUST NOT count as expense, ONLY 6,000 TL commission counts!
    const soonDate = new Date(Date.now() + 5 * 86400_000).toISOString().slice(0, 10);
    const guarantee: GuaranteeLetter = {
      id: 'guar-1',
      organizationId: 'kuzeydenizi',
      projectId: prj.id,
      type: 'Kesin Teminat',
      bankName: 'Halkbank',
      letterNo: 'TM-2026-01',
      principalAmountKurus: toKurus(600_000),
      commissionRatePct: 1,
      commissionExpenseKurus: toKurus(6_000),
      startDate: '2026-01-01',
      endDate: soonDate,
      returned: false,
      notes: '',
      createdBy: 'test',
      createdAt: '2026-01-01',
      updatedBy: 'test',
      updatedAt: '2026-01-01',
    };

    const invoice: InvoiceRecord = {
      id: 'inv-1',
      organizationId: 'kuzeydenizi',
      projectId: prj.id,
      supplierId: 'sup-1',
      supplierName: 'Adana Çatı A.Ş.',
      supplierTaxNo: '1234567890',
      supplierTaxOffice: 'Seyhan',
      invoiceNo: 'ADA2026000000001',
      waybillNo: '',
      ettn: '11111111-1111-1111-1111-111111111111',
      invoiceType: 'SATIŞ',
      issueDate: '2026-05-01',
      dueDate: soonDate,
      iban: '',
      paymentInfo: '',
      subtotalKurus: toKurus(900_000),
      discountTotalKurus: 0,
      vatTotalKurus: toKurus(180_000),
      withholdingKurus: 0,
      grandTotalKurus: toKurus(1_080_000),
      deductibleVat: true,
      paidKurus: toKurus(500_000),
      remainingDebtKurus: toKurus(580_000),
      items: [],
      allocations: [],
      attachments: [],
      sourceMode: 'manual',
      confirmedByUser: true,
      locked: true,
      notes: '',
      createdBy: 'test',
      createdAt: '2026-05-01',
      updatedBy: 'test',
      updatedAt: '2026-05-01',
    };

    const progressPayment: ProgressPayment = {
      id: 'hk-1',
      organizationId: 'kuzeydenizi',
      projectId: prj.id,
      hakedisNo: 1,
      period: '2026-05',
      issueDate: '2026-05-15',
      previousTotalKurus: 0,
      currentWorkKurus: toKurus(2_000_000),
      cumulativeWorkKurus: toKurus(2_000_000),
      grossAmountKurus: toKurus(2_000_000),
      priceDiffKurus: 0,
      vatRate: 20,
      vatAmountKurus: toKurus(400_000),
      vatWithholdingRate: 0,
      vatWithholdingKurus: 0,
      advanceDeductionRate: 0,
      advanceDeductionKurus: 0,
      retentionRate: 0,
      retentionKurus: 0,
      taxDeductionKurus: 0,
      sgkDeductionKurus: 0,
      penaltyDeductionKurus: 0,
      otherDeductionKurus: 0,
      netPayableKurus: toKurus(2_400_000),
      collectedKurus: toKurus(1_400_000),
      remainingReceivableKurus: toKurus(1_000_000),
      collectionDate: '',
      expectedPaymentDate: soonDate,
      status: 'Tahakkuk Etti',
      locked: true,
      attachments: [],
      notes: '',
      createdBy: 'test',
      createdAt: '2026-05-15',
      updatedBy: 'test',
      updatedAt: '2026-05-15',
    };

    const snap: ErpDatasetSnapshot = {
      ...createEmptySnapshot(),
      projects: [prj],
      budgets: [budget],
      expenses: [materialExpense, reversalExp],
      guarantees: [guarantee],
      invoices: [invoice],
      progressPayments: [progressPayment],
    };

    const financials = computeProjectFinancials(prj, snap);
    // Current contract value = 5,000,000 + 500,000 + 250,000 = 5,750,000 TL
    expect(financials.currentContractValueKurus).toBe(toKurus(5_750_000));
    // Material cost uses NET (900,000 TL) because deductibleVat=true
    expect(financials.materialCostKurus).toBe(toKurus(900_000));
    expect(financials.deductibleVatKurus).toBe(toKurus(180_000));
    // Financing cost uses ONLY 6,000 TL commission, NEVER 600,000 TL guarantee principal
    expect(financials.financingCostKurus).toBe(toKurus(6_000));
    expect(financials.totalActualCostKurus).toBe(toKurus(906_000));
    // Budget burn = 906,000 / 1,000,000 = 90.6% -> warning level (>= 85%)
    expect(financials.budgetBurnPct).toBe(90.6);
    expect(financials.budgetAlertLevel).toBe('warning');
    // Physical progress = 40%, budget burn = 90.6% -> diff 50.6 >= 15 -> burnDivergenceAlert!
    expect(financials.burnDivergenceAlert).toBe(true);

    const kpis = computeExecutiveKpis(snap);
    expect(kpis.totalGuaranteePrincipalKurus).toBe(toKurus(600_000));
    expect(kpis.supplierPayablesKurus).toBe(toKurus(580_000));
    expect(kpis.pendingProgressReceivableKurus).toBe(toKurus(1_000_000));
    // Net VAT = Output 400,000 - Input 180,000 = 220,000 TL
    expect(kpis.totalVatNetKurus).toBe(toKurus(220_000));

    const alerts = computeErpNotifications(snap);
    expect(alerts.some((a) => a.category === 'Teminat Süresi' && a.severity === 'critical')).toBe(true);
    expect(alerts.some((a) => a.category === 'İlerleme / Bütçe Sapması')).toBe(true);
  });
});
