export function formatTRY(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatDateTR(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatDateTimeTR(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export const SERVICE_OPTIONS = [
  { value: 'konut-rezidans', label: 'Konut & Rezidans Projeleri' },
  { value: 'ticari-plaza', label: 'Ticari İş Merkezleri & Plaza Yapıları' },
  { value: 'insaat-taahhut', label: 'Kamu & Özel Sektör İnşaat Taahhüt' },
  { value: 'kentsel-donusum', label: 'Kentsel Dönüşüm & Kat Karşılığı Arsa' },
  { value: 'deprem-guclendirme', label: 'Deprem Güçlendirme & Statik Mühendislik' },
  { value: 'diger', label: 'Diğer Proje & Yatırım Danışmanlığı' },
] as const;

export function getServiceLabel(val: string): string {
  const found = SERVICE_OPTIONS.find((s) => s.value === val || s.label === val);
  return found ? found.label : val || 'Genel Teklif & Bilgi Talebi';
}
