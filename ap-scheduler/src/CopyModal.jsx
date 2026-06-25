import { useState, useEffect } from 'react';
import { DAYS } from './constants';
import { addWeeks, formatWeekLabel } from './utils';

export default function CopyModal({ weekStart, onCopy, onClose }) {
  const [scope, setScope] = useState('all');
  const [offset, setOffset] = useState(1);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const offsets = [1, 2, 3, 4, 5, 6, 7, 8];
  const toWeek = addWeeks(weekStart, offset);

  const handleSubmit = (e) => {
    e.preventDefault();
    onCopy({ scope, toWeek });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="copy-modal-title" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title" id="copy-modal-title">Copy schedule</h2>
        <form onSubmit={handleSubmit} className="modal-form">
          <label>
            What to copy
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="all">Whole week</option>
              {DAYS.map((d) => <option key={d} value={d}>Just {d}</option>)}
            </select>
          </label>
          <label>
            Copy to
            <select value={offset} onChange={(e) => setOffset(Number(e.target.value))}>
              {offsets.map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? 'Next week' : `In ${n} weeks`} — {formatWeekLabel(addWeeks(weekStart, n))}
                </option>
              ))}
            </select>
          </label>
          <p className="modal-hint">Existing entries in the destination won't be overwritten.</p>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Copy</button>
          </div>
        </form>
      </div>
    </div>
  );
}
