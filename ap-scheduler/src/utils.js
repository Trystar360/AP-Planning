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

// Maps day names to their offset from the week-start (Saturday = 0).
const DAY_OFFSETS = { Saturday: 0, Sunday: 1, Monday: 2, Tuesday: 3, Wednesday: 4, Thursday: 5, Friday: 6 };

export function getDayDate(weekStart, dayName) {
  const offset = DAY_OFFSETS[dayName];
  if (offset === undefined) return null;
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return d;
}

export function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

// Names of facilitators who are double-booked somewhere this week — i.e. they
// have two or more overlapping, non-cancelled activities on the same day.
// Mirrors the per-entry conflict logic in WeekGrid, but keyed by name so the
// totals cards can flag the people involved.
export function doubleBookedFacilitators(entries) {
  const getFacs = (e) =>
    Array.isArray(e.facilitators) ? e.facilitators : e.staff ? [e.staff] : [];
  const start = (e) => toMinutes(e.start_time || e.time_slot || '00:00');
  const end = (e) => {
    const v = toMinutes(e.end_time || '');
    return v > start(e) ? v : start(e) + 30;
  };
  // name -> day -> list of that person's activities on that day
  const byPersonDay = new Map();
  entries.filter((e) => !e.cancelled).forEach((e) => {
    getFacs(e).forEach((name) => {
      if (!byPersonDay.has(name)) byPersonDay.set(name, {});
      const days = byPersonDay.get(name);
      (days[e.day] = days[e.day] || []).push(e);
    });
  });
  const booked = new Set();
  byPersonDay.forEach((days, name) => {
    Object.values(days).forEach((list) => {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          if (start(list[i]) < end(list[j]) && start(list[j]) < end(list[i])) {
            booked.add(name);
          }
        }
      }
    });
  });
  return booked;
}

// Initials for a facilitator avatar badge: first letter of the first word
// plus first letter of the last word (max 2 chars). "Rodney" → "R",
// "Mary Jane" → "MJ".
export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
