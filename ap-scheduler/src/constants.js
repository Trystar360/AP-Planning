// Colour palette assigned to staff members in order (wraps if > 8 members).
export const STAFF_PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6',
];

export const ACTIVITIES = [
  'Zip Line',
  'Mini Zip Line',
  'Climbing Wall',
  'Climbing Tower',
  'Laser Tag',
  'Power Swing',
  'Sky Trail',
];

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Row headers for the schedule grid (every hour)
export const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00',
];

// 15-minute increment options for start/end time dropdowns (8:00 AM – 9:00 PM)
export const TIME_OPTIONS = (() => {
  const times = [];
  for (let h = 8; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === 21 && m > 0) break;
      times.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return times;
})();

export const ACTIVITY_COLORS = {
  'Zip Line':       { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  'Mini Zip Line':  { bg: '#e0f2fe', border: '#0ea5e9', text: '#0c4a6e' },
  'Climbing Wall':  { bg: '#dcfce7', border: '#22c55e', text: '#14532d' },
  'Climbing Tower': { bg: '#d1fae5', border: '#10b981', text: '#064e3b' },
  'Laser Tag':      { bg: '#fce7f3', border: '#ec4899', text: '#831843' },
  'Power Swing':    { bg: '#fef3c7', border: '#f59e0b', text: '#78350f' },
  'Sky Trail':      { bg: '#ede9fe', border: '#8b5cf6', text: '#4c1d95' },
};
