// Returns the most recent Saturday (the start of the week) at local midnight.
export function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday … 6 = Saturday
  const diff = -((day + 1) % 7); // days back to the preceding Saturday (0 if today is Saturday)
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatWeekStart(date) {
  return date.toISOString().slice(0, 10);
}

export function formatWeekLabel(weekStart) {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function addWeeks(weekStart, n) {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + n * 7);
  return formatWeekStart(d);
}

export function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

export function toMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function formatMinutes(mins) {
  if (!mins || mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  return h ? `${h}h` : `${m}m`;
}

export function durationLabel(start, end) {
  if (!start || !end) return '';
  const mins = toMinutes(end) - toMinutes(start);
  if (mins <= 0) return '';
  return formatMinutes(mins);
}

export function minutesToHHMM(mins) {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(mins)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function roundToQuarter(mins) {
  return Math.round(mins / 15) * 15;
}
