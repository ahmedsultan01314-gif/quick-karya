// Haversine formula to compute great-circle distance between two points in km
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // 1 decimal place
}

export function formatDistance(km: number | undefined): string {
  if (km === undefined || isNaN(km)) return 'Nearby';
  if (km < 1) {
    const meters = Math.round(km * 1000);
    return `${meters} m away`;
  }
  return `${km.toFixed(1)} km away`;
}

// Well-known Indian city / regional centers for fallback coordinates and manual search
export interface CityCoord {
  city: string;
  state: string;
  pincode: string;
  lat: number;
  lng: number;
}

export const KNOWN_LOCATIONS: CityCoord[] = [
  { city: 'Agartala', state: 'Tripura', pincode: '799001', lat: 23.8315, lng: 91.2868 },
  { city: 'Bengaluru', state: 'Karnataka', pincode: '560001', lat: 12.9716, lng: 77.5946 },
  { city: 'Delhi', state: 'Delhi', pincode: '110001', lat: 28.6139, lng: 77.209 },
  { city: 'Mumbai', state: 'Maharashtra', pincode: '400001', lat: 19.076, lng: 72.8777 },
  { city: 'Kolkata', state: 'West Bengal', pincode: '700001', lat: 22.5726, lng: 88.3639 },
  { city: 'Hyderabad', state: 'Telangana', pincode: '500001', lat: 17.385, lng: 78.4867 },
  { city: 'Pune', state: 'Maharashtra', pincode: '411001', lat: 18.5204, lng: 73.8567 },
  { city: 'Chennai', state: 'Tamil Nadu', pincode: '600001', lat: 13.0827, lng: 80.2707 },
  { city: 'Guwahati', state: 'Assam', pincode: '781001', lat: 26.1445, lng: 91.7362 },
  { city: 'Jaipur', state: 'Rajasthan', pincode: '302001', lat: 26.9124, lng: 75.7873 },
];

export function lookupCityCoords(query: string): CityCoord | null {
  const clean = query.trim().toLowerCase();
  if (!clean) return null;

  // Direct match by city name or pincode
  const match = KNOWN_LOCATIONS.find(
    (item) =>
      item.city.toLowerCase() === clean ||
      item.pincode === clean ||
      clean.includes(item.city.toLowerCase()) ||
      clean.includes(item.state.toLowerCase())
  );
  return match || null;
}
