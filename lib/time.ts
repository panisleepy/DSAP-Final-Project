const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const DIVISIONS: Array<[number, Intl.RelativeTimeFormatUnit]> = [
  [60, 'second'],
  [60, 'minute'],
  [24, 'hour'],
  [7, 'day'],
  [4.34524, 'week'],
  [12, 'month'],
  [Number.POSITIVE_INFINITY, 'year'],
];

export function formatRelativeTime(date: Date | string) {
  const target = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  let duration = (target.getTime() - now.getTime()) / 1000;

  for (const [amount, unit] of DIVISIONS) {
    if (Math.abs(duration) < amount) {
      return rtf.format(Math.round(duration), unit);
    }
    duration /= amount;
  }

  return target.toLocaleDateString();
}
