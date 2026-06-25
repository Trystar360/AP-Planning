import { useState, useEffect } from 'react';

export default function TemplatePanel({ templates, weekEntryCount, weekLabel, onSave, onApply, onDelete, onClose }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSave = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (weekEntryCount === 0) { setError('This week has no entries to save.'); return; }
    try {
      await onSave(trimmed);
      setName('');
      setError('');
    } catch {
      setError('Could not save template.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="tpl-modal-title" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title" id="tpl-modal-title">Templates</h2>

        {templates.length === 0 ? (
          <p className="modal-hint">No templates yet. Save the current week below to reuse its layout on any other week.</p>
        ) : (
          <ul className="staff-list">
            {templates.map((t) => (
              <li key={t.id} className="staff-item template-item">
                <span className="staff-item-name">
                  <strong>{t.name}</strong>
                  <span className="template-count">{(t.entries || []).length} {(t.entries || []).length === 1 ? 'entry' : 'entries'}</span>
                </span>
                <span className="template-actions">
                  <button className="btn-ghost" onClick={() => onApply(t.id)} title={`Apply to ${weekLabel}`}>Apply</button>
                  <button className="btn-danger-sm" onClick={() => onDelete(t.id)}>Delete</button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleSave} className="staff-add-form">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this week's layout…"
            autoComplete="off"
          />
          <button type="submit" className="btn-primary" disabled={weekEntryCount === 0}>Save week</button>
        </form>
        {error && <p className="error-text">{error}</p>}
        <p className="modal-hint">“Apply” adds a template's activities to <strong>{weekLabel}</strong> (existing entries are kept).</p>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
