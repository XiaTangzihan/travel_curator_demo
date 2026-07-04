const cnTimezoneOffsetMinutes = 8 * 60;

function pad(value: number) {
  return `${value}`.padStart(2, "0");
}

function formatDateInCnTimezone(date: Date) {
  const shifted = new Date(date.getTime() + cnTimezoneOffsetMinutes * 60_000);

  return {
    year: shifted.getUTCFullYear(),
    month: pad(shifted.getUTCMonth() + 1),
    day: pad(shifted.getUTCDate()),
    hour: pad(shifted.getUTCHours()),
    minute: pad(shifted.getUTCMinutes()),
    second: pad(shifted.getUTCSeconds()),
  };
}

export function parseRawCreatedAt(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{10}$/.test(trimmed)) {
    const date = new Date(Number(trimmed) * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (/^\d{13}$/.test(trimmed)) {
    const date = new Date(Number(trimmed));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const withSeconds = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
    const date = new Date(withSeconds.replace(" ", "T") + "+08:00");
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    const withSeconds = trimmed.length === 16 ? `${trimmed}:00` : trimmed;
    const date = new Date(`${withSeconds}+08:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toCanonicalCreatedAt(value: string) {
  const parsed = parseRawCreatedAt(value);
  if (!parsed) {
    return value.trim();
  }

  const formatted = formatDateInCnTimezone(parsed);
  return `${formatted.year}-${formatted.month}-${formatted.day}T${formatted.hour}:${formatted.minute}:${formatted.second}+08:00`;
}

export function formatCreatedAtDay(value: string) {
  const parsed = parseRawCreatedAt(value);
  if (!parsed) {
    return "";
  }

  const formatted = formatDateInCnTimezone(parsed);
  return `${formatted.year}:${formatted.month}:${formatted.day}`;
}

export function formatCreatedAtTime(value: string, includeSeconds = false) {
  const parsed = parseRawCreatedAt(value);
  if (!parsed) {
    return "";
  }

  const formatted = formatDateInCnTimezone(parsed);
  return includeSeconds
    ? `${formatted.hour}:${formatted.minute}:${formatted.second}`
    : `${formatted.hour}:${formatted.minute}`;
}
