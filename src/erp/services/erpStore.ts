import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  Unsubscribe,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../core/firebase';
import { DEFAULT_SETTINGS, SEED_PROJECTS } from '../../data/seedData';
import {
  ApprovalRequest,
  AuditLogEntry,
  BankAccount,
  CheckNoteRecord,
  DocumentVaultItem,
  EmployeeCard,
  EquipmentRecord,
  ErpProject,
  ErpProjectStatus,
  ErpSettings,
  ErpUserAccount,
  ExpenseRecord,
  GanttTask,
  GuaranteeLetter,
  InvoiceRecord,
  OfflineDraftItem,
  PaymentRecord,
  ProgressPayment,
  ProjectBudget,
  PurchaseOrder,
  SiteLogRecord,
  StockItem,
  StockMovement,
  SubcontractorCard,
  SupplierCard,
  SupplierQuote,
  TenderRecord,
  TimesheetEntry,
  WarehouseRecord,
  WorkItem,
} from '../types/erp';
import { toKurus } from '../utils/money';
import { canUserApproveAmount, getRequiredApprovalLevel } from '../utils/permissions';

export const ERP_ORG_ID = 'kuzeydenizi';
const OFFLINE_QUEUE_KEY = 'cb_erp_offline_queue_v1';
const LOCAL_PREFIX = 'cb_erp_v1_';

let activeLocalScope = 'preview';

function normalizeScopeKey(raw?: string | null): string {
  const clean = String(raw || 'preview')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '_');
  return clean || 'preview';
}

export function setErpLocalScope(scope?: string | null): void {
  activeLocalScope = normalizeScopeKey(scope);
}

export function getErpLocalScope(): string {
  return activeLocalScope;
}

export function clearErpLocalScope(scope?: string | null): void {
  try {
    const target = normalizeScopeKey(scope || activeLocalScope);
    const prefix = `${LOCAL_PREFIX}${target}_`;
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(prefix) || k === `${OFFLINE_QUEUE_KEY}_${target}`)) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Ignore storage unavailability
  }
}

function scopedColKey(col: string): string {
  return `${LOCAL_PREFIX}${activeLocalScope}_${col}`;
}

function scopedQueueKey(): string {
  return `${OFFLINE_QUEUE_KEY}_${activeLocalScope}`;
}

export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((v) => v !== undefined)
      .map((v) => stripUndefinedDeep(v)) as unknown as T;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

export const DEFAULT_ERP_SETTINGS: ErpSettings = {
  id: 'general',
  organizationId: ERP_ORG_ID,
  companyName: DEFAULT_SETTINGS.companyName,
  taxOffice: DEFAULT_SETTINGS.taxOffice,
  taxNumber: DEFAULT_SETTINGS.taxNumber,
  phone: DEFAULT_SETTINGS.phone,
  email: DEFAULT_SETTINGS.email,
  address: DEFAULT_SETTINGS.address,
  approvalLimitLevel1Kurus: 1_000_000, // 10.000 TL
  approvalLimitLevel2Kurus: 10_000_000, // 100.000 TL
  aiBackendEndpoint: '',
  mailWebhookUrl: '',
  autoSyncContactToMail: true,
};

export function hydrateLegacyProjectToErp(raw: any, actorEmail = 'system'): ErpProject {
  const now = new Date().toISOString();
  const statusMap: Record<string, ErpProjectStatus> = {
    planlama: 'Hazırlanıyor',
    'devam-ediyor': 'Devam Ediyor',
    'test-kabul': 'Geçici Kabul',
    'teslim-edildi': 'Tamamlandı',
  };
  const mappedStatus =
    (statusMap[raw.status] as ErpProjectStatus) ||
    (raw.status as ErpProjectStatus) ||
    'Tamamlandı';

  return {
    id: raw.id,
    organizationId: raw.organizationId || ERP_ORG_ID,
    code: raw.code || 'KD-01',
    title: raw.title || '',
    shortName: raw.shortName || raw.title || '',
    ikn: raw.ikn || '',
    contractingAuthority: raw.contractingAuthority || raw.client || '',
    employer: raw.employer || raw.client || '',
    province: raw.province || 'Adana',
    district: raw.district || (String(raw.location || '').includes('Pozantı') ? 'Pozantı' : 'Seyhan'),
    location: raw.location || 'Adana',
    siteAddress: raw.siteAddress || raw.location || 'Adana',
    tenderDate: raw.tenderDate || '',
    approxCostKurus: raw.approxCostKurus ?? 0,
    bidAmountKurus: raw.bidAmountKurus ?? 0,
    discountRatePct: raw.discountRatePct ?? 0,
    contractAmountKurus:
      raw.contractAmountKurus ?? (raw.budget ? toKurus(raw.budget) : 0),
    approvedIncreaseKurus: raw.approvedIncreaseKurus ?? 0,
    approvedDecreaseKurus: raw.approvedDecreaseKurus ?? 0,
    priceDiffKurus: raw.priceDiffKurus ?? 0,
    estimatedRemainingCostKurus: raw.estimatedRemainingCostKurus ?? 0,
    vatRate: raw.vatRate ?? 20,
    contractDate: raw.contractDate || raw.startDate || '',
    siteDeliveryDate: raw.siteDeliveryDate || '',
    startDate: raw.startDate || '',
    endDate: raw.endDate || '',
    extensionDays: raw.extensionDays ?? 0,
    durationDays: raw.durationDays ?? 0,
    siteChief: raw.siteChief || raw.siteManager || 'Kuzey Denizi Teknik Ekibi',
    projectManager: raw.projectManager || 'Kuzey Denizi Yönetim',
    performanceBondKurus: raw.performanceBondKurus ?? 0,
    advanceAmountKurus: raw.advanceAmountKurus ?? 0,
    hasPriceDifference: raw.hasPriceDifference ?? false,
    physicalProgressPct: raw.physicalProgressPct ?? raw.progress ?? 100,
    financialProgressPct: raw.financialProgressPct ?? 0,
    status: mappedStatus,
    category: raw.category || 'kamu',
    description: raw.description || '',
    coverImage: raw.coverImage || raw.image || '/images/adana-adliye-gercek.jpg',
    sitePhotos: raw.sitePhotos || raw.galleryImages || [],
    publishedOnSite: raw.publishedOnSite ?? true,
    warnThresholds: raw.warnThresholds || {
      infoPct: 70,
      warningPct: 85,
      criticalPct: 95,
      overrunPct: 100,
      burnDivergencePct: 15,
    },
    createdBy: raw.createdBy || actorEmail,
    createdAt: raw.createdAt || now,
    updatedBy: raw.updatedBy || actorEmail,
    updatedAt: raw.updatedAt || now,
  };
}

export function getSeedErpProjects(): ErpProject[] {
  return SEED_PROJECTS.map((p) => hydrateLegacyProjectToErp(p, 'system'));
}

export function getSeedWarehouses(): WarehouseRecord[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'wh-merkez',
      organizationId: ERP_ORG_ID,
      name: 'Merkez Depo (Seyhan / Yeşiloba)',
      type: 'merkez',
      location: 'Yeşiloba Mah. 46088 Sk. No: 18 B, Seyhan / ADANA',
      manager: 'Depo Yönetimi',
      createdBy: 'system',
      createdAt: now,
      updatedBy: 'system',
      updatedAt: now,
    },
  ];
}

// Local storage helpers isolated by active session scope ('preview' or 'cloud_<uid>')
export function readLocalCollection<T>(col: string, fallback: T[]): T[] {
  try {
    const key = scopedColKey(col);
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw) as T[];
  } catch {
    return fallback;
  }
}

export function writeLocalCollection<T>(col: string, items: T[]): void {
  try {
    localStorage.setItem(scopedColKey(col), JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cb-erp-sync', { detail: { col } }));
  } catch {
    // Ignore storage quota
  }
}

export function readOfflineQueue(): OfflineDraftItem[] {
  try {
    const raw = localStorage.getItem(scopedQueueKey());
    return raw ? (JSON.parse(raw) as OfflineDraftItem[]) : [];
  } catch {
    return [];
  }
}

export function enqueueOfflineMutation(item: OfflineDraftItem): void {
  const queue = readOfflineQueue();
  if (queue.some((q) => q.clientMutationId === item.clientMutationId)) return;
  localStorage.setItem(scopedQueueKey(), JSON.stringify([...queue, item]));
  window.dispatchEvent(new CustomEvent('cb-erp-offline-queue'));
}

export async function flushOfflineQueue(): Promise<number> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;
  const queue = readOfflineQueue();
  if (queue.length === 0) return 0;

  let synced = 0;
  const remaining: OfflineDraftItem[] = [];
  for (const item of queue) {
    try {
      const payloadId = String(item.payload.id || item.id);
      await setDoc(doc(db, item.collection, payloadId), stripUndefinedDeep(item.payload), { merge: true });
      synced++;
    } catch {
      remaining.push(item);
    }
  }
  localStorage.setItem(scopedQueueKey(), JSON.stringify(remaining));
  window.dispatchEvent(new CustomEvent('cb-erp-offline-queue'));
  return synced;
}

export interface ErpSubscriptionFilter {
  singleDocId?: string;
  whereField?: 'projectId' | 'id' | 'requestedBy';
  values?: string[] | null;
}

export function subscribeErpCollection<T extends { id: string }>(
  colName: string,
  cloudMode: boolean,
  fallback: T[],
  onData: (items: T[]) => void,
  transform?: (raw: any) => T,
  filter?: ErpSubscriptionFilter
): Unsubscribe {
  if (!cloudMode) {
    const emit = () => {
      const list = readLocalCollection<any>(colName, fallback);
      onData(transform ? list.map(transform) : list);
    };
    emit();
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ col?: string }>;
      if (!ce.detail?.col || ce.detail.col === colName) emit();
    };
    window.addEventListener('cb-erp-sync', handler);
    return () => window.removeEventListener('cb-erp-sync', handler);
  }

  const sortDesc = (list: T[]) =>
    list.sort((a: any, b: any) =>
      String(b.createdAt || b.date || '').localeCompare(String(a.createdAt || a.date || ''))
    );

  // Scoped single-document subscription (e.g. own user profile document)
  if (filter?.singleDocId) {
    try {
      return onSnapshot(
        doc(db, colName, filter.singleDocId),
        (snap) => {
          if (!snap.exists()) {
            onData([]);
            return;
          }
          const raw = { ...snap.data(), id: snap.id };
          onData([transform ? transform(raw) : (raw as T)]);
        },
        (err) => {
          if ((err as any)?.code === 'permission-denied') {
            onData([]);
            return;
          }
          onData([]);
        }
      );
    } catch {
      onData([]);
      return () => {};
    }
  }

  // Scoped array filter subscription (enforces server-side Firestore `in` query matching security rules)
  if (filter && Array.isArray(filter.values)) {
    const uniqueValues = Array.from(new Set(filter.values.map((v) => String(v || '').trim()).filter(Boolean)));
    if (uniqueValues.length === 0) {
      onData([]);
      return () => {};
    }

    const fieldTarget = filter.whereField === 'id' ? documentId() : (filter.whereField || 'projectId');
    const chunks: string[][] = [];
    for (let i = 0; i < uniqueValues.length; i += 10) {
      chunks.push(uniqueValues.slice(i, i + 10));
    }

    const chunkResults = new Map<number, T[]>();
    const unsubs: Unsubscribe[] = [];
    const emitMerged = () => {
      const merged = new Map<string, T>();
      chunkResults.forEach((items) => items.forEach((item) => merged.set(item.id, item)));
      onData(sortDesc(Array.from(merged.values())));
    };

    try {
      chunks.forEach((chunk, chunkIdx) => {
        const q = query(collection(db, colName), where(fieldTarget, 'in', chunk));
        const u = onSnapshot(
          q,
          (snap) => {
            const list = snap.docs.map((d) => {
              const raw = { ...d.data(), id: d.id };
              return transform ? transform(raw) : (raw as T);
            });
            chunkResults.set(chunkIdx, list);
            emitMerged();
          },
          (err) => {
            if ((err as any)?.code === 'permission-denied') {
              chunkResults.set(chunkIdx, []);
              emitMerged();
              return;
            }
            chunkResults.set(chunkIdx, []);
            emitMerged();
          }
        );
        unsubs.push(u);
      });
    } catch {
      onData([]);
    }
    return () => unsubs.forEach((u) => u());
  }

  let unsub: Unsubscribe = () => {};
  try {
    unsub = onSnapshot(
      query(collection(db, colName)),
      (snap) => {
        const list = snap.docs.map((d) => {
          const raw = { ...d.data(), id: d.id };
          return transform ? transform(raw) : (raw as T);
        });
        sortDesc(list);
        onData(list);
      },
      (err) => {
        if ((err as any)?.code === 'permission-denied') {
          onData([]);
          return;
        }
        const list = readLocalCollection<any>(colName, fallback);
        onData(transform ? list.map(transform) : list);
      }
    );
  } catch {
    onData(fallback);
  }
  return unsub;
}

export async function appendAuditLog(
  entry: Omit<AuditLogEntry, 'id' | 'organizationId' | 'timestamp'>,
  cloudMode: boolean
): Promise<void> {
  const record: AuditLogEntry = stripUndefinedDeep({
    ...entry,
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    organizationId: ERP_ORG_ID,
    timestamp: new Date().toISOString(),
  });
  const existing = readLocalCollection<AuditLogEntry>('auditLogs', []);
  writeLocalCollection('auditLogs', [record, ...existing.slice(0, 199)]);
  if (cloudMode && (typeof navigator === 'undefined' || navigator.onLine)) {
    await setDoc(doc(db, 'auditLogs', record.id), record).catch(() => {});
  }
}

export async function saveErpRecord<T extends { id: string }>(
  colName: string,
  record: T,
  actorEmail: string,
  cloudMode: boolean,
  auditAction: AuditLogEntry['action'] = 'UPDATE',
  auditSummary = ''
): Promise<void> {
  const now = new Date().toISOString();
  const stamped: any = stripUndefinedDeep({
    ...record,
    organizationId: (record as any).organizationId || ERP_ORG_ID,
    createdBy: (record as any).createdBy || actorEmail,
    createdAt: (record as any).createdAt || now,
    updatedBy: actorEmail,
    updatedAt: now,
    clientMutationId: (record as any).clientMutationId || `mut-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  });

  // Sync legacy public fields for projects so public website (/ and /projeler) stays 100% compatible
  if (colName === 'projects') {
    const revMap: Record<string, string> = {
      Hazırlanıyor: 'planlama',
      'İhale Aşamasında': 'planlama',
      Kazanıldı: 'planlama',
      'Devam Ediyor': 'devam-ediyor',
      Askıda: 'devam-ediyor',
      'Geçici Kabul': 'test-kabul',
      'Kesin Kabul': 'teslim-edildi',
      Tamamlandı: 'teslim-edildi',
      'Tasfiye Edildi': 'teslim-edildi',
    };
    stamped.image = stamped.coverImage || stamped.image;
    stamped.galleryImages = stamped.sitePhotos || stamped.galleryImages || [];
    stamped.client = stamped.employer || stamped.contractingAuthority || stamped.client || '';
    stamped.statusBadge = stamped.status;
    stamped.progress = stamped.physicalProgressPct ?? 0;
    stamped.budget = Math.round((stamped.contractAmountKurus || 0) / 100);
    stamped.legacyStatus = revMap[stamped.status] || 'devam-ediyor';
  }

  const list = readLocalCollection<any>(colName, []);
  const idx = list.findIndex((x) => x.id === stamped.id);
  const next = idx >= 0 ? list.map((x) => (x.id === stamped.id ? stamped : x)) : [stamped, ...list];
  writeLocalCollection(colName, next);

  if (cloudMode) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enqueueOfflineMutation({
        id: `off-${Date.now()}`,
        clientMutationId: stamped.clientMutationId,
        collection: colName,
        payload: stamped,
        createdAt: now,
        label: `${colName}: ${stamped.title || stamped.name || stamped.id}`,
      });
    } else {
      await setDoc(doc(db, colName, stamped.id), stamped, { merge: true });
    }
  }

  if (auditSummary) {
    await appendAuditLog(
      {
        entityType: colName,
        entityId: stamped.id,
        projectId: stamped.projectId,
        action: auditAction,
        actorEmail,
        summary: auditSummary,
      },
      cloudMode
    );
  }
}

export async function deleteErpRecord(
  colName: string,
  id: string,
  actorEmail: string,
  cloudMode: boolean,
  isLocked = false
): Promise<void> {
  if (isLocked) {
    throw new Error(
      'Kesinleşmiş finansal kayıtlar doğrudan silinemez. İptal veya düzeltme (ters kayıt) işlemi kullanın.'
    );
  }
  const list = readLocalCollection<any>(colName, []);
  writeLocalCollection(
    colName,
    list.filter((x) => x.id !== id)
  );
  if (cloudMode) {
    await deleteDoc(doc(db, colName, id));
  }
  await appendAuditLog(
    {
      entityType: colName,
      entityId: id,
      action: 'DELETE',
      actorEmail,
      summary: `${colName}/${id} silindi`,
    },
    cloudMode
  );
}

/**
 * Confirms an OCR/XML/Manual invoice, saves attachments, and creates allocated expenses or warehouse stock
 * atomically in a single Firestore writeBatch without double-counting.
 */
export async function confirmAndPostInvoice(
  invoice: InvoiceRecord,
  actorEmail: string,
  cloudMode: boolean
): Promise<void> {
  const allocSum = invoice.allocations.reduce((s, a) => s + a.allocatedGrossKurus, 0);
  if (invoice.allocations.length > 0 && allocSum > invoice.grandTotalKurus + 1) {
    throw new Error('Toplam proje/depo gider dağıtımı fatura genel toplamını aşamaz.');
  }

  const now = new Date().toISOString();
  const finalizedInvoice: InvoiceRecord = {
    ...invoice,
    organizationId: ERP_ORG_ID,
    confirmedByUser: true,
    locked: true,
    createdBy: invoice.createdBy || actorEmail,
    createdAt: invoice.createdAt || now,
    updatedBy: actorEmail,
    updatedAt: now,
  };

  const expenseEntries: ExpenseRecord[] = [];
  const docVaultEntries: DocumentVaultItem[] = [];
  const stockEntries: StockItem[] = [];
  const stockMovEntries: StockMovement[] = [];
  const localStock = readLocalCollection<StockItem>('stockItems', []);

  // Create allocated ExpenseRecords for project targets and StockItems/Movements for warehouse targets
  const effectiveAllocations =
    finalizedInvoice.allocations.length > 0
      ? finalizedInvoice.allocations
      : [
          {
            id: `al-default-${Date.now()}`,
            invoiceId: finalizedInvoice.id,
            targetType: 'project' as const,
            targetId: finalizedInvoice.projectId || 'company_overhead',
            targetName: 'Bağlı Proje',
            mode: 'percent' as const,
            value: 100,
            allocatedNetKurus: finalizedInvoice.subtotalKurus,
            allocatedVatKurus: finalizedInvoice.vatTotalKurus,
            allocatedGrossKurus: finalizedInvoice.grandTotalKurus,
          },
        ];

  effectiveAllocations.forEach((alloc, idx) => {
    const firstItem = finalizedInvoice.items[0];
    if (alloc.targetType === 'project') {
      expenseEntries.push({
        id: `exp-${finalizedInvoice.id}-${idx + 1}`,
        organizationId: ERP_ORG_ID,
        projectId: alloc.targetId,
        categoryGroup: firstItem?.categoryGroup || 'İnşaat İmalatları',
        categorySub: firstItem?.categorySub || 'Diğer giderler',
        description: `Fatura #${finalizedInvoice.invoiceNo} (${finalizedInvoice.supplierName})`,
        date: finalizedInvoice.issueDate || now.slice(0, 10),
        netKurus: alloc.allocatedNetKurus,
        vatRate: firstItem?.vatRate ?? 20,
        vatKurus: alloc.allocatedVatKurus,
        grossKurus: alloc.allocatedGrossKurus,
        deductibleVat: finalizedInvoice.deductibleVat,
        sourceType: 'invoice',
        sourceId: finalizedInvoice.id,
        locked: true,
        createdBy: actorEmail,
        createdAt: now,
        updatedBy: actorEmail,
        updatedAt: now,
      });
    } else if (alloc.targetType === 'warehouse') {
      const ratio =
        finalizedInvoice.grandTotalKurus > 0
          ? alloc.allocatedGrossKurus / finalizedInvoice.grandTotalKurus
          : 1;
      const lineItems = finalizedInvoice.items.length > 0 ? finalizedInvoice.items : [];
      const itemQty = lineItems.length === 1 ? Math.max(0.01, Number((lineItems[0].quantity * ratio).toFixed(2))) : 1;
      const itemName = lineItems.length === 1
        ? lineItems[0].name
        : `Fatura #${finalizedInvoice.invoiceNo} — ${finalizedInvoice.supplierName}`;
      const itemUnit = lineItems.length === 1 ? lineItems[0].unit : 'Takım';
      const costKurus = finalizedInvoice.deductibleVat ? alloc.allocatedNetKurus : alloc.allocatedGrossKurus;
      const unitCostKurus = itemQty > 0 ? Math.round(costKurus / itemQty) : costKurus;

      const existingMatch = localStock.find(
        (s) => s.warehouseId === alloc.targetId && s.name.toLowerCase() === itemName.toLowerCase()
      );
      const stockId = existingMatch?.id || `stk-inv-${finalizedInvoice.id}-${idx + 1}`;
      const nextQty = (existingMatch?.quantity || 0) + itemQty;
      const nextTotalVal = (existingMatch?.totalValueKurus || 0) + costKurus;

      stockEntries.push({
        id: stockId,
        organizationId: ERP_ORG_ID,
        warehouseId: alloc.targetId,
        sku: existingMatch?.sku || `KD-${finalizedInvoice.invoiceNo.slice(-4) || idx + 1}`,
        barcode: existingMatch?.barcode || `869${Date.now().toString().slice(-10)}`,
        name: itemName,
        category: firstItem?.categoryGroup || 'İnşaat İmalatları',
        unit: itemUnit,
        quantity: nextQty,
        minStockLevel: existingMatch?.minStockLevel ?? 5,
        avgUnitCostKurus: nextQty > 0 ? Math.round(nextTotalVal / nextQty) : unitCostKurus,
        totalValueKurus: nextTotalVal,
        usedQty: existingMatch?.usedQty || 0,
        createdBy: existingMatch?.createdBy || actorEmail,
        createdAt: existingMatch?.createdAt || now,
        updatedBy: actorEmail,
        updatedAt: now,
      });

      stockMovEntries.push({
        id: `smv-inv-${finalizedInvoice.id}-${idx + 1}`,
        organizationId: ERP_ORG_ID,
        projectId: finalizedInvoice.projectId !== 'multi' ? finalizedInvoice.projectId : '',
        stockItemId: stockId,
        itemName,
        movementType: 'Giriş',
        toWarehouseId: alloc.targetId,
        quantity: itemQty,
        unitCostKurus,
        totalCostKurus: costKurus,
        date: finalizedInvoice.issueDate || now.slice(0, 10),
        notes: `Fatura #${finalizedInvoice.invoiceNo} ile depo girişi`,
        createdBy: actorEmail,
        createdAt: now,
        updatedBy: actorEmail,
        updatedAt: now,
      });
    }
  });

  finalizedInvoice.attachments.forEach((att, idx) => {
    docVaultEntries.push({
      id: `doc-inv-${finalizedInvoice.id}-${idx + 1}`,
      organizationId: ERP_ORG_ID,
      projectId: finalizedInvoice.projectId,
      title: `Fatura #${finalizedInvoice.invoiceNo} — ${att.name}`,
      category: 'Fatura',
      fileName: att.name,
      mimeType: att.mimeType,
      url: att.previewUrl || att.originalUrl,
      originalUrl: att.originalUrl,
      version: att.version,
      sizeBytes: 0,
      createdBy: actorEmail,
      createdAt: now,
      updatedBy: actorEmail,
      updatedAt: now,
    });
  });

  // Update local mirrors
  const invList = readLocalCollection<InvoiceRecord>('invoices', []);
  writeLocalCollection('invoices', [finalizedInvoice, ...invList.filter((i) => i.id !== finalizedInvoice.id)]);
  if (expenseEntries.length > 0) {
    const expList = readLocalCollection<ExpenseRecord>('expenses', []);
    writeLocalCollection('expenses', [...expenseEntries, ...expList]);
  }
  if (stockEntries.length > 0) {
    const mergedStock = [...localStock];
    stockEntries.forEach((se) => {
      const idx = mergedStock.findIndex((x) => x.id === se.id);
      if (idx >= 0) mergedStock[idx] = se;
      else mergedStock.unshift(se);
    });
    writeLocalCollection('stockItems', mergedStock);
    const movList = readLocalCollection<StockMovement>('stockMovements', []);
    writeLocalCollection('stockMovements', [...stockMovEntries, ...movList]);
  }
  if (docVaultEntries.length > 0) {
    const docList = readLocalCollection<DocumentVaultItem>('documents', []);
    writeLocalCollection('documents', [...docVaultEntries, ...docList]);
  }

  if (cloudMode) {
    const batch = writeBatch(db);
    batch.set(doc(db, 'invoices', finalizedInvoice.id), stripUndefinedDeep(finalizedInvoice));
    expenseEntries.forEach((e) => batch.set(doc(db, 'expenses', e.id), stripUndefinedDeep(e)));
    stockEntries.forEach((s) => batch.set(doc(db, 'stockItems', s.id), stripUndefinedDeep(s), { merge: true }));
    stockMovEntries.forEach((m) => batch.set(doc(db, 'stockMovements', m.id), stripUndefinedDeep(m)));
    docVaultEntries.forEach((d) => batch.set(doc(db, 'documents', d.id), stripUndefinedDeep(d)));
    await batch.commit();
  }

  await appendAuditLog(
    {
      entityType: 'invoices',
      entityId: finalizedInvoice.id,
      projectId: finalizedInvoice.projectId,
      action: 'CREATE',
      actorEmail,
      summary: `Fatura #${finalizedInvoice.invoiceNo} onaylandı ve ${expenseEntries.length} proje giderine dağıtıldı.`,
    },
    cloudMode
  );
}

/**
 * Reverses a finalized invoice or expense via offsetting negative entry (never hard-deletes).
 */
export async function reverseInvoiceRecord(
  invoice: InvoiceRecord,
  expenses: ExpenseRecord[],
  actorEmail: string,
  cloudMode: boolean,
  reason: string
): Promise<void> {
  const now = new Date().toISOString();
  const revInv: InvoiceRecord = {
    ...invoice,
    id: `rev-${invoice.id}-${Date.now()}`,
    invoiceNo: `İPTAL-${invoice.invoiceNo}`,
    invoiceType: 'İADE',
    subtotalKurus: -invoice.subtotalKurus,
    vatTotalKurus: -invoice.vatTotalKurus,
    grandTotalKurus: -invoice.grandTotalKurus,
    paidKurus: 0,
    remainingDebtKurus: 0,
    reversalOfId: invoice.id,
    notes: `Ters Kayıt Nedeni: ${reason}`,
    createdBy: actorEmail,
    createdAt: now,
    updatedBy: actorEmail,
    updatedAt: now,
  };

  const linkedExps = expenses.filter((e) => e.sourceId === invoice.id && !e.reversalOfId);
  const revExps: ExpenseRecord[] = linkedExps.map((e, i) => ({
    ...e,
    id: `rev-exp-${e.id}-${i}-${Date.now()}`,
    description: `İPTAL: ${e.description} (${reason})`,
    netKurus: -e.netKurus,
    vatKurus: -e.vatKurus,
    grossKurus: -e.grossKurus,
    reversalOfId: e.id,
    createdBy: actorEmail,
    createdAt: now,
    updatedBy: actorEmail,
    updatedAt: now,
  }));

  const invList = readLocalCollection<InvoiceRecord>('invoices', []);
  writeLocalCollection('invoices', [revInv, ...invList]);
  if (revExps.length > 0) {
    const expList = readLocalCollection<ExpenseRecord>('expenses', []);
    writeLocalCollection('expenses', [...revExps, ...expList]);
  }

  if (cloudMode) {
    const batch = writeBatch(db);
    batch.set(doc(db, 'invoices', revInv.id), stripUndefinedDeep(revInv));
    revExps.forEach((re) => batch.set(doc(db, 'expenses', re.id), stripUndefinedDeep(re)));
    await batch.commit();
  }

  await appendAuditLog(
    {
      entityType: 'invoices',
      entityId: invoice.id,
      projectId: invoice.projectId,
      action: 'REVERSE',
      actorEmail,
      summary: `Fatura #${invoice.invoiceNo} için ters/iptal kaydı oluşturuldu (${reason}).`,
    },
    cloudMode
  );
}

export async function reverseExpenseRecord(
  expense: ExpenseRecord,
  actorEmail: string,
  cloudMode: boolean,
  reason: string
): Promise<void> {
  const now = new Date().toISOString();
  const revExp: ExpenseRecord = {
    ...expense,
    id: `rev-exp-${expense.id}-${Date.now()}`,
    description: `İPTAL: ${expense.description} (${reason})`,
    netKurus: -expense.netKurus,
    vatKurus: -expense.vatKurus,
    grossKurus: -expense.grossKurus,
    reversalOfId: expense.id,
    locked: true,
    createdBy: actorEmail,
    createdAt: now,
    updatedBy: actorEmail,
    updatedAt: now,
  };
  await saveErpRecord(
    'expenses',
    revExp,
    actorEmail,
    cloudMode,
    'REVERSE',
    `Gider ters kaydı oluşturuldu: ${expense.description} (${reason})`
  );
}

function applyLocalPaymentSettlement(finalPayment: PaymentRecord) {
  const banks = readLocalCollection<BankAccount>('bankAccounts', []);
  if (finalPayment.bankAccountId) {
    writeLocalCollection(
      'bankAccounts',
      banks.map((b) =>
        b.id === finalPayment.bankAccountId
          ? {
              ...b,
              balanceKurus:
                b.balanceKurus +
                (finalPayment.direction === 'Tahsilat'
                  ? finalPayment.amountKurus
                  : -finalPayment.amountKurus),
            }
          : b
      )
    );
  }
  if (finalPayment.invoiceId) {
    const invs = readLocalCollection<InvoiceRecord>('invoices', []);
    writeLocalCollection(
      'invoices',
      invs.map((inv) => {
        if (inv.id !== finalPayment.invoiceId) return inv;
        const nextPaid = (inv.paidKurus || 0) + finalPayment.amountKurus;
        return {
          ...inv,
          paidKurus: nextPaid,
          remainingDebtKurus: Math.max(0, inv.grandTotalKurus - nextPaid),
        };
      })
    );
  }
  if (finalPayment.hakedisId) {
    const hks = readLocalCollection<ProgressPayment>('progressPayments', []);
    writeLocalCollection(
      'progressPayments',
      hks.map((hk) => {
        if (hk.id !== finalPayment.hakedisId) return hk;
        const nextCollected = (hk.collectedKurus || 0) + finalPayment.amountKurus;
        const nextRem = Math.max(0, (hk.netPayableKurus || 0) - nextCollected);
        return {
          ...hk,
          collectedKurus: nextCollected,
          remainingReceivableKurus: nextRem,
          collectionDate: finalPayment.date,
          status: nextRem === 0 ? 'Ödendi' : 'Kısmi Ödendi',
        };
      })
    );
  }
  if (finalPayment.subcontractorId) {
    const subs = readLocalCollection<SubcontractorCard>('subcontractors', []);
    writeLocalCollection(
      'subcontractors',
      subs.map((sub) => {
        if (sub.id !== finalPayment.subcontractorId) return sub;
        const nextPaid = (sub.paidTotalKurus || 0) + finalPayment.amountKurus;
        const nextRem = Math.max(
          0,
          (sub.hakedisTotalKurus || 0) -
            (sub.advanceGivenKurus || 0) -
            nextPaid -
            (sub.retentionKurus || 0) -
            (sub.companyMaterialDeductionKurus || 0)
        );
        return {
          ...sub,
          paidTotalKurus: nextPaid,
          remainingDebtKurus: nextRem,
        };
      })
    );
  }
  const pays = readLocalCollection<PaymentRecord>('payments', []);
  const idx = pays.findIndex((p) => p.id === finalPayment.id);
  writeLocalCollection(
    'payments',
    idx >= 0
      ? pays.map((p) => (p.id === finalPayment.id ? finalPayment : p))
      : [finalPayment, ...pays]
  );
}

async function settlePaymentInFirestore(
  finalPayment: PaymentRecord,
  approvalUpdate?: ApprovalRequest
): Promise<void> {
  const now = new Date().toISOString();
  await runTransaction(db, async (tx) => {
    const bankSnap = finalPayment.bankAccountId
      ? await tx.get(doc(db, 'bankAccounts', finalPayment.bankAccountId))
      : null;
    const invSnap = finalPayment.invoiceId
      ? await tx.get(doc(db, 'invoices', finalPayment.invoiceId))
      : null;
    const hkSnap = finalPayment.hakedisId
      ? await tx.get(doc(db, 'progressPayments', finalPayment.hakedisId))
      : null;
    const subSnap = finalPayment.subcontractorId
      ? await tx.get(doc(db, 'subcontractors', finalPayment.subcontractorId))
      : null;

    if (bankSnap && bankSnap.exists()) {
      const curBal = (bankSnap.data().balanceKurus as number) || 0;
      const delta =
        finalPayment.direction === 'Tahsilat'
          ? finalPayment.amountKurus
          : -finalPayment.amountKurus;
      tx.update(bankSnap.ref, { balanceKurus: curBal + delta, updatedAt: now });
    }
    if (invSnap && invSnap.exists()) {
      const d = invSnap.data() as InvoiceRecord;
      const nextPaid = (d.paidKurus || 0) + finalPayment.amountKurus;
      const nextRem = Math.max(0, (d.grandTotalKurus || 0) - nextPaid);
      tx.update(invSnap.ref, {
        paidKurus: nextPaid,
        remainingDebtKurus: nextRem,
        updatedAt: now,
      });
    }
    if (hkSnap && hkSnap.exists()) {
      const d = hkSnap.data() as ProgressPayment;
      const nextCollected = (d.collectedKurus || 0) + finalPayment.amountKurus;
      const nextRem = Math.max(0, (d.netPayableKurus || 0) - nextCollected);
      tx.update(hkSnap.ref, {
        collectedKurus: nextCollected,
        remainingReceivableKurus: nextRem,
        collectionDate: finalPayment.date,
        status: nextRem === 0 ? 'Ödendi' : 'Kısmi Ödendi',
        updatedAt: now,
      });
    }
    if (subSnap && subSnap.exists()) {
      const d = subSnap.data() as SubcontractorCard;
      const nextPaid = (d.paidTotalKurus || 0) + finalPayment.amountKurus;
      const nextRem = Math.max(
        0,
        (d.hakedisTotalKurus || 0) -
          (d.advanceGivenKurus || 0) -
          nextPaid -
          (d.retentionKurus || 0) -
          (d.companyMaterialDeductionKurus || 0)
      );
      tx.update(subSnap.ref, {
        paidTotalKurus: nextPaid,
        remainingDebtKurus: nextRem,
        updatedAt: now,
      });
    }

    tx.set(doc(db, 'payments', finalPayment.id), stripUndefinedDeep(finalPayment), { merge: true });
    if (approvalUpdate) {
      tx.set(doc(db, 'approvals', approvalUpdate.id), stripUndefinedDeep(approvalUpdate), { merge: true });
    }
  });
}

/**
 * Records a payment or collection atomically, supporting partial invoice, hakedis,
 * subcontractor settlement, bank balance update, and amount-based approval queuing.
 */
export async function postPaymentWithApproval(
  payment: PaymentRecord,
  currentUser: ErpUserAccount | null,
  settings: ErpSettings,
  cloudMode: boolean
): Promise<{ queuedForApproval: boolean; requiredRoleLabel?: string }> {
  const isOutgoing = payment.direction === 'Ödeme';
  const canApproveNow = !isOutgoing || canUserApproveAmount(currentUser, payment.amountKurus, settings);

  if (!canApproveNow) {
    const req = getRequiredApprovalLevel(payment.amountKurus, settings);
    const pendingPayment: PaymentRecord = {
      ...payment,
      approvalStatus: 'Onay Bekliyor',
      locked: false,
    };
    const approvalReq: ApprovalRequest = {
      id: `apr-${Date.now()}`,
      organizationId: ERP_ORG_ID,
      entityType: 'payment',
      entityId: payment.id,
      projectId: payment.projectId,
      title: `${payment.targetName} — Ödeme Onayı`,
      amountKurus: payment.amountKurus,
      requiredRoleLabel: req.requiredRoleLabel,
      status: 'Onay Bekliyor',
      requestedBy: currentUser?.email || 'sistem',
      createdBy: currentUser?.email || 'sistem',
      createdAt: new Date().toISOString(),
      updatedBy: currentUser?.email || 'sistem',
      updatedAt: new Date().toISOString(),
    };

    await saveErpRecord('payments', pendingPayment, currentUser?.email || 'sistem', cloudMode);
    await saveErpRecord(
      'approvals',
      approvalReq,
      currentUser?.email || 'sistem',
      cloudMode,
      'CREATE',
      `Ödeme onaya gönderildi: ${req.requiredRoleLabel}`
    );
    return { queuedForApproval: true, requiredRoleLabel: req.requiredRoleLabel };
  }

  const finalPayment: PaymentRecord = {
    ...payment,
    approvalStatus: 'Onaylandı',
    locked: true,
  };

  if (cloudMode) {
    await settlePaymentInFirestore(finalPayment);
  }
  applyLocalPaymentSettlement(finalPayment);

  await appendAuditLog(
    {
      entityType: 'payments',
      entityId: finalPayment.id,
      projectId: finalPayment.projectId,
      action: 'CREATE',
      actorEmail: currentUser?.email || 'sistem',
      summary: `${finalPayment.direction} kaydedildi: ${finalPayment.targetName}`,
    },
    cloudMode
  );

  return { queuedForApproval: false };
}

export async function approveOrRejectRequest(
  apr: ApprovalRequest,
  approved: boolean,
  currentUser: ErpUserAccount | null,
  settings: ErpSettings,
  cloudMode: boolean
): Promise<void> {
  if (!canUserApproveAmount(currentUser, apr.amountKurus, settings)) {
    throw new Error(`Bu işlem için "${apr.requiredRoleLabel}" yetkisi gerekiyor.`);
  }
  const actorEmail = currentUser?.email || 'sistem';
  const now = new Date().toISOString();
  const nextStatus = approved ? 'Onaylandı' : 'Reddedildi';
  const updatedApr: ApprovalRequest = {
    ...apr,
    status: nextStatus,
    decidedBy: actorEmail,
    decidedAt: now,
    updatedBy: actorEmail,
    updatedAt: now,
  };

  if (apr.entityType === 'payment') {
    let payRecord: PaymentRecord | null = null;
    if (cloudMode) {
      const snap = await getDoc(doc(db, 'payments', apr.entityId));
      if (snap.exists()) {
        payRecord = { ...(snap.data() as PaymentRecord), id: snap.id };
      }
    } else {
      payRecord =
        readLocalCollection<PaymentRecord>('payments', []).find((p) => p.id === apr.entityId) || null;
    }

    if (approved && payRecord) {
      const settled: PaymentRecord = {
        ...payRecord,
        approvalStatus: 'Onaylandı',
        locked: true,
        updatedBy: actorEmail,
        updatedAt: now,
      };
      if (cloudMode) {
        await settlePaymentInFirestore(settled, updatedApr);
      }
      applyLocalPaymentSettlement(settled);
    } else {
      await saveErpRecord('approvals', updatedApr, actorEmail, cloudMode);
      if (payRecord) {
        await saveErpRecord(
          'payments',
          { ...payRecord, approvalStatus: nextStatus, locked: false },
          actorEmail,
          cloudMode
        );
      }
    }
  } else if (apr.entityType === 'purchase') {
    await saveErpRecord('approvals', updatedApr, actorEmail, cloudMode);
    await saveErpRecord(
      'purchases',
      { id: apr.entityId, approvalStatus: nextStatus } as any,
      actorEmail,
      cloudMode
    );
  } else {
    await saveErpRecord('approvals', updatedApr, actorEmail, cloudMode);
  }

  await appendAuditLog(
    {
      entityType: 'approvals',
      entityId: apr.id,
      projectId: apr.projectId,
      action: approved ? 'APPROVE' : 'REJECT',
      actorEmail,
      summary: `Onay kararı (${nextStatus}): ${apr.title}`,
    },
    cloudMode
  );
}

export async function recordStockConsumption(
  item: StockItem,
  qty: number,
  warehouse: WarehouseRecord,
  targetProject: ErpProject | undefined,
  actorEmail: string,
  cloudMode: boolean,
  notes = ''
): Promise<void> {
  if (qty <= 0 || qty > item.quantity) {
    throw new Error('Kullanım miktarı sıfırdan büyük olmalı ve mevcut stoku aşmamalıdır.');
  }
  const now = new Date().toISOString();
  const costKurus = Math.round(qty * item.avgUnitCostKurus);
  const nextQty = Number((item.quantity - qty).toFixed(2));
  const updatedItem: StockItem = {
    ...item,
    quantity: nextQty,
    usedQty: Number(((item.usedQty || 0) + qty).toFixed(2)),
    totalValueKurus: Math.round(nextQty * item.avgUnitCostKurus),
    updatedBy: actorEmail,
    updatedAt: now,
  };
  const mov: StockMovement = {
    id: `smv-use-${Date.now()}`,
    organizationId: ERP_ORG_ID,
    projectId: targetProject?.id || warehouse.projectId || '',
    stockItemId: item.id,
    itemName: item.name,
    movementType: 'Çıkış',
    fromWarehouseId: warehouse.id,
    fromProjectId: warehouse.projectId,
    toProjectId: targetProject?.id,
    quantity: qty,
    unitCostKurus: item.avgUnitCostKurus,
    totalCostKurus: costKurus,
    date: now.slice(0, 10),
    notes: notes || `${warehouse.name} -> ${targetProject?.shortName || 'Şantiye'} sarf çıkışı`,
    createdBy: actorEmail,
    createdAt: now,
    updatedBy: actorEmail,
    updatedAt: now,
  };

  await saveErpRecord('stockItems', updatedItem, actorEmail, cloudMode);
  await saveErpRecord('stockMovements', mov, actorEmail, cloudMode);

  // Only post expense when consuming out of Merkez Depo into a project (santiye warehouse stock is already expensed on arrival)
  if (warehouse.type === 'merkez' && targetProject?.id) {
    const exp: ExpenseRecord = {
      id: `exp-use-${Date.now()}`,
      organizationId: ERP_ORG_ID,
      projectId: targetProject.id,
      categoryGroup: 'İnşaat İmalatları',
      categorySub: item.category || 'Diğer giderler',
      description: `Depo Sarf Çıkışı: ${item.name} (${qty} ${item.unit})`,
      date: now.slice(0, 10),
      netKurus: costKurus,
      vatRate: 0,
      vatKurus: 0,
      grossKurus: costKurus,
      deductibleVat: false,
      sourceType: 'stock_transfer',
      sourceId: mov.id,
      locked: true,
      createdBy: actorEmail,
      createdAt: now,
      updatedBy: actorEmail,
      updatedAt: now,
    };
    await saveErpRecord('expenses', exp, actorEmail, cloudMode);
  }
}

/**
 * Backward-compatible migration: runs safely on sign-in, preserves all existing real records,
 * and initializes core ERP collections if missing.
 */
export async function runBackwardCompatibleErpMigration(actorEmail: string): Promise<void> {
  try {
    const [projSnap, whSnap, userSnap, settingsSnap] = await Promise.all([
      getDocs(collection(db, 'projects')),
      getDocs(collection(db, 'warehouses')),
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'settings')),
    ]);

    const batch = writeBatch(db);
    let hasOps = false;

    if (projSnap.empty) {
      getSeedErpProjects().forEach((p) => {
        batch.set(doc(db, 'projects', p.id), p);
        hasOps = true;
      });
    } else {
      // Non-destructively upgrade legacy project documents to full ERP fields
      projSnap.docs.forEach((d) => {
        const raw = d.data();
        if (!raw.organizationId || raw.contractAmountKurus === undefined) {
          const upgraded = hydrateLegacyProjectToErp({ ...raw, id: d.id }, actorEmail);
          batch.set(doc(db, 'projects', d.id), upgraded, { merge: true });
          hasOps = true;
        }
      });
    }

    if (whSnap.empty) {
      getSeedWarehouses().forEach((w) => {
        batch.set(doc(db, 'warehouses', w.id), w);
        hasOps = true;
      });
    }

    const existingUserIds = new Set(userSnap.docs.map((d) => d.id.toLowerCase()));
    const now = new Date().toISOString();
    const owners: ErpUserAccount[] = [
      {
        id: 'cebrailkara@gmail.com',
        email: 'cebrailkara@gmail.com',
        fullName: 'Cebrail Kara',
        roleId: 'sirket_sahibi',
        assignedProjectIds: [],
        active: true,
        organizationId: ERP_ORG_ID,
        createdBy: 'system',
        createdAt: now,
        updatedBy: 'system',
        updatedAt: now,
      },
      {
        id: 'yalinizlargrup@gmail.com',
        email: 'yalinizlargrup@gmail.com',
        fullName: 'Yalınızlar Grup Süper Admin',
        roleId: 'sirket_sahibi',
        assignedProjectIds: [],
        active: true,
        organizationId: ERP_ORG_ID,
        createdBy: 'system',
        createdAt: now,
        updatedBy: 'system',
        updatedAt: now,
      },
      {
        id: 'ilkeryaliniz@gmail.com',
        email: 'ilkeryaliniz@gmail.com',
        fullName: 'İlker Yalınız',
        roleId: 'sirket_sahibi',
        assignedProjectIds: [],
        active: true,
        organizationId: ERP_ORG_ID,
        createdBy: 'system',
        createdAt: now,
        updatedBy: 'system',
        updatedAt: now,
      },
      {
        id: 'info@kuzeydeniziyapi.com.tr',
        email: 'info@kuzeydeniziyapi.com.tr',
        fullName: 'Kuzey Denizi Yönetici',
        roleId: 'sirket_sahibi',
        assignedProjectIds: [],
        active: true,
        organizationId: ERP_ORG_ID,
        createdBy: 'system',
        createdAt: now,
        updatedBy: 'system',
        updatedAt: now,
      },
    ];
    owners.forEach((u) => {
      if (!existingUserIds.has(u.id)) {
        batch.set(doc(db, 'users', u.id), u);
        hasOps = true;
      }
    });

    if (settingsSnap.empty) {
      batch.set(doc(db, 'settings', 'general'), DEFAULT_ERP_SETTINGS);
      hasOps = true;
    }

    if (hasOps) {
      await batch.commit();
    }
  } catch (err) {
    console.warn('[ERP Migration] Uyarı:', err);
  }
}

export async function convertTenderToProject(
  tender: TenderRecord,
  actorEmail: string,
  cloudMode: boolean
): Promise<ErpProject> {
  const now = new Date().toISOString();
  const project: ErpProject = {
    id: `prj-ihale-${Date.now()}`,
    organizationId: ERP_ORG_ID,
    code: tender.ikn || `KD-${Date.now().toString().slice(-4)}`,
    title: tender.title,
    shortName: tender.title.slice(0, 42),
    ikn: tender.ikn,
    contractingAuthority: tender.authority,
    employer: tender.authority,
    province: tender.province || 'Adana',
    district: tender.district || 'Seyhan',
    location: `${tender.district || 'Seyhan'} / ${tender.province || 'Adana'}`,
    siteAddress: `${tender.district || 'Seyhan'} / ${tender.province || 'Adana'}`,
    tenderDate: tender.tenderDate,
    approxCostKurus: tender.approxCostKurus,
    bidAmountKurus: tender.ourBidKurus,
    discountRatePct: tender.discountRatePct,
    contractAmountKurus: tender.ourBidKurus,
    approvedIncreaseKurus: 0,
    approvedDecreaseKurus: 0,
    priceDiffKurus: 0,
    estimatedRemainingCostKurus: tender.estimatedCostKurus,
    vatRate: 20,
    contractDate: tender.contractDeadline || now.slice(0, 10),
    siteDeliveryDate: '',
    startDate: now.slice(0, 10),
    endDate: '',
    extensionDays: 0,
    durationDays: 180,
    siteChief: 'Atanacak',
    projectManager: 'Atanacak',
    performanceBondKurus: Math.round((tender.ourBidKurus * 6) / 100),
    advanceAmountKurus: 0,
    hasPriceDifference: false,
    physicalProgressPct: 0,
    financialProgressPct: 0,
    status: 'Kazanıldı',
    category: 'kamu',
    description: `${tender.ikn} İKN'li ihale kazanılarak aktif projeye dönüştürüldü.`,
    coverImage: '/images/insaat-taahhut.jpg',
    sitePhotos: ['/images/insaat-taahhut.jpg'],
    publishedOnSite: false,
    warnThresholds: {
      infoPct: 70,
      warningPct: 85,
      criticalPct: 95,
      overrunPct: 100,
      burnDivergencePct: 15,
    },
    createdBy: actorEmail,
    createdAt: now,
    updatedBy: actorEmail,
    updatedAt: now,
  };

  await saveErpRecord(
    'projects',
    project,
    actorEmail,
    cloudMode,
    'CREATE',
    `İhale (#${tender.ikn}) aktif projeye dönüştürüldü.`
  );
  await saveErpRecord(
    'tenders',
    { ...tender, result: 'Kazanıldı', convertedProjectId: project.id },
    actorEmail,
    cloudMode
  );
  return project;
}

export async function transferWarehouseStock(
  item: StockItem,
  qty: number,
  fromWarehouse: WarehouseRecord,
  toWarehouse: WarehouseRecord,
  actorEmail: string,
  cloudMode: boolean
): Promise<void> {
  if (qty <= 0 || qty > item.quantity) {
    throw new Error('Transfer miktarı mevcut stoktan büyük veya sıfır olamaz.');
  }
  const now = new Date().toISOString();
  const transferCostKurus = Math.round(qty * item.avgUnitCostKurus);

  const updatedSource: StockItem = {
    ...item,
    quantity: item.quantity - qty,
    totalValueKurus: Math.round((item.quantity - qty) * item.avgUnitCostKurus),
    updatedBy: actorEmail,
    updatedAt: now,
  };

  const targetItem: StockItem = {
    ...item,
    id: `stk-${toWarehouse.id}-${item.sku || item.id}`,
    warehouseId: toWarehouse.id,
    quantity: qty,
    totalValueKurus: transferCostKurus,
    usedQty: 0,
    createdBy: actorEmail,
    createdAt: now,
    updatedBy: actorEmail,
    updatedAt: now,
  };

  const movement: StockMovement = {
    id: `smv-${Date.now()}`,
    organizationId: ERP_ORG_ID,
    projectId: toWarehouse.projectId || fromWarehouse.projectId,
    stockItemId: item.id,
    itemName: item.name,
    movementType:
      fromWarehouse.type === 'santiye' && toWarehouse.type === 'santiye'
        ? 'Şantiye Transfer'
        : 'Depo Transfer',
    fromWarehouseId: fromWarehouse.id,
    toWarehouseId: toWarehouse.id,
    fromProjectId: fromWarehouse.projectId,
    toProjectId: toWarehouse.projectId,
    quantity: qty,
    unitCostKurus: item.avgUnitCostKurus,
    totalCostKurus: transferCostKurus,
    date: now.slice(0, 10),
    notes: `${fromWarehouse.name} -> ${toWarehouse.name} transferi`,
    createdBy: actorEmail,
    createdAt: now,
    updatedBy: actorEmail,
    updatedAt: now,
  };

  await saveErpRecord('stockItems', updatedSource, actorEmail, cloudMode);
  // Merge into existing target item if already in destination warehouse
  const allStock = readLocalCollection<StockItem>('stockItems', []);
  const existingTarget = allStock.find(
    (s) => s.warehouseId === toWarehouse.id && s.name === item.name
  );
  if (existingTarget) {
    await saveErpRecord(
      'stockItems',
      {
        ...existingTarget,
        quantity: existingTarget.quantity + qty,
        totalValueKurus: existingTarget.totalValueKurus + transferCostKurus,
      },
      actorEmail,
      cloudMode
    );
  } else {
    await saveErpRecord('stockItems', targetItem, actorEmail, cloudMode);
  }
  await saveErpRecord('stockMovements', movement, actorEmail, cloudMode);

  // If moving from warehouse/site to another project site, allocate cost accurately without double-counting
  if (toWarehouse.projectId) {
    const exp: ExpenseRecord = {
      id: `exp-stk-${Date.now()}`,
      organizationId: ERP_ORG_ID,
      projectId: toWarehouse.projectId,
      categoryGroup: 'İnşaat İmalatları',
      categorySub: item.category || 'Diğer giderler',
      description: `Depo/Şantiye Transferi: ${item.name} (${qty} ${item.unit})`,
      date: now.slice(0, 10),
      netKurus: transferCostKurus,
      vatRate: 0,
      vatKurus: 0,
      grossKurus: transferCostKurus,
      deductibleVat: false,
      sourceType: 'stock_transfer',
      sourceId: movement.id,
      locked: true,
      createdBy: actorEmail,
      createdAt: now,
      updatedBy: actorEmail,
      updatedAt: now,
    };
    await saveErpRecord('expenses', exp, actorEmail, cloudMode);
  }
  if (fromWarehouse.type === 'santiye' && fromWarehouse.projectId) {
    const creditExp: ExpenseRecord = {
      id: `exp-stk-cr-${Date.now()}`,
      organizationId: ERP_ORG_ID,
      projectId: fromWarehouse.projectId,
      categoryGroup: 'İnşaat İmalatları',
      categorySub: item.category || 'Diğer giderler',
      description: `Şantiye Çıkış Mahsubu (${toWarehouse.name}): ${item.name}`,
      date: now.slice(0, 10),
      netKurus: -transferCostKurus,
      vatRate: 0,
      vatKurus: 0,
      grossKurus: -transferCostKurus,
      deductibleVat: false,
      sourceType: 'stock_transfer',
      sourceId: movement.id,
      locked: true,
      createdBy: actorEmail,
      createdAt: now,
      updatedBy: actorEmail,
      updatedAt: now,
    };
    await saveErpRecord('expenses', creditExp, actorEmail, cloudMode);
  }
}

export const erpTypePlaceholders = {
  PurchaseOrder: {} as PurchaseOrder,
  SupplierCard: {} as SupplierCard,
  SupplierQuote: {} as SupplierQuote,
  SubcontractorCard: {} as SubcontractorCard,
  EmployeeCard: {} as EmployeeCard,
  TimesheetEntry: {} as TimesheetEntry,
  EquipmentRecord: {} as EquipmentRecord,
  ProgressPayment: {} as ProgressPayment,
  ProjectBudget: {} as ProjectBudget,
  WorkItem: {} as WorkItem,
  CheckNoteRecord: {} as CheckNoteRecord,
  GuaranteeLetter: {} as GuaranteeLetter,
  GanttTask: {} as GanttTask,
  SiteLogRecord: {} as SiteLogRecord,
};
