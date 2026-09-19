const EARTH_RADIUS_M = 6371000;

/**
 * Great-circle (haversine) distance between two lat/lng points in metres.
 */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** "250 m" / "1.5 km" */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
}

/** Radius choices offered in the /addLocation and /managePerfect keyboards */
export const RADIUS_CHOICES_M = [100, 250, 500, 1000, 2000];
export const MIN_RADIUS_M = 50;
export const MAX_RADIUS_M = 5000;

/** Google Maps link for a pin; Telegram renders it as a tappable link */
export function mapsLink(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}
