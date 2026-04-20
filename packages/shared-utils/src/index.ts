export function formatKm(km: number, digits = 1): string {
  if (!Number.isFinite(km)) return '-';
  return `${km.toFixed(digits)} km`;
}

export function formatSpeedKmh(kmh: number, digits = 1): string {
  if (!Number.isFinite(kmh)) return '-';
  return `${kmh.toFixed(digits)} km/h`;
}

export function formatMinutes(min: number | null | undefined): string {
  if (min == null || !Number.isFinite(min)) return '-';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h <= 0) return `${m}분`;
  return `${h}시간 ${m}분`;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '-';
  }
}
