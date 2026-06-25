import { API } from './constants';

export async function fetchSchedule(weekStart) {
  const res = await fetch(`${API}/schedule/${weekStart}`);
  if (!res.ok) throw new Error('Failed to fetch schedule');
  return res.json();
}

export async function addEntry(entry) {
  const res = await fetch(`${API}/schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error('Failed to add entry');
  return res.json();
}

export async function updateEntry(id, entry) {
  const res = await fetch(`${API}/schedule/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error('Failed to update entry');
  return res.json();
}

export async function deleteEntry(id) {
  const res = await fetch(`${API}/schedule/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete entry');
}

export async function fetchStaff() {
  const res = await fetch(`${API}/staff`);
  if (!res.ok) throw new Error('Failed to fetch staff');
  return res.json();
}

export async function addStaff(name) {
  const res = await fetch(`${API}/staff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('Failed to add staff');
  return res.json();
}

export async function deleteStaff(id) {
  const res = await fetch(`${API}/staff/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete staff');
}
