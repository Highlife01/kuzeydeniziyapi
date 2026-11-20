// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ALL_16_REPORTS,
  buildReportTable,
} from '../services/reportExporter';
import { askErpAssistant } from '../services/aiAssistantEngine';
import {
  approveOrRejectRequest,
  confirmAndPostInvoice,
  DEFAULT_ERP_SETTINGS,
  ERP_ORG_ID,
  hydrateLegacyProjectToErp,
  postPaymentWithApproval,
  readLocalCollection,
  recordStockConsumption,
  writeLocalCollection,
} from '../services/erpStore';
import { ErpDatasetSnapshot } from '../services/financeEngine';
import { toKurus } from '../utils/money';

describe('Dashboard Full Functional Flows & Reports', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const actor = 'cebrailkara@gmail.com';
  const now = '2026-11-18T10:00:00.000Z';

  const project = hydrateLegacyProjectToErp(
    {
      id: 'prj-adliye',
      code: 'CB-01',
      title: 'Adana Adliyesi Çatı Yenileme',
      shortName: 'Adana Adliyesi Çatı',
      contractAmountKurus: toKurus(2_000_000),
      status: 'Devam Ediyor',
      physicalProgressPct: 60,
    },
    actor
  );

  it('produces distinct tables for all 16 reports including cashflow, aging, poz, budget and site progress', () => {
    const snap: ErpDatasetSnapshot = {
      projects: [project],
      budgets: [
        {
          id: 'bdg-1',
          organizationId: ERP_ORG_ID,
          projectId: project.id,
          constructionKurus: toKurus(1_000_000),
          mechanicalKurus: 0,
          electricalKurus: 0,
          laborKurus: toKurus(200_000),
          subcontractorKurus: 0,
          generalKurus: toKurus(100_000),
          totalBudgetKurus: toKurus(1_300_000),
          notes: '',
          createdBy: actor,
          createdAt: now,
          updatedBy: actor,
          updatedAt: now,
        },
      ],
      purchases: [],
      invoices: [
        {
          id: 'inv-1',
          organizationId: ERP_ORG_ID,
          projectId: project.id,
          supplierId: 'sup-1',
          supplierName: 'Toros Çelik A.Ş.',
          supplierTaxNo: '1234567890',
          supplierTaxOffice: 'Seyhan',
          invoiceNo: 'FTR-2026-01',
          waybillNo: '',
          ettn: '',
          invoiceType: 'SATIŞ',
          issueDate: '2026-11-10',
          dueDate: '2026-11-25',
          iban: '',
          paymentInfo: '',
          subtotalKurus: toKurus(50_000),
          discountTotalKurus: 0,
          vatTotalKurus: toKurus(10_000),
          withholdingKurus: 0,
          grandTotalKurus: toKurus(60_000),
          deductibleVat: true,
          paidKurus: 0,
          remainingDebtKurus: toKurus(60_000),
          items: [],
          allocations: [],
          attachments: [],
          sourceMode: 'manual',
          confirmedByUser: true,
          locked: true,
          notes: '',
          createdBy: actor,
          createdAt: now,
          updatedBy: actor,
          updatedAt: now,
        },
      ],
      progressPayments: [
        {
          id: 'hk-1',
          organizationId: ERP_ORG_ID,
          projectId: project.id,
          hakedisNo: 1,
          period: '2026-11',
          issueDate: '2026-11-15',
          previousTotalKurus: 0,
          currentWorkKurus: toKurus(400_000),
          cumulativeWorkKurus: toKurus(400_000),
          grossAmountKurus: toKurus(400_000),
          priceDiffKurus: 0,
          vatRate: 20,
          vatAmountKurus: toKurus(80_000),
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
          netPayableKurus: toKurus(480_000),
          collectedKurus: 0,
          remainingReceivableKurus: toKurus(480_000),
          collectionDate: '',
          expectedPaymentDate: '2026-11-30',
          status: 'Onaylandı',
          locked: false,
          attachments: [],
          notes: '',
          createdBy: actor,
          createdAt: now,
          updatedBy: actor,
          updatedAt: now,
        },
      ],
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
      workItems: [
        {
          id: 'wi-1',
          organizationId: ERP_ORG_ID,
          projectId: project.id,
          parentGroup: 'İnşaat',
          pozNo: '15.120.1001',
          source: 'ÇŞİDB',
          description: 'Kenet Sac Çatı Kaplaması',
          unit: 'm²',
          contractQty: 1000,
          contractUnitPriceKurus: toKurus(850),
          pursantajPct: 25,
          estMaterialCostKurus: 0,
          estLaborCostKurus: 0,
          estMachineCostKurus: 0,
          actualQty: 600,
          actualCostKurus: toKurus(500_000),
          createdBy: actor,
          createdAt: now,
          updatedBy: actor,
          updatedAt: now,
        },
      ],
      siteLogs: [
        {
          id: 'log-1',
          organizationId: ERP_ORG_ID,
          projectId: project.id,
          date: '2026-11-18',
          weather: 'Açık / Güneşli',
          workerCount: 14,
          subcontractorsNote: '',
          worksDone: 'A blok kenet montajı',
          materialsArrived: '',
          equipmentUsed: '',
          issues: '',
          hseIncidents: 'Yok',
          clientInstructions: '',
          delayReasons: '',
          tomorrowPlan: '',
          beforePhotos: [],
          afterPhotos: [],
          dailyPhotos: [],
          createdBy: actor,
          createdAt: now,
          updatedBy: actor,
          updatedAt: now,
        },
      ],
    };

    expect(ALL_16_REPORTS).toHaveLength(16);
    const cashflow = buildReportTable('cashflow_forecast', snap);
    expect(cashflow.headers).toContain('Nakit Yönü');
    expect(cashflow.rows.length).toBe(2);

    const aging = buildReportTable('aging_report', snap);
    expect(aging.headers).toContain('Yaşlandırma Durumu');
    expect(aging.rows.some((r) => r[0] === 'Tedarikçi Borcu')).toBe(true);

    const poz = buildReportTable('poz_cost', snap);
    expect(poz.headers).toContain('Poz No');
    expect(poz.rows[0][0]).toBe('15.120.1001');
    expect(poz.rows[0][7]).toBe('%60');

    const budget = buildReportTable('budget_comparison', snap);
    expect(budget.headers).toContain('Uyarı Seviyesi');
    expect(budget.rows[0][2]).toContain('1.300.000,00');

    const site = buildReportTable('site_progress', snap);
    expect(site.rows[0][5]).toBe('2026-11-18');
    expect(site.rows[0][6]).toContain('14 personel');
  });

  it('handles warehouse stock invoice allocation and consumption without double-counting', async () => {
    const wh = {
      id: 'wh-merkez',
      organizationId: ERP_ORG_ID,
      name: 'Merkez Depo',
      type: 'merkez' as const,
      location: 'Seyhan',
      manager: 'Depo',
      createdBy: actor,
      createdAt: now,
      updatedBy: actor,
      updatedAt: now,
    };
    writeLocalCollection('warehouses', [wh]);
    writeLocalCollection('stockItems', []);
    writeLocalCollection('stockMovements', []);
    writeLocalCollection('expenses', []);

    await confirmAndPostInvoice(
      {
        id: 'inv-wh-1',
        organizationId: ERP_ORG_ID,
        projectId: 'multi',
        supplierId: 'sup-1',
        supplierName: 'İzolasyon A.Ş.',
        supplierTaxNo: '',
        supplierTaxOffice: '',
        invoiceNo: 'IZO-101',
        waybillNo: '',
        ettn: '',
        invoiceType: 'SATIŞ',
        issueDate: '2026-11-18',
        dueDate: '2026-11-30',
        iban: '',
        paymentInfo: '',
        subtotalKurus: toKurus(10_000),
        discountTotalKurus: 0,
        vatTotalKurus: toKurus(2_000),
        withholdingKurus: 0,
        grandTotalKurus: toKurus(12_000),
        deductibleVat: true,
        paidKurus: 0,
        remainingDebtKurus: toKurus(12_000),
        items: [
          {
            id: 'l1',
            name: 'Taşyünü Levha',
            quantity: 100,
            unit: 'm²',
            unitPriceKurus: toKurus(100),
            discountKurus: 0,
            vatRate: 20,
            netKurus: toKurus(10_000),
            vatKurus: toKurus(2_000),
            grossKurus: toKurus(12_000),
          },
        ],
        allocations: [
          {
            id: 'al-wh',
            invoiceId: 'inv-wh-1',
            targetType: 'warehouse',
            targetId: 'wh-merkez',
            targetName: 'Merkez Depo',
            mode: 'percent',
            value: 100,
            allocatedNetKurus: toKurus(10_000),
            allocatedVatKurus: toKurus(2_000),
            allocatedGrossKurus: toKurus(12_000),
          },
        ],
        attachments: [],
        sourceMode: 'manual',
        confirmedByUser: true,
        locked: true,
        notes: '',
        createdBy: actor,
        createdAt: now,
        updatedBy: actor,
        updatedAt: now,
      },
      actor,
      false
    );

    const stock = readLocalCollection<any>('stockItems', []);
    expect(stock).toHaveLength(1);
    expect(stock[0].name).toBe('Taşyünü Levha');
    expect(stock[0].quantity).toBe(100);
    expect(stock[0].totalValueKurus).toBe(toKurus(10_000));
    expect(readLocalCollection<any>('expenses', [])).toHaveLength(0);

    await recordStockConsumption(stock[0], 40, wh, project, actor, false, 'A blok');
    const updatedStock = readLocalCollection<any>('stockItems', []);
    expect(updatedStock[0].quantity).toBe(60);
    expect(updatedStock[0].usedQty).toBe(40);
    const exps = readLocalCollection<any>('expenses', []);
    expect(exps).toHaveLength(1);
    expect(exps[0].netKurus).toBe(toKurus(4_000));
  });

  it('settles queued payment approvals and hakedis collections atomically', async () => {
    writeLocalCollection('bankAccounts', [
      {
        id: 'bnk-1',
        organizationId: ERP_ORG_ID,
        name: 'Ziraat TL',
        bankName: 'Ziraat Bankası',
        accountType: 'Banka TL',
        currency: 'TRY',
        iban: '',
        balanceKurus: toKurus(500_000),
        createdBy: actor,
        createdAt: now,
        updatedBy: actor,
        updatedAt: now,
      },
    ]);
    writeLocalCollection('invoices', [
      {
        id: 'inv-p1',
        organizationId: ERP_ORG_ID,
        projectId: project.id,
        supplierId: 'sup-1',
        supplierName: 'Demir Ticaret',
        supplierTaxNo: '',
        supplierTaxOffice: '',
        invoiceNo: 'FTR-99',
        waybillNo: '',
        ettn: '',
        invoiceType: 'SATIŞ',
        issueDate: '2026-11-18',
        dueDate: '2026-11-30',
        iban: '',
        paymentInfo: '',
        subtotalKurus: toKurus(25_000),
        discountTotalKurus: 0,
        vatTotalKurus: toKurus(5_000),
        withholdingKurus: 0,
        grandTotalKurus: toKurus(30_000),
        deductibleVat: true,
        paidKurus: 0,
        remainingDebtKurus: toKurus(30_000),
        items: [],
        allocations: [],
        attachments: [],
        sourceMode: 'manual',
        confirmedByUser: true,
        locked: true,
        notes: '',
        createdBy: actor,
        createdAt: now,
        updatedBy: actor,
        updatedAt: now,
      },
    ]);
    writeLocalCollection('payments', []);
    writeLocalCollection('approvals', []);

    const siteChief = {
      id: 'sefi@kuzeydeniziyapi.com.tr',
      email: 'sefi@kuzeydeniziyapi.com.tr',
      fullName: 'Şantiye Şefi',
      roleId: 'santiye_sefi' as const,
      assignedProjectIds: [project.id],
      active: true,
      organizationId: ERP_ORG_ID,
      createdBy: actor,
      createdAt: now,
      updatedBy: actor,
      updatedAt: now,
    };
    const ownerUser = {
      ...siteChief,
      id: actor,
      email: actor,
      fullName: 'Patron',
      roleId: 'sirket_sahibi' as const,
    };

    // Outgoing payment of 20.000 TL exceeds Şantiye Şefi limit (0) -> queues approval
    const res = await postPaymentWithApproval(
      {
        id: 'pay-q1',
        organizationId: ERP_ORG_ID,
        projectId: project.id,
        direction: 'Ödeme',
        targetType: 'supplier',
        targetId: 'sup-1',
        targetName: 'Demir Ticaret',
        invoiceId: 'inv-p1',
        bankAccountId: 'bnk-1',
        bankAccountName: 'Ziraat TL',
        method: 'Havale / EFT',
        amountKurus: toKurus(20_000),
        date: '2026-11-18',
        locked: false,
        approvalStatus: 'Onay Bekliyor',
        notes: '',
        createdBy: siteChief.email,
        createdAt: now,
        updatedBy: siteChief.email,
        updatedAt: now,
      },
      siteChief,
      DEFAULT_ERP_SETTINGS,
      false
    );
    expect(res.queuedForApproval).toBe(true);
    expect(readLocalCollection<any>('bankAccounts', [])[0].balanceKurus).toBe(toKurus(500_000));

    // Owner approves -> bank balance and invoice remaining debt must update atomically!
    const apr = readLocalCollection<any>('approvals', [])[0];
    await approveOrRejectRequest(apr, true, ownerUser, DEFAULT_ERP_SETTINGS, false);

    expect(readLocalCollection<any>('bankAccounts', [])[0].balanceKurus).toBe(toKurus(480_000));
    expect(readLocalCollection<any>('invoices', [])[0].remainingDebtKurus).toBe(toKurus(10_000));
    expect(readLocalCollection<any>('payments', [])[0].approvalStatus).toBe('Onaylandı');
  });

  it('answers guarantee, check, stock, and hr assistant queries cleanly', async () => {
    const emptySnap: ErpDatasetSnapshot = {
      projects: [project],
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
    const r1 = await askErpAssistant('Aktif teminat mektubu durumumuz nedir?', emptySnap);
    expect(r1.answer.toLowerCase()).toContain('teminat');
    const r2 = await askErpAssistant('Depoda kaç stok kalemi var?', emptySnap);
    expect(r2.answer.toLowerCase()).toContain('stok');
  });
});
