// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  canAccessProject,
  canAccessSection,
  canUserApproveAmount,
  canViewCompanyProfitability,
  hasRolePermission,
} from '../utils/permissions';
import {
  clearErpLocalScope,
  DEFAULT_ERP_SETTINGS,
  enqueueOfflineMutation,
  getErpLocalScope,
  hydrateLegacyProjectToErp,
  readLocalCollection,
  readOfflineQueue,
  setErpLocalScope,
  stripUndefinedDeep,
  writeLocalCollection,
} from '../services/erpStore';
import { isSuperAdminEmail } from '../../core/firebase';
import { getLocalProjects, normalizePublicProject } from '../../services/dataService';
import { ErpUserAccount } from '../types/erp';
import { toKurus } from '../utils/money';

function makeUser(roleId: ErpUserAccount['roleId'], assignedProjectIds: string[] = []): ErpUserAccount {
  return {
    id: `${roleId}@kuzeydeniziyapi.com.tr`,
    organizationId: 'kuzeydenizi',
    email: `${roleId}@kuzeydeniziyapi.com.tr`,
    fullName: roleId,
    roleId,
    assignedProjectIds,
    active: true,
    createdBy: 'test',
    createdAt: '',
    updatedBy: 'test',
    updatedAt: '',
  };
}

describe('RBAC Permissions, Approval Matrix & Legacy Project Migration', () => {
  it('enforces project-level isolation and hides company profitability for Şantiye Şefi & Saha Personeli', () => {
    const santiyeSefi = makeUser('santiye_sefi', ['prj-adliye']);
    expect(canAccessProject(santiyeSefi, 'prj-adliye')).toBe(true);
    expect(canAccessProject(santiyeSefi, 'prj-pozanti')).toBe(false);
    expect(canViewCompanyProfitability(santiyeSefi)).toBe(false);
    expect(canAccessSection(santiyeSefi, 'users')).toBe(false);
    expect(canAccessSection(santiyeSefi, 'siteLogs')).toBe(true);

    const saha = makeUser('saha_personeli', ['prj-pozanti']);
    expect(hasRolePermission(saha, 'update')).toBe(false);
    expect(hasRolePermission(saha, 'approve')).toBe(false);
    expect(canViewCompanyProfitability(saha)).toBe(false);
    expect(canAccessProject(saha, 'prj-adliye')).toBe(false);
  });

  it('enforces amount-based approval limits (<10k / 10k-100k / >100k)', () => {
    const projeMuduru = makeUser('proje_muduru', ['prj-1']);
    const maliIsler = makeUser('mali_isler');
    const genelMudur = makeUser('genel_mudur');

    // < 10.000 TL: Proje Müdürü can approve
    expect(canUserApproveAmount(projeMuduru, toKurus(5_000), DEFAULT_ERP_SETTINGS)).toBe(true);
    // 50.000 TL (10k-100k): Mali İşler & Proje Müdürü can approve
    expect(canUserApproveAmount(maliIsler, toKurus(50_000), DEFAULT_ERP_SETTINGS)).toBe(true);
    // > 100.000 TL: Requires Genel Müdür or Şirket Sahibi
    expect(canUserApproveAmount(maliIsler, toKurus(150_000), DEFAULT_ERP_SETTINGS)).toBe(false);
    expect(canUserApproveAmount(projeMuduru, toKurus(150_000), DEFAULT_ERP_SETTINGS)).toBe(false);
    expect(canUserApproveAmount(genelMudur, toKurus(150_000), DEFAULT_ERP_SETTINGS)).toBe(true);
  });

  it('recognizes all designated super admin emails case-insensitively', () => {
    expect(isSuperAdminEmail('cebrailkara@gmail.com')).toBe(true);
    expect(isSuperAdminEmail('hayrullahcingoz81@gmail.com')).toBe(true);
    expect(isSuperAdminEmail('HAYRULLAHCINGOZ81@GMAIL.COM')).toBe(true);
    expect(isSuperAdminEmail('YalinizlarGrup@gmail.com')).toBe(true);
    expect(isSuperAdminEmail('ILKERYALINIZ@gmail.com')).toBe(true);
    expect(isSuperAdminEmail('info@kuzeydeniziyapi.com.tr')).toBe(true);
    expect(isSuperAdminEmail('yetkisiz@example.com')).toBe(false);
  });

  it('hydrates legacy website ProjectItem into full 27-field ErpProject safely', () => {
    const erp = hydrateLegacyProjectToErp(
      {
        id: 'prj-pozanti',
        code: 'CB-02',
        title: 'Pozantı 80. Yıl Devlet Hastanesi',
        client: 'T.C. Sağlık Bakanlığı',
        location: 'Pozantı, Adana',
        status: 'teslim-edildi',
        progress: 100,
        budget: 250000,
      },
      'info@kuzeydeniziyapi.com.tr'
    );
    expect(erp.status).toBe('Tamamlandı');
    expect(erp.district).toBe('Pozantı');
    expect(erp.employer).toBe('T.C. Sağlık Bakanlığı');
    expect(erp.contractAmountKurus).toBe(toKurus(250_000));
    expect(erp.warnThresholds.criticalPct).toBe(95);
    expect(erp.physicalProgressPct).toBe(100);
  });

  it('isolates localStorage collections and offline queues across preview and cloud users', () => {
    localStorage.clear();

    setErpLocalScope('cloud_user_a');
    expect(getErpLocalScope()).toBe('cloud_user_a');
    writeLocalCollection('invoices', [{ id: 'inv-secret-a', amount: 5000 }]);
    enqueueOfflineMutation({
      id: 'off-a',
      clientMutationId: 'mut-a',
      collection: 'invoices',
      payload: { id: 'inv-secret-a' },
      createdAt: '2026-11-19T00:00:00Z',
      label: 'A invoice',
    });

    setErpLocalScope('preview');
    expect(readLocalCollection<any>('invoices', [])).toEqual([]);
    expect(readOfflineQueue()).toEqual([]);

    setErpLocalScope('cloud_user_b');
    expect(readLocalCollection<any>('invoices', [])).toEqual([]);
    expect(readOfflineQueue()).toEqual([]);

    setErpLocalScope('cloud_user_a');
    expect(readLocalCollection<any>('invoices', [])).toHaveLength(1);
    expect(readOfflineQueue()).toHaveLength(1);

    clearErpLocalScope('cloud_user_a');
    expect(readLocalCollection<any>('invoices', [])).toEqual([]);
    expect(readOfflineQueue()).toEqual([]);
    setErpLocalScope('preview');
  });

  it('strips undefined properties recursively before Firestore writes', () => {
    const cleaned = stripUndefinedDeep({
      id: 'pay-1',
      amountKurus: 10000,
      invoiceId: undefined,
      hakedisId: undefined,
      nested: { keep: 'ok', drop: undefined },
      list: [1, undefined, { a: 2, b: undefined }],
    });
    expect(cleaned).toEqual({
      id: 'pay-1',
      amountKurus: 10000,
      nested: { keep: 'ok' },
      list: [1, { a: 2 }],
    });
    expect('invoiceId' in cleaned).toBe(false);
    expect('hakedisId' in cleaned).toBe(false);
  });

  it('invalidates stale cb_projects_v2 cache and merges newly added public seed projects', () => {
    localStorage.clear();
    localStorage.setItem(
      'cb_projects_v2',
      JSON.stringify([{ id: 'prj-kuzey-panorama', title: 'Stale Old Entry' }])
    );
    localStorage.setItem(
      'cb_projects_v3',
      JSON.stringify([
        {
          id: 'prj-kuzey-panorama',
          code: 'KD-01',
          title: 'Kuzey Panorama Konutları',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ])
    );

    const projects = getLocalProjects();
    const ids = projects.map((p) => p.id);
    expect(localStorage.getItem('cb_projects_v2')).toBeNull();
    expect(ids).toContain('prj-ceyhan-ulus-saglik-ocagi');
    expect(ids).toContain('prj-yuregir-dis-hastanesi-tretuar');
    expect(ids).toContain('prj-gecitli-saglik-ocagi-tadilati');
    expect(ids).toContain('prj-kizildere-deprem-konutlari');
    expect(projects[0].id).toBe('prj-ceyhan-ulus-saglik-ocagi');
  });

  it('normalizes ERP-hydrated project records for public showcase rendering', () => {
    const erp = hydrateLegacyProjectToErp(
      {
        id: 'prj-ceyhan-ulus-saglik-ocagi',
        code: 'KD-01',
        title: 'Ceyhan Ulus Sağlık Ocağı Yapımı',
        client: 'T.C. Sağlık Bakanlığı',
        location: 'Ulus Mah., Ceyhan / ADANA',
        status: 'teslim-edildi',
        progress: 100,
        image: '/images/projects/ceyhan-ulus-saglik-ocagi/foto-1.jpg',
        galleryImages: ['/images/projects/ceyhan-ulus-saglik-ocagi/foto-1.jpg'],
      },
      'info@kuzeydeniziyapi.com.tr'
    );
    const pub = normalizePublicProject(erp);
    expect(pub.status).toBe('teslim-edildi');
    expect(pub.image).toBe('/images/projects/ceyhan-ulus-saglik-ocagi/foto-1.jpg');
    expect(pub.publishedOnSite).toBe(true);
  });
});
