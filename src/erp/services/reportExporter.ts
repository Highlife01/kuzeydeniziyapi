import { formatKurusTRY } from '../utils/money';
import {
  ErpDatasetSnapshot,
  computeExecutiveKpis,
  computeProjectFinancials,
} from './financeEngine';

export interface ReportDefinition {
  id: string;
  title: string;
  description: string;
}

export const ALL_16_REPORTS: ReportDefinition[] = [
  { id: 'proj_income_expense', title: '1. Proje Gelir-Gider Raporu', description: 'Proje bazlı hakediş ve gider dökümü' },
  { id: 'proj_cost_breakdown', title: '2. Proje Maliyet Dökümü', description: 'Malzeme, işçilik, taşeron ve makine maliyet kırılımı' },
  { id: 'proj_pnl', title: '3. Proje Kâr-Zarar Raporu', description: 'Güncel sözleşme, beklenen kâr ve marj analizi' },
  { id: 'purchases', title: '4. Malzeme Satın Alma Raporu', description: 'Siparişler, miktar, birim fiyat ve teslim durumu' },
  { id: 'supplier_ledger', title: '5. Tedarikçi Cari Hesap Ekstresi', description: 'Tedarikçi fatura, ödeme ve kalan borç listesi' },
  { id: 'subcontractor_ledger', title: '6. Taşeron Cari Hesap Ekstresi', description: 'Taşeron sözleşme, hakediş, malzeme mahsubu ve borç' },
  { id: 'hr_cost', title: '7. Personel Maliyet Raporu', description: 'Puantaj, mesai, avans ve işverene toplam maliyet' },
  { id: 'progress_payments', title: '8. Hakediş Raporu', description: 'Brüt, fiyat farkı, kesintiler, net ödenecek ve tahsilat' },
  { id: 'vat_report', title: '9. KDV Raporu', description: 'Hesaplanan KDV (Hakediş) vs İndirilebilir KDV (Fatura)' },
  { id: 'bank_cash', title: '10. Banka ve Kasa Raporu', description: 'Banka/kasa bakiyeleri ve son nakit hareketleri' },
  { id: 'cashflow_forecast', title: '11. Nakit Akış Tahmini', description: 'Beklenen hakediş tahsilatları ve yaklaşan ödemeler' },
  { id: 'aging_report', title: '12. Borç ve Alacak Yaşlandırma Raporu', description: 'Vadesi geçmiş ve yaklaşan fatura/çek/hakediş yaşlandırması' },
  { id: 'poz_cost', title: '13. Poz Bazlı Maliyet Raporu', description: 'Sözleşme metrajı vs gerçekleşen poz maliyeti' },
  { id: 'budget_comparison', title: '14. Bütçe Karşılaştırma Raporu', description: 'Hedef bütçe, gerçekleşen maliyet ve sapma %' },
  { id: 'guarantees', title: '15. Teminat Raporu', description: 'Teminat mektupları, vadeler ve banka komisyonları' },
  { id: 'site_progress', title: '16. Şantiye İlerleme Raporu', description: 'Fiziki ve finansal ilerleme ile günlük saha özeti' },
];

export function buildReportTable(
  reportId: string,
  data: ErpDatasetSnapshot,
  selectedProjectId = 'all'
): { headers: string[]; rows: string[][] } {
  const filterProj = <T extends { projectId?: string }>(arr: T[]) =>
    selectedProjectId === 'all' ? arr : arr.filter((x) => x.projectId === selectedProjectId);

  switch (reportId) {
    case 'proj_income_expense':
    case 'proj_pnl': {
      const targetProjects =
        selectedProjectId === 'all'
          ? data.projects
          : data.projects.filter((p) => p.id === selectedProjectId);
      return {
        headers: ['Kod', 'Proje', 'Sözleşme Değeri', 'Gerçekleşen Maliyet', 'Düzenlenen Hakediş', 'Beklenen Kâr', 'Marj'],
        rows: targetProjects.map((p) => {
          const m = computeProjectFinancials(p, data);
          return [
            p.code,
            p.title,
            formatKurusTRY(m.currentContractValueKurus),
            formatKurusTRY(m.totalActualCostKurus),
            formatKurusTRY(m.billedProgressKurus),
            formatKurusTRY(m.expectedFinalProfitKurus),
            `%${m.expectedProfitMarginPct}`,
          ];
        }),
      };
    }
    case 'proj_cost_breakdown': {
      const targetProjects =
        selectedProjectId === 'all'
          ? data.projects
          : data.projects.filter((p) => p.id === selectedProjectId);
      return {
        headers: ['Proje', 'Malzeme', 'İşçilik', 'Taşeron', 'Makine', 'Nakliye', 'Genel/Finansman', 'Toplam'],
        rows: targetProjects.map((p) => {
          const m = computeProjectFinancials(p, data);
          return [
            p.shortName,
            formatKurusTRY(m.materialCostKurus),
            formatKurusTRY(m.laborCostKurus),
            formatKurusTRY(m.subcontractorCostKurus),
            formatKurusTRY(m.machineCostKurus),
            formatKurusTRY(m.transportCostKurus),
            formatKurusTRY(m.siteOverheadKurus + m.allocatedCompanyOverheadKurus + m.financingCostKurus),
            formatKurusTRY(m.totalActualCostKurus),
          ];
        }),
      };
    }
    case 'purchases':
      return {
        headers: ['Sipariş Tarihi', 'Malzeme', 'Poz', 'Tedarikçi', 'Miktar', 'KDV Hariç', 'Genel Toplam', 'Durum'],
        rows: filterProj(data.purchases).map((p) => [
          p.orderDate,
          p.materialName,
          p.pozNo,
          p.supplierName,
          `${p.quantity} ${p.unit}`,
          formatKurusTRY(p.netTotalKurus),
          formatKurusTRY(p.grossTotalKurus),
          p.status,
        ]),
      };
    case 'supplier_ledger':
      return {
        headers: ['Fatura No', 'Tarih', 'Tedarikçi', 'VKN', 'Genel Toplam', 'Ödenen', 'Kalan Borç', 'Vade'],
        rows: filterProj(data.invoices).map((i) => [
          i.invoiceNo,
          i.issueDate,
          i.supplierName,
          i.supplierTaxNo,
          formatKurusTRY(i.grandTotalKurus),
          formatKurusTRY(i.paidKurus),
          formatKurusTRY(i.remainingDebtKurus),
          i.dueDate,
        ]),
      };
    case 'subcontractor_ledger':
      return {
        headers: ['Taşeron Firma', 'Kapsam', 'Sözleşme', 'Hakediş', 'Malzeme Mahsubu', 'Ödenen', 'Kalan Borç'],
        rows: filterProj(data.subcontractors).map((s) => [
          s.firmName,
          s.scopeOfWork,
          formatKurusTRY(s.contractAmountKurus),
          formatKurusTRY(s.hakedisTotalKurus),
          formatKurusTRY(s.companyMaterialDeductionKurus),
          formatKurusTRY(s.paidTotalKurus),
          formatKurusTRY(s.remainingDebtKurus),
        ]),
      };
    case 'hr_cost':
      return {
        headers: ['Tarih', 'Personel', 'Çalışılan Gün', 'Mesai (sa)', 'Avans', 'Ödenen', 'İşveren Maliyeti'],
        rows: filterProj(data.timesheets).map((t) => [
          t.date,
          t.employeeName,
          String(t.workedDays),
          String(t.overtimeHours),
          formatKurusTRY(t.advanceKurus),
          formatKurusTRY(t.paidWageKurus),
          formatKurusTRY(t.employerCostKurus),
        ]),
      };
    case 'progress_payments':
      return {
        headers: ['Hakediş No', 'Dönem', 'Brüt + Fiyat Farkı', 'KDV', 'Kesintiler', 'Net Ödenecek', 'Tahsil Edilen', 'Durum'],
        rows: filterProj(data.progressPayments).map((h) => [
          String(h.hakedisNo),
          h.period,
          formatKurusTRY(h.grossAmountKurus),
          formatKurusTRY(h.vatAmountKurus),
          formatKurusTRY(
            h.vatWithholdingKurus +
              h.advanceDeductionKurus +
              h.retentionKurus +
              h.taxDeductionKurus +
              h.sgkDeductionKurus +
              h.penaltyDeductionKurus +
              h.otherDeductionKurus
          ),
          formatKurusTRY(h.netPayableKurus),
          formatKurusTRY(h.collectedKurus),
          h.status,
        ]),
      };
    case 'vat_report': {
      const kpis = computeExecutiveKpis(data);
      const outVat = data.progressPayments.reduce((s, h) => s + h.vatAmountKurus, 0);
      const inVat = data.invoices
        .filter((i) => i.deductibleVat && !i.reversalOfId)
        .reduce((s, i) => s + i.vatTotalKurus, 0);
      return {
        headers: ['Kalem', 'Tutar'],
        rows: [
          ['Hesaplanan KDV (Hakedişlerden)', formatKurusTRY(outVat)],
          ['İndirilebilir KDV (Alış Faturalarından)', formatKurusTRY(inVat)],
          ['Net KDV Pozisyonu', formatKurusTRY(kpis.totalVatNetKurus)],
        ],
      };
    }
    case 'bank_cash':
      return {
        headers: ['Hesap / Kasa', 'Tür', 'Para Birimi', 'IBAN', 'Bakiye'],
        rows: data.bankAccounts.map((b) => [
          b.name,
          b.accountType,
          b.currency,
          b.iban || '—',
          formatKurusTRY(b.balanceKurus),
        ]),
      };
    case 'guarantees':
      return {
        headers: ['Tür', 'Banka', 'Mektup No', 'Ana Para', 'Komisyon Gideri', 'Bitiş', 'İade'],
        rows: filterProj(data.guarantees).map((g) => [
          g.type,
          g.bankName,
          g.letterNo,
          formatKurusTRY(g.principalAmountKurus),
          formatKurusTRY(g.commissionExpenseKurus),
          g.endDate,
          g.returned ? 'İade Edildi' : 'Aktif',
        ]),
      };
    case 'cashflow_forecast': {
      const rows: string[][] = [];
      const invs = filterProj(data.invoices).filter((i) => !i.reversalOfId && i.remainingDebtKurus > 0);
      const hks = filterProj(data.progressPayments).filter((h) => h.remainingReceivableKurus > 0);
      const chks = filterProj(data.checks).filter((c) => c.status === 'Portföyde');
      hks.forEach((h) =>
        rows.push([
          h.expectedPaymentDate || h.issueDate,
          'Giriş (Tahsilat)',
          `Hakediş #${h.hakedisNo} (${h.period})`,
          formatKurusTRY(h.remainingReceivableKurus),
          h.status,
        ])
      );
      invs.forEach((i) =>
        rows.push([
          i.dueDate || i.issueDate,
          'Çıkış (Ödeme)',
          `Fatura #${i.invoiceNo} — ${i.supplierName}`,
          formatKurusTRY(i.remainingDebtKurus),
          'Açık Borç',
        ])
      );
      chks.forEach((c) =>
        rows.push([
          c.dueDate || c.issueDate,
          c.direction === 'Alınan' ? 'Giriş (Tahsilat)' : 'Çıkış (Ödeme)',
          `${c.direction} ${c.kind} (${c.serialNo}) — ${c.counterparty}`,
          formatKurusTRY(c.amountKurus),
          c.status,
        ])
      );
      rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
      return {
        headers: ['Tahmini Tarih', 'Nakit Yönü', 'Açıklama', 'Tutar', 'Durum'],
        rows,
      };
    }
    case 'aging_report': {
      const todayMs = new Date().setHours(0, 0, 0, 0);
      const rows: string[][] = [];
      const diffBadge = (dateStr?: string) => {
        if (!dateStr) return 'Tarihsiz';
        const diff = Math.ceil((new Date(dateStr).getTime() - todayMs) / 86400_000);
        return diff < 0 ? `${Math.abs(diff)} gün GECİKMİŞ` : `${diff} gün kaldı`;
      };
      filterProj(data.invoices)
        .filter((i) => !i.reversalOfId && i.remainingDebtKurus > 0)
        .forEach((i) =>
          rows.push([
            'Tedarikçi Borcu',
            `${i.supplierName} (#${i.invoiceNo})`,
            i.dueDate || '—',
            diffBadge(i.dueDate),
            formatKurusTRY(i.remainingDebtKurus),
          ])
        );
      filterProj(data.progressPayments)
        .filter((h) => h.remainingReceivableKurus > 0)
        .forEach((h) =>
          rows.push([
            'Hakediş Alacağı',
            `Hakediş #${h.hakedisNo} (${h.period})`,
            h.expectedPaymentDate || h.issueDate,
            diffBadge(h.expectedPaymentDate || h.issueDate),
            formatKurusTRY(h.remainingReceivableKurus),
          ])
        );
      filterProj(data.checks)
        .filter((c) => c.status === 'Portföyde')
        .forEach((c) =>
          rows.push([
            `${c.direction} ${c.kind}`,
            `${c.counterparty} (${c.serialNo})`,
            c.dueDate || '—',
            diffBadge(c.dueDate),
            formatKurusTRY(c.amountKurus),
          ])
        );
      return {
        headers: ['Cari Türü', 'Muhatap / Belge', 'Vade Tarihi', 'Yaşlandırma Durumu', 'Kalan Tutar'],
        rows,
      };
    }
    case 'poz_cost': {
      const items = filterProj(data.workItems || []);
      return {
        headers: ['Poz No', 'Kaynak', 'İş Kalemi', 'Sözleşme Metraj', 'Gerçekleşen', 'Birim Fiyat', 'Gerçekleşen Maliyet', 'Tamamlanma'],
        rows: items.map((w) => [
          w.pozNo,
          w.source,
          w.description,
          `${w.contractQty} ${w.unit}`,
          `${w.actualQty} ${w.unit}`,
          formatKurusTRY(w.contractUnitPriceKurus),
          formatKurusTRY(w.actualCostKurus),
          `%${w.contractQty > 0 ? Math.round((w.actualQty / w.contractQty) * 100) : 0}`,
        ]),
      };
    }
    case 'budget_comparison': {
      const targetProjects =
        selectedProjectId === 'all'
          ? data.projects
          : data.projects.filter((p) => p.id === selectedProjectId);
      const alertLabels: Record<string, string> = {
        normal: 'Normal',
        info: 'İzleme (%70+)',
        warning: 'Uyarı (%85+)',
        critical: 'Kritik (%95+)',
        overrun: 'BÜTÇE AŞIMI',
      };
      return {
        headers: ['Kod', 'Proje', 'Hedef Bütçe', 'Gerçekleşen Maliyet', 'Kalan Bütçe', 'Tüketim %', 'Uyarı Seviyesi'],
        rows: targetProjects.map((p) => {
          const m = computeProjectFinancials(p, data);
          const diff = m.budgetTargetKurus - m.totalActualCostKurus;
          return [
            p.code,
            p.shortName,
            formatKurusTRY(m.budgetTargetKurus),
            formatKurusTRY(m.totalActualCostKurus),
            formatKurusTRY(diff),
            `%${m.budgetBurnPct}`,
            alertLabels[m.budgetAlertLevel] || m.budgetAlertLevel,
          ];
        }),
      };
    }
    case 'site_progress':
    default: {
      const targetProjects =
        selectedProjectId === 'all'
          ? data.projects
          : data.projects.filter((p) => p.id === selectedProjectId);
      return {
        headers: ['Kod', 'Proje', 'Durum', 'Fiziki %', 'Finansal %', 'Son Günlük Tarih', 'Günlük / Personel Özeti'],
        rows: targetProjects.map((p) => {
          const projLogs = (data.siteLogs || []).filter((l) => l.projectId === p.id);
          const latestLog = projLogs[0];
          const taskCount = (data.tasks || []).filter((t) => t.projectId === p.id).length;
          return [
            p.code,
            p.shortName,
            p.status,
            `%${p.physicalProgressPct}`,
            `%${p.financialProgressPct}`,
            latestLog?.date || '—',
            latestLog
              ? `${projLogs.length} rapor • Son: ${latestLog.workerCount} personel, ${latestLog.weather}`
              : `${taskCount} planlı faaliyet`,
          ];
        }),
      };
    }
  }
}

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportReportCsv(title: string, headers: string[], rows: string[][]) {
  const csv =
    '\uFEFF' +
    [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c || '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kuzeydenizi-${title.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportReportPrintablePdf(
  reportTitle: string,
  projectName: string,
  headers: string[],
  rows: string[][]
) {
  const win = window.open('', '_blank', 'width=1000,height=800');
  if (!win) return;
  const nowStr = new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date());

  const ths = headers.map((h) => `<th style="border:1px solid #cbd5e1;padding:8px;background:#0f172a;color:#fff;font-size:11px;text-align:left;">${escapeHtml(h)}</th>`).join('');
  const trs = rows
    .map(
      (r) =>
        `<tr>${r
          .map((c) => `<td style="border:1px solid #e2e8f0;padding:7px;font-size:11px;">${escapeHtml(c)}</td>`)
          .join('')}</tr>`
    )
    .join('');

  win.document.write(`<!doctype html><html lang="tr"><head><meta charset="UTF-8"><title>${escapeHtml(reportTitle)}</title></head>
  <body style="font-family:sans-serif;padding:32px;color:#0f172a;">
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #2563eb;padding-bottom:16px;margin-bottom:20px;">
      <div>
        <div style="font-size:18px;font-weight:900;color:#0f172a;">KUZEY DENİZİ İNŞAAT SAN. VE TİC. A.Ş.</div>
        <div style="font-size:11px;color:#475569;">Yeşiloba Mah. 46088 Sk. No: 18 B Seyhan / ADANA • VKN: 2640323020 • Tel: 0533 677 91 09</div>
      </div>
      <div style="text-align:right;font-size:11px;color:#475569;">
        <div><strong>Rapor Tarihi:</strong> ${escapeHtml(nowStr)}</div>
        <div><strong>Kapsam:</strong> ${escapeHtml(projectName)}</div>
      </div>
    </div>
    <h1 style="font-size:16px;margin-bottom:14px;">${escapeHtml(reportTitle)}</h1>
    <table style="width:100%;border-collapse:collapse;"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>
    <script>window.onload=function(){window.print();}</script>
  </body></html>`);
  win.document.close();
}
