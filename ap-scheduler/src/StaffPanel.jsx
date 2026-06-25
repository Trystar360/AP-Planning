import { useState } from 'react';

export default function StaffPanel({ staff, onAdd, onDelete, onClose }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

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
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Manage Staff</h2>
        <ul className="staff-list">
          {staff.map((s) => (
            <li key={s.id} className="staff-item">
              <span>{s.name}</span>
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
