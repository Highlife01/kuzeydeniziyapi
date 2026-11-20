// Fluent-style line icons. SVGs carry no text so button labels stay unchanged.
const PATHS: Record<string, string> = {
  compose: 'M4 20h4l10.5-10.5a2.1 2.1 0 0 0-4-4L4 16v4zM13.5 6.5l4 4',
  inbox: 'M3 13h5l1.5 3h5L16 13h5M5.5 5h13L21 13v6H3v-6z',
  sent: 'M3 11.5 21 4l-7.5 18-2.5-8z M11 14l10-10',
  drafts: 'M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h4',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  reply: 'M10 8 4 13l6 5M4 13h10a6 6 0 0 1 6 6',
  replyall: 'M10 8 4 13l6 5M4 13h8M16 5l4 4-4 4M20 9H12',
  forward: 'M14 8l6 5-6 5M20 13H10a6 6 0 0 0-6 6',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.8 6.7 19.6l1-5.8L3.5 9.7l5.9-.9z',
  starfill: 'M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.8 6.7 19.6l1-5.8L3.5 9.7l5.9-.9z',
  spam: 'M12 3 21 19H3zM12 9v5M12 16.5h.01',
  archive: 'M3 7h18l-2 13H5L3 7zM3 7l2-3h14l2 3M9 12h6',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3',
  read: 'M3 8l9 6 9-6M3 8v11h18V8l-9-5z',
  unread: 'M3 6h18v13H3zM3 6l9 7 9-7',
  attach: 'M20 11.5 12 19.5a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5L10 17.5a2 2 0 0 1-3-3L15 6.5',
  send: 'M3 11.5 21 4l-7.5 18-2.5-8z',
  save: 'M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7',
  close: 'M6 6l12 12M18 6 6 18',
  add: 'M12 5v14M5 12h14',
  edit: 'M4 20h4l10.5-10.5a2.1 2.1 0 1 0-4-4L4 16v4z',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 21 21',
  menu: 'M4 7h16M4 12h16M4 17h16',
  back: 'M15 5l-7 7 7 7',
  signout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  filter: 'M4 6h16M7 12h10M10 18h4',
  file: 'M14 3H6v18h12V7zM14 3v4h4',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15.5 9.5h.01',
};

export default function Icon({ name, size = 18 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill={name === 'starfill' ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name] || PATHS.mail} />
    </svg>
  );
}

export const PALETTE = [
  '#0a58ca', // Derin Safir Mavi
  '#be123c', // Derin Yakut Kırmızı
  '#047857', // Derin Zümrüt Yeşil
  '#6d28d9', // Derin Ametist Mor
  '#b45309', // Derin Kehribar Kahve
  '#0e7490', // Derin Okyanus Camgöbeği
  '#a21caf', // Derin Orkide Fuşya
  '#c2410c', // Derin Mercan Kiremit
  '#4338ca', // Derin Çivit İndigo
  '#0f766e', // Derin Deniz Turkuaz
  '#be185d', // Derin Gül Pembesi
  '#15803d', // Derin Yaprak Yeşili
  '#7e22ce', // Derin Kraliyet Moru
  '#1d4ed8', // Derin Kobalt Mavi
  '#b91c1c', // Derin Kızıl Yakut
  '#0369a1', // Derin Gök Mavisi
  '#4d7c0f', // Derin Zeytin Yeşili
  '#86198f', // Derin Koyu Mürdüm
  '#92400e', // Derin Bronz
  '#115e59', // Derin Çam Yeşili
  '#9f1239', // Derin Bordo Gül
  '#3730a3', // Derin Gece Mavisi
  '#166534', // Derin Orman Yeşili
  '#991b1b', // Derin Şarap Kırmızısı
];

function hashSeed(seed: string) {
  let hash = 0;
  for (const char of String(seed || '?')) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

export function tint(seed: string) {
  return PALETTE[hashSeed(seed) % PALETTE.length];
}

export function accountColor(index: number, seed?: string) {
  if (Number.isInteger(index) && index >= 0) {
    return PALETTE[index % PALETTE.length];
  }
  return tint(seed || '?');
}

export function mailColor(index: number, seedOrOffset?: number | string, avoidColor?: string) {
  const baseOffset = typeof seedOrOffset === 'number'
    ? Math.abs(seedOrOffset)
    : seedOrOffset
      ? hashSeed(seedOrOffset)
      : 0;
  const idx = (baseOffset + Math.max(0, index)) % PALETTE.length;
  const picked = PALETTE[idx];
  if (avoidColor && picked === avoidColor) {
    return PALETTE[(idx + 1) % PALETTE.length];
  }
  return picked;
}
