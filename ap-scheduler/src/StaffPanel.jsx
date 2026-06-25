import { useState, useEffect } from 'react';
import { STAFF_PALETTE } from './constants';

export default function StaffPanel({ staff, onAdd, onDelete, onClose }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await onAdd(name.trim());
      setName('');
      setError('');
    } catch {
      setError('Name already exists');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title" id="staff-modal-title">Manage Team</h2>
        <ul className="staff-list">
          {staff.map((s, i) => (
            <li key={s.id} className="staff-item">
              <span className="staff-item-name">
                <span className="staff-color-dot" style={{ background: STAFF_PALETTE[i % STAFF_PALETTE.length] }} />
                {s.name}
              </span>
              <button className="btn-danger-sm" onClick={() => onDelete(s.id)}>Remove</button>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAdd} className="staff-add-form">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New team member name"
            autoComplete="off"
          />
          <button type="submit" className="btn-primary">Add</button>
        </form>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
