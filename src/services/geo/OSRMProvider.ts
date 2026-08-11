import { IGeoProvider, GeoSearchResult, RouteResult } from './types';

/**
 * OSRM + Nominatim Provider (OpenStreetMap ecosystem)
 * 
 * - Geocoding: Nominatim (free, no API key)
 * - Routing: OSRM (free, real road-distance calculation)
 * 
 * Rate limiting: Nominatim requires max 1 req/sec and a custom User-Agent.
 * OSRM public server has no strict limit but is shared infrastructure.
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const OSRM_BASE = 'https://router.project-osrm.org';
const USER_AGENT = 'Serviciosatuhogar/1.0 (marketplace)';

class OSRMProvider implements IGeoProvider {
  async searchAddress(query: string): Promise<GeoSearchResult[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        addressdetails: '1',
        limit: '5',
        countrycodes: 'cl', // Restrict to Chile
      });

      const response = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
        headers: { 'User-Agent': USER_AGENT },
      });

      if (!response.ok) throw new Error(`Nominatim error: ${response.status}`);

      const data = await response.json();

      return data.map((item: any) => ({
        address: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        display_name: item.display_name,
      }));
    } catch (error) {
      console.error('Nominatim search error:', error);
      return [];
    }
  }

  async calculateRoute(origin: GeoSearchResult, destination: GeoSearchResult): Promise<RouteResult> {
    try {
      // OSRM uses lng,lat order (opposite of Leaflet's lat,lng)
      const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
      const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson`;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`OSRM error: ${response.status}`);

      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes?.length) {
        throw new Error('No se encontró una ruta válida entre los puntos seleccionados');
      }

      const route = data.routes[0];
      const distanceKm = parseFloat((route.distance / 1000).toFixed(1));
      const durationMinutes = Math.round(route.duration / 60);

      // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
      const geometry: [number, number][] = route.geometry.coordinates.map(
        (coord: [number, number]) => [coord[1], coord[0]]
      );

      return { distanceKm, durationMinutes, geometry };
    } catch (error) {
      console.error('OSRM route error:', error);
      throw error;
    }
  }
}

// Export singleton instance
const osrmProvider = new OSRMProvider();
export default osrmProvider;
