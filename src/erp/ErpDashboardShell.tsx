import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../core/AuthContext';
import { DashboardLogin } from '../pages/dashboard/DashboardLogin';
import { SafirMailModule } from '../mail/SafirMailModule';
import { MessagesTab } from '../pages/dashboard/MessagesTab';
import {
  removeEntity,
  saveEntity,
  subscribeCollectionData,
} from '../services/dataService';
import {
  ContactMessage,
  ProjectItem,
} from '../types';
import { InvoiceCaptureModal } from './components/InvoiceCaptureModal';
import { ExecutiveOverviewView } from './pages/ExecutiveOverviewView';
import { FinanceBankingView } from './pages/FinanceBankingView';
import { HakedisSuppliersSubsView } from './pages/HakedisSuppliersSubsView';
import { HrWarehouseEquipmentView } from './pages/HrWarehouseEquipmentView';
import { PurchasingAndInvoicesView } from './pages/PurchasingAndInvoicesView';
import { ReportsAiUsersSettingsView } from './pages/ReportsAiUsersSettingsView';
import { ScheduleSiteLogsDocsView } from './pages/ScheduleSiteLogsDocsView';
import { TendersAndProjectsView } from './pages/TendersAndProjectsView';
import {
  DEFAULT_ERP_SETTINGS,
  ERP_ORG_ID,
  flushOfflineQueue,
  getSeedErpProjects,
  getSeedWarehouses,
  hydrateLegacyProjectToErp,
  readOfflineQueue,
  runBackwardCompatibleErpMigration,
  saveErpRecord,
  subscribeErpCollection,
} from './services/erpStore';
import { computeErpNotifications, ErpDatasetSnapshot } from './services/financeEngine';
import {
  ApprovalRequest,
  AuditLogEntry,
  BankAccount,
  CheckNoteRecord,
  CustomExpenseCategory,
  DocumentVaultItem,
  EmployeeCard,
  EquipmentRecord,
  ErpMenuSectionId,
  ErpProject,
  ErpRoleId,
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
} from './types/erp';
import {
  canAccessProject,
  canAccessSection,
  canViewCompanyProfitability,
  ERP_ROLES,
  hasRolePermission,
} from './utils/permissions';

interface MenuEntry {
  id: ErpMenuSectionId;
  label: string;
  icon: string;
  group: string;
}

const MENU_ITEMS: MenuEntry[] = [
  { id: 'overview', label: 'Genel Dashboard', icon: 'fa-gauge-high', group: 'Yönetim' },
  { id: 'tenders', label: 'İhale Takip Sistemi', icon: 'fa-gavel', group: 'Projeler & İhale' },
  { id: 'projects', label: 'Projeler', icon: 'fa-diagram-project', group: 'Projeler & İhale' },
  { id: 'purchases', label: 'Satın Alma', icon: 'fa-cart-shopping', group: 'Tedarik & Fatura' },
  { id: 'invoices', label: 'Faturalar ve İrsaliyeler', icon: 'fa-file-invoice', group: 'Tedarik & Fatura' },
  { id: 'progressPayments', label: 'Hakedişler', icon: 'fa-file-signature', group: 'Projeler & İhale' },
  { id: 'suppliers', label: 'Tedarikçiler', icon: 'fa-truck-field', group: 'Tedarik & Fatura' },
  { id: 'subcontractors', label: 'Taşeronlar', icon: 'fa-people-carry-box', group: 'Şantiye & İK' },
  { id: 'hr', label: 'Personel ve Puantaj', icon: 'fa-user-clock', group: 'Şantiye & İK' },
  { id: 'warehouse', label: 'Depo ve Stok', icon: 'fa-boxes-stacked', group: 'Şantiye & İK' },
  { id: 'equipment', label: 'Makine ve Ekipman', icon: 'fa-tractor', group: 'Şantiye & İK' },
  { id: 'expenses', label: 'Gelir ve Giderler', icon: 'fa-receipt', group: 'Finans' },
  { id: 'currentAccounts', label: 'Cari Hesaplar', icon: 'fa-address-book', group: 'Finans' },
  { id: 'bankCash', label: 'Banka ve Kasa', icon: 'fa-building-columns', group: 'Finans' },
  { id: 'checks', label: 'Çek ve Senetler', icon: 'fa-money-check', group: 'Finans' },
  { id: 'guarantees', label: 'Teminat Mektupları', icon: 'fa-shield-halved', group: 'Finans' },
  { id: 'schedule', label: 'İş Programı', icon: 'fa-calendar-days', group: 'Saha & Belgeler' },
  { id: 'siteLogs', label: 'Şantiye Günlüğü', icon: 'fa-clipboard-list', group: 'Saha & Belgeler' },
  { id: 'documents', label: 'Belgeler ve Dosyalar', icon: 'fa-folder-open', group: 'Saha & Belgeler' },
  { id: 'reports', label: 'Raporlar', icon: 'fa-chart-column', group: 'Analiz & Zekâ' },
  { id: 'aiAssistant', label: 'Yapay Zekâ Asistanı', icon: 'fa-robot', group: 'Analiz & Zekâ' },
  { id: 'crmMessages', label: 'İletişim Mesajları', icon: 'fa-inbox', group: 'İletişim & Sistem' },
  { id: 'mailControl', label: 'Mail Kontrol', icon: 'fa-envelope-circle-check', group: 'İletişim & Sistem' },
  { id: 'users', label: 'Kullanıcılar ve Yetkiler', icon: 'fa-users-gear', group: 'İletişim & Sistem' },
  { id: 'settings', label: 'Sistem Ayarları', icon: 'fa-sliders', group: 'İletişim & Sistem' },
];

export const ErpDashboardShell: React.FC = () => {
  const { user, mode, isSuperAdmin, erpProfile, loginWithGoogle, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as ErpMenuSectionId) || 'overview';
  const [activeMenu, setActiveMenu] = useState<ErpMenuSectionId>(
    initialTab === ('messages' as any) ? 'crmMessages' : initialTab
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [selectedProject, setSelectedProject] = useState<ErpProject | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceDefaultProjId, setInvoiceDefaultProjId] = useState<string | undefined>(undefined);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [offlineQueue, setOfflineQueue] = useState<OfflineDraftItem[]>(() => readOfflineQueue());
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Core ERP collections
  const [projects, setProjects] = useState<ErpProject[]>(() => getSeedErpProjects());
  const [tenders, setTenders] = useState<TenderRecord[]>([]);
  const [budgets, setBudgets] = useState<ProjectBudget[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [progressPayments, setProgressPayments] = useState<ProgressPayment[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierCard[]>([]);
  const [supplierQuotes, setSupplierQuotes] = useState<SupplierQuote[]>([]);
  const [subcontractors, setSubcontractors] = useState<SubcontractorCard[]>([]);
  const [employees, setEmployees] = useState<EmployeeCard[]>([]);
  const [timesheets, setTimesheets] = useState<TimesheetEntry[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRecord[]>(() => getSeedWarehouses());
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [equipment, setEquipment] = useState<EquipmentRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [checks, setChecks] = useState<CheckNoteRecord[]>([]);
  const [guarantees, setGuarantees] = useState<GuaranteeLetter[]>([]);
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [siteLogs, setSiteLogs] = useState<SiteLogRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentVaultItem[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [erpUsers, setErpUsers] = useState<ErpUserAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [erpSettings, setErpSettings] = useState<ErpSettings>(DEFAULT_ERP_SETTINGS);
  const [customCategories, setCustomCategories] = useState<CustomExpenseCategory[]>([]);
  const [mailComposePrefill, setMailComposePrefill] = useState<{
    key: number;
    to: string;
    subject: string;
    body: string;
  } | null>(null);
  const [paymentPrefill, setPaymentPrefill] = useState<{
    key: number;
    direction: 'Tahsilat' | 'Ödeme';
    targetType: 'supplier' | 'subcontractor' | 'client_hakedis' | 'other';
    targetId?: string;
    targetName: string;
    projectId?: string;
    invoiceId?: string;
    hakedisId?: string;
    subcontractorId?: string;
    amountKurus: number;
  } | null>(null);

  // Isolated CRM state
  const [crmMessages, setCrmMessages] = useState<ContactMessage[]>([]);

  const cloudMode = mode === 'cloud-admin';
  const actorEmail = user?.email?.toLowerCase().trim() || 'onizleme@kuzeydeniziyapi.com.tr';

  const liveUserDoc = useMemo(
    () => erpUsers.find((u) => u.email.toLowerCase() === actorEmail),
    [erpUsers, actorEmail]
  );

  const effectiveRoleId: ErpRoleId =
    isSuperAdmin || !cloudMode
      ? 'sirket_sahibi'
      : liveUserDoc?.roleId || erpProfile?.roleId || 'salt_okunur';

  const hasAllProjects =
    isSuperAdmin || !cloudMode || (ERP_ROLES[effectiveRoleId]?.allProjects ?? false);

  const assignedProjectIdsKey = useMemo(() => {
    if (hasAllProjects) return 'ALL';
    const raw = liveUserDoc?.assignedProjectIds ?? erpProfile?.assignedProjectIds ?? [];
    return Array.from(new Set(raw.map(String).filter(Boolean))).sort().join(',');
  }, [hasAllProjects, liveUserDoc?.assignedProjectIds, erpProfile?.assignedProjectIds]);

  // Online / offline & Ctrl+K handlers
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      flushOfflineQueue().then(() => setOfflineQueue(readOfflineQueue()));
    };
    const onOffline = () => setIsOnline(false);
    const onQueue = () => setOfflineQueue(readOfflineQueue());
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('cb-erp-offline-queue', onQueue);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('cb-erp-offline-queue', onQueue);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // Reset volatile session UI/cache state whenever identity or workspace mode changes
  useEffect(() => {
    setSelectedProject(null);
    setPaymentPrefill(null);
    setMailComposePrefill(null);
    setGlobalQuery('');
    setNotifOpen(false);
    setInvoiceModalOpen(false);
    setOfflineQueue(readOfflineQueue());
  }, [mode, actorEmail]);

  useEffect(() => {
    const param = searchParams.get('tab');
    if (param === 'messages') setActiveMenu('crmMessages');
    else if (param && MENU_ITEMS.some((m) => m.id === param)) {
      setActiveMenu(param as ErpMenuSectionId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (mode !== 'cloud-admin' && mode !== 'preview') return;

    const roleDef = ERP_ROLES[effectiveRoleId];
    const allowSec = (s: ErpMenuSectionId) =>
      !cloudMode || isSuperAdmin || (roleDef?.allowedSections.includes(s) ?? false);
    const isAdminMgr =
      !cloudMode || isSuperAdmin || effectiveRoleId === 'sirket_sahibi' || effectiveRoleId === 'genel_mudur';
    const isFinanceReader =
      isAdminMgr || effectiveRoleId === 'mali_isler' || effectiveRoleId === 'muhasebe';
    const projIdsList = assignedProjectIdsKey === 'ALL' ? null : assignedProjectIdsKey.split(',').filter(Boolean);
    const projFilter = projIdsList !== null ? { whereField: 'projectId' as const, values: projIdsList } : undefined;
    const idFilter = projIdsList !== null ? { whereField: 'id' as const, values: projIdsList } : undefined;

    // Clear all volatile arrays before subscribing with the new session's scope
    setProjects(cloudMode ? [] : getSeedErpProjects());
    setTenders([]);
    setBudgets([]);
    setWorkItems([]);
    setPurchases([]);
    setInvoices([]);
    setProgressPayments([]);
    setSuppliers([]);
    setSupplierQuotes([]);
    setSubcontractors([]);
    setEmployees([]);
    setTimesheets([]);
    setWarehouses(cloudMode ? [] : getSeedWarehouses());
    setStockItems([]);
    setStockMovements([]);
    setEquipment([]);
    setExpenses([]);
    setBankAccounts([]);
    setPayments([]);
    setChecks([]);
    setGuarantees([]);
    setTasks([]);
    setSiteLogs([]);
    setDocuments([]);
    setApprovals([]);
    setErpUsers([]);
    setAuditLogs([]);
    setCrmMessages([]);

    if (cloudMode && isSuperAdmin) {
      runBackwardCompatibleErpMigration(actorEmail);
    }

    const unsubs = [
      subscribeErpCollection<ErpProject>(
        'projects',
        cloudMode,
        getSeedErpProjects(),
        setProjects,
        (raw) => hydrateLegacyProjectToErp(raw, actorEmail),
        idFilter
      ),
      subscribeErpCollection<ErpUserAccount>(
        'users',
        cloudMode,
        [],
        setErpUsers,
        undefined,
        isAdminMgr ? undefined : { singleDocId: actorEmail }
      ),
      subscribeErpCollection<ErpSettings>('settings', cloudMode, [DEFAULT_ERP_SETTINGS as any], (list) => {
        if (list[0]) setErpSettings({ ...DEFAULT_ERP_SETTINGS, ...list[0] });
      }),
      subscribeErpCollection<CustomExpenseCategory>('expenseCategories', cloudMode, [], setCustomCategories),
    ];

    if (allowSec('tenders')) {
      unsubs.push(subscribeErpCollection<TenderRecord>('tenders', cloudMode, [], setTenders));
    }
    if (allowSec('projects') || allowSec('overview') || allowSec('reports')) {
      unsubs.push(subscribeErpCollection<ProjectBudget>('budgets', cloudMode, [], setBudgets, undefined, projFilter));
      unsubs.push(subscribeErpCollection<WorkItem>('workItems', cloudMode, [], setWorkItems, undefined, projFilter));
    }
    if (allowSec('purchases') || allowSec('projects') || allowSec('overview') || allowSec('reports')) {
      unsubs.push(subscribeErpCollection<PurchaseOrder>('purchases', cloudMode, [], setPurchases, undefined, projFilter));
    }
    if (
      allowSec('invoices') ||
      allowSec('overview') ||
      allowSec('reports') ||
      allowSec('currentAccounts') ||
      allowSec('bankCash')
    ) {
      unsubs.push(subscribeErpCollection<InvoiceRecord>('invoices', cloudMode, [], setInvoices, undefined, projFilter));
    }
    if (
      allowSec('progressPayments') ||
      allowSec('overview') ||
      allowSec('reports') ||
      allowSec('bankCash')
    ) {
      unsubs.push(
        subscribeErpCollection<ProgressPayment>('progressPayments', cloudMode, [], setProgressPayments, undefined, projFilter)
      );
    }
    if (
      allowSec('suppliers') ||
      allowSec('purchases') ||
      allowSec('invoices') ||
      allowSec('currentAccounts') ||
      allowSec('reports')
    ) {
      unsubs.push(subscribeErpCollection<SupplierCard>('suppliers', cloudMode, [], setSuppliers));
      unsubs.push(subscribeErpCollection<SupplierQuote>('supplierQuotes', cloudMode, [], setSupplierQuotes));
    }
    if (
      allowSec('subcontractors') ||
      allowSec('projects') ||
      allowSec('currentAccounts') ||
      allowSec('bankCash') ||
      allowSec('reports')
    ) {
      unsubs.push(
        subscribeErpCollection<SubcontractorCard>('subcontractors', cloudMode, [], setSubcontractors, undefined, projFilter)
      );
    }
    if (allowSec('hr') || allowSec('overview') || allowSec('reports')) {
      unsubs.push(subscribeErpCollection<EmployeeCard>('employees', cloudMode, [], setEmployees, undefined, projFilter));
      unsubs.push(subscribeErpCollection<TimesheetEntry>('timesheets', cloudMode, [], setTimesheets, undefined, projFilter));
    }
    if (allowSec('warehouse') || allowSec('equipment') || allowSec('overview') || allowSec('reports')) {
      unsubs.push(subscribeErpCollection<WarehouseRecord>('warehouses', cloudMode, getSeedWarehouses(), setWarehouses));
      unsubs.push(subscribeErpCollection<StockItem>('stockItems', cloudMode, [], setStockItems));
      unsubs.push(subscribeErpCollection<StockMovement>('stockMovements', cloudMode, [], setStockMovements, undefined, projFilter));
      unsubs.push(subscribeErpCollection<EquipmentRecord>('equipment', cloudMode, [], setEquipment));
    }
    if (isFinanceReader || effectiveRoleId === 'proje_muduru') {
      unsubs.push(subscribeErpCollection<ExpenseRecord>('expenses', cloudMode, [], setExpenses, undefined, projFilter));
      unsubs.push(subscribeErpCollection<PaymentRecord>('payments', cloudMode, [], setPayments, undefined, projFilter));
      unsubs.push(subscribeErpCollection<GuaranteeLetter>('guarantees', cloudMode, [], setGuarantees, undefined, projFilter));
    }
    if (isFinanceReader) {
      unsubs.push(subscribeErpCollection<BankAccount>('bankAccounts', cloudMode, [], setBankAccounts));
      unsubs.push(subscribeErpCollection<CheckNoteRecord>('checks', cloudMode, [], setChecks));
    }
    if (allowSec('schedule') || allowSec('projects')) {
      unsubs.push(subscribeErpCollection<GanttTask>('projectTasks', cloudMode, [], setTasks, undefined, projFilter));
    }
    if (allowSec('siteLogs') || allowSec('projects') || allowSec('reports')) {
      unsubs.push(subscribeErpCollection<SiteLogRecord>('siteLogs', cloudMode, [], setSiteLogs, undefined, projFilter));
    }
    if (allowSec('documents') || allowSec('projects')) {
      unsubs.push(subscribeErpCollection<DocumentVaultItem>('documents', cloudMode, [], setDocuments, undefined, projFilter));
    }
    if (isFinanceReader) {
      unsubs.push(subscribeErpCollection<ApprovalRequest>('approvals', cloudMode, [], setApprovals));
    } else if (effectiveRoleId === 'proje_muduru') {
      unsubs.push(subscribeErpCollection<ApprovalRequest>('approvals', cloudMode, [], setApprovals, undefined, projFilter));
    } else if (allowSec('users')) {
      unsubs.push(subscribeErpCollection<ApprovalRequest>('approvals', cloudMode, [], setApprovals));
    } else {
      unsubs.push(
        subscribeErpCollection<ApprovalRequest>('approvals', cloudMode, [], setApprovals, undefined, {
          whereField: 'requestedBy',
          values: [actorEmail],
        })
      );
    }
    if (isAdminMgr) {
      unsubs.push(subscribeErpCollection<AuditLogEntry>('auditLogs', cloudMode, [], setAuditLogs));
    }
    if (allowSec('crmMessages')) {
      unsubs.push(subscribeCollectionData<ContactMessage>('contact_messages', cloudMode, setCrmMessages));
    }

    return () => unsubs.forEach((u) => u());
  }, [mode, cloudMode, actorEmail, isSuperAdmin, effectiveRoleId, assignedProjectIdsKey]);

  const currentUserAccount: ErpUserAccount | null = useMemo(() => {
    if (liveUserDoc) {
      return isSuperAdmin ? { ...liveUserDoc, roleId: 'sirket_sahibi', active: true } : liveUserDoc;
    }
    return {
      id: actorEmail,
      organizationId: ERP_ORG_ID,
      email: actorEmail,
      fullName: erpProfile?.fullName || user?.displayName || actorEmail,
      roleId: effectiveRoleId,
      assignedProjectIds: erpProfile?.assignedProjectIds || [],
      active: erpProfile?.active ?? true,
      createdBy: 'system',
      createdAt: '',
      updatedBy: 'system',
      updatedAt: '',
    };
  }, [liveUserDoc, actorEmail, erpProfile, user?.displayName, effectiveRoleId, isSuperAdmin]);

  const scopedProjects = useMemo(
    () => projects.filter((p) => canAccessProject(currentUserAccount, p.id)),
    [projects, currentUserAccount]
  );
  const scopedProjectIds = useMemo(
    () => new Set(scopedProjects.map((p) => p.id)),
    [scopedProjects]
  );

  const allowProjItem = (projId?: string) =>
    hasAllProjects || (Boolean(projId) && scopedProjectIds.has(String(projId)));

  const scopedBudgets = useMemo(
    () => (hasAllProjects ? budgets : budgets.filter((b) => scopedProjectIds.has(b.projectId))),
    [hasAllProjects, budgets, scopedProjectIds]
  );
  const scopedWorkItems = useMemo(
    () => (hasAllProjects ? workItems : workItems.filter((w) => scopedProjectIds.has(w.projectId))),
    [hasAllProjects, workItems, scopedProjectIds]
  );
  const scopedPurchases = useMemo(
    () => (hasAllProjects ? purchases : purchases.filter((p) => allowProjItem(p.projectId))),
    [hasAllProjects, purchases, scopedProjectIds]
  );
  const scopedInvoices = useMemo(
    () =>
      hasAllProjects
        ? invoices
        : invoices.filter(
            (i) =>
              scopedProjectIds.has(i.projectId) ||
              (i.allocations || []).some((a) => a.targetType === 'project' && scopedProjectIds.has(a.targetId))
          ),
    [hasAllProjects, invoices, scopedProjectIds]
  );
  const scopedProgressPayments = useMemo(
    () => (hasAllProjects ? progressPayments : progressPayments.filter((h) => scopedProjectIds.has(h.projectId))),
    [hasAllProjects, progressPayments, scopedProjectIds]
  );
  const scopedSubcontractors = useMemo(
    () => (hasAllProjects ? subcontractors : subcontractors.filter((s) => allowProjItem(s.projectId))),
    [hasAllProjects, subcontractors, scopedProjectIds]
  );
  const scopedEmployees = useMemo(
    () => (hasAllProjects ? employees : employees.filter((e) => allowProjItem(e.projectId))),
    [hasAllProjects, employees, scopedProjectIds]
  );
  const scopedTimesheets = useMemo(
    () => (hasAllProjects ? timesheets : timesheets.filter((t) => allowProjItem(t.projectId))),
    [hasAllProjects, timesheets, scopedProjectIds]
  );
  const scopedExpenses = useMemo(
    () => (hasAllProjects ? expenses : expenses.filter((e) => allowProjItem(e.projectId))),
    [hasAllProjects, expenses, scopedProjectIds]
  );
  const scopedPayments = useMemo(
    () => (hasAllProjects ? payments : payments.filter((p) => allowProjItem(p.projectId))),
    [hasAllProjects, payments, scopedProjectIds]
  );
  const scopedGuarantees = useMemo(
    () => (hasAllProjects ? guarantees : guarantees.filter((g) => allowProjItem(g.projectId))),
    [hasAllProjects, guarantees, scopedProjectIds]
  );
  const scopedTasks = useMemo(
    () => (hasAllProjects ? tasks : tasks.filter((t) => scopedProjectIds.has(t.projectId))),
    [hasAllProjects, tasks, scopedProjectIds]
  );
  const scopedSiteLogs = useMemo(
    () => (hasAllProjects ? siteLogs : siteLogs.filter((l) => scopedProjectIds.has(l.projectId))),
    [hasAllProjects, siteLogs, scopedProjectIds]
  );
  const scopedDocuments = useMemo(
    () => (hasAllProjects ? documents : documents.filter((d) => allowProjItem(d.projectId))),
    [hasAllProjects, documents, scopedProjectIds]
  );
  const scopedWarehouses = useMemo(
    () =>
      hasAllProjects
        ? warehouses
        : warehouses.filter((w) => w.type === 'merkez' || (w.projectId ? scopedProjectIds.has(w.projectId) : false)),
    [hasAllProjects, warehouses, scopedProjectIds]
  );
  const scopedWarehouseIds = useMemo(
    () => new Set(scopedWarehouses.map((w) => w.id)),
    [scopedWarehouses]
  );
  const scopedStockItems = useMemo(
    () => (hasAllProjects ? stockItems : stockItems.filter((s) => scopedWarehouseIds.has(s.warehouseId))),
    [hasAllProjects, stockItems, scopedWarehouseIds]
  );
  const scopedStockMovements = useMemo(
    () =>
      hasAllProjects
        ? stockMovements
        : stockMovements.filter(
            (m) =>
              (m.projectId && scopedProjectIds.has(m.projectId)) ||
              (m.fromWarehouseId && scopedWarehouseIds.has(m.fromWarehouseId)) ||
              (m.toWarehouseId && scopedWarehouseIds.has(m.toWarehouseId))
          ),
    [hasAllProjects, stockMovements, scopedProjectIds, scopedWarehouseIds]
  );
  const scopedEquipment = useMemo(
    () =>
      hasAllProjects
        ? equipment
        : equipment.filter((eq) => !eq.projectId || scopedProjectIds.has(eq.projectId)),
    [hasAllProjects, equipment, scopedProjectIds]
  );
  const scopedApprovals = useMemo(
    () =>
      hasAllProjects
        ? approvals
        : approvals.filter(
            (a) =>
              (a.projectId && scopedProjectIds.has(a.projectId)) ||
              a.requestedBy?.toLowerCase() === actorEmail
          ),
    [hasAllProjects, approvals, scopedProjectIds, actorEmail]
  );

  const canSeeProfitability = canViewCompanyProfitability(currentUserAccount);
  const canMutate = hasRolePermission(currentUserAccount, 'create');

  const dataset: ErpDatasetSnapshot = useMemo(
    () => ({
      projects: scopedProjects,
      budgets: scopedBudgets,
      purchases: scopedPurchases,
      invoices: scopedInvoices,
      progressPayments: scopedProgressPayments,
      subcontractors: scopedSubcontractors,
      employees: scopedEmployees,
      timesheets: scopedTimesheets,
      expenses: scopedExpenses,
      payments: scopedPayments,
      bankAccounts,
      checks,
      guarantees: scopedGuarantees,
      stockItems: scopedStockItems,
      supplierQuotes,
      workItems: scopedWorkItems,
      siteLogs: scopedSiteLogs,
      tasks: scopedTasks,
      equipment: scopedEquipment,
      warehouses: scopedWarehouses,
    }),
    [
      scopedProjects,
      scopedBudgets,
      scopedPurchases,
      scopedInvoices,
      scopedProgressPayments,
      scopedSubcontractors,
      scopedEmployees,
      scopedTimesheets,
      scopedExpenses,
      scopedPayments,
      bankAccounts,
      checks,
      scopedGuarantees,
      scopedStockItems,
      supplierQuotes,
      scopedWorkItems,
      scopedSiteLogs,
      scopedTasks,
      scopedEquipment,
      scopedWarehouses,
    ]
  );

  const notifications = useMemo(
    () =>
      computeErpNotifications(dataset).filter((n) =>
        canAccessSection(currentUserAccount, n.targetMenu)
      ),
    [dataset, currentUserAccount]
  );
  const unreadCrmCount = canAccessSection(currentUserAccount, 'crmMessages')
    ? crmMessages.filter((m) => m.status === 'yeni').length
    : 0;
  const pendingApprovalCount = canAccessSection(currentUserAccount, 'users')
    ? scopedApprovals.filter((a) => a.status === 'Onay Bekliyor').length
    : 0;

  const visibleMenuItems = useMemo(
    () => MENU_ITEMS.filter((m) => canAccessSection(currentUserAccount, m.id)),
    [currentUserAccount]
  );

  // Enforce menu/route authorization strictly whenever activeMenu or role changes
  useEffect(() => {
    if (mode !== 'cloud-admin' && mode !== 'preview') return;
    if (!canAccessSection(currentUserAccount, activeMenu)) {
      const fallback = visibleMenuItems[0]?.id;
      if (fallback && fallback !== activeMenu) {
        setActiveMenu(fallback);
        setSelectedProject(null);
        setSearchParams({ tab: fallback }, { replace: true });
      }
    }
  }, [mode, currentUserAccount, activeMenu, visibleMenuItems, setSearchParams]);

  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center text-white">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-blue-400" />
      </div>
    );
  }

  if (mode === 'unauthenticated') {
    return <DashboardLogin />;
  }

  const navigateMenu = (menu: ErpMenuSectionId) => {
    if (!canAccessSection(currentUserAccount, menu)) return;
    setActiveMenu(menu);
    setMobileMenuOpen(false);
    setSelectedProject(null);
    setSearchParams({ tab: menu });
  };

  const searchResults: { label: string; menu: ErpMenuSectionId; proj?: ErpProject }[] = globalQuery.trim()
    ? [
        ...(canAccessSection(currentUserAccount, 'projects')
          ? scopedProjects
              .filter((p) => p.title.toLowerCase().includes(globalQuery.toLowerCase()))
              .map((p) => ({ label: `Proje: ${p.title}`, menu: 'projects' as ErpMenuSectionId, proj: p }))
          : []),
        ...(canAccessSection(currentUserAccount, 'invoices')
          ? scopedInvoices
              .filter((i) => i.invoiceNo.toLowerCase().includes(globalQuery.toLowerCase()) || i.supplierName.toLowerCase().includes(globalQuery.toLowerCase()))
              .map((i) => ({ label: `Fatura #${i.invoiceNo} — ${i.supplierName}`, menu: 'invoices' as ErpMenuSectionId }))
          : []),
        ...(canAccessSection(currentUserAccount, 'suppliers')
          ? suppliers
              .filter((s) => s.name.toLowerCase().includes(globalQuery.toLowerCase()))
              .map((s) => ({ label: `Tedarikçi: ${s.name}`, menu: 'suppliers' as ErpMenuSectionId }))
          : []),
      ]
    : [];

  return (
    <div
      data-erp-theme={theme}
      className={`erp-workspace min-h-screen flex ${
        theme === 'dark' ? 'bg-[#030712] text-white' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/65 lg:hidden"
        />
      )}
      {/* Collapsible Left Sidebar */}
      <aside
        className={`${
          mobileMenuOpen ? 'fixed inset-y-0 left-0 z-50 flex' : 'hidden lg:flex'
        } ${sidebarCollapsed ? 'w-20' : 'w-72'} bg-[#02050e] text-white border-r-2 border-slate-800 flex-col justify-between p-3.5 shrink-0 transition-all`}
      >
        <div className="space-y-4 overflow-y-auto pr-1">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <Link to="/">
                <BrandLogo size="sm" subtitle="Müteahhitlik ERP" />
              </Link>
            )}
            <button
              type="button"
              onClick={() =>
                mobileMenuOpen ? setMobileMenuOpen(false) : setSidebarCollapsed((c) => !c)
              }
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300"
            >
              <i className={`fa-solid ${sidebarCollapsed ? 'fa-angles-right' : 'fa-angles-left'}`} />
            </button>
          </div>

          <nav className="space-y-1">
            {visibleMenuItems.map((item) => {
              const active = activeMenu === item.id;
              const badge =
                item.id === 'crmMessages'
                  ? unreadCrmCount
                  : item.id === 'users'
                    ? pendingApprovalCount
                    : 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateMenu(item.id)}
                  title={item.label}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                    active
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-300 hover:bg-[#0b1329] hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <i className={`fa-solid ${item.icon} w-4 text-center shrink-0`} />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </span>
                  {!sidebarCollapsed && badge > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {!sidebarCollapsed && (
          <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
            {!cloudMode && (
              <button
                type="button"
                onClick={loginWithGoogle}
                className="w-full py-2 rounded-xl bg-blue-600/20 border border-blue-500/50 text-blue-300 font-bold"
              >
                Canlı Buluta Bağlan
              </button>
            )}
            <Link
              to="/"
              className="block text-center py-2 rounded-xl bg-[#0b1329] border border-slate-700 text-slate-200 font-bold"
            >
              Web Sitesine Dön
            </Link>
            <button
              type="button"
              onClick={logout}
              className="w-full py-1.5 text-slate-400 hover:text-red-400 font-bold"
            >
              Çıkış Yap
            </button>
          </div>
        )}
      </aside>

      {/* Main ERP Workspace */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        {/* Top Bar */}
        <header className="h-16 bg-[#070d1e] text-white border-b-2 border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-[#0b1329] border border-slate-700"
            >
              <i className="fa-solid fa-bars" />
            </button>

            {/* Quick Project Switcher */}
            <select
              value={selectedProject?.id || ''}
              onChange={(e) => {
                const p = scopedProjects.find((x) => x.id === e.target.value) || null;
                setSelectedProject(p);
                if (p) setActiveMenu('projects');
              }}
              className="px-3 py-1.5 rounded-xl bg-[#0b1329] border border-slate-700 text-xs font-bold text-white max-w-[210px] truncate"
            >
              <option value="">Tüm Projeler (Şirket Geneli)</option>
              {scopedProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.shortName}
                </option>
              ))}
            </select>

            <span
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black ${
                isOnline
                  ? cloudMode
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                  : 'bg-red-950 text-red-300 border border-red-500/40'
              }`}
            >
              {isOnline ? (cloudMode ? 'Firestore Canlı' : 'Önizleme Modu') : 'Çevrimdışı (Taslak)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {offlineQueue.length > 0 && isOnline && (
              <button
                type="button"
                onClick={() => flushOfflineQueue().then(() => setOfflineQueue(readOfflineQueue()))}
                className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black"
              >
                Senkronize Et ({offlineQueue.length})
              </button>
            )}

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-[#0b1329] border border-slate-700 text-xs text-slate-300 hidden sm:flex items-center gap-2"
            >
              <i className="fa-solid fa-magnifying-glass" />
              <span>Ara (Ctrl+K)</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              title="Açık / Koyu Tema"
              className="p-2 rounded-xl bg-[#0b1329] border border-slate-700 text-amber-300"
            >
              <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`} />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="relative p-2 rounded-xl bg-[#0b1329] border border-slate-700 text-white"
              >
                <i className="fa-solid fa-bell" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-4 px-1 rounded-full bg-red-600 text-[10px] font-black flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-[#0b1329] border-2 border-slate-600 rounded-2xl p-4 shadow-2xl z-50 space-y-2 max-h-96 overflow-y-auto text-xs">
                  <div className="font-black text-white flex justify-between">
                    <span>Otomatik Uyarılar ({notifications.length})</span>
                    <button type="button" onClick={() => setNotifOpen(false)} className="text-slate-400">Kapat</button>
                  </div>
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        navigateMenu(n.targetMenu);
                      }}
                      className="w-full text-left p-2.5 rounded-xl bg-[#070d1e] hover:bg-slate-800 border border-slate-800 space-y-0.5"
                    >
                      <div className={`font-black ${n.severity === 'critical' ? 'text-red-400' : n.severity === 'warning' ? 'text-amber-300' : 'text-blue-300'}`}>
                        {n.category} — {n.title}
                      </div>
                      <div className="text-slate-400">{n.description}</div>
                    </button>
                  ))}
                  {notifications.length === 0 && (
                    <div className="text-slate-400 py-4 text-center">Kritik uyarı bulunmuyor.</div>
                  )}
                </div>
              )}
            </div>

            <div className="hidden md:block text-right text-[11px] leading-tight pl-1">
              <div className="font-black text-white">{currentUserAccount?.fullName}</div>
              <div className="text-blue-400 font-bold">
                {ERP_ROLES[currentUserAccount?.roleId || 'sirket_sahibi']?.label}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          {activeMenu === 'overview' && (
            <ExecutiveOverviewView
              dataset={dataset}
              canSeeProfitability={canSeeProfitability}
              onNavigate={navigateMenu}
              onOpenProject={(p) => {
                setSelectedProject(p);
                setActiveMenu('projects');
              }}
              onOpenInvoiceUpload={() => {
                setInvoiceDefaultProjId(undefined);
                setInvoiceModalOpen(true);
              }}
              onQuickAction={(act) => {
                if (act === 'invoice' && canAccessSection(currentUserAccount, 'invoices') && canMutate) {
                  setInvoiceModalOpen(true);
                } else if (act === 'expense') navigateMenu('expenses');
                else if (act === 'stock') navigateMenu('warehouse');
                else if (act === 'payment') navigateMenu('bankCash');
                else if (act === 'sitelog') navigateMenu('siteLogs');
                else if (act === 'timesheet') navigateMenu('hr');
              }}
            />
          )}

          {(activeMenu === 'projects' || activeMenu === 'tenders') && canAccessSection(currentUserAccount, activeMenu) && (
            <TendersAndProjectsView
              mode={activeMenu}
              dataset={{
                ...dataset,
                tenders,
                workItems: scopedWorkItems,
                tasks: scopedTasks,
                siteLogs: scopedSiteLogs,
                documents: scopedDocuments,
              }}
              selectedProject={selectedProject}
              onSelectProject={setSelectedProject}
              canSeeProfitability={canSeeProfitability}
              canMutate={canMutate}
              actorEmail={actorEmail}
              cloudMode={cloudMode}
              onOpenInvoiceUpload={(pid) => {
                if (!canAccessSection(currentUserAccount, 'invoices') || !canMutate) return;
                setInvoiceDefaultProjId(pid);
                setInvoiceModalOpen(true);
              }}
            />
          )}

          {(activeMenu === 'purchases' || activeMenu === 'invoices') && canAccessSection(currentUserAccount, activeMenu) && (
            <PurchasingAndInvoicesView
              mode={activeMenu}
              projects={scopedProjects}
              suppliers={suppliers}
              purchases={scopedPurchases}
              invoices={scopedInvoices}
              expenses={scopedExpenses}
              currentUser={currentUserAccount}
              settings={erpSettings}
              canMutate={canMutate}
              cloudMode={cloudMode}
              onOpenInvoiceUpload={() => {
                if (!canAccessSection(currentUserAccount, 'invoices') || !canMutate) return;
                setInvoiceDefaultProjId(undefined);
                setInvoiceModalOpen(true);
              }}
              onRequestInvoicePayment={(inv) => {
                if (!canAccessSection(currentUserAccount, 'bankCash')) return;
                setPaymentPrefill({
                  key: Date.now(),
                  direction: 'Ödeme',
                  targetType: 'supplier',
                  targetId: inv.supplierId,
                  targetName: inv.supplierName,
                  projectId: inv.projectId,
                  invoiceId: inv.id,
                  amountKurus: inv.remainingDebtKurus,
                });
                navigateMenu('bankCash');
              }}
            />
          )}

          {(activeMenu === 'progressPayments' ||
            activeMenu === 'suppliers' ||
            activeMenu === 'subcontractors') &&
            canAccessSection(currentUserAccount, activeMenu) && (
            <HakedisSuppliersSubsView
              mode={activeMenu}
              projects={scopedProjects}
              progressPayments={scopedProgressPayments}
              suppliers={suppliers}
              supplierQuotes={supplierQuotes}
              subcontractors={scopedSubcontractors}
              invoices={scopedInvoices}
              canMutate={canMutate}
              actorEmail={actorEmail}
              cloudMode={cloudMode}
            />
          )}

          {(activeMenu === 'hr' || activeMenu === 'warehouse' || activeMenu === 'equipment') &&
            canAccessSection(currentUserAccount, activeMenu) && (
            <HrWarehouseEquipmentView
              mode={activeMenu}
              projects={scopedProjects}
              employees={scopedEmployees}
              timesheets={scopedTimesheets}
              warehouses={scopedWarehouses}
              stockItems={scopedStockItems}
              stockMovements={scopedStockMovements}
              equipment={scopedEquipment}
              canMutate={canMutate}
              actorEmail={actorEmail}
              cloudMode={cloudMode}
            />
          )}

          {(activeMenu === 'expenses' ||
            activeMenu === 'currentAccounts' ||
            activeMenu === 'bankCash' ||
            activeMenu === 'checks' ||
            activeMenu === 'guarantees') &&
            canAccessSection(currentUserAccount, activeMenu) && (
            <FinanceBankingView
              mode={activeMenu}
              projects={scopedProjects}
              expenses={scopedExpenses}
              customCategories={customCategories}
              bankAccounts={bankAccounts}
              payments={scopedPayments}
              invoices={scopedInvoices}
              progressPayments={scopedProgressPayments}
              suppliers={suppliers}
              subcontractors={scopedSubcontractors}
              checks={checks}
              guarantees={scopedGuarantees}
              currentUser={currentUserAccount}
              settings={erpSettings}
              canMutate={canMutate}
              cloudMode={cloudMode}
              paymentPrefill={paymentPrefill}
              onClearPaymentPrefill={() => setPaymentPrefill(null)}
              onRequestPayment={(prefill) => {
                if (!canAccessSection(currentUserAccount, 'bankCash')) return;
                setPaymentPrefill({ ...prefill, key: Date.now() });
                navigateMenu('bankCash');
              }}
            />
          )}

          {(activeMenu === 'schedule' ||
            activeMenu === 'siteLogs' ||
            activeMenu === 'documents') &&
            canAccessSection(currentUserAccount, activeMenu) && (
            <ScheduleSiteLogsDocsView
              mode={activeMenu}
              projects={scopedProjects}
              tasks={scopedTasks}
              siteLogs={scopedSiteLogs}
              documents={scopedDocuments}
              canMutate={canMutate}
              actorEmail={actorEmail}
              cloudMode={cloudMode}
            />
          )}

          {(activeMenu === 'reports' ||
            activeMenu === 'aiAssistant' ||
            activeMenu === 'users' ||
            activeMenu === 'settings') &&
            canAccessSection(currentUserAccount, activeMenu) && (
            <ReportsAiUsersSettingsView
              mode={activeMenu}
              dataset={dataset}
              users={erpUsers}
              approvals={scopedApprovals}
              auditLogs={auditLogs}
              settings={erpSettings}
              currentUser={currentUserAccount}
              canSeeProfitability={canSeeProfitability}
              cloudMode={cloudMode}
              onSaveSettings={async (next) => {
                setErpSettings(next);
                await saveErpRecord('settings', { ...next, id: 'general' }, actorEmail, cloudMode, 'UPDATE', 'ERP sistem ayarları güncellendi');
                await saveErpRecord(
                  'dashboard_settings',
                  {
                    id: 'general',
                    companyName: next.companyName,
                    shortBrand: 'KUZEY DENİZİ',
                    taxOffice: next.taxOffice,
                    taxNumber: next.taxNumber,
                    phone: next.phone,
                    email: next.email,
                    address: next.address,
                    mailWebhookUrl: next.mailWebhookUrl,
                    autoSyncContactToMail: next.autoSyncContactToMail,
                  },
                  actorEmail,
                  cloudMode
                );
              }}
              onConnectCloud={() => {
                void loginWithGoogle();
              }}
              onOpenInvoiceUpload={() => {
                if (!canAccessSection(currentUserAccount, 'invoices') || !canMutate) return;
                setInvoiceDefaultProjId(undefined);
                setInvoiceModalOpen(true);
              }}
              onNavigate={navigateMenu}
            />
          )}

          {activeMenu === 'crmMessages' && canAccessSection(currentUserAccount, 'crmMessages') && (
            <MessagesTab
              messages={crmMessages}
              onSaveMessage={(m) => saveEntity('contact_messages', m, cloudMode)}
              onDeleteMessage={async (id) => {
                await removeEntity('contact_messages', id, cloudMode);
              }}
              onConvertToProject={async (msg) => {
                const now = new Date().toISOString();
                const prj = hydrateLegacyProjectToErp(
                  {
                    id: `prj-${Date.now()}`,
                    code: `CB-${String(projects.length + 1).padStart(2, '0')}`,
                    title: `${msg.company || msg.name} — ${msg.serviceLabel}`,
                    shortName: (msg.company || msg.name).slice(0, 40),
                    client: msg.company || msg.name,
                    description: msg.message,
                    status: 'planlama',
                    progress: 0,
                  },
                  actorEmail
                );
                await saveErpRecord('projects', prj, actorEmail, cloudMode);
                return {
                  id: prj.id,
                  code: prj.code,
                  title: prj.title,
                  shortName: prj.shortName,
                  category: prj.category,
                  categoryLabel: msg.serviceLabel,
                  status: 'planlama',
                  statusBadge: 'Hazırlanıyor',
                  location: prj.location,
                  client: prj.employer || prj.contractingAuthority || '',
                  area: '',
                  budget: 0,
                  collectedAmount: 0,
                  progress: 0,
                  siteManager: prj.siteChief,
                  startDate: now.slice(0, 10),
                  endDate: '',
                  description: prj.description,
                  highlights: [],
                  milestones: [],
                  image: prj.coverImage,
                  galleryImages: [prj.coverImage],
                  publishedOnSite: false,
                  isFeatured: false,
                  createdAt: now,
                  updatedAt: now,
                } as ProjectItem;
              }}
              onReplyInMailControl={(msg) => {
                setMailComposePrefill({
                  key: Date.now(),
                  to: msg.email,
                  subject: `Teklif Talebiniz Hk. — ${msg.serviceLabel}`,
                  body: `Sayın ${msg.name},\n\n"${msg.serviceLabel}" hakkındaki talebiniz tarafımıza ulaşmıştır.\n\nSaygılarımızla,\nKuzey Denizi İnşaat\nTel: 0533 677 91 09`,
                });
                navigateMenu('mailControl');
              }}
            />
          )}

          {activeMenu === 'mailControl' && canAccessSection(currentUserAccount, 'mailControl') && (
            <SafirMailModule
              cloudMode={cloudMode}
              actorEmail={actorEmail}
              onLogout={() => { void logout(); }}
              composePrefill={mailComposePrefill}
              onPrefillConsumed={() => setMailComposePrefill(null)}
            />
          )}
        </main>

        {/* Mobile PWA Quick Bottom Bar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#02050e] border-t-2 border-slate-800 flex items-center justify-around text-[10px] font-bold text-slate-300">
          {canAccessSection(currentUserAccount, 'overview') && (
            <button type="button" onClick={() => navigateMenu('overview')} className="py-2.5 flex flex-col items-center gap-1">
              <i className="fa-solid fa-gauge-high text-sm" />
              <span>Özet</span>
            </button>
          )}
          {canAccessSection(currentUserAccount, 'projects') && (
            <button type="button" onClick={() => navigateMenu('projects')} className="py-2.5 flex flex-col items-center gap-1">
              <i className="fa-solid fa-diagram-project text-sm" />
              <span>Projeler</span>
            </button>
          )}
          {canAccessSection(currentUserAccount, 'invoices') && canMutate && (
            <button
              type="button"
              onClick={() => setInvoiceModalOpen(true)}
              className="py-2.5 flex flex-col items-center gap-1 text-blue-400"
            >
              <i className="fa-solid fa-camera text-base" />
              <span>Fatura Çek</span>
            </button>
          )}
          {canAccessSection(currentUserAccount, 'siteLogs') && (
            <button type="button" onClick={() => navigateMenu('siteLogs')} className="py-2.5 flex flex-col items-center gap-1">
              <i className="fa-solid fa-clipboard-list text-sm" />
              <span>Günlük</span>
            </button>
          )}
          {canAccessSection(currentUserAccount, 'hr') && (
            <button type="button" onClick={() => navigateMenu('hr')} className="py-2.5 flex flex-col items-center gap-1">
              <i className="fa-solid fa-user-clock text-sm" />
              <span>Puantaj</span>
            </button>
          )}
        </nav>
      </div>

      {/* Global Search Modal */}
      {searchOpen && (
        <div
          onClick={() => setSearchOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center pt-20 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0b1329] border-2 border-slate-600 rounded-2xl max-w-lg w-full p-4 space-y-3 text-xs text-white"
          >
            <input
              autoFocus
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              placeholder="Proje, fatura no veya tedarikçi ara..."
              className="w-full px-4 py-2.5 rounded-xl bg-[#0f172a] border border-slate-600 text-sm"
            />
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {searchResults.map((res, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    if ('proj' in res && res.proj) {
                      setSelectedProject(res.proj);
                      setActiveMenu('projects');
                    } else {
                      navigateMenu(res.menu);
                    }
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 font-bold"
                >
                  {res.label}
                </button>
              ))}
              {globalQuery && searchResults.length === 0 && (
                <div className="text-slate-400 p-3 text-center">Sonuç bulunamadı.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice Capture & OCR / XML / Allocation Modal */}
      <InvoiceCaptureModal
        open={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        projects={scopedProjects}
        warehouses={scopedWarehouses}
        suppliers={suppliers}
        existingInvoices={scopedInvoices}
        actorEmail={actorEmail}
        cloudMode={cloudMode}
        aiBackendEndpoint={erpSettings.aiBackendEndpoint}
        defaultProjectId={invoiceDefaultProjId}
        onSuccess={() => navigateMenu('invoices')}
      />
    </div>
  );
};
