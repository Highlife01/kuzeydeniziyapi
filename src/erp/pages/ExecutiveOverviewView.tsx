import React, { useMemo, useState } from 'react';
import { DEFAULT_EXPENSE_TAXONOMY } from '../data/expenseCategories';
import {
  computeExecutiveKpis,
  computeProjectFinancials,
  ErpDatasetSnapshot,
} from '../services/financeEngine';
import { ErpMenuSectionId, ErpProject } from '../types/erp';
import { formatKurusTRY } from '../utils/money';

interface ExecutiveOverviewViewProps {
  dataset: ErpDatasetSnapshot;
  canSeeProfitability: boolean;
  onNavigate: (menu: ErpMenuSectionId) => void;
  onOpenProject: (p: ErpProject) => void;
  onOpenInvoiceUpload: () => void;
  onQuickAction: (action: 'invoice' | 'expense' | 'stock' | 'payment' | 'sitelog' | 'timesheet') => void;
}

export const ExecutiveOverviewView: React.FC<ExecutiveOverviewViewProps> = ({
  dataset,
  canSeeProfitability,
  onNavigate,
  onOpenProject,
  onOpenInvoiceUpload,
  onQuickAction,
}) => {
  const [filterProj, setFilterProj] = useState('all');
  const [filterCity, setFilterCity] = useState('all');
  const [filterAuthority, setFilterAuthority] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filteredData: ErpDatasetSnapshot = useMemo(() => {
    const validProjects = dataset.projects.filter((p) => {
      if (filterProj !== 'all' && p.id !== filterProj) return false;
      if (filterCity !== 'all' && p.province !== filterCity) return false;
      if (filterAuthority !== 'all' && p.contractingAuthority !== filterAuthority) return false;
      return true;
    });
    const validIds = new Set(validProjects.map((p) => p.id));
    const inDateRange = (d?: string) => {
      if (!d) return true;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    };

    return {
      ...dataset,
      projects: validProjects,
      expenses: dataset.expenses.filter(
        (e) =>
          (filterProj === 'all' || validIds.has(e.projectId)) &&
          (filterCategory === 'all' || e.categoryGroup === filterCategory || e.categorySub === filterCategory) &&
          inDateRange(e.date)
      ),
      invoices: dataset.invoices.filter(
        (i) => (filterProj === 'all' || validIds.has(i.projectId)) && inDateRange(i.issueDate)
      ),
      progressPayments: dataset.progressPayments.filter(
        (h) => (filterProj === 'all' || validIds.has(h.projectId)) && inDateRange(h.issueDate)
      ),
      payments: dataset.payments.filter(
        (p) => (filterProj === 'all' || validIds.has(p.projectId)) && inDateRange(p.date)
      ),
    };
  }, [dataset, filterProj, filterCity, filterAuthority, filterCategory, dateFrom, dateTo]);

  const kpis = useMemo(() => computeExecutiveKpis(filteredData), [filteredData]);
  const cities = Array.from(new Set(dataset.projects.map((p) => p.province).filter(Boolean)));
  const authorities = Array.from(
    new Set(dataset.projects.map((p) => p.contractingAuthority).filter(Boolean))
  );

  // Monthly Income vs Expense Aggregation (real records only)
  const monthlySeries = useMemo(() => {
    const map: Record<string, { incomeKurus: number; expenseKurus: number }> = {};
    for (const h of filteredData.progressPayments) {
      const m = (h.issueDate || '').slice(0, 7);
      if (!m) continue;
      map[m] = map[m] || { incomeKurus: 0, expenseKurus: 0 };
      map[m].incomeKurus += h.netPayableKurus || 0;
    }
    for (const e of filteredData.expenses) {
      if (e.reversalOfId) continue;
      const m = (e.date || '').slice(0, 7);
      if (!m) continue;
      map[m] = map[m] || { incomeKurus: 0, expenseKurus: 0 };
      map[m].expenseKurus += e.netKurus || 0;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6);
  }, [filteredData]);

  // Cost distribution by group
  const costDistribution = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const e of filteredData.expenses) {
      if (e.reversalOfId) continue;
      groups[e.categoryGroup] = (groups[e.categoryGroup] || 0) + e.netKurus;
    }
    return Object.entries(groups).sort((a, b) => b[1] - a[1]);
  }, [filteredData.expenses]);

  const maxMonthlyVal = Math.max(
    1,
    ...monthlySeries.flatMap(([, v]) => [v.incomeKurus, v.expenseKurus])
  );

  const kpiCards: { label: string; value: string; color: string; menu: ErpMenuSectionId; hideForField?: boolean }[] = [
    { label: 'Toplam Sözleşme Bedeli', value: formatKurusTRY(kpis.totalContractValueKurus), color: 'text-white', menu: 'projects' },
    { label: 'Aktif Proje Sayısı', value: String(kpis.activeProjectsCount), color: 'text-blue-400', menu: 'projects' },
    { label: 'Tamamlanan Proje Sayısı', value: String(kpis.completedProjectsCount), color: 'text-emerald-400', menu: 'projects' },
    { label: 'Toplam Gerçekleşen Maliyet', value: formatKurusTRY(kpis.totalActualCostKurus), color: 'text-rose-400', menu: 'expenses' },
    { label: 'Toplam Düzenlenen Hakediş', value: formatKurusTRY(kpis.totalProgressBilledKurus), color: 'text-blue-300', menu: 'progressPayments' },
    { label: 'Toplam Tahsil Edilen Hakediş', value: formatKurusTRY(kpis.totalProgressCollectedKurus), color: 'text-emerald-400', menu: 'progressPayments' },
    { label: 'Bekleyen Hakediş Alacakları', value: formatKurusTRY(kpis.pendingProgressReceivableKurus), color: 'text-amber-400', menu: 'progressPayments' },
    { label: 'Tedarikçi Borçları', value: formatKurusTRY(kpis.supplierPayablesKurus), color: 'text-rose-400', menu: 'suppliers' },
    { label: 'Taşeron Borçları', value: formatKurusTRY(kpis.subcontractorPayablesKurus), color: 'text-rose-400', menu: 'subcontractors' },
    { label: 'Personel Borçları', value: formatKurusTRY(kpis.employeePayablesKurus), color: 'text-amber-300', menu: 'hr' },
    { label: 'Toplam KDV Pozisyonu', value: formatKurusTRY(kpis.totalVatNetKurus), color: 'text-sky-400', menu: 'reports' },
    { label: 'Toplam Nakit Mevcudu', value: formatKurusTRY(kpis.totalCashBalanceKurus), color: 'text-emerald-400', menu: 'bankCash' },
    { label: 'Beklenen Proje Kârı', value: formatKurusTRY(kpis.expectedTotalProfitKurus), color: kpis.expectedTotalProfitKurus >= 0 ? 'text-emerald-400' : 'text-rose-400', menu: 'projects', hideForField: true },
    { label: 'Gerçekleşen Proje Kârı', value: formatKurusTRY(kpis.realizedTotalProfitKurus), color: kpis.realizedTotalProfitKurus >= 0 ? 'text-emerald-400' : 'text-rose-400', menu: 'projects', hideForField: true },
    { label: 'Ortalama Kâr Marjı', value: `%${kpis.averageProfitMarginPct}`, color: 'text-blue-300', menu: 'projects', hideForField: true },
    { label: 'Toplam Teminat Tutarı', value: formatKurusTRY(kpis.totalGuaranteePrincipalKurus), color: 'text-amber-300', menu: 'guarantees' },
    { label: 'Yaklaşan Ödemeler (14 Gün)', value: formatKurusTRY(kpis.upcomingPaymentsKurus), color: 'text-orange-400', menu: 'currentAccounts' },
  ];

  const visibleCards = canSeeProfitability
    ? kpiCards
    : kpiCards.filter((c) => !c.hideForField);

  return (
    <div className="space-y-6">
      {/* Mobile & Desktop Quick Action Buttons (Section 27) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        {[
          { label: 'Fatura Fotoğrafı Çek', icon: 'fa-camera', cls: 'bg-blue-600 hover:bg-blue-500 text-white', fn: onOpenInvoiceUpload },
          { label: 'Gider Ekle', icon: 'fa-receipt', cls: 'bg-[#0b1329] hover:bg-slate-800 border border-slate-700 text-rose-300', fn: () => onQuickAction('expense') },
          { label: 'Malzeme Girişi', icon: 'fa-boxes-stacked', cls: 'bg-[#0b1329] hover:bg-slate-800 border border-slate-700 text-sky-300', fn: () => onQuickAction('stock') },
          { label: 'Ödeme Ekle', icon: 'fa-money-bill-transfer', cls: 'bg-[#0b1329] hover:bg-slate-800 border border-slate-700 text-emerald-300', fn: () => onQuickAction('payment') },
          { label: 'Günlük Rapor', icon: 'fa-clipboard-list', cls: 'bg-[#0b1329] hover:bg-slate-800 border border-slate-700 text-amber-300', fn: () => onQuickAction('sitelog') },
          { label: 'Şantiye Fotoğrafı', icon: 'fa-image', cls: 'bg-[#0b1329] hover:bg-slate-800 border border-slate-700 text-blue-300', fn: () => onQuickAction('sitelog') },
          { label: 'Puantaj Ekle', icon: 'fa-user-clock', cls: 'bg-[#0b1329] hover:bg-slate-800 border border-slate-700 text-purple-300', fn: () => onQuickAction('timesheet') },
        ].map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={btn.fn}
            className={`p-3 rounded-xl text-xs font-extrabold flex flex-col items-center justify-center gap-1.5 text-center transition ${btn.cls}`}
          >
            <i className={`fa-solid ${btn.icon} text-base`} />
            <span>{btn.label}</span>
          </button>
        ))}
      </div>

      {/* Global Filters */}
      <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-4 space-y-3 text-xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <select
            value={filterProj}
            onChange={(e) => setFilterProj(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white"
          >
            <option value="all">Tüm Projeler</option>
            {dataset.projects.map((p) => (
              <option key={p.id} value={p.id}>{p.shortName}</option>
            ))}
          </select>
          <select
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white"
          >
            <option value="all">Tüm Şehirler</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filterAuthority}
            onChange={(e) => setFilterAuthority(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white"
          >
            <option value="all">Tüm Kurumlar</option>
            {authorities.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white"
          >
            <option value="all">Tüm Gider Grupları</option>
            {DEFAULT_EXPENSE_TAXONOMY.map((g) => (
              <option key={g.group} value={g.group}>{g.group}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600 text-white"
          />
        </div>
        {(filterProj !== 'all' || filterCity !== 'all' || filterAuthority !== 'all' || filterCategory !== 'all' || dateFrom || dateTo) && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setFilterProj('all');
                setFilterCity('all');
                setFilterAuthority('all');
                setFilterCategory('all');
                setDateFrom('');
                setDateTo('');
              }}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold"
            >
              <i className="fa-solid fa-rotate-left mr-1" />
              Filtreleri Sıfırla
            </button>
          </div>
        )}
      </div>

      {/* All 17 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {visibleCards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => onNavigate(c.menu)}
            className="text-left p-4 rounded-2xl bg-[#0b1329] border border-slate-700 hover:border-blue-400 transition space-y-1.5"
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {c.label}
            </div>
            <div className={`text-lg font-black ${c.color}`}>{c.value}</div>
          </button>
        ))}
      </div>

      {/* Charts Grid: Monthly Cashflow + Cost Distribution + Project Profitability / Budget Overrun */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Monthly Income vs Expense */}
        <div className="lg:col-span-6 bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 space-y-4">
          <h3 className="text-base font-black text-white">Aylık Gelir (Hakediş) &amp; Gider Grafiği</h3>
          {monthlySeries.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400 bg-[#070d1e] rounded-xl">
              Henüz aylık hakediş veya gider kaydı girilmedi. Gerçek fatura/hakediş eklendikçe grafik oluşacaktır.
            </div>
          ) : (
            <div className="space-y-3">
              {monthlySeries.map(([ym, vals]) => (
                <div key={ym} className="space-y-1 text-xs">
                  <div className="flex justify-between font-bold text-slate-300">
                    <span>{ym}</span>
                    <span>
                      +{formatKurusTRY(vals.incomeKurus)} / -{formatKurusTRY(vals.expenseKurus)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.round((vals.incomeKurus / maxMonthlyVal) * 100)}%` }}
                      />
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-rose-500 rounded-full"
                        style={{ width: `${Math.round((vals.expenseKurus / maxMonthlyVal) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cost Distribution */}
        <div className="lg:col-span-6 bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 space-y-4">
          <h3 className="text-base font-black text-white">Maliyet Dağılımı &amp; Proje Bütçe Durumu</h3>
          {costDistribution.length === 0 ? (
            <div className="p-5 text-center text-xs text-slate-400 bg-[#070d1e] rounded-xl">
              Gider kaydı eklendikçe kategori dağılımı burada listelenecektir.
            </div>
          ) : (
            <div className="space-y-2.5 text-xs">
              {costDistribution.map(([grp, val]) => {
                const pct =
                  kpis.totalActualCostKurus > 0
                    ? Math.round((val / kpis.totalActualCostKurus) * 100)
                    : 0;
                return (
                  <div key={grp} className="space-y-1">
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-200">{grp}</span>
                      <span className="font-black text-white">{formatKurusTRY(val)} (%{pct})</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 space-y-2.5">
            <div className="text-xs font-black uppercase text-slate-400">Proje Kârlılık &amp; Bütçe Tüketimi</div>
            {filteredData.projects.map((p) => {
              const m = computeProjectFinancials(p, filteredData);
              return (
                <div
                  key={p.id}
                  onClick={() => onOpenProject(p)}
                  className="p-3 rounded-xl bg-[#070d1e] border border-slate-800 hover:border-blue-400 cursor-pointer flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-black text-white">{p.code} — {p.shortName}</div>
                    <div className="text-slate-400">
                      Fiziki %{p.physicalProgressPct} • Bütçe %{m.budgetBurnPct}
                    </div>
                  </div>
                  <div className="text-right">
                    {canSeeProfitability && (
                      <div className={`font-black ${m.expectedFinalProfitKurus >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        Kâr: {formatKurusTRY(m.expectedFinalProfitKurus)} (%{m.expectedProfitMarginPct})
                      </div>
                    )}
                    <div className="text-[11px] text-slate-400">
                      Maliyet: {formatKurusTRY(m.totalActualCostKurus)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
