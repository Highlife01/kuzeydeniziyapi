import { ErpDatasetSnapshot, computeExecutiveKpis, computeProjectFinancials } from './financeEngine';
import { formatKurusTRY } from '../utils/money';

export interface AiAssistantReply {
  answer: string;
  citations: { label: string; detail: string; targetMenu: string }[];
  readOnlyWarning: string;
  usedBackendAi: boolean;
}

function matchProjectFromQuestion(q: string, snapshot: ErpDatasetSnapshot) {
  const low = q.toLocaleLowerCase('tr-TR');
  return snapshot.projects.find(
    (p) =>
      low.includes(p.shortName.toLocaleLowerCase('tr-TR')) ||
      low.includes(p.title.toLocaleLowerCase('tr-TR')) ||
      low.includes(p.code.toLocaleLowerCase('tr-TR')) ||
      (low.includes('adliye') && p.title.toLocaleLowerCase('tr-TR').includes('adliye')) ||
      (low.includes('pozantı') && p.title.toLocaleLowerCase('tr-TR').includes('pozantı'))
  );
}

/**
 * Strictly read-only Financial & Project AI Query Engine grounded 100% in live Firestore records.
 * Never alters, deletes, or approves financial records.
 */
export async function askErpAssistant(
  question: string,
  snapshot: ErpDatasetSnapshot,
  aiBackendEndpoint?: string
): Promise<AiAssistantReply> {
  const q = question.trim();
  const low = q.toLocaleLowerCase('tr-TR');
  const kpis = computeExecutiveKpis(snapshot);
  const citations: AiAssistantReply['citations'] = [];

  // Optional secure backend LLM synthesis using verified database context
  if (aiBackendEndpoint) {
    try {
      const res = await fetch(`${aiBackendEndpoint.replace(/\/$/, '')}/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          verifiedSummary: {
            kpis,
            projects: snapshot.projects.map((p) => ({
              id: p.id,
              code: p.code,
              title: p.title,
              financials: computeProjectFinancials(p, snapshot),
            })),
            invoiceCount: snapshot.invoices.length,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          answer: data.answer,
          citations: data.citations || [],
          readOnlyWarning: 'Salt okunur analiz: Sistem kayıtlarında otomatik değişiklik yapılmadı.',
          usedBackendAi: true,
        };
      }
    } catch {
      // Fallback gracefully to deterministic verified query engine
    }
  }

  const matchedProject = matchProjectFromQuestion(q, snapshot);

  // 1. Project spend / profit margin / cash needed to finish
  if (
    matchedProject &&
    (low.includes('harca') ||
      low.includes('maliyet') ||
      low.includes('kâr') ||
      low.includes('kar') ||
      low.includes('marj') ||
      low.includes('kalan') ||
      low.includes('nakit'))
  ) {
    const m = computeProjectFinancials(matchedProject, snapshot);
    const linkedExpenses = snapshot.expenses.filter(
      (e) => e.projectId === matchedProject.id && !e.reversalOfId
    );
    linkedExpenses.slice(0, 5).forEach((e) =>
      citations.push({
        label: `${e.categorySub} (${e.date})`,
        detail: `${e.description} — ${formatKurusTRY(e.netKurus)}`,
        targetMenu: 'expenses',
      })
    );
    return {
      answer:
        `**${matchedProject.title} (${matchedProject.code}) Finansal Özeti:**\n` +
        `• Güncel Sözleşme Değeri: **${formatKurusTRY(m.currentContractValueKurus)}**\n` +
        `• Toplam Gerçekleşen Maliyet (KDV Hariç / İndirilebilir KDV ayrılmış): **${formatKurusTRY(m.totalActualCostKurus)}** (${linkedExpenses.length} gider kaydı)\n` +
        `• Faturalanmamış Taahhüt + Kalan Tahmini Maliyet: **${formatKurusTRY(m.unbilledCommitmentsKurus + m.estRemainingCostKurus)}**\n` +
        `• Beklenen Nihai Kâr: **${formatKurusTRY(m.expectedFinalProfitKurus)}** (Kâr Marjı: **%${m.expectedProfitMarginPct}**)`,
      citations,
      readOnlyWarning: 'Bu yanıt yalnızca canlı veritabanındaki onaylı/kayıtlı belgelerden hesaplandı.',
      usedBackendAi: false,
    };
  }

  // 2. Top paid material this month
  if (low.includes('bu ay') && (low.includes('malzeme') || low.includes('en çok'))) {
    const ym = new Date().toISOString().slice(0, 7);
    const byCat: Record<string, number> = {};
    for (const exp of snapshot.expenses) {
      if (!exp.reversalOfId && exp.date.startsWith(ym)) {
        byCat[exp.categorySub] = (byCat[exp.categorySub] || 0) + exp.netKurus;
      }
    }
    const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
      return {
        answer: `${ym} dönemi için henüz kayıtlı gider/malzeme faturası bulunmuyor.`,
        citations: [],
        readOnlyWarning: 'Canlı veritabanı sorgulandı; sahte veri gösterilmedi.',
        usedBackendAi: false,
      };
    }
    sorted.slice(0, 5).forEach(([cat, val]) =>
      citations.push({ label: cat, detail: formatKurusTRY(val), targetMenu: 'expenses' })
    );
    return {
      answer: `${ym} döneminde en yüksek harcama yapılan kalem **${sorted[0][0]}** (${formatKurusTRY(sorted[0][1])}) oldu.`,
      citations,
      readOnlyWarning: 'Hesaplama güncel ay gider kayıtlarından yapıldı.',
      usedBackendAi: false,
    };
  }

  // 3. Supplier payables
  if (low.includes('tedarikçi') && (low.includes('borç') || low.includes('borcumuz'))) {
    const bySup: Record<string, number> = {};
    for (const inv of snapshot.invoices) {
      if (!inv.reversalOfId && inv.remainingDebtKurus > 0) {
        bySup[inv.supplierName] = (bySup[inv.supplierName] || 0) + inv.remainingDebtKurus;
        citations.push({
          label: `Fatura #${inv.invoiceNo}`,
          detail: `${inv.supplierName} — Kalan: ${formatKurusTRY(inv.remainingDebtKurus)}`,
          targetMenu: 'invoices',
        });
      }
    }
    const entries = Object.entries(bySup).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      return {
        answer: 'Sistemde kayıtlı açık tedarikçi borcu bulunmuyor (Toplam: 0,00 TL).',
        citations: [],
        readOnlyWarning: 'Salt okunur analiz.',
        usedBackendAi: false,
      };
    }
    const summary = entries.map(([k, v]) => `• ${k}: **${formatKurusTRY(v)}**`).join('\n');
    return {
      answer: `Toplam açık tedarikçi borcu **${formatKurusTRY(kpis.supplierPayablesKurus)}**:\n${summary}`,
      citations: citations.slice(0, 6),
      readOnlyWarning: 'Yalnızca kesinleşmiş fatura bakiyelerinden hesaplandı.',
      usedBackendAi: false,
    };
  }

  // 4. This week due payments
  if (low.includes('bu hafta') && low.includes('ödeme')) {
    const now = Date.now();
    const in7 = now + 7 * 86400_000;
    const dueInvs = snapshot.invoices.filter(
      (i) => i.remainingDebtKurus > 0 && i.dueDate && new Date(i.dueDate).getTime() <= in7
    );
    const dueChks = snapshot.checks.filter(
      (c) => c.direction === 'Verilen' && c.status === 'Portföyde' && c.dueDate && new Date(c.dueDate).getTime() <= in7
    );
    const total =
      dueInvs.reduce((s, i) => s + i.remainingDebtKurus, 0) +
      dueChks.reduce((s, c) => s + c.amountKurus, 0);
    dueInvs.forEach((i) =>
      citations.push({
        label: `Fatura #${i.invoiceNo}`,
        detail: `${i.supplierName} (${i.dueDate}) — ${formatKurusTRY(i.remainingDebtKurus)}`,
        targetMenu: 'invoices',
      })
    );
    return {
      answer: `Önümüzdeki 7 gün içinde vadesi gelen/geçen toplam ödeme yükümlülüğü **${formatKurusTRY(total)}** (${dueInvs.length} fatura, ${dueChks.length} çek/senet).`,
      citations,
      readOnlyWarning: 'Ödeme emri oluşturulmaz; salt okunur vade analizidir.',
      usedBackendAi: false,
    };
  }

  // 5. Pending progress payments (hakediş alacakları)
  if (low.includes('hakediş') && (low.includes('alacağ') || low.includes('bekleyen'))) {
    const pending = snapshot.progressPayments.filter((h) => h.remainingReceivableKurus > 0);
    pending.forEach((h) =>
      citations.push({
        label: `Hakediş #${h.hakedisNo} (${h.period})`,
        detail: `Kalan: ${formatKurusTRY(h.remainingReceivableKurus)} (${h.status})`,
        targetMenu: 'progressPayments',
      })
    );
    return {
      answer: `Toplam bekleyen hakediş alacağı **${formatKurusTRY(kpis.pendingProgressReceivableKurus)}** (${pending.length} hakediş kaydı).`,
      citations,
      readOnlyWarning: 'Veriler canlı hakediş tablosundan alındı.',
      usedBackendAi: false,
    };
  }

  // 6. Budget overrun risk
  if (low.includes('bütçe') && (low.includes('aşım') || low.includes('risk'))) {
    const risky = snapshot.projects
      .map((p) => ({ p, m: computeProjectFinancials(p, snapshot) }))
      .filter((x) => x.m.budgetAlertLevel !== 'normal' || x.m.burnDivergenceAlert);
    if (risky.length === 0) {
      return {
        answer: 'Şu anda hedef bütçe eşiğini (%70+) aşan veya bütçe/ilerleme sapması gösteren proje bulunmuyor.',
        citations: [],
        readOnlyWarning: 'Projeler canlı bütçe eşiklerine göre kontrol edildi.',
        usedBackendAi: false,
      };
    }
    risky.forEach(({ p, m }) =>
      citations.push({
        label: p.shortName,
        detail: `Bütçe Tüketimi: %${m.budgetBurnPct} | Fiziki İlerleme: %${p.physicalProgressPct}`,
        targetMenu: 'projects',
      })
    );
    return {
      answer: `Bütçe uyarısı veren **${risky.length}** proje tespit edildi:\n${risky
        .map(
          ({ p, m }) =>
            `• **${p.shortName}**: Bütçe %${m.budgetBurnPct} / Fiziki İlerleme %${p.physicalProgressPct}`
        )
        .join('\n')}`,
      citations,
      readOnlyWarning: 'Salt okunur bütçe analizidir.',
      usedBackendAi: false,
    };
  }

  // 7. Missing invoices (unbilled purchases)
  if (low.includes('eksik fatura') || low.includes('faturasız')) {
    const unbilled = snapshot.purchases.filter(
      (p) => !p.invoiceNo && p.status !== 'İptal Edildi'
    );
    unbilled.slice(0, 6).forEach((p) =>
      citations.push({
        label: p.materialName,
        detail: `${p.supplierName} — ${formatKurusTRY(p.grossTotalKurus)}`,
        targetMenu: 'purchases',
      })
    );
    return {
      answer: `Fatura numarası eşleşmemiş **${unbilled.length}** satın alma kaydı bulundu.`,
      citations,
      readOnlyWarning: 'Satın alma siparişleri ile fatura numaraları karşılaştırıldı.',
      usedBackendAi: false,
    };
  }

  // 8. Best supplier or material price trend
  if (low.includes('tedarikçi') && (low.includes('uygun') || low.includes('fiyat'))) {
    const quotes = [...snapshot.supplierQuotes].sort(
      (a, b) => a.unitPriceKurus - b.unitPriceKurus
    );
    if (quotes.length === 0) {
      return {
        answer: 'Karşılaştırma yapabilmek için Tedarikçiler modülünde henüz fiyat teklifi kaydı bulunmuyor.',
        citations: [],
        readOnlyWarning: 'Canlı teklif kayıtları sorgulandı.',
        usedBackendAi: false,
      };
    }
    quotes.slice(0, 5).forEach((qt) =>
      citations.push({
        label: qt.materialName,
        detail: `${qt.supplierName} — ${formatKurusTRY(qt.unitPriceKurus)}/${qt.unit}`,
        targetMenu: 'suppliers',
      })
    );
    return {
      answer: `Kayıtlı teklifler arasında en düşük birim fiyat: **${quotes[0].materialName}** için **${quotes[0].supplierName}** (${formatKurusTRY(quotes[0].unitPriceKurus)}/${quotes[0].unit}).`,
      citations,
      readOnlyWarning: 'Salt okunur fiyat karşılaştırması.',
      usedBackendAi: false,
    };
  }

  // 8b. Guarantees / Checks / Stock / Personnel / Equipment queries
  if (low.includes('teminat')) {
    const activeG = snapshot.guarantees.filter((g) => !g.returned);
    activeG.slice(0, 6).forEach((g) =>
      citations.push({
        label: `${g.type} #${g.letterNo}`,
        detail: `${g.bankName} — ${formatKurusTRY(g.principalAmountKurus)} (Bitiş: ${g.endDate || 'Süresiz'})`,
        targetMenu: 'guarantees',
      })
    );
    return {
      answer:
        activeG.length === 0
          ? 'Sistemde iade edilmemiş aktif teminat mektubu bulunmuyor.'
          : `Aktif **${activeG.length}** teminat mektubunun toplam anapara tutarı **${formatKurusTRY(kpis.totalGuaranteePrincipalKurus)}** ve toplam banka komisyonu **${formatKurusTRY(activeG.reduce((s, g) => s + (g.commissionExpenseKurus || 0), 0))}**.`,
      citations,
      readOnlyWarning: 'Teminat mektupları canlı veritabanından analiz edildi.',
      usedBackendAi: false,
    };
  }

  if (low.includes('çek') || low.includes('cek') || low.includes('senet')) {
    const activeChks = snapshot.checks.filter((c) => c.status === 'Portföyde');
    activeChks.slice(0, 6).forEach((c) =>
      citations.push({
        label: `${c.direction} ${c.kind} #${c.serialNo}`,
        detail: `${c.counterparty} (${c.dueDate || 'Vadesiz'}) — ${formatKurusTRY(c.amountKurus)}`,
        targetMenu: 'checks',
      })
    );
    const ver = activeChks.filter((c) => c.direction === 'Verilen').reduce((s, c) => s + c.amountKurus, 0);
    const aln = activeChks.filter((c) => c.direction === 'Alınan').reduce((s, c) => s + c.amountKurus, 0);
    return {
      answer: `Portföyde **${activeChks.length}** adet aktif çek/senet bulunuyor.\n• Alınan Portföy: **${formatKurusTRY(aln)}**\n• Verilen Portföy: **${formatKurusTRY(ver)}**`,
      citations,
      readOnlyWarning: 'Çek/senet portföyü canlı kayıtlardan listelendi.',
      usedBackendAi: false,
    };
  }

  if (low.includes('depo') || low.includes('stok') || low.includes('malzeme')) {
    const totalVal = snapshot.stockItems.reduce((s, x) => s + (x.totalValueKurus || 0), 0);
    const lowStock = snapshot.stockItems.filter((x) => x.quantity <= x.minStockLevel);
    snapshot.stockItems.slice(0, 6).forEach((s) =>
      citations.push({
        label: s.name,
        detail: `${s.quantity} ${s.unit} (Kullanılan: ${s.usedQty}) — ${formatKurusTRY(s.totalValueKurus)}`,
        targetMenu: 'warehouse',
      })
    );
    return {
      answer: `Toplam **${snapshot.stockItems.length}** stok kaleminin depo değeri **${formatKurusTRY(totalVal)}** (${lowStock.length} kritik düşük stok kalemi).`,
      citations,
      readOnlyWarning: 'Depo ve şantiye stokları canlı kayıtlardan okundu.',
      usedBackendAi: false,
    };
  }

  if (low.includes('personel') || low.includes('puantaj') || low.includes('işçi')) {
    snapshot.employees.slice(0, 6).forEach((emp) =>
      citations.push({
        label: emp.fullName,
        detail: `${emp.profession} — Günlük: ${formatKurusTRY(emp.dailyWageKurus)}`,
        targetMenu: 'hr',
      })
    );
    return {
      answer: `Kayıtlı **${snapshot.employees.length}** personel ve **${snapshot.timesheets.length}** puantaj kaydı bulunuyor. Toplam kalan personel hak ediş borcu **${formatKurusTRY(kpis.employeePayablesKurus)}**.`,
      citations,
      readOnlyWarning: 'Personel ve puantaj kayıtları canlı veritabanından hesaplandı.',
      usedBackendAi: false,
    };
  }

  // 9. Default Executive Financial Report
  snapshot.projects.forEach((p) => {
    const m = computeProjectFinancials(p, snapshot);
    citations.push({
      label: `${p.code} ${p.shortName}`,
      detail: `Sözleşme: ${formatKurusTRY(m.currentContractValueKurus)} | Maliyet: ${formatKurusTRY(m.totalActualCostKurus)}`,
      targetMenu: 'projects',
    });
  });

  return {
    answer:
      `**Kuzey Deniz İnşaat Canlı Finansal Yönetim Özeti:**\n` +
      `• Aktif / Tamamlanan Proje: **${kpis.activeProjectsCount} Aktif / ${kpis.completedProjectsCount} Tamamlanan**\n` +
      `• Toplam Sözleşme Bedeli: **${formatKurusTRY(kpis.totalContractValueKurus)}**\n` +
      `• Toplam Gerçekleşen Maliyet: **${formatKurusTRY(kpis.totalActualCostKurus)}**\n` +
      `• Düzenlenen / Tahsil Edilen Hakediş: **${formatKurusTRY(kpis.totalProgressBilledKurus)}** / **${formatKurusTRY(kpis.totalProgressCollectedKurus)}**\n` +
      `• Toplam Tedarikçi + Taşeron Borcu: **${formatKurusTRY(kpis.supplierPayablesKurus + kpis.subcontractorPayablesKurus)}**\n` +
      `• Nakit Mevcudu: **${formatKurusTRY(kpis.totalCashBalanceKurus)}** | Beklenen Toplam Kâr: **${formatKurusTRY(kpis.expectedTotalProfitKurus)}**`,
    citations,
    readOnlyWarning: 'Tüm değerler gerçek Firestore veritabanı kayıtlarından anlık hesaplanmıştır.',
    usedBackendAi: false,
  };
}
