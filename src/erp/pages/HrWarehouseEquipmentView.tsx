import React, { useState } from 'react';
import {
  deleteErpRecord,
  ERP_ORG_ID,
  recordStockConsumption,
  saveErpRecord,
  transferWarehouseStock,
} from '../services/erpStore';
import {
  EmployeeCard,
  EquipmentRecord,
  ErpProject,
  StockItem,
  StockMovement,
  TimesheetEntry,
  WarehouseRecord,
} from '../types/erp';
import { formatKurusTRY, fromKurus, toKurus } from '../utils/money';

interface HrWarehouseEquipmentViewProps {
  mode: 'hr' | 'warehouse' | 'equipment';
  projects: ErpProject[];
  employees: EmployeeCard[];
  timesheets: TimesheetEntry[];
  warehouses: WarehouseRecord[];
  stockItems: StockItem[];
  stockMovements: StockMovement[];
  equipment: EquipmentRecord[];
  canMutate: boolean;
  actorEmail: string;
  cloudMode: boolean;
}

export const HrWarehouseEquipmentView: React.FC<HrWarehouseEquipmentViewProps> = ({
  mode,
  projects,
  employees,
  timesheets,
  warehouses,
  stockItems,
  stockMovements,
  equipment,
  canMutate,
  actorEmail,
  cloudMode,
}) => {
  const [editingEmp, setEditingEmp] = useState<EmployeeCard | null>(null);
  const [newTs, setNewTs] = useState<TimesheetEntry | null>(null);
  const [newWarehouse, setNewWarehouse] = useState<WarehouseRecord | null>(null);
  const [newStock, setNewStock] = useState<StockItem | null>(null);
  const [transferModal, setTransferModal] = useState<{ item: StockItem; toWhId: string; qty: number } | null>(null);
  const [consumeModal, setConsumeModal] = useState<{ item: StockItem; projectId: string; qty: number; notes: string } | null>(null);
  const [editingEq, setEditingEq] = useState<EquipmentRecord | null>(null);
  const [transferError, setTransferError] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (mode === 'hr') {
    const openNewEmp = () => {
      const now = new Date().toISOString();
      setEditingEmp({
        id: `emp-${Date.now()}`,
        organizationId: ERP_ORG_ID,
        fullName: '',
        profession: 'Usta / Saha Personeli',
        projectId: projects[0]?.id || '',
        dailyWageKurus: 0,
        monthlySalaryKurus: 0,
        employerCostMultiplier: 1.225,
        hireDate: now.slice(0, 10),
        phone: '',
        active: true,
        createdBy: actorEmail,
        createdAt: now,
        updatedBy: actorEmail,
        updatedAt: now,
      });
    };

    const openNewTimesheet = () => {
      const emp = employees[0];
      const now = new Date().toISOString();
      setNewTs({
        id: `ts-${Date.now()}`,
        organizationId: ERP_ORG_ID,
        employeeId: emp?.id || '',
        employeeName: emp?.fullName || '',
        projectId: emp?.projectId || projects[0]?.id || '',
        date: now.slice(0, 10),
        workedDays: 1,
        overtimeHours: 0,
        leaveDays: 0,
        absenceDays: 0,
        advanceKurus: 0,
        paidWageKurus: 0,
        employerCostKurus: emp ? Math.round(emp.dailyWageKurus * emp.employerCostMultiplier) : 0,
        notes: '',
        createdBy: actorEmail,
        createdAt: now,
        updatedBy: actorEmail,
        updatedAt: now,
      });
    };

    return (
      <div className="space-y-6">
        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-white">Personel, SGK/İSG &amp; Mobil Şantiye Puantajı</h2>
            <p className="text-xs text-slate-400">
              Çoklu şantiye puantajı, mesai, avans ve çalışılan süreye göre otomatik proje maliyet dağıtımı
            </p>
          </div>
          {canMutate && (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={employees.length === 0}
                onClick={openNewTimesheet}
                title={employees.length === 0 ? 'Önce personel kartı oluşturun' : ''}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black"
              >
                + Günlük Puantaj Gir
              </button>
              <button type="button" onClick={openNewEmp} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black">
                + Personel Ekle
              </button>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500 text-xs font-bold text-red-200">
            {errorMsg}
          </div>
        )}

        {/* Employee Cards */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {employees.map((e) => (
            <div key={e.id} className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <div>
                  <div className="font-black text-white text-sm">
                    {e.fullName} {!e.active && <span className="text-[10px] text-amber-400">(Pasif)</span>}
                  </div>
                  <div className="text-slate-400">{e.profession} • {projects.find((p) => p.id === e.projectId)?.shortName || 'Merkez'}</div>
                </div>
                {canMutate && (
                  <div className="flex items-start gap-2 shrink-0">
                    <button type="button" onClick={() => setEditingEmp(e)} className="text-blue-400 font-bold">
                      Düzenle
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteErpRecord('employees', e.id, actorEmail, cloudMode).catch((err) => setErrorMsg(err?.message || 'Silinemedi.'))}
                      className="text-red-400 hover:text-red-300 font-bold"
                    >
                      Sil
                    </button>
                  </div>
                )}
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-800">
                <span>Günlük: <strong>{formatKurusTRY(e.dailyWageKurus)}</strong></span>
                <span>Aylık: <strong>{formatKurusTRY(e.monthlySalaryKurus)}</strong></span>
              </div>
            </div>
          ))}
        </div>

        {/* Timesheet Ledger */}
        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#070d1e] border-b border-slate-700 text-slate-400 uppercase">
                <th className="py-3 px-4">Tarih</th>
                <th className="py-3 px-4">Personel</th>
                <th className="py-3 px-4">Çalıştığı Şantiye</th>
                <th className="py-3 px-4">Gün / Mesai</th>
                <th className="py-3 px-4">Avans / Ödenen</th>
                <th className="py-3 px-4">İşverene Maliyet</th>
                <th className="py-3 px-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {timesheets.map((ts) => (
                <tr key={ts.id}>
                  <td className="py-3 px-4">{ts.date}</td>
                  <td className="py-3 px-4 font-bold text-white">{ts.employeeName}</td>
                  <td className="py-3 px-4 text-blue-300">{projects.find((p) => p.id === ts.projectId)?.shortName || '—'}</td>
                  <td className="py-3 px-4">{ts.workedDays} gün • {ts.overtimeHours} sa mesai</td>
                  <td className="py-3 px-4">{formatKurusTRY(ts.advanceKurus)} / {formatKurusTRY(ts.paidWageKurus)}</td>
                  <td className="py-3 px-4 font-black text-rose-400">{formatKurusTRY(ts.employerCostKurus)}</td>
                  <td className="py-3 px-4 text-right space-x-2">
                    {canMutate && (
                      <>
                        <button type="button" onClick={() => setNewTs(ts)} className="text-blue-400 font-bold">Düzenle</button>
                        <button
                          type="button"
                          onClick={() => deleteErpRecord('timesheets', ts.id, actorEmail, cloudMode).catch((err) => setErrorMsg(err?.message || 'Silinemedi.'))}
                          className="text-red-400 font-bold"
                        >
                          Sil
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {timesheets.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">Puantaj kaydı henüz girilmedi.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {editingEmp && (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await saveErpRecord('employees', editingEmp, actorEmail, cloudMode);
                setEditingEmp(null);
              }}
              className="bg-[#0b1329] border-2 border-slate-600 rounded-2xl max-w-lg w-full p-6 space-y-3 text-xs"
            >
              <h3 className="text-base font-black text-white">Personel Kartı</h3>
              <input required placeholder="Ad Soyad *" value={editingEmp.fullName} onChange={(e) => setEditingEmp({ ...editingEmp, fullName: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="Meslek / Görev" value={editingEmp.profession} onChange={(e) => setEditingEmp({ ...editingEmp, profession: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                <select value={editingEmp.projectId} onChange={(e) => setEditingEmp({ ...editingEmp, projectId: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.shortName}</option>)}
                </select>
                <input placeholder="Telefon" value={editingEmp.phone} onChange={(e) => setEditingEmp({ ...editingEmp, phone: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                <input type="date" value={editingEmp.hireDate} onChange={(e) => setEditingEmp({ ...editingEmp, hireDate: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                <label>
                  <span>Günlük Ücret (TL)</span>
                  <input type="number" value={fromKurus(editingEmp.dailyWageKurus)} onChange={(e) => setEditingEmp({ ...editingEmp, dailyWageKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Aylık Maaş (TL)</span>
                  <input type="number" value={fromKurus(editingEmp.monthlySalaryKurus)} onChange={(e) => setEditingEmp({ ...editingEmp, monthlySalaryKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3 items-center">
                <label>
                  <span>İşveren SGK Çarpanı</span>
                  <input type="number" step="0.005" value={editingEmp.employerCostMultiplier} onChange={(e) => setEditingEmp({ ...editingEmp, employerCostMultiplier: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label className="flex items-center gap-2 pt-4">
                  <input type="checkbox" checked={editingEmp.active} onChange={(e) => setEditingEmp({ ...editingEmp, active: e.target.checked })} />
                  <span>Aktif Personel</span>
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingEmp(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 font-black">Kaydet</button>
              </div>
            </form>
          </div>
        )}

        {newTs && (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const emp = employees.find((x) => x.id === newTs.employeeId);
                if (!emp) {
                  setErrorMsg('Lütfen geçerli bir personel seçin.');
                  return;
                }
                const cost =
                  newTs.employerCostKurus > 0
                    ? newTs.employerCostKurus
                    : Math.round(newTs.workedDays * emp.dailyWageKurus * emp.employerCostMultiplier);
                await saveErpRecord(
                  'timesheets',
                  { ...newTs, employeeName: emp.fullName, employerCostKurus: cost },
                  actorEmail,
                  cloudMode
                );
                setNewTs(null);
              }}
              className="bg-[#0b1329] border-2 border-slate-600 rounded-2xl max-w-lg w-full p-6 space-y-3 text-xs"
            >
              <h3 className="text-base font-black text-white">Mobil Şantiye Puantajı</h3>
              <div className="grid grid-cols-2 gap-3">
                <select
                  required
                  value={newTs.employeeId}
                  onChange={(e) => {
                    const emp = employees.find((x) => x.id === e.target.value);
                    const cost = emp ? Math.round(newTs.workedDays * emp.dailyWageKurus * emp.employerCostMultiplier) : 0;
                    setNewTs({
                      ...newTs,
                      employeeId: e.target.value,
                      employeeName: emp?.fullName || '',
                      projectId: emp?.projectId || newTs.projectId,
                      employerCostKurus: cost,
                    });
                  }}
                  className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                >
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName}</option>)}
                </select>
                <select value={newTs.projectId} onChange={(e) => setNewTs({ ...newTs, projectId: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.shortName}</option>)}
                </select>
                <label>
                  <span>Tarih</span>
                  <input type="date" value={newTs.date} onChange={(e) => setNewTs({ ...newTs, date: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Çalışılan Gün</span>
                  <input
                    type="number"
                    step="0.5"
                    value={newTs.workedDays}
                    onChange={(e) => {
                      const days = Number(e.target.value);
                      const emp = employees.find((x) => x.id === newTs.employeeId);
                      const cost = emp ? Math.round(days * emp.dailyWageKurus * emp.employerCostMultiplier) : newTs.employerCostKurus;
                      setNewTs({ ...newTs, workedDays: days, employerCostKurus: cost });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600"
                  />
                </label>
                <label>
                  <span>Fazla Mesai (Saat)</span>
                  <input type="number" step="0.5" value={newTs.overtimeHours} onChange={(e) => setNewTs({ ...newTs, overtimeHours: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Avans (TL)</span>
                  <input type="number" step="0.01" value={fromKurus(newTs.advanceKurus)} onChange={(e) => setNewTs({ ...newTs, advanceKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Ödenen Ücret (TL)</span>
                  <input type="number" step="0.01" value={fromKurus(newTs.paidWageKurus)} onChange={(e) => setNewTs({ ...newTs, paidWageKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Toplam İşveren Maliyeti (TL)</span>
                  <input type="number" step="0.01" value={fromKurus(newTs.employerCostKurus)} onChange={(e) => setNewTs({ ...newTs, employerCostKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setNewTs(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-emerald-600 font-black">Puantaj Kaydet</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'warehouse') {
    const openNewWh = () => {
      const now = new Date().toISOString();
      setNewWarehouse({
        id: `wh-${Date.now()}`,
        organizationId: ERP_ORG_ID,
        name: '',
        type: 'santiye',
        projectId: projects[0]?.id,
        location: '',
        manager: '',
        createdBy: actorEmail,
        createdAt: now,
        updatedBy: actorEmail,
        updatedAt: now,
      });
    };

    const openNewStock = () => {
      const now = new Date().toISOString();
      setNewStock({
        id: `stk-${Date.now()}`,
        organizationId: ERP_ORG_ID,
        warehouseId: warehouses[0]?.id || 'wh-merkez',
        sku: `CB-${Date.now().toString().slice(-4)}`,
        barcode: `869${Date.now().toString().slice(-10)}`,
        name: '',
        category: 'İnşaat İmalatları',
        unit: 'Adet',
        quantity: 0,
        minStockLevel: 10,
        avgUnitCostKurus: 0,
        totalValueKurus: 0,
        usedQty: 0,
        createdBy: actorEmail,
        createdAt: now,
        updatedBy: actorEmail,
        updatedAt: now,
      });
    };

    return (
      <div className="space-y-6">
        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-white">Depo, Şantiye Stoku &amp; QR/Barkod Takibi</h2>
            <p className="text-xs text-slate-400">
              Merkez depo ve şantiyeler arası maliyet aktarımlı transfer (çifte maliyet engellenir)
            </p>
          </div>
          {canMutate && (
            <div className="flex gap-2">
              <button type="button" onClick={openNewWh} className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-600 text-xs font-bold">
                + Şantiye Deposu Aç
              </button>
              <button type="button" onClick={openNewStock} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black">
                + Stok Kalemi Ekle
              </button>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500 text-xs font-bold text-red-200">
            {errorMsg}
          </div>
        )}

        {/* Warehouses Strip */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouses.map((w) => {
            const whItems = stockItems.filter((s) => s.warehouseId === w.id);
            const totalVal = whItems.reduce((s, i) => s + i.totalValueKurus, 0);
            return (
              <div key={w.id} className="bg-[#0b1329] border border-slate-700 rounded-2xl p-4 text-xs space-y-1">
                <div className="flex justify-between items-start gap-2">
                  <div className="font-black text-white text-sm">{w.name}</div>
                  {canMutate && (
                    <div className="flex gap-2 shrink-0">
                      <button type="button" onClick={() => setNewWarehouse(w)} className="text-blue-400 font-bold">Düzenle</button>
                      {w.id !== 'wh-merkez' && (
                        <button
                          type="button"
                          onClick={() => deleteErpRecord('warehouses', w.id, actorEmail, cloudMode).catch((err) => setErrorMsg(err?.message || 'Depo silinemedi.'))}
                          className="text-red-400 font-bold"
                        >
                          Sil
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-slate-400">{w.type === 'merkez' ? 'Merkez Depo' : 'Şantiye Stoku'} • {whItems.length} kalem</div>
                <div className="text-emerald-400 font-black pt-1">Stok Değeri: {formatKurusTRY(totalVal)}</div>
              </div>
            );
          })}
        </div>

        {/* Stock Table */}
        <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#070d1e] border-b border-slate-700 text-slate-400 uppercase">
                <th className="py-3 px-4">Malzeme / Barkod</th>
                <th className="py-3 px-4">Depo</th>
                <th className="py-3 px-4">Bekleyen / Kullanılan</th>
                <th className="py-3 px-4">Birim Maliyet</th>
                <th className="py-3 px-4">Toplam Değer</th>
                <th className="py-3 px-4 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {stockItems.map((st) => {
                const low = st.quantity <= st.minStockLevel;
                return (
                  <tr key={st.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{st.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">QR/Barkod: {st.barcode}</div>
                    </td>
                    <td className="py-3 px-4 text-blue-300">
                      {warehouses.find((w) => w.id === st.warehouseId)?.name || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={low ? 'text-rose-400 font-black' : 'text-emerald-400 font-black'}>
                        {st.quantity} {st.unit}
                      </span>
                      <span className="text-slate-400 ml-2">(Kullanılan: {st.usedQty})</span>
                    </td>
                    <td className="py-3 px-4">{formatKurusTRY(st.avgUnitCostKurus)}</td>
                    <td className="py-3 px-4 font-bold">{formatKurusTRY(st.totalValueKurus)}</td>
                    <td className="py-3 px-4 text-right space-x-1.5">
                      {canMutate && st.quantity > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const wh = warehouses.find((w) => w.id === st.warehouseId);
                            setConsumeModal({
                              item: st,
                              projectId: wh?.projectId || projects[0]?.id || '',
                              qty: 1,
                              notes: '',
                            });
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                        >
                          Kullan
                        </button>
                      )}
                      {canMutate && warehouses.length > 1 && st.quantity > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const other = warehouses.find((w) => w.id !== st.warehouseId);
                            setTransferError('');
                            setTransferModal({ item: st, toWhId: other?.id || '', qty: 1 });
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold"
                        >
                          Transfer
                        </button>
                      )}
                      {canMutate && (
                        <>
                          <button type="button" onClick={() => setNewStock(st)} className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-white font-bold">
                            Düzenle
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteErpRecord('stockItems', st.id, actorEmail, cloudMode).catch((err) => setErrorMsg(err?.message || 'Stok silinemedi.'))}
                            className="px-2.5 py-1.5 rounded-lg bg-red-950/70 hover:bg-red-600 text-red-300 hover:text-white font-bold"
                          >
                            Sil
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {stockItems.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-slate-400">Depoda kayıtlı stok kalemi yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Recent Movements */}
        {stockMovements.length > 0 && (
          <div className="bg-[#0b1329] border border-slate-700 rounded-2xl p-4 space-y-2 text-xs">
            <div className="font-black text-slate-300">Son Stok Hareketleri</div>
            {stockMovements.slice(0, 6).map((m) => (
              <div key={m.id} className="flex justify-between py-1.5 border-b border-slate-800 last:border-0">
                <span>[{m.movementType}] {m.itemName} ({m.quantity}) — {m.notes}</span>
                <span className="font-bold text-emerald-400">{formatKurusTRY(m.totalCostKurus)}</span>
              </div>
            ))}
          </div>
        )}

        {transferModal && (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const fromW = warehouses.find((w) => w.id === transferModal.item.warehouseId);
                const toW = warehouses.find((w) => w.id === transferModal.toWhId);
                if (!fromW || !toW) return;
                try {
                  await transferWarehouseStock(
                    transferModal.item,
                    transferModal.qty,
                    fromW,
                    toW,
                    actorEmail,
                    cloudMode
                  );
                  setTransferModal(null);
                } catch (err: any) {
                  setTransferError(err.message);
                }
              }}
              className="bg-[#0b1329] border-2 border-slate-600 rounded-2xl max-w-md w-full p-6 space-y-3 text-xs"
            >
              <h3 className="text-base font-black">Depolar / Şantiyeler Arası Maliyet Transferi</h3>
              {transferError && <div className="text-red-400 font-bold">{transferError}</div>}
              <div>Malzeme: <strong>{transferModal.item.name}</strong> (Mevcut: {transferModal.item.quantity})</div>
              <select value={transferModal.toWhId} onChange={(e) => setTransferModal({ ...transferModal, toWhId: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                {warehouses.filter((w) => w.id !== transferModal.item.warehouseId).map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              <input type="number" min={1} max={transferModal.item.quantity} value={transferModal.qty} onChange={(e) => setTransferModal({ ...transferModal, qty: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setTransferModal(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-sky-600 font-black">Transferi Onayla</button>
              </div>
            </form>
          </div>
        )}

        {consumeModal && (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setErrorMsg('');
                const wh = warehouses.find((w) => w.id === consumeModal.item.warehouseId);
                if (!wh) return;
                const targetProj = projects.find((p) => p.id === consumeModal.projectId);
                try {
                  await recordStockConsumption(
                    consumeModal.item,
                    consumeModal.qty,
                    wh,
                    targetProj,
                    actorEmail,
                    cloudMode,
                    consumeModal.notes
                  );
                  setConsumeModal(null);
                } catch (err: any) {
                  setErrorMsg(err?.message || 'Stok sarf çıkışı kaydedilemedi.');
                }
              }}
              className="bg-[#0b1329] border-2 border-slate-600 rounded-2xl max-w-md w-full p-6 space-y-3 text-xs"
            >
              <h3 className="text-base font-black text-white">Şantiyede Malzeme Kullanımı (Sarf Çıkışı)</h3>
              <div>Malzeme: <strong>{consumeModal.item.name}</strong> (Mevcut: {consumeModal.item.quantity} {consumeModal.item.unit})</div>
              <select value={consumeModal.projectId} onChange={(e) => setConsumeModal({ ...consumeModal, projectId: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                {projects.map((p) => <option key={p.id} value={p.id}>{p.shortName}</option>)}
              </select>
              <input type="number" step="0.01" min={0.01} max={consumeModal.item.quantity} value={consumeModal.qty} onChange={(e) => setConsumeModal({ ...consumeModal, qty: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" placeholder="Miktar" />
              <input value={consumeModal.notes} onChange={(e) => setConsumeModal({ ...consumeModal, notes: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" placeholder="Açıklama (blok/mahal)" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setConsumeModal(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-emerald-600 font-black">Kullanımı İşle</button>
              </div>
            </form>
          </div>
        )}

        {newWarehouse && (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await saveErpRecord('warehouses', newWarehouse, actorEmail, cloudMode);
                setNewWarehouse(null);
              }}
              className="bg-[#0b1329] border-2 border-slate-600 rounded-2xl max-w-md w-full p-6 space-y-3 text-xs"
            >
              <h3 className="text-base font-black text-white">Şantiye / Depo Kartı</h3>
              <input required placeholder="Depo Adı *" value={newWarehouse.name} onChange={(e) => setNewWarehouse({ ...newWarehouse, name: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <div className="grid grid-cols-2 gap-3">
                <select value={newWarehouse.type} onChange={(e) => setNewWarehouse({ ...newWarehouse, type: e.target.value as 'merkez' | 'santiye' })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                  <option value="santiye">Şantiye Stoku</option>
                  <option value="merkez">Merkez Depo</option>
                </select>
                <select value={newWarehouse.projectId || ''} onChange={(e) => setNewWarehouse({ ...newWarehouse, projectId: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                  <option value="">Merkez / Projesiz</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.shortName}</option>)}
                </select>
              </div>
              <input placeholder="Konum / Şantiye Adresi" value={newWarehouse.location} onChange={(e) => setNewWarehouse({ ...newWarehouse, location: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <input placeholder="Depo Sorumlusu" value={newWarehouse.manager} onChange={(e) => setNewWarehouse({ ...newWarehouse, manager: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setNewWarehouse(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 font-black">Kaydet</button>
              </div>
            </form>
          </div>
        )}

        {newStock && (
          <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await saveErpRecord(
                  'stockItems',
                  {
                    ...newStock,
                    totalValueKurus: Math.round(newStock.quantity * newStock.avgUnitCostKurus),
                  },
                  actorEmail,
                  cloudMode
                );
                setNewStock(null);
              }}
              className="bg-[#0b1329] border-2 border-slate-600 rounded-2xl max-w-md w-full p-6 space-y-3 text-xs"
            >
              <h3 className="text-base font-black text-white">Stok Kalemi Kartı</h3>
              <input required placeholder="Malzeme Adı *" value={newStock.name} onChange={(e) => setNewStock({ ...newStock, name: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <select value={newStock.warehouseId} onChange={(e) => setNewStock({ ...newStock, warehouseId: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
              <div className="grid grid-cols-3 gap-2">
                <label>
                  <span>Miktar</span>
                  <input type="number" step="0.01" value={newStock.quantity} onChange={(e) => setNewStock({ ...newStock, quantity: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Birim</span>
                  <input value={newStock.unit} onChange={(e) => setNewStock({ ...newStock, unit: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Birim Maliyet (TL)</span>
                  <input type="number" step="0.01" value={fromKurus(newStock.avgUnitCostKurus)} onChange={(e) => setNewStock({ ...newStock, avgUnitCostKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label>
                  <span>Min. Kritik Stok</span>
                  <input type="number" value={newStock.minStockLevel} onChange={(e) => setNewStock({ ...newStock, minStockLevel: Number(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
                <label className="col-span-2">
                  <span>Kategori</span>
                  <input value={newStock.category} onChange={(e) => setNewStock({ ...newStock, category: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setNewStock(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 font-black">Kaydet</button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // MODE === 'equipment'
  return (
    <div className="space-y-6">
      <div className="bg-[#0b1329] border-2 border-slate-700 rounded-2xl p-5 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-white">Makine, Ekipman, Vinç ve İskele Takibi</h2>
          <p className="text-xs text-slate-400">Özmal ve kiralık iş makineleri, operatör ve günlük maliyet izleme</p>
        </div>
        {canMutate && (
          <button
            type="button"
            onClick={() =>
              setEditingEq({
                id: `eq-${Date.now()}`,
                organizationId: ERP_ORG_ID,
                name: '',
                plateOrSerial: '',
                type: 'İş Makinesi',
                ownership: 'Özmal',
                projectId: projects[0]?.id || '',
                operatorName: '',
                dailyCostKurus: 0,
                fuelCostKurus: 0,
                maintenanceCostKurus: 0,
                status: 'Aktif Sahada',
                notes: '',
                createdBy: actorEmail,
                createdAt: new Date().toISOString(),
                updatedBy: actorEmail,
                updatedAt: new Date().toISOString(),
              })
            }
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black"
          >
            + Ekipman Ekle
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-950/80 border border-red-500 text-xs font-bold text-red-200">
          {errorMsg}
        </div>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 text-xs">
        {equipment.map((eq) => (
          <div key={eq.id} className="bg-[#0b1329] border border-slate-700 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between gap-2">
              <span className="font-black text-white text-sm">{eq.name}</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-blue-300 font-bold shrink-0">{eq.status}</span>
            </div>
            <div className="text-slate-400">{eq.type} ({eq.ownership}) • {eq.plateOrSerial}</div>
            <div>Proje: <strong>{projects.find((p) => p.id === eq.projectId)?.shortName || 'Merkez'}</strong> {eq.operatorName ? `• Op: ${eq.operatorName}` : ''}</div>
            <div className="flex justify-between pt-2 border-t border-slate-800">
              <span>Günlük: {formatKurusTRY(eq.dailyCostKurus)}</span>
              <span>Yakıt+Bakım: {formatKurusTRY(eq.fuelCostKurus + eq.maintenanceCostKurus)}</span>
            </div>
            {canMutate && (
              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setEditingEq(eq)} className="text-blue-400 font-bold">
                  Düzenle / Durum
                </button>
                <button
                  type="button"
                  onClick={() => deleteErpRecord('equipment', eq.id, actorEmail, cloudMode).catch((err) => setErrorMsg(err?.message || 'Ekipman silinemedi.'))}
                  className="text-red-400 font-bold"
                >
                  Sil
                </button>
              </div>
            )}
          </div>
        ))}
        {equipment.length === 0 && (
          <div className="md:col-span-3 p-8 text-center text-slate-400 bg-[#0b1329] rounded-2xl border-2 border-slate-700">
            Henüz kayıtlı makine/ekipman yok.
          </div>
        )}
      </div>

      {editingEq && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await saveErpRecord('equipment', editingEq, actorEmail, cloudMode);
              setEditingEq(null);
            }}
            className="bg-[#0b1329] border-2 border-slate-600 rounded-2xl max-w-lg w-full p-6 space-y-3 text-xs"
          >
            <h3 className="text-base font-black text-white">Makine &amp; Ekipman Kartı</h3>
            <input required placeholder="Makine / Ekipman Adı *" value={editingEq.name} onChange={(e) => setEditingEq({ ...editingEq, name: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
            <div className="grid grid-cols-3 gap-2">
              <select value={editingEq.type} onChange={(e) => setEditingEq({ ...editingEq, type: e.target.value as EquipmentRecord['type'] })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                <option value="İş Makinesi">İş Makinesi</option>
                <option value="Vinç">Vinç</option>
                <option value="Binek/Ticari Araç">Binek/Ticari Araç</option>
                <option value="İskele/Kalıp">İskele/Kalıp</option>
                <option value="Diğer">Diğer</option>
              </select>
              <select value={editingEq.ownership} onChange={(e) => setEditingEq({ ...editingEq, ownership: e.target.value as 'Özmal' | 'Kiralık' })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                <option value="Özmal">Özmal</option>
                <option value="Kiralık">Kiralık</option>
              </select>
              <select value={editingEq.status} onChange={(e) => setEditingEq({ ...editingEq, status: e.target.value as EquipmentRecord['status'] })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                <option value="Aktif Sahada">Aktif Sahada</option>
                <option value="Bakımda">Bakımda</option>
                <option value="Boşta">Boşta</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Plaka / Seri No" value={editingEq.plateOrSerial} onChange={(e) => setEditingEq({ ...editingEq, plateOrSerial: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <select value={editingEq.projectId} onChange={(e) => setEditingEq({ ...editingEq, projectId: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600">
                <option value="">Merkez</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.shortName}</option>)}
              </select>
              <input placeholder="Operatör / Sürücü" value={editingEq.operatorName} onChange={(e) => setEditingEq({ ...editingEq, operatorName: e.target.value })} className="px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              <label>
                <span>Günlük Maliyet (TL)</span>
                <input type="number" step="0.01" value={fromKurus(editingEq.dailyCostKurus)} onChange={(e) => setEditingEq({ ...editingEq, dailyCostKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label>
                <span>Yakıt Gideri (TL)</span>
                <input type="number" step="0.01" value={fromKurus(editingEq.fuelCostKurus)} onChange={(e) => setEditingEq({ ...editingEq, fuelCostKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
              <label>
                <span>Bakım / Onarım (TL)</span>
                <input type="number" step="0.01" value={fromKurus(editingEq.maintenanceCostKurus)} onChange={(e) => setEditingEq({ ...editingEq, maintenanceCostKurus: toKurus(e.target.value) })} className="w-full px-3 py-2 rounded-xl bg-[#0f172a] border border-slate-600" />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingEq(null)} className="px-4 py-2 rounded-xl bg-slate-800">İptal</button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-blue-600 font-black">Kaydet</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
