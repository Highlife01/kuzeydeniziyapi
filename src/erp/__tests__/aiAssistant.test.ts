import { describe, expect, it } from 'vitest';
import { askErpAssistant } from '../services/aiAssistantEngine';
import { ErpDatasetSnapshot } from '../services/financeEngine';
import { hydrateLegacyProjectToErp } from '../services/erpStore';
import { toKurus } from '../utils/money';

describe('AI Read-Only Financial Assistant', () => {
  const project = hydrateLegacyProjectToErp(
    {
      id: 'prj-adliye',
      code: 'CB-01',
      title: 'Adana Adliyesi Çatı Yenileme',
      shortName: 'Adana Adliyesi Çatı',
      contractAmountKurus: toKurus(2_000_000),
      status: 'Devam Ediyor',
    },
    'info@kuzeydeniziyapi.com.tr'
  );

  const emptySnapshot: ErpDatasetSnapshot = {
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

  it('answers project cost & profit queries strictly from live data without inventing numbers', async () => {
    const reply = await askErpAssistant('Adana Adliyesi projesine bugüne kadar ne kadar harcadık, beklenen kâr marjı nedir?', emptySnapshot);
    expect(reply.usedBackendAi).toBe(false);
    expect(reply.answer).toContain('Adana Adliyesi Çatı Yenileme');
    expect(reply.answer).toContain('0,00');
    expect(reply.readOnlyWarning.toLowerCase()).toContain('canlı');
  });

  it('reports zero supplier debt cleanly when no invoices exist', async () => {
    const reply = await askErpAssistant('Tedarikçilere toplam borcumuz nedir?', emptySnapshot);
    expect(reply.answer).toContain('0,00 TL');
  });
});
