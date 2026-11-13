export type LatLng = { latitude: number; longitude: number };

/**
 * A reported location and when the tracker recorded it, in epoch ms, with whether its
 * accelerometer said it was moving, if the report says.
 */
export type TimedLatLng = LatLng & { time: number; moving?: boolean };

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two points, in km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Total length of a path, in km. */
export function pathLengthKm(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceKm(points[i - 1], points[i]);
  return total;
}
