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
  { value: 'kamu-taahhut', label: 'Kamu & Kurumsal Yapı Taahhütleri' },
  { value: 'cati-yenileme', label: 'Çatı Konstrüksiyon, Kenet & Yalıtım Yenileme' },
  { value: 'yangin-muhendislik', label: 'Yangın Algılama, Sprinkler & Pompa Sistemleri' },
  { value: 'statik-celik', label: 'İleri Statik Mühendislik & Çelik Yapılar' },
  { value: 'tesis-yonetimi', label: 'Entegre Endüstriyel Tesis & Teknik Bakım' },
  { value: 'diger', label: 'Diğer Özel Proje & Danışmanlık' },
] as const;

export function getServiceLabel(val: string): string {
  const found = SERVICE_OPTIONS.find((s) => s.value === val || s.label === val);
  return found ? found.label : val || 'Genel Teklif Talebi';
}
