// Data layer — uses Supabase when VITE_SUPABASE_URL is set at build time,
// otherwise falls back to localStorage so local dev works without credentials.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_KEY);

// ─── Supabase REST helpers ────────────────────────────────────────────────────

function supabase(path, options = {}) {
  const { prefer, ...rest } = options;
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...rest,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
      ...rest.headers,
    },
  });
}

async function sbGet(path) {
  const res = await supabase(path);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function sbPost(path, body) {
  const res = await supabase(path, {
    method: 'POST',
    prefer: 'return=representation',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function sbPatch(path, body) {
  const res = await supabase(path, {
    method: 'PATCH',
    prefer: 'return=representation',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function sbDelete(path) {
  const res = await supabase(path, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
}

// ─── Supabase API ─────────────────────────────────────────────────────────────

const sb = {
  fetchSchedule: (weekStart) =>
    sbGet(`schedule_entries?week_start=eq.${weekStart}&order=day,start_time`),

  addEntry: (entry) => sbPost('schedule_entries', entry),

  updateEntry: (id, entry) => sbPatch(`schedule_entries?id=eq.${id}`, entry),

  deleteEntry: (id) => sbDelete(`schedule_entries?id=eq.${id}`),

  fetchStaff: () => sbGet('staff_members?order=name'),

  async addStaff(name) {
    try {
      return await sbPost('staff_members', { name });
    } catch (e) {
      if (e.message.includes('unique') || e.message.includes('duplicate')) {
        throw new Error('Staff member already exists');
      }
      throw e;
    }
  },

  deleteStaff: (id) => sbDelete(`staff_members?id=eq.${id}`),

  async copyWeek(fromWeek, toWeek, opts = {}) {
    const [source, target] = await Promise.all([
      sbGet(`schedule_entries?week_start=eq.${fromWeek}`),
      sbGet(`schedule_entries?week_start=eq.${toWeek}`),
    ]);
    const key = (e) => `${e.activity}|${e.day}|${e.start_time || e.time_slot}|${e.staff}`;
    const existing = new Set(target.map(key));
    // Strip id and created_at so Supabase generates fresh ones
    const toInsert = source
      .filter((e) => (opts.day ? e.day === opts.day : true))
      .filter((e) => !existing.has(key(e)))
      .map(({ id: _id, created_at: _c, ...rest }) => ({ ...rest, week_start: toWeek }));
    if (toInsert.length === 0) return 0;
    await sbPost('schedule_entries', toInsert);
    return toInsert.length;
  },

  // ─── Templates ──
  fetchTemplates: () => sbGet('schedule_templates?order=name'),

  saveTemplate: (name, entries) => sbPost('schedule_templates', { name, entries }),

  deleteTemplate: (id) => sbDelete(`schedule_templates?id=eq.${id}`),

  async applyTemplate(id, weekStart) {
    const [[tpl], target] = await Promise.all([
      sbGet(`schedule_templates?id=eq.${id}`),
      sbGet(`schedule_entries?week_start=eq.${weekStart}`),
    ]);
    if (!tpl) return 0;
    const key = (e) => `${e.activity}|${e.day}|${e.start_time || e.time_slot}|${e.staff}`;
    const existing = new Set(target.map(key));
    const toInsert = (tpl.entries || [])
      .filter((e) => !existing.has(key(e)))
      .map((e) => ({ ...e, week_start: weekStart }));
    if (toInsert.length === 0) return 0;
    await sbPost('schedule_entries', toInsert);
    return toInsert.length;
  },
};

// ─── localStorage fallback ────────────────────────────────────────────────────

const SCHEDULE_KEY = 'ap-scheduler:entries';
const STAFF_KEY    = 'ap-scheduler:staff';
const TEMPLATE_KEY = 'ap-scheduler:templates';

const uuid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function lsRead(key, fallback) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
  catch { return fallback; }
}
function lsWrite(key, v) { localStorage.setItem(key, JSON.stringify(v)); }

function getStaffStore() {
  let s = lsRead(STAFF_KEY, null);
  if (!s) {
    s = [
      { id: uuid(), name: 'Team Member 1' },
      { id: uuid(), name: 'Team Member 2' },
      { id: uuid(), name: 'Team Member 3' },
    ];
    lsWrite(STAFF_KEY, s);
  }
  return s;
}
function getEntryStore() { return lsRead(SCHEDULE_KEY, []); }
function getTemplateStore() { return lsRead(TEMPLATE_KEY, []); }

const resolve = (v) => Promise.resolve(v);

const ls = {
  fetchSchedule: (w) => resolve(getEntryStore().filter((e) => e.week_start === w)),

  addEntry(entry) {
    const entries = getEntryStore();
    const record = { id: uuid(), notes: '', group_name: '', ...entry };
    entries.push(record);
    lsWrite(SCHEDULE_KEY, entries);
    return resolve(record);
  },

  updateEntry(id, entry) {
    const entries = getEntryStore();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx !== -1) { entries[idx] = { ...entries[idx], ...entry }; lsWrite(SCHEDULE_KEY, entries); }
    return resolve(entries[idx]);
  },

  deleteEntry(id) {
    lsWrite(SCHEDULE_KEY, getEntryStore().filter((e) => e.id !== id));
    return resolve();
  },

  fetchStaff: () => resolve(getStaffStore()),

  addStaff(name) {
    const staff = getStaffStore();
    if (staff.some((s) => s.name.toLowerCase() === name.toLowerCase()))
      throw new Error('Staff member already exists');
    const member = { id: uuid(), name };
    staff.push(member);
    staff.sort((a, b) => a.name.localeCompare(b.name));
    lsWrite(STAFF_KEY, staff);
    return resolve(member);
  },

  deleteStaff(id) {
    lsWrite(STAFF_KEY, getStaffStore().filter((s) => s.id !== id));
    return resolve();
  },

  copyWeek(fromWeek, toWeek, opts = {}) {
    const all = getEntryStore();
    const source = all.filter((e) => e.week_start === fromWeek && (opts.day ? e.day === opts.day : true));
    const target = all.filter((e) => e.week_start === toWeek);
    const key = (e) => `${e.activity}|${e.day}|${e.start_time || e.time_slot}|${e.staff}`;
    const existing = new Set(target.map(key));
    const added = source
      .filter((e) => !existing.has(key(e)))
      .map((e) => ({ ...e, id: uuid(), week_start: toWeek }));
    lsWrite(SCHEDULE_KEY, [...all, ...added]);
    return resolve(added.length);
  },

  // ─── Templates ──
  fetchTemplates: () => resolve(getTemplateStore()),

  saveTemplate(name, entries) {
    const templates = getTemplateStore();
    const tpl = { id: uuid(), name, entries };
    templates.push(tpl);
    templates.sort((a, b) => a.name.localeCompare(b.name));
    lsWrite(TEMPLATE_KEY, templates);
    return resolve(tpl);
  },

  deleteTemplate(id) {
    lsWrite(TEMPLATE_KEY, getTemplateStore().filter((t) => t.id !== id));
    return resolve();
  },

  applyTemplate(id, weekStart) {
    const tpl = getTemplateStore().find((t) => t.id === id);
    if (!tpl) return resolve(0);
    const all = getEntryStore();
    const target = all.filter((e) => e.week_start === weekStart);
    const key = (e) => `${e.activity}|${e.day}|${e.start_time || e.time_slot}|${e.staff}`;
    const existing = new Set(target.map(key));
    const added = (tpl.entries || [])
      .filter((e) => !existing.has(key(e)))
      .map((e) => ({ ...e, id: uuid(), week_start: weekStart }));
    lsWrite(SCHEDULE_KEY, [...all, ...added]);
    return resolve(added.length);
  },
};

// ─── Exports (same interface regardless of backend) ───────────────────────────

const api = USE_SUPABASE ? sb : ls;

export const fetchSchedule  = (w)        => api.fetchSchedule(w);
export const addEntry       = (e)        => api.addEntry(e);
export const updateEntry    = (id, e)    => api.updateEntry(id, e);
export const deleteEntry    = (id)       => api.deleteEntry(id);
export const fetchStaff     = ()         => api.fetchStaff();
export const addStaff       = (n)        => api.addStaff(n);
export const deleteStaff    = (id)       => api.deleteStaff(id);
export const copyWeek       = (f, t, o)  => api.copyWeek(f, t, o);
export const fetchTemplates = ()         => api.fetchTemplates();
export const saveTemplate   = (n, e)     => api.saveTemplate(n, e);
export const deleteTemplate = (id)       => api.deleteTemplate(id);
export const applyTemplate  = (id, w)    => api.applyTemplate(id, w);

// Exposed so the UI can show a "shared" badge when Supabase is active.
export const isShared = USE_SUPABASE;
