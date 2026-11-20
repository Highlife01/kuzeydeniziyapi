import {
  ErpMenuSectionId,
  ErpRoleId,
  ErpSettings,
  ErpUserAccount,
  PermissionAction,
} from '../types/erp';

export interface RoleDefinition {
  id: ErpRoleId;
  label: string;
  description: string;
  allProjects: boolean;
  canSeeCompanyProfitability: boolean;
  actions: Record<PermissionAction, boolean>;
  allowedSections: ErpMenuSectionId[];
}

const ALL_SECTIONS: ErpMenuSectionId[] = [
  'overview',
  'tenders',
  'projects',
  'purchases',
  'invoices',
  'progressPayments',
  'suppliers',
  'subcontractors',
  'hr',
  'warehouse',
  'equipment',
  'expenses',
  'currentAccounts',
  'bankCash',
  'checks',
  'guarantees',
  'schedule',
  'siteLogs',
  'documents',
  'reports',
  'aiAssistant',
  'users',
  'settings',
  'crmMessages',
  'mailControl',
];

export const ERP_ROLES: Record<ErpRoleId, RoleDefinition> = {
  sirket_sahibi: {
    id: 'sirket_sahibi',
    label: 'Şirket Sahibi',
    description: 'Tüm projeler, finans, onay ve yetkilendirme üzerinde tam yetki.',
    allProjects: true,
    canSeeCompanyProfitability: true,
    actions: { view: true, create: true, update: true, approve: true, delete: true, export: true },
    allowedSections: ALL_SECTIONS,
  },
  genel_mudur: {
    id: 'genel_mudur',
    label: 'Genel Müdür',
    description: 'Tüm operasyonlar, ihale, finans ve yönetim onayları.',
    allProjects: true,
    canSeeCompanyProfitability: true,
    actions: { view: true, create: true, update: true, approve: true, delete: false, export: true },
    allowedSections: ALL_SECTIONS,
  },
  mali_isler: {
    id: 'mali_isler',
    label: 'Mali İşler',
    description: 'Finans, banka/kasa, hakediş, teminat, kârlılık ve onay yetkisi.',
    allProjects: true,
    canSeeCompanyProfitability: true,
    actions: { view: true, create: true, update: true, approve: true, delete: false, export: true },
    allowedSections: ALL_SECTIONS.filter((s) => s !== 'users'),
  },
  muhasebe: {
    id: 'muhasebe',
    label: 'Muhasebe',
    description: 'Fatura, cari hesap, gider, ödeme, KDV ve raporlama işlemleri.',
    allProjects: true,
    canSeeCompanyProfitability: true,
    actions: { view: true, create: true, update: true, approve: false, delete: false, export: true },
    allowedSections: [
      'overview',
      'projects',
      'purchases',
      'invoices',
      'progressPayments',
      'suppliers',
      'subcontractors',
      'hr',
      'expenses',
      'currentAccounts',
      'bankCash',
      'checks',
      'guarantees',
      'documents',
      'reports',
      'aiAssistant',
      'crmMessages',
      'mailControl',
    ],
  },
  satin_alma: {
    id: 'satin_alma',
    label: 'Satın Alma Sorumlusu',
    description: 'Tedarikçi teklifleri, malzeme satın alma, fatura girişi ve stok takibi.',
    allProjects: true,
    canSeeCompanyProfitability: false,
    actions: { view: true, create: true, update: true, approve: false, delete: false, export: true },
    allowedSections: [
      'projects',
      'purchases',
      'invoices',
      'suppliers',
      'warehouse',
      'equipment',
      'documents',
      'reports',
    ],
  },
  proje_muduru: {
    id: 'proje_muduru',
    label: 'Proje Müdürü',
    description: 'İhale, poz/metraj, taşeron, hakediş, iş programı ve orta seviye onaylar.',
    allProjects: false,
    canSeeCompanyProfitability: true,
    actions: { view: true, create: true, update: true, approve: true, delete: false, export: true },
    allowedSections: [
      'overview',
      'tenders',
      'projects',
      'purchases',
      'invoices',
      'progressPayments',
      'suppliers',
      'subcontractors',
      'hr',
      'warehouse',
      'equipment',
      'schedule',
      'siteLogs',
      'documents',
      'reports',
      'aiAssistant',
    ],
  },
  santiye_sefi: {
    id: 'santiye_sefi',
    label: 'Şantiye Şefi',
    description: 'Yalnızca yetkili olduğu şantiyelerde saha, günlük, puantaj, stok ve fatura yükleme.',
    allProjects: false,
    canSeeCompanyProfitability: false,
    actions: { view: true, create: true, update: true, approve: false, delete: false, export: true },
    allowedSections: [
      'projects',
      'purchases',
      'invoices',
      'subcontractors',
      'hr',
      'warehouse',
      'equipment',
      'schedule',
      'siteLogs',
      'documents',
    ],
  },
  depo_sorumlusu: {
    id: 'depo_sorumlusu',
    label: 'Depo Sorumlusu',
    description: 'Merkez depo ve şantiye stok giriş-çıkış, transfer ve sayım.',
    allProjects: true,
    canSeeCompanyProfitability: false,
    actions: { view: true, create: true, update: true, approve: false, delete: false, export: true },
    allowedSections: ['purchases', 'warehouse', 'equipment', 'documents'],
  },
  saha_personeli: {
    id: 'saha_personeli',
    label: 'Saha Personeli',
    description: 'Mobil kamera ile fatura fotoğrafı yükleme ve günlük şantiye raporu girme; şirket kârlılığı gizlidir.',
    allProjects: false,
    canSeeCompanyProfitability: false,
    actions: { view: true, create: true, update: false, approve: false, delete: false, export: false },
    allowedSections: ['invoices', 'siteLogs', 'hr', 'warehouse'],
  },
  salt_okunur: {
    id: 'salt_okunur',
    label: 'Salt Okunur Kullanıcı',
    description: 'Yalnızca görüntüleme yetkisi; oluşturma, güncelleme ve silme kapalıdır.',
    allProjects: true,
    canSeeCompanyProfitability: true,
    actions: { view: true, create: false, update: false, approve: false, delete: false, export: false },
    allowedSections: [
      'overview',
      'tenders',
      'projects',
      'reports',
      'documents',
    ],
  },
};

export function hasRolePermission(user: ErpUserAccount | null, action: PermissionAction): boolean {
  if (!user || !user.active) return false;
  return ERP_ROLES[user.roleId]?.actions[action] ?? false;
}

export function canAccessSection(
  user: ErpUserAccount | null,
  section: ErpMenuSectionId
): boolean {
  if (!user || !user.active) return false;
  return ERP_ROLES[user.roleId]?.allowedSections.includes(section) ?? false;
}

export function canAccessProject(user: ErpUserAccount | null, projectId: string): boolean {
  if (!user || !user.active) return false;
  const role = ERP_ROLES[user.roleId];
  if (!role) return false;
  if (role.allProjects) return true;
  if (!user.assignedProjectIds || user.assignedProjectIds.length === 0) return false;
  return user.assignedProjectIds.includes(projectId);
}

export function canViewCompanyProfitability(user: ErpUserAccount | null): boolean {
  if (!user || !user.active) return false;
  return ERP_ROLES[user.roleId]?.canSeeCompanyProfitability ?? false;
}

export function getRequiredApprovalLevel(
  amountKurus: number,
  settings: ErpSettings
): {
  requiredRoleLabel: string;
  allowedApprovers: ErpRoleId[];
} {
  const limit1 = settings.approvalLimitLevel1Kurus || 1_000_000; // 10.000 TL
  const limit2 = settings.approvalLimitLevel2Kurus || 10_000_000; // 100.000 TL
  if (amountKurus < limit1) {
    return {
      requiredRoleLabel: 'Proje Sorumlusu / Proje Müdürü',
      allowedApprovers: ['proje_muduru', 'mali_isler', 'genel_mudur', 'sirket_sahibi'],
    };
  }
  if (amountKurus <= limit2) {
    return {
      requiredRoleLabel: 'Proje Müdürü / Mali İşler',
      allowedApprovers: ['proje_muduru', 'mali_isler', 'genel_mudur', 'sirket_sahibi'],
    };
  }
  return {
    requiredRoleLabel: 'Şirket Yönetimi (Genel Müdür / Şirket Sahibi)',
    allowedApprovers: ['genel_mudur', 'sirket_sahibi'],
  };
}

export function canUserApproveAmount(
  user: ErpUserAccount | null,
  amountKurus: number,
  settings: ErpSettings
): boolean {
  if (!hasRolePermission(user, 'approve') || !user) return false;
  const req = getRequiredApprovalLevel(amountKurus, settings);
  return req.allowedApprovers.includes(user.roleId);
}
