// localStorage-backed data layer.
// Same async signatures as the real API in server.js — swap this file to use a backend.

const SCHEDULE_KEY = 'ap-scheduler:entries';
const STAFF_KEY = 'ap-scheduler:staff';

const uuid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getStaffStore() {
  let staff = read(STAFF_KEY, null);
  if (!staff) {
    staff = [
      { id: uuid(), name: 'Team Member 1' },
      { id: uuid(), name: 'Team Member 2' },
      { id: uuid(), name: 'Team Member 3' },
    ];
    write(STAFF_KEY, staff);
  }
  return staff;
}

function getEntryStore() {
  return read(SCHEDULE_KEY, []);
}

const resolve = (value) => Promise.resolve(value);

export async function fetchSchedule(weekStart) {
  return resolve(getEntryStore().filter((e) => e.week_start === weekStart));
}

export async function addEntry(entry) {
  const entries = getEntryStore();
  const record = { id: uuid(), notes: '', ...entry };
  entries.push(record);
  write(SCHEDULE_KEY, entries);
  return resolve(record);
}

export async function updateEntry(id, entry) {
  const entries = getEntryStore();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx !== -1) {
    entries[idx] = { ...entries[idx], ...entry };
    write(SCHEDULE_KEY, entries);
  }
  return resolve(entries[idx]);
}

export async function deleteEntry(id) {
  write(SCHEDULE_KEY, getEntryStore().filter((e) => e.id !== id));
  return resolve();
}

export async function fetchStaff() {
  return resolve(getStaffStore());
}

export async function addStaff(name) {
  const staff = getStaffStore();
  if (staff.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('Staff member already exists');
  }
  const member = { id: uuid(), name };
  staff.push(member);
  staff.sort((a, b) => a.name.localeCompare(b.name));
  write(STAFF_KEY, staff);
  return resolve(member);
}

export async function deleteStaff(id) {
  write(STAFF_KEY, getStaffStore().filter((s) => s.id !== id));
  return resolve();
}

// Copies all entries from one week to another. Returns count added.
// Skips entries that already exist in the target week (same activity+day+time_slot+staff).
export async function copyWeek(fromWeek, toWeek) {
  const all = getEntryStore();
  const source = all.filter((e) => e.week_start === fromWeek);
  const target = all.filter((e) => e.week_start === toWeek);

  const key = (e) => `${e.activity}|${e.day}|${e.time_slot}|${e.staff}`;
  const existing = new Set(target.map(key));

  const newEntries = source
    .filter((e) => !existing.has(key(e)))
    .map((e) => ({ ...e, id: uuid(), week_start: toWeek }));

  write(SCHEDULE_KEY, [...all, ...newEntries]);
  return resolve(newEntries.length);
}
