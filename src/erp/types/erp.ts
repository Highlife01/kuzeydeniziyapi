export type ErpRoleId =
  | 'sirket_sahibi'
  | 'genel_mudur'
  | 'mali_isler'
  | 'muhasebe'
  | 'satin_alma'
  | 'proje_muduru'
  | 'santiye_sefi'
  | 'depo_sorumlusu'
  | 'saha_personeli'
  | 'salt_okunur';

export type PermissionAction =
  | 'view'
  | 'create'
  | 'update'
  | 'approve'
  | 'delete'
  | 'export';

export type ErpMenuSectionId =
  | 'overview'
  | 'tenders'
  | 'projects'
  | 'purchases'
  | 'invoices'
  | 'progressPayments'
  | 'suppliers'
  | 'subcontractors'
  | 'hr'
  | 'warehouse'
  | 'equipment'
  | 'expenses'
  | 'currentAccounts'
  | 'bankCash'
  | 'checks'
  | 'guarantees'
  | 'schedule'
  | 'siteLogs'
  | 'documents'
  | 'reports'
  | 'aiAssistant'
  | 'users'
  | 'settings'
  | 'crmMessages'
  | 'mailControl';

export interface AuditFields {
  organizationId: string;
  projectId?: string;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  clientMutationId?: string;
}

export type ErpProjectStatus =
  | 'Hazırlanıyor'
  | 'İhale Aşamasında'
  | 'Kazanıldı'
  | 'Devam Ediyor'
  | 'Askıda'
  | 'Geçici Kabul'
  | 'Kesin Kabul'
  | 'Tamamlandı'
  | 'Tasfiye Edildi';

export interface ErpProject extends AuditFields {
  id: string;
  code: string;
  title: string;
  shortName: string;
  ikn: string; // İhale Kayıt Numarası
  contractingAuthority: string; // İhaleyi yapan kamu kurumu
  employer: string; // İşveren
  province: string;
  district: string;
  location: string;
  siteAddress: string;
  tenderDate: string;
  approxCostKurus: number; // Yaklaşık maliyet (kuruş)
  bidAmountKurus: number; // Teklif bedeli (kuruş)
  discountRatePct: number; // İhale kırım oranı (%)
  contractAmountKurus: number; // Sözleşme bedeli (kuruş)
  approvedIncreaseKurus: number; // Onaylı iş artışı (kuruş)
  approvedDecreaseKurus: number; // İş eksilişi (kuruş)
  priceDiffKurus: number; // Onaylı fiyat farkı (kuruş)
  estimatedRemainingCostKurus: number; // Kalan işin tahmini maliyeti (kuruş)
  vatRate: number; // KDV oranı (0, 10, 20)
  contractDate: string;
  siteDeliveryDate: string;
  startDate: string;
  endDate: string;
  extensionDays: number; // İlave süre (gün)
  durationDays: number; // Proje süresi (gün)
  siteChief: string; // Şantiye şefi
  projectManager: string; // Proje sorumlusu
  performanceBondKurus: number; // Kesin teminat
  advanceAmountKurus: number; // Avans tutarı
  hasPriceDifference: boolean; // Fiyat farkı durumu
  physicalProgressPct: number; // Fiziki ilerleme %
  financialProgressPct: number; // Finansal ilerleme %
  status: ErpProjectStatus;
  category: 'kamu' | 'saglik-yangin' | 'ticari-sanayi' | 'tesis-yonetimi';
  description: string;
  coverImage: string;
  sitePhotos: string[];
  publishedOnSite: boolean;
  // Project budget thresholds (editable per project)
  warnThresholds: {
    infoPct: number; // 70
    warningPct: number; // 85
    criticalPct: number; // 95
    overrunPct: number; // 100
    burnDivergencePct: number; // e.g., 15%
  };
}

export interface ProjectBudget extends AuditFields {
  id: string;
  projectId: string;
  constructionKurus: number;
  mechanicalKurus: number;
  electricalKurus: number;
  laborKurus: number;
  subcontractorKurus: number;
  generalKurus: number;
  totalBudgetKurus: number;
  notes: string;
}

export type PozSource = 'ÇŞİDB' | 'MSB' | 'DSİ' | 'KGM' | 'Özel';

export interface WorkItem extends AuditFields {
  id: string;
  projectId: string;
  parentGroup: string; // Ana iş grubu
  pozNo: string;
  source: PozSource;
  description: string;
  unit: string;
  contractQty: number;
  contractUnitPriceKurus: number;
  pursantajPct: number;
  estMaterialCostKurus: number;
  estLaborCostKurus: number;
  estMachineCostKurus: number;
  actualQty: number;
  actualCostKurus: number;
}

export type TenderType = 'Birim Fiyatlı' | 'Anahtar Teslim Götürü Bedel';
export type TenderResult = 'Hazırlanıyor' | 'Teklif Verildi' | 'Kazanıldı' | 'Kaybedildi' | 'İptal';

export interface CompetitorBid {
  firmName: string;
  bidKurus: number;
}

export interface TenderRecord extends AuditFields {
  id: string;
  ikn: string;
  title: string;
  authority: string;
  province: string;
  district: string;
  tenderType: TenderType;
  tenderDate: string;
  approxCostKurus: number;
  estimatedCostKurus: number;
  ourBidKurus: number;
  discountRatePct: number;
  boundaryValueKurus: number; // Sınır değer
  bidBondKurus: number; // Geçici teminat
  validityDays: number;
  objectionDate: string;
  contractDeadline: string;
  result: TenderResult;
  winnerFirm: string;
  winnerBidKurus: number;
  competitors: CompetitorBid[];
  convertedProjectId?: string;
  documentUrls: { name: string; url: string }[];
  notes: string;
}

export type PurchaseStatus =
  | 'Talep Oluşturuldu'
  | 'Teklif Alınıyor'
  | 'Onay Bekliyor'
  | 'Onaylandı'
  | 'Sipariş Verildi'
  | 'Kısmi Teslim'
  | 'Teslim Edildi'
  | 'İptal Edildi';

export interface PurchaseOrder extends AuditFields {
  id: string;
  projectId: string;
  warehouseId?: string;
  materialName: string;
  categoryGroup: string;
  categorySub: string;
  brand: string;
  model: string;
  specs: string;
  pozNo: string;
  supplierId: string;
  supplierName: string;
  orderDate: string;
  deliveryDate: string;
  quantity: number;
  unit: string;
  unitPriceKurus: number;
  discountRatePct: number;
  vatRate: number;
  netTotalKurus: number;
  vatAmountKurus: number;
  grossTotalKurus: number;
  shippingKurus: number;
  paidKurus: number;
  remainingDebtKurus: number;
  paymentMethod: string;
  dueDate: string;
  invoiceNo: string;
  waybillNo: string;
  receivedBy: string;
  productPhotoUrl: string;
  invoicePhotoUrl: string;
  waybillPhotoUrl: string;
  status: PurchaseStatus;
  approvalStatus: 'Beklemiyor' | 'Onay Bekliyor' | 'Onaylandı' | 'Reddedildi';
  description: string;
}

export interface InvoiceLineItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unitPriceKurus: number;
  discountKurus: number;
  vatRate: number;
  netKurus: number;
  vatKurus: number;
  grossKurus: number;
  categoryGroup?: string;
  categorySub?: string;
  pozNo?: string;
  confidence?: number;
}

export interface InvoiceAllocation {
  id: string;
  invoiceId: string;
  targetType: 'project' | 'warehouse';
  targetId: string; // projectId or warehouseId
  targetName: string;
  mode: 'amount' | 'percent' | 'quantity';
  value: number;
  allocatedNetKurus: number;
  allocatedVatKurus: number;
  allocatedGrossKurus: number;
}

export interface InvoiceAttachment {
  id: string;
  name: string;
  mimeType: string;
  originalUrl: string;
  previewUrl?: string;
  sha256: string;
  version: number;
  uploadedAt: string;
}

export interface InvoiceRecord extends AuditFields {
  id: string;
  projectId: string; // Primary or 'multi'
  supplierId: string;
  supplierName: string;
  supplierTaxNo: string;
  supplierTaxOffice: string;
  invoiceNo: string;
  waybillNo: string;
  ettn: string;
  invoiceType: 'SATIŞ' | 'İADE' | 'TEVKİFATLI' | 'İSTİSNA' | 'ÖZEL MATRAH' | 'GİDER';
  issueDate: string;
  dueDate: string;
  iban: string;
  paymentInfo: string;
  subtotalKurus: number;
  discountTotalKurus: number;
  vatTotalKurus: number;
  withholdingKurus: number; // Tevkifat
  grandTotalKurus: number;
  deductibleVat: boolean;
  paidKurus: number;
  remainingDebtKurus: number;
  items: InvoiceLineItem[];
  allocations: InvoiceAllocation[];
  attachments: InvoiceAttachment[];
  sourceMode: 'manual' | 'xml' | 'ocr';
  ocrConfidence?: number;
  lowConfidenceFields?: string[];
  confirmedByUser: boolean;
  locked: boolean; // Finalized records cannot be deleted directly
  reversalOfId?: string;
  fileSha256?: string;
  notes: string;
}

export type ProgressPaymentStatus =
  | 'Taslak'
  | 'Kuruma Sunuldu'
  | 'İnceleniyor'
  | 'Onaylandı'
  | 'Tahakkuk Etti'
  | 'Kısmi Ödendi'
  | 'Ödendi';

export interface ProgressPayment extends AuditFields {
  id: string;
  projectId: string;
  hakedisNo: number;
  period: string;
  issueDate: string;
  previousTotalKurus: number;
  currentWorkKurus: number;
  cumulativeWorkKurus: number;
  grossAmountKurus: number;
  priceDiffKurus: number;
  vatRate: number;
  vatAmountKurus: number;
  vatWithholdingRate: number; // Tevkifat oranı (e.g. 4/10 -> 40)
  vatWithholdingKurus: number;
  advanceDeductionRate: number;
  advanceDeductionKurus: number;
  retentionRate: number; // Teminat kesintisi
  retentionKurus: number;
  taxDeductionKurus: number;
  sgkDeductionKurus: number;
  penaltyDeductionKurus: number;
  otherDeductionKurus: number;
  netPayableKurus: number;
  collectedKurus: number;
  remainingReceivableKurus: number;
  collectionDate: string;
  expectedPaymentDate: string;
  status: ProgressPaymentStatus;
  locked: boolean;
  attachments: { name: string; url: string }[];
  notes: string;
}

export interface SupplierCard extends AuditFields {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  taxNo: string;
  taxOffice: string;
  address: string;
  iban: string;
  suppliedProducts: string[];
  deliveryPerformanceScore: number; // 1-100
  rating: number; // 1-5
  notes: string;
}

export interface SupplierQuote extends AuditFields {
  id: string;
  supplierId: string;
  supplierName: string;
  projectId: string;
  materialName: string;
  unit: string;
  unitPriceKurus: number;
  vatRate: number;
  quoteDate: string;
  validUntil: string;
  fileUrl?: string;
  selected: boolean;
}

export interface SubcontractorCard extends AuditFields {
  id: string;
  firmName: string;
  projectId: string;
  scopeOfWork: string;
  contactPerson: string;
  phone: string;
  taxNo: string;
  iban: string;
  contractAmountKurus: number;
  unitPricesNote: string;
  executedAmountKurus: number;
  hakedisTotalKurus: number;
  advanceGivenKurus: number;
  paidTotalKurus: number;
  retentionKurus: number;
  companyMaterialDeductionKurus: number; // Şirket malzemesi mahsubu
  remainingDebtKurus: number;
  endDate: string;
  performanceScore: number;
  contractFileUrl?: string;
}

export interface EmployeeCard extends AuditFields {
  id: string;
  fullName: string;
  profession: string;
  projectId: string;
  dailyWageKurus: number;
  monthlySalaryKurus: number;
  employerCostMultiplier: number; // e.g., 1.225 (editable, never hardcoded blindly)
  hireDate: string;
  phone: string;
  sgkDocUrl?: string;
  isgDocUrl?: string;
  active: boolean;
}

export interface TimesheetEntry extends AuditFields {
  id: string;
  employeeId: string;
  employeeName: string;
  projectId: string;
  date: string;
  workedDays: number; // 0, 0.5, 1
  overtimeHours: number;
  leaveDays: number;
  absenceDays: number;
  advanceKurus: number;
  paidWageKurus: number;
  employerCostKurus: number;
  notes: string;
}

export interface WarehouseRecord extends AuditFields {
  id: string;
  name: string;
  type: 'merkez' | 'santiye';
  projectId?: string;
  location: string;
  manager: string;
}

export interface StockItem extends AuditFields {
  id: string;
  warehouseId: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minStockLevel: number;
  avgUnitCostKurus: number;
  totalValueKurus: number;
  usedQty: number; // Şantiyede tüketilen
}

export type StockMovementType =
  | 'Giriş'
  | 'Çıkış'
  | 'Depo Transfer'
  | 'Şantiye Transfer'
  | 'İade'
  | 'Fire'
  | 'Zayiat'
  | 'Sayım Düzeltme';

export interface StockMovement extends AuditFields {
  id: string;
  stockItemId: string;
  itemName: string;
  movementType: StockMovementType;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  fromProjectId?: string;
  toProjectId?: string;
  quantity: number;
  unitCostKurus: number;
  totalCostKurus: number;
  date: string;
  notes: string;
}

export interface EquipmentRecord extends AuditFields {
  id: string;
  name: string;
  plateOrSerial: string;
  type: 'İş Makinesi' | 'Vinç' | 'Binek/Ticari Araç' | 'İskele/Kalıp' | 'Diğer';
  ownership: 'Özmal' | 'Kiralık';
  projectId: string;
  operatorName: string;
  dailyCostKurus: number;
  fuelCostKurus: number;
  maintenanceCostKurus: number;
  status: 'Aktif Sahada' | 'Bakımda' | 'Boşta';
  notes: string;
}

export interface ExpenseRecord extends AuditFields {
  id: string;
  projectId: string; // or 'company_overhead'
  categoryGroup: string;
  categorySub: string;
  description: string;
  date: string;
  netKurus: number;
  vatRate: number;
  vatKurus: number;
  grossKurus: number;
  deductibleVat: boolean;
  sourceType: 'manual' | 'invoice' | 'payroll' | 'subcontractor' | 'guarantee_commission' | 'stock_transfer';
  sourceId?: string;
  locked: boolean;
  reversalOfId?: string;
}

export interface BankAccount extends AuditFields {
  id: string;
  name: string;
  bankName: string;
  accountType: 'Banka TL' | 'Banka Döviz' | 'TL Kasa' | 'Döviz Kasa' | 'Kredi Kartı';
  currency: 'TRY' | 'USD' | 'EUR';
  iban: string;
  balanceKurus: number;
}

export interface PaymentRecord extends AuditFields {
  id: string;
  projectId: string;
  direction: 'Tahsilat' | 'Ödeme';
  targetType: 'supplier' | 'subcontractor' | 'employee' | 'client_hakedis' | 'bank_fee' | 'other';
  targetId: string;
  targetName: string;
  invoiceId?: string;
  hakedisId?: string;
  subcontractorId?: string;
  bankAccountId: string;
  bankAccountName: string;
  method: 'Havale / EFT' | 'Nakit' | 'Kredi Kartı' | 'Çek' | 'Senet' | 'Kamu Hakediş';
  amountKurus: number;
  date: string;
  receiptUrl?: string;
  locked: boolean;
  reversalOfId?: string;
  approvalStatus: 'Onaylandı' | 'Onay Bekliyor' | 'Reddedildi';
  notes: string;
}

export interface CustomExpenseCategory extends AuditFields {
  id: string;
  group: string;
  name: string;
}

export interface CheckNoteRecord extends AuditFields {
  id: string;
  kind: 'Çek' | 'Senet';
  direction: 'Alınan' | 'Verilen';
  serialNo: string;
  bankName: string;
  counterparty: string;
  projectId: string;
  amountKurus: number;
  issueDate: string;
  dueDate: string;
  status: 'Portföyde' | 'Tahsil Edildi' | 'Ödendi' | 'Karşılıksız / İade';
}

export type GuaranteeType =
  | 'Geçici Teminat'
  | 'Kesin Teminat'
  | 'Ek Kesin Teminat'
  | 'Avans Teminatı';

export interface GuaranteeLetter extends AuditFields {
  id: string;
  projectId: string;
  tenderId?: string;
  type: GuaranteeType;
  bankName: string;
  letterNo: string;
  principalAmountKurus: number; // Ana para (gider değildir)
  commissionRatePct: number;
  commissionExpenseKurus: number; // Gider olarak izlenir
  startDate: string;
  endDate: string;
  returned: boolean;
  fileUrl?: string;
  notes: string;
}

export interface GanttTask extends AuditFields {
  id: string;
  projectId: string;
  name: string;
  responsible: string;
  startDate: string;
  endDate: string;
  plannedPct: number;
  actualPct: number;
  dependsOnTaskId?: string;
  isCriticalPath: boolean;
}

export interface SiteLogRecord extends AuditFields {
  id: string;
  projectId: string;
  date: string;
  weather: string;
  workerCount: number;
  subcontractorsNote: string;
  worksDone: string;
  materialsArrived: string;
  equipmentUsed: string;
  issues: string;
  hseIncidents: string;
  clientInstructions: string;
  delayReasons: string;
  tomorrowPlan: string;
  beforePhotos: string[];
  afterPhotos: string[];
  dailyPhotos: string[];
}

export interface DocumentVaultItem extends AuditFields {
  id: string;
  projectId: string;
  title: string;
  category: 'Sözleşme' | 'Fatura' | 'İrsaliye' | 'Hakediş' | 'Teminat' | 'SGK/İSG' | 'İhale' | 'Fotoğraf' | 'Diğer';
  fileName: string;
  mimeType: string;
  url: string;
  originalUrl?: string;
  version: number;
  sizeBytes: number;
}

export interface ApprovalRequest extends AuditFields {
  id: string;
  entityType: 'purchase' | 'payment';
  entityId: string;
  projectId: string;
  title: string;
  amountKurus: number;
  requiredRoleLabel: string;
  status: 'Onay Bekliyor' | 'Onaylandı' | 'Reddedildi';
  requestedBy: string;
  decidedBy?: string;
  decidedAt?: string;
  comment?: string;
}

export interface ErpUserAccount extends AuditFields {
  id: string; // lowercase email
  email: string;
  fullName: string;
  roleId: ErpRoleId;
  assignedProjectIds: string[]; // boş ise Proje Müdürü olmayan rollerde yetki kontrolü uygulanır
  active: boolean;
  mfaEnforcedNote?: string;
}

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  projectId?: string;
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'APPROVE' | 'REJECT' | 'REVERSE' | 'DELETE' | 'MIGRATE';
  actorEmail: string;
  timestamp: string;
  summary: string;
}

export interface ErpSettings {
  id: string;
  organizationId: string;
  companyName: string;
  taxOffice: string;
  taxNumber: string;
  phone: string;
  email: string;
  address: string;
  approvalLimitLevel1Kurus: number; // 10.000 TL = 1_000_000 kuruş
  approvalLimitLevel2Kurus: number; // 100.000 TL = 10_000_000 kuruş
  aiBackendEndpoint: string; // Optional Cloud Function URL
  mailWebhookUrl: string;
  autoSyncContactToMail: boolean;
}

export interface ErpNotification {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  category: string;
  title: string;
  description: string;
  projectId?: string;
  targetMenu: ErpMenuSectionId;
  dueDate?: string;
}

export interface OfflineDraftItem {
  id: string;
  clientMutationId: string;
  collection: string;
  payload: Record<string, unknown>;
  createdAt: string;
  label: string;
}
