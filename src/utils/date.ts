const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDate(date: Date, pattern: 'yyyy-MM-dd' | 'MMM d' | 'EEE' | 'EEEE, MMMM d' | 'h:mm a') {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  switch (pattern) {
    case 'yyyy-MM-dd':
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    case 'MMM d':
      return `${MONTHS_SHORT[month]} ${day}`;
    case 'EEE':
      return WEEKDAY_SHORT[date.getDay()];
    case 'EEEE, MMMM d':
      return `${WEEKDAYS[date.getDay()]}, ${MONTHS[month]} ${day}`;
    case 'h:mm a':
      const hours = date.getHours();
      const mins = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const h12 = hours % 12 || 12;
      return `${h12}:${String(mins).padStart(2, '0')} ${ampm}`;
  }
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function subDays(date: Date, amount: number) {
  return addDays(date, -amount);
}

export function isAfter(a: Date, b: Date) {
  return a.getTime() > b.getTime();
}

export function parseTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}
