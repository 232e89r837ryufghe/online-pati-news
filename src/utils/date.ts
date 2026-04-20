/**
 * Utility for Nepali Relative Time
 */

const NE_NUMBERS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

function toNepaliNumber(num: number): string {
  return num
    .toString()
    .split('')
    .map(digit => NE_NUMBERS[parseInt(digit, 10)] || digit)
    .join('');
}

export function getRelativeTimeNepali(dateStr: string): string {
  if (!dateStr) return '';

  const now = new Date();
  const past = new Date(dateStr);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'भर्खरै';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${toNepaliNumber(diffInMinutes)} मिनेट अगाडि`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${toNepaliNumber(diffInHours)} घण्टा अगाडि`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${toNepaliNumber(diffInDays)} दिन अगाडि`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${toNepaliNumber(diffInMonths)} महिना अगाडि`;
  }

  const diffInYears = Math.floor(diffInMonths / 12);
  return `${toNepaliNumber(diffInYears)} वर्ष अगाडि`;
}
