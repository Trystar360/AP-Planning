// localStorage-backed data layer.
//
// This keeps the same async function signatures the app already uses, so the
// UI code is unchanged. Data is stored in the browser, which is great for
// testing/demo. To switch back to a shared backend later, swap this file for
// one that calls a real API (see server.js for the matching endpoints).

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

// Seed a few default team members on first run.
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

// Simulate async so callers using await keep working unchanged.
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
