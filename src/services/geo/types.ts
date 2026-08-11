/**
 * Geo Provider Abstraction Layer
 * 
 * This interface allows swapping between different geocoding/routing providers
 * (e.g., OSRM/Nominatim → Google Maps) without modifying the UI components.
 * 
 * To migrate to Google Maps:
 * 1. Create GoogleMapsProvider.ts implementing IGeoProvider
 * 2. Change the import in FreightRouteMap.tsx
 */

export interface GeoSearchResult {
  address: string;
  lat: number;
  lng: number;
  display_name?: string;
}

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  geometry: [number, number][]; // [lat, lng] polyline coordinates
}

export interface IGeoProvider {
  /**
   * Search for addresses matching the query string.
   * Returns geocoded results with coordinates.
   */
  searchAddress(query: string): Promise<GeoSearchResult[]>;

  /**
   * Calculate driving route between two points.
   * Returns distance, duration, and polyline geometry.
   */
  calculateRoute(origin: GeoSearchResult, destination: GeoSearchResult): Promise<RouteResult>;
}
