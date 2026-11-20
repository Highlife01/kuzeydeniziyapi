export type CalendarEventData = {
  summary: string;
  description?: string;
  location?: string;
  organizer?: string;
  dtstart?: string;
  dtend?: string;
  rawIcs?: string;
};

function parseIcsDate(raw?: string): Date | null {
  if (!raw) return null;
  const clean = raw.trim();
  // Format: YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS or YYYY-MM-DD...
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?/);
  if (match) {
    const [, y, m, d, hh, mm, ss, z] = match;
    if (z) {
      return new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss));
    }
    return new Date(+y, +m - 1, +d, +hh, +mm, +ss);
  }
  const dateOnly = clean.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return new Date(+y, +m - 1, +d);
  }
  const parsed = new Date(clean);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTurkish(date: Date): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleString('tr-TR');
  }
}

function formatGoogleDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export default function CalendarInviteCard(props: { event: CalendarEventData }) {
  const { event } = props;
  const start = parseIcsDate(event.dtstart);
  const end = parseIcsDate(event.dtend) || (start ? new Date(start.getTime() + 60 * 60 * 1000) : null);

  const googleUrl = (() => {
    if (!start) return '';
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.summary || 'Toplantı Daveti',
      dates: `${formatGoogleDate(start)}/${formatGoogleDate(end || start)}`,
      details: event.description || '',
      location: event.location || '',
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  })();

  const downloadIcs = () => {
    const content = event.rawIcs || [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//SafirMail//TR',
      'BEGIN:VEVENT',
      `SUMMARY:${event.summary || 'Toplantı'}`,
      event.description ? `DESCRIPTION:${event.description}` : '',
      event.location ? `LOCATION:${event.location}` : '',
      event.dtstart ? `DTSTART:${event.dtstart}` : '',
      event.dtend ? `DTEND:${event.dtend}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(event.summary || 'davet').replace(/[^a-zA-Z0-9_\-]/g, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="calendar-invite-card" role="region" aria-label="Toplantı Daveti">
      <div className="calendar-invite-header">
        <span className="calendar-invite-badge">📅 Toplantı Daveti</span>
        <h4 className="calendar-invite-title">{event.summary || 'Toplantı'}</h4>
      </div>
      <div className="calendar-invite-details">
        {start ? (
          <div className="calendar-invite-row">
            <span className="calendar-invite-icon">⏰</span>
            <span className="calendar-invite-value">
              {formatDateTurkish(start)}
              {end ? ` – ${end.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
          </div>
        ) : null}
        {event.location ? (
          <div className="calendar-invite-row">
            <span className="calendar-invite-icon">📍</span>
            <span className="calendar-invite-value">{event.location}</span>
          </div>
        ) : null}
        {event.organizer ? (
          <div className="calendar-invite-row">
            <span className="calendar-invite-icon">👤</span>
            <span className="calendar-invite-value">Düzenleyen: {event.organizer}</span>
          </div>
        ) : null}
        {event.description ? (
          <p className="calendar-invite-desc">{event.description.slice(0, 300)}</p>
        ) : null}
      </div>
      <div className="calendar-invite-actions">
        {googleUrl ? (
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="cmd calendar-btn primary"
          >
            Google Takvim'e Ekle
          </a>
        ) : null}
        <button
          type="button"
          className="text-btn calendar-btn"
          onClick={downloadIcs}
          title="Outlook, Apple veya Thunderbird için .ics indir"
        >
          📥 .ICS Olarak İndir
        </button>
      </div>
    </div>
  );
}
