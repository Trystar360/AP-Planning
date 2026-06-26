import { useState, useEffect, useRef, useCallback } from 'react';
import { ACTIVITIES, DAYS, TIME_OPTIONS, ACTIVITY_COLORS } from './constants';
import { formatTime } from './utils';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

function normalizeActivity(str) {
  if (!str) return ACTIVITIES[0];
  const s = str.trim().toLowerCase();
  const exact = ACTIVITIES.find(a => a.toLowerCase() === s);
  if (exact) return exact;
  const partial = ACTIVITIES.find(a => s.includes(a.toLowerCase()) || a.toLowerCase().includes(s));
  if (partial) return partial;
  if (s.includes('zip') && (s.includes('mini') || s.includes('small'))) return 'Mini Zip Line';
  if (s.includes('zip')) return 'Zip Line';
  if (s.includes('climb') && s.includes('tower')) return 'Climbing Tower';
  if (s.includes('climb')) return 'Climbing Wall';
  if (s.includes('laser')) return 'Laser Tag';
  if (s.includes('swing')) return 'Power Swing';
  if (s.includes('sky') || s.includes('trail')) return 'Sky Trail';
  return ACTIVITIES[0];
}

function normalizeDay(str) {
  if (!str) return DAYS[0];
  const s = str.trim().toLowerCase();
  return DAYS.find(d => d.toLowerCase().startsWith(s.slice(0, 3))) || DAYS[0];
}

function normalizeTime(str) {
  if (!str) return '09:00';
  const s = str.trim().toLowerCase();
  let h, m;
  const match12 = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (match12) {
    h = parseInt(match12[1]);
    m = parseInt(match12[2]);
    if (match12[3] === 'pm' && h !== 12) h += 12;
    if (match12[3] === 'am' && h === 12) h = 0;
  } else {
    const match24 = s.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      h = parseInt(match24[1]);
      m = parseInt(match24[2]);
    }
  }
  if (h === undefined) return '09:00';
  h = Math.max(8, Math.min(21, h));
  m = Math.round(m / 15) * 15;
  if (m >= 60) { m = 0; h = Math.min(21, h + 1); }
  if (h === 21) m = 0;
  const candidate = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return TIME_OPTIONS.includes(candidate) ? candidate : '09:00';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function buildPrompt() {
  return `Extract all schedule/activity booking entries from this document.

Valid activities (use exact names): ${ACTIVITIES.join(', ')}
Valid days: ${DAYS.join(', ')}

Return ONLY a JSON array. Each item:
- activity: exact match from valid activities above
- day: exact match from valid days above
- start_time: "HH:MM" 24h format, between 08:00 and 21:00
- end_time: "HH:MM" 24h format, must be after start_time, max 21:00
- group_name: string (empty string if none)
- facilitators: array of name strings (empty array if none)
- notes: string (empty string if none)

Return [] if no entries found. Output raw JSON only, no markdown fences, no explanation.`;
}

async function callAnthropic(file, base64, apiKey) {
  const isImage = file.type.startsWith('image/');
  const fileBlock = isImage
    ? { type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } }
    : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [fileBlock, { type: 'text', text: buildPrompt() }],
      }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic API error ${res.status}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || '[]';
}

async function callGemini(file, base64, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: file.type, data: base64 } },
            { text: buildPrompt() },
          ],
        }],
        generationConfig: { maxOutputTokens: 2048 },
      }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API error ${res.status}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
}

async function analyzeFile(file) {
  const anthropicKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!anthropicKey && !geminiKey) {
    throw new Error('No API key configured. Add VITE_ANTHROPIC_API_KEY or VITE_GEMINI_API_KEY to your .env file.');
  }

  const base64 = await fileToBase64(file);
  const rawText = anthropicKey
    ? await callAnthropic(file, base64, anthropicKey)
    : await callGemini(file, base64, geminiKey);

  const text = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Claude returned an unexpected response. Please try again.');
  }

  if (!Array.isArray(raw)) throw new Error('Unexpected response format from Claude.');

  return raw.map(e => {
    const start = normalizeTime(e.start_time);
    let end = normalizeTime(e.end_time);
    if (end <= start) {
      const startIdx = TIME_OPTIONS.indexOf(start);
      end = TIME_OPTIONS[Math.min(startIdx + 4, TIME_OPTIONS.length - 1)];
    }
    return {
      activity: normalizeActivity(e.activity),
      day: normalizeDay(e.day),
      start_time: start,
      end_time: end,
      group_name: e.group_name || '',
      facilitators: Array.isArray(e.facilitators) ? e.facilitators : [],
      notes: e.notes || '',
    };
  });
}

export default function AIUploadModal({ weekLabel, onImport, onClose }) {
  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const acceptFile = useCallback((f) => {
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type)) {
      setError('Unsupported file type. Please upload a JPEG, PNG, GIF, WebP image, or PDF.');
      return;
    }
    setError('');
    setFile(f);
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setStep('analyzing');
    setError('');
    try {
      const results = await analyzeFile(file);
      setEntries(results);
      setSelected(new Set(results.map((_, i) => i)));
      setStep('review');
    } catch (err) {
      setError(err.message);
      setStep('upload');
    }
  };

  const toggleEntry = (i) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const handleImport = () => {
    onImport(entries.filter((_, i) => selected.has(i)));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal ai-upload-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-upload-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title" id="ai-upload-title">AI Import</h2>
        <p className="ai-upload-subtitle">
          Upload a schedule image or PDF — Claude will extract the entries for you.
        </p>

        {error && <div className="ai-upload-error">{error}</div>}

        {step === 'upload' && (
          <>
            <div
              className={`ai-dropzone${dragging ? ' dragging' : ''}${file ? ' has-file' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
              aria-label="Upload file"
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*,.pdf"
                className="ai-file-input"
                onChange={(e) => acceptFile(e.target.files?.[0])}
              />
              {preview ? (
                <img src={preview} alt="Schedule preview" className="ai-preview-img" />
              ) : file ? (
                <div className="ai-file-selected">
                  <span className="ai-file-icon">📄</span>
                  <span className="ai-file-name">{file.name}</span>
                  <span className="ai-file-hint">Click to replace</span>
                </div>
              ) : (
                <div className="ai-dropzone-prompt">
                  <span className="ai-dropzone-icon" aria-hidden="true">⬆</span>
                  <span className="ai-dropzone-main">Drop a file here, or click to browse</span>
                  <span className="ai-dropzone-sub">JPEG · PNG · GIF · WebP · PDF</span>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="btn-primary"
                disabled={!file}
                onClick={handleAnalyze}
              >
                Analyze with AI ✦
              </button>
            </div>
          </>
        )}

        {step === 'analyzing' && (
          <div className="ai-analyzing">
            <div className="ai-spinner" aria-hidden="true" />
            <p className="ai-analyzing-text">Analyzing with Claude…</p>
            <p className="ai-analyzing-sub">This usually takes a few seconds.</p>
          </div>
        )}

        {step === 'review' && (
          <>
            {entries.length === 0 ? (
              <div className="ai-no-entries">
                <p>No schedule entries were found in this file.</p>
                <p>Try a different image or PDF with clearer schedule information.</p>
              </div>
            ) : (
              <>
                <p className="ai-review-count">
                  Found <strong>{entries.length}</strong> {entries.length === 1 ? 'entry' : 'entries'}
                  {weekLabel ? <> for <strong>{weekLabel}</strong></> : null}
                  {' '}— select the ones to add:
                </p>
                <div className="ai-entry-list">
                  {entries.map((entry, i) => {
                    const colors = ACTIVITY_COLORS[entry.activity] || { bg: '#f1f5f9', border: '#94a3b8', text: '#334155' };
                    return (
                      <label
                        key={i}
                        className={`ai-entry-card${selected.has(i) ? ' selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(i)}
                          onChange={() => toggleEntry(i)}
                          className="ai-entry-check"
                        />
                        <div className="ai-entry-body">
                          <span
                            className="ai-entry-activity"
                            style={{ background: colors.bg, borderColor: colors.border, color: colors.text }}
                          >
                            {entry.activity}
                          </span>
                          <span className="ai-entry-time">
                            {entry.day} · {formatTime(entry.start_time)}–{formatTime(entry.end_time)}
                          </span>
                          {entry.group_name && (
                            <span className="ai-entry-meta">{entry.group_name}</span>
                          )}
                          {entry.facilitators.length > 0 && (
                            <span className="ai-entry-meta">{entry.facilitators.join(', ')}</span>
                          )}
                          {entry.notes && (
                            <span className="ai-entry-meta ai-entry-notes">{entry.notes}</span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setStep('upload'); setEntries([]); setSelected(new Set()); }}
              >
                ← Back
              </button>
              {entries.length > 0 && (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={selected.size === 0}
                  onClick={handleImport}
                >
                  Add {selected.size} {selected.size === 1 ? 'entry' : 'entries'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
