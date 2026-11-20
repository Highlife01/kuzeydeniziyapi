export type ProjectCategory =
  | 'kamu'
  | 'saglik-yangin'
  | 'ticari-sanayi'
  | 'tesis-yonetimi';

export type ProjectStatus =
  | 'planlama'
  | 'devam-ediyor'
  | 'test-kabul'
  | 'teslim-edildi';

export interface ProjectMilestone {
  id: string;
  title: string;
  done: boolean;
}

export interface ProjectItem {
  id: string;
  code: string;
  title: string;
  shortName: string;
  category: ProjectCategory;
  categoryLabel: string;
  status: ProjectStatus;
  statusBadge: string;
  location: string;
  client: string;
  area: string;
  budget: number;
  collectedAmount: number;
  progress: number;
  siteManager: string;
  startDate: string;
  endDate: string;
  description: string;
  highlights: string[];
  milestones: ProjectMilestone[];
  image: string;
  galleryImages: string[];
  publishedOnSite: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ContactMessageStatus =
  | 'yeni'
  | 'inceleniyor'
  | 'teklif-verildi'
  | 'arsiv';

export interface ContactMessage {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  service: string;
  serviceLabel: string;
  message: string;
  sourcePage: 'Ana Sayfa' | 'İletişim Sayfası';
  status: ContactMessageStatus;
  adminNotes: string;
  convertedProjectId?: string;
  createdAt: string;
  readAt?: string;
}

export type AccountingType = 'gelir' | 'gider';

export type AccountingCategory =
  | 'Hakediş Tahsilatı'
  | 'Avans / Peşinat'
  | 'Malzeme & Çelik'
  | 'Taşeron Ödemesi'
  | 'Yangın / Mekanik Ekipman'
  | 'Personel & SGK'
  | 'Vergi & Resmi Harç'
  | 'Genel İşletme Gideri';

export type PaymentStatus = 'odendi' | 'bekliyor' | 'vadesi-gecti';

export interface AccountingEntry {
  id: string;
  date: string;
  dueDate: string;
  type: AccountingType;
  category: AccountingCategory;
  projectId: string;
  projectName: string;
  counterparty: string;
  invoiceNo: string;
  taxRate: 0 | 10 | 20;
  netAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: 'Havale / EFT' | 'Kamu Hakediş' | 'Çek / Senet' | 'Kasa / Nakit';
  paymentStatus: PaymentStatus;
  notes: string;
  createdAt: string;
}

export interface MailAccount {
  id: string;
  email: string;
  displayName: string;
  department: string;
  imapHost: string;
  smtpHost: string;
  quotaUsedMb: number;
  quotaLimitMb: number;
  status: 'aktif' | 'uyari';
  lastCheckedAt: string;
}

export type MailFolder = 'inbox' | 'sent' | 'drafts' | 'archive';

export type MailTag =
  | 'İhale & Şartname'
  | 'Teklif Talebi'
  | 'Muhasebe & Fatura'
  | 'Şantiye Raporu'
  | 'Resmi Yazışma';

export interface MailMessage {
  id: string;
  accountEmail: string;
  folder: MailFolder;
  fromName: string;
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  tag: MailTag;
  projectId?: string;
  isRead: boolean;
  isStarred: boolean;
  linkedContactId?: string;
  createdAt: string;
}

export interface MailCheckLog {
  id: string;
  domain: string;
  checkedAt: string;
  mxValid: boolean;
  mxRecords: string[];
  spfValid: boolean;
  spfRecord: string;
  dmarcValid: boolean;
  dmarcRecord: string;
  dkimFound: boolean;
  dkimSelector: string;
  score: number;
  summary: string;
}

export interface DashboardSettings {
  companyName: string;
  shortBrand: string;
  taxOffice: string;
  taxNumber: string;
  phone: string;
  email: string;
  address: string;
  mailWebhookUrl: string;
  autoSyncContactToMail: boolean;
}
