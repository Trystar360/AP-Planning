// Export helpers — turn a week's entries into downloadable iCal / CSV files.
import { DAYS } from './constants';
import { toMinutes, formatTime, durationLabel } from './utils';

function getFacilitators(e) {
  if (Array.isArray(e.facilitators)) return e.facilitators;
  if (e.staff) return [e.staff];
  return [];
}

// Local Date at midnight for a given day index (0 = Monday) of the week.
function dayDate(weekStart, dayIndex) {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + dayIndex);
  return d;
}

function pad(n) { return String(n).padStart(2, '0'); }

// Floating local datetime stamp: YYYYMMDDTHHMMSS
function icsStamp(date, time) {
  const [h, m] = time.split(':').map(Number);
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(h)}${pad(m)}00`;
}

function icsEscape(s = '') {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function triggerDownload(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportICS(entries, weekStart) {
  const active = entries.filter((e) => !e.cancelled);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AP Scheduler//EN',
    'CALSCALE:GREGORIAN',
  ];
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  active.forEach((e) => {
    const dayIndex = DAYS.indexOf(e.day);
    if (dayIndex < 0) return;
    const date = dayDate(weekStart, dayIndex);
    const start = e.start_time || '09:00';
    const end = e.end_time || start;
    const facs = getFacilitators(e);
    const summary = e.group_name ? `${e.activity} — ${e.group_name}` : e.activity;
    const desc = [
      facs.length ? `Facilitators: ${facs.join(', ')}` : '',
      e.notes ? `Notes: ${e.notes}` : '',
    ].filter(Boolean).join('\\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id || Math.random().toString(36).slice(2)}@ap-scheduler`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsStamp(date, start)}`,
      `DTEND:${icsStamp(date, end)}`,
      `SUMMARY:${icsEscape(summary)}`,
      desc ? `DESCRIPTION:${desc}` : '',
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  triggerDownload(`ap-schedule-${weekStart}.ics`, lines.filter(Boolean).join('\r\n'), 'text/calendar');
}

export function exportCSV(entries, weekStart) {
  const esc = (v = '') => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['Day', 'Date', 'Activity', 'Group', 'Start', 'End', 'Duration', 'Facilitators', 'Notes', 'Status'];
  const rows = [...entries]
    .sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || toMinutes(a.start_time) - toMinutes(b.start_time))
    .map((e) => {
      const dayIndex = DAYS.indexOf(e.day);
      const date = dayIndex >= 0 ? dayDate(weekStart, dayIndex).toLocaleDateString('en-GB') : '';
      return [
        e.day,
        date,
        e.activity,
        e.group_name || '',
        e.start_time ? formatTime(e.start_time) : '',
        e.end_time ? formatTime(e.end_time) : '',
        durationLabel(e.start_time, e.end_time),
        getFacilitators(e).join('; '),
        e.notes || '',
        e.cancelled ? 'Cancelled' : 'Scheduled',
      ].map(esc).join(',');
    });
  triggerDownload(`ap-schedule-${weekStart}.csv`, [header.join(','), ...rows].join('\n'), 'text/csv');
}
