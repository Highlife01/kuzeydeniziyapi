import {
  AccountingEntry,
  ContactMessage,
  DashboardSettings,
  MailAccount,
  MailCheckLog,
  MailMessage,
  ProjectItem,
} from '../types';

export const DEFAULT_SETTINGS: DashboardSettings = {
  companyName: 'Kuzey Denizi İnşaat Sanayi ve Ticaret A.Ş.',
  shortBrand: 'KUZEY DENİZİ',
  taxOffice: 'Seyhan Vergi Dairesi Müd.',
  taxNumber: '2640323020',
  phone: '0533 677 91 09',
  email: 'info@kuzeydeniziyapi.com.tr',
  address: 'Yeşiloba Mah. 46088 Sk. No: 18 B, Seyhan / ADANA',
  mailWebhookUrl: '',
  autoSyncContactToMail: true,
};

/**
 * Yalnızca gerçek, doğrulanmış kurumsal projeler.
 * Sözleşme bedelleri ve hakediş/gider kalemleri sıfırdan gerçek girilen verilerle takip edilir.
 */
export const SEED_PROJECTS: ProjectItem[] = [
  {
    id: 'prj-adana-adliye-cati',
    code: 'KD-01',
    title: 'Adana Adliyesi Çatı Yenileme',
    shortName: 'Adana Adliyesi Çatı Yenileme',
    category: 'kamu',
    categoryLabel: 'Kamu Taahhüt & Çatı Yenileme',
    status: 'teslim-edildi',
    statusBadge: 'Tamamlandı',
    location: 'Adana',
    client: 'Adana Adalet Sarayı',
    area: 'Çatı Yenileme & İzolasyon',
    budget: 0,
    collectedAmount: 0,
    progress: 100,
    siteManager: 'Kuzey Denizi Teknik Ekibi',
    startDate: '',
    endDate: '',
    description:
      'Adana Adalet Sarayı kompleksinde çatı kaplama yenileme, ısı-su yalıtım katmanları ve yağmur drenaj sistemlerinin anahtar teslim yenilenmesi projesi.',
    highlights: [
      'Mevcut çatı kaplama ve yalıtım katmanlarının yenilenmesi',
      'Su yalıtımı ve yağmur drenaj altyapısı güçlendirmesi',
      'Kurum işleyişi aksatılmadan güvenli saha uygulaması',
    ],
    milestones: [
      { id: 'm1', title: 'Mevcut çatı söküm ve zemin hazırlığı', done: true },
      { id: 'm2', title: 'Isı ve su yalıtımı uygulaması', done: true },
      { id: 'm3', title: 'Yeni çatı kaplama ve drenaj montajı', done: true },
    ],
    image: '/images/adana-adliye-gercek.jpg',
    galleryImages: ['/images/adana-adliye-gercek.jpg', '/images/cati-izolasyon.jpg'],
    publishedOnSite: true,
    isFeatured: true,
    createdAt: '2026-01-01T08:30:00Z',
    updatedAt: '2026-11-18T12:00:00Z',
  },
  {
    id: 'prj-pozanti-hastane-yangin',
    code: 'KD-02',
    title:
      "Pozantı 80. Yıl Devlet Hastanesi Yangın Güvenliği Standartlarının Güçlendirilmesine Yönelik Tadilat ve Bakım Çalışmaları",
    shortName: "Pozantı 80. Yıl Devlet Hastanesi Yangın İşleri",
    category: 'saglik-yangin',
    categoryLabel: 'Sağlık Tesisi & Yangın Güvenliği',
    status: 'teslim-edildi',
    statusBadge: 'Tamamlandı',
    location: 'Pozantı / ADANA',
    client: 'Pozantı 80. Yıl Devlet Hastanesi',
    area: 'Yangın Güvenliği Tadilat & Bakım',
    budget: 0,
    collectedAmount: 0,
    progress: 100,
    siteManager: 'Kuzey Denizi Teknik Ekibi',
    startDate: '',
    endDate: '',
    description:
      "Pozantı 80. Yıl Devlet Hastanesi'nde yangın güvenliği standartlarının güçlendirilmesine yönelik mekanik söndürme, yangın algılama, tahliye ve güvenlik altyapısı tadilat ve bakım çalışmaları.",
    highlights: [
      'Yangın güvenliği standartlarına uygun mekanik ve tesisat tadilatları',
      'Yangın pompa, sprinkler, dolap ve algılama sistemlerinin bakım ve yenilenmesi',
      'Sağlık tesisi sürekliliği gözetilerek tamamlanan saha çalışmaları',
    ],
    milestones: [
      { id: 'p1', title: 'Mevcut yangın altyapısı tespit ve tadilat planlaması', done: true },
      { id: 'p2', title: 'Söndürme ve algılama donanımlarının tadilat ve bakımı', done: true },
      { id: 'p3', title: 'Sistem testleri ve devreye alma kontrolleri', done: true },
    ],
    image: '/images/pozanti-hastane-gercek.jpg',
    galleryImages: ['/images/pozanti-hastane-gercek.jpg', '/images/yangin-sistemleri.jpg'],
    publishedOnSite: true,
    isFeatured: true,
    createdAt: '2026-01-02T09:00:00Z',
    updatedAt: '2026-11-18T12:00:00Z',
  },
];

// Mock veriler kaldırıldı — gerçek muhasebe, iletişim mesajı ve mail kayıtları sıfırdan gerçek girişlerle oluşur.
export const SEED_ACCOUNTING: AccountingEntry[] = [];

export const SEED_CONTACT_MESSAGES: ContactMessage[] = [];

export const SEED_MAIL_ACCOUNTS: MailAccount[] = [
  {
    id: 'mail-acc-info',
    email: 'info@kuzeydeniziyapi.com.tr',
    displayName: 'Kuzey Denizi Kurumsal E-Posta',
    department: 'Genel Merkez & İletişim',
    imapHost: 'mail.kuzeydeniziyapi.com.tr:993',
    smtpHost: 'mail.kuzeydeniziyapi.com.tr:465',
    quotaUsedMb: 0,
    quotaLimitMb: 10240,
    status: 'aktif',
    lastCheckedAt: new Date().toISOString(),
  },
];

export const SEED_MAIL_MESSAGES: MailMessage[] = [];

export const SEED_MAIL_LOGS: MailCheckLog[] = [];
