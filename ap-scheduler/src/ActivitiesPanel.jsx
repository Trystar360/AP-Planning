import { useState, useEffect } from 'react';

const COLOR_PRESETS = [
  { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  { bg: '#e0f2fe', border: '#0ea5e9', text: '#0c4a6e' },
  { bg: '#dcfce7', border: '#22c55e', text: '#14532d' },
  { bg: '#d1fae5', border: '#10b981', text: '#064e3b' },
  { bg: '#fce7f3', border: '#ec4899', text: '#831843' },
  { bg: '#fef3c7', border: '#f59e0b', text: '#78350f' },
  { bg: '#ede9fe', border: '#8b5cf6', text: '#4c1d95' },
  { bg: '#ffedd5', border: '#f97316', text: '#7c2d12' },
  { bg: '#ccfbf1', border: '#14b8a6', text: '#134e4a' },
  { bg: '#fee2e2', border: '#ef4444', text: '#7f1d1d' },
  { bg: '#fdf4ff', border: '#d946ef', text: '#701a75' },
  { bg: '#f0fdf4', border: '#4ade80', text: '#166534' },
];

export { COLOR_PRESETS };

// A distinct activity colour set for ANY index. The 12 curated presets come
// first; past that we generate evenly-spread hues via the golden angle so
// no two activities share a colour.
export function activityColorForIndex(i) {
  if (i < COLOR_PRESETS.length) return COLOR_PRESETS[i];
  const hue = Math.round((i * 137.508) % 360);
  return {
    bg: `hsl(${hue}, 70%, 91%)`,
    border: `hsl(${hue}, 58%, 52%)`,
    text: `hsl(${hue}, 60%, 26%)`,
  };
}

export default function ActivitiesPanel({ activities, onAdd, onUpdate, onDelete, onClose }) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [colorPickerFor, setColorPickerFor] = useState(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const usedBgs = new Set(activities.map((a) => a.bg));
  let nextColor = COLOR_PRESETS.find((c) => !usedBgs.has(c.bg));
  if (!nextColor) {
    // All presets taken — generate further distinct colours until one is unused.
    for (let i = COLOR_PRESETS.length; ; i++) {
      const c = activityColorForIndex(i);
      if (!usedBgs.has(c.bg)) { nextColor = c; break; }
    }
  }

  const handleAdd = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    onAdd(name, nextColor);
    setNewName('');
  };

  const startEdit = (a) => {
    setEditingId(a.id);
    setEditingName(a.name);
    setColorPickerFor(null);
  };

  const commitEdit = (id) => {
    const name = editingName.trim();
    if (name) onUpdate(id, { name });
    setEditingId(null);
  };

  const handleColorChange = (id, colors) => {
    onUpdate(id, colors);
    setColorPickerFor(null);
  };

  const toggleColorPicker = (id) => {
    setColorPickerFor((prev) => (prev === id ? null : id));
    setEditingId(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="activities-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title" id="activities-modal-title">Activities</h2>
        <ul className="staff-list activities-list">
          {activities.map((a) => (
            <li key={a.id} className="staff-item activity-item">
              <div className="activity-row">
                <button
                  className="activity-chip-btn"
                  style={{ background: a.bg, borderColor: a.border, color: a.text }}
                  onClick={() => toggleColorPicker(a.id)}
                  title="Change color"
                  aria-label={`Change color for ${a.name}`}
                >
                  {a.name.slice(0, 2)}
                </button>
                {editingId === a.id ? (
                  <input
                    autoFocus
                    className="activity-name-input"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit(a.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={() => commitEdit(a.id)}
                  />
                ) : (
                  <span
                    className="activity-name-text"
                    onClick={() => startEdit(a)}
                    title="Click to rename"
                  >
                    {a.name}
                  </span>
                )}
                <button className="btn-danger-sm" onClick={() => onDelete(a.id)}>Remove</button>
              </div>
              {colorPickerFor === a.id && (
                <div className="activity-color-picker">
                  {COLOR_PRESETS.map((c, i) => (
                    <button
                      key={i}
                      className={`activity-color-swatch${a.bg === c.bg ? ' active' : ''}`}
                      style={{ background: c.bg, borderColor: c.border }}
                      onClick={() => handleColorChange(a.id, c)}
                      title={`Color option ${i + 1}`}
                    />
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>

        <form onSubmit={handleAdd} className="staff-add-form">
          <span
            className="activity-new-preview"
            style={{ background: nextColor.bg, borderColor: nextColor.border, color: nextColor.text }}
          >
            {newName.trim().slice(0, 2) || '?'}
          </span>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New activity name…"
            autoComplete="off"
          />
          <button type="submit" className="btn-primary" disabled={!newName.trim()}>Add</button>
        </form>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
