import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import geoProvider from '../../services/geo/OSRMProvider';
import type { GeoSearchResult, RouteResult } from '../../services/geo/types';

// Fix Leaflet default icons path in Vite/Webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const originIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const destIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Auto-fit map to show both markers + route
function FitBounds({ origin, destination }: { origin?: GeoSearchResult; destination?: GeoSearchResult }) {
  const map = useMap();
  useEffect(() => {
    if (origin && destination) {
      const bounds = L.latLngBounds([
        [origin.lat, origin.lng],
        [destination.lat, destination.lng],
      ]);
      map.fitBounds(bounds, { padding: [40, 40] });
    } else if (origin) {
      map.setView([origin.lat, origin.lng], 13);
    } else if (destination) {
      map.setView([destination.lat, destination.lng], 13);
    }
  }, [origin, destination, map]);
  return null;
}

// Debounced address search input
function AddressSearch({
  label,
  icon,
  value,
  onChange,
  onSelect,
  results,
  isLoading,
}: {
  label: string;
  icon: string;
  value: string;
  onChange: (val: string) => void;
  onSelect: (result: GeoSearchResult) => void;
  results: GeoSearchResult[];
  isLoading: boolean;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', marginBottom: '0.75rem' }}>
      <label style={{
        display: 'block',
        fontSize: '0.8rem',
        fontWeight: 600,
        marginBottom: '0.25rem',
        color: 'var(--text-secondary, #666)',
      }}>
        {icon} {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => results.length > 0 && setShowDropdown(true)}
        placeholder="Buscar dirección, comuna o ciudad..."
        style={{
          width: '100%',
          padding: '0.65rem 0.75rem',
          border: '1.5px solid var(--border-color, #e0e0e0)',
          borderRadius: '8px',
          fontSize: '0.9rem',
          backgroundColor: 'var(--bg-card, #fff)',
          color: 'var(--text-primary, #222)',
          outline: 'none',
          transition: 'border-color 0.2s',
          boxSizing: 'border-box',
        }}
      />
      {isLoading && (
        <div style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(20%)',
          fontSize: '0.75rem',
          color: 'var(--text-muted, #999)',
        }}>
          Buscando...
        </div>
      )}
      {showDropdown && results.length > 0 && (
        <ul style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: 'var(--bg-card, #fff)',
          border: '1px solid var(--border-color, #e0e0e0)',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          listStyle: 'none',
          margin: '4px 0 0',
          padding: '4px',
          maxHeight: '200px',
          overflowY: 'auto',
        }}>
          {results.map((r, idx) => (
            <li
              key={idx}
              onClick={() => {
                onSelect(r);
                setShowDropdown(false);
              }}
              style={{
                padding: '0.55rem 0.75rem',
                fontSize: '0.82rem',
                cursor: 'pointer',
                borderRadius: '6px',
                color: 'var(--text-primary, #333)',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f5f5f5)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              📍 {r.address}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================

interface FreightRouteMapProps {
  basePrice: number;
  pricePerKm: number;
  maxDistanceKm?: number;
  onRouteCalculated: (data: {
    origin: GeoSearchResult;
    destination: GeoSearchResult;
    distanceKm: number;
    durationMinutes: number;
  }) => void;
  readonly?: boolean;
  initialOrigin?: GeoSearchResult;
  initialDestination?: GeoSearchResult;
}

const FreightRouteMap: React.FC<FreightRouteMapProps> = ({
  basePrice,
  pricePerKm,
  maxDistanceKm = 1000,
  onRouteCalculated,
  readonly = false,
  initialOrigin,
  initialDestination,
}) => {
  const [originQuery, setOriginQuery] = useState(initialOrigin?.address || '');
  const [destQuery, setDestQuery] = useState(initialDestination?.address || '');
  const [originResults, setOriginResults] = useState<GeoSearchResult[]>([]);
  const [destResults, setDestResults] = useState<GeoSearchResult[]>([]);
  const [origin, setOrigin] = useState<GeoSearchResult | undefined>(initialOrigin);
  const [destination, setDestination] = useState<GeoSearchResult | undefined>(initialDestination);
  const [routeGeometry, setRouteGeometry] = useState<[number, number][]>([]);
  const [routeInfo, setRouteInfo] = useState<RouteResult | null>(null);
  const [error, setError] = useState('');
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const [isSearchingDest, setIsSearchingDest] = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  const debouncedSearch = useCallback(
    (query: string, type: 'origin' | 'dest') => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      if (query.length < 3) {
        type === 'origin' ? setOriginResults([]) : setDestResults([]);
        return;
      }

      const setLoading = type === 'origin' ? setIsSearchingOrigin : setIsSearchingDest;
      setLoading(true);

      searchTimeout.current = setTimeout(async () => {
        const results = await geoProvider.searchAddress(query);
        if (type === 'origin') setOriginResults(results);
        else setDestResults(results);
        setLoading(false);
      }, 500); // 500ms debounce
    },
    []
  );

  // Auto-calculate route when both points are set
  useEffect(() => {
    if (!origin || !destination) return;

    const calcRoute = async () => {
      try {
        setError('');
        const result = await geoProvider.calculateRoute(origin, destination);

        if (result.distanceKm > maxDistanceKm) {
          setError(`La distancia (${result.distanceKm} km) excede el máximo permitido de ${maxDistanceKm.toLocaleString()} km.`);
          setRouteGeometry([]);
          setRouteInfo(null);
          return;
        }

        setRouteGeometry(result.geometry);
        setRouteInfo(result);
        onRouteCalculated({
          origin,
          destination,
          distanceKm: result.distanceKm,
          durationMinutes: result.durationMinutes,
        });
      } catch (err: any) {
        setError(err.message || 'Error al calcular la ruta');
        setRouteGeometry([]);
        setRouteInfo(null);
      }
    };

    calcRoute();
  }, [origin, destination, maxDistanceKm, onRouteCalculated]);

  const estimatedPrice = routeInfo
    ? basePrice + pricePerKm * routeInfo.distanceKm
    : null;

  return (
    <div style={{
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid var(--border-color, #e0e0e0)',
      backgroundColor: 'var(--bg-card, #fff)',
    }}>
      {/* Map */}
      <div style={{ height: '280px', width: '100%' }}>
        <MapContainer
          center={[-33.45, -70.65]}
          zoom={6}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {origin && <Marker position={[origin.lat, origin.lng]} icon={originIcon} />}
          {destination && <Marker position={[destination.lat, destination.lng]} icon={destIcon} />}
          {routeGeometry.length > 0 && (
            <Polyline
              positions={routeGeometry}
              pathOptions={{ color: '#4f46e5', weight: 4, opacity: 0.8 }}
            />
          )}
          <FitBounds origin={origin} destination={destination} />
        </MapContainer>
      </div>

      {/* Search inputs */}
      {!readonly && (
        <div style={{ padding: '1rem' }}>
          <AddressSearch
            label="Dirección de Origen"
            icon="🟢"
            value={originQuery}
            onChange={(val) => {
              setOriginQuery(val);
              debouncedSearch(val, 'origin');
            }}
            onSelect={(r) => {
              setOrigin(r);
              setOriginQuery(r.address);
              setOriginResults([]);
            }}
            results={originResults}
            isLoading={isSearchingOrigin}
          />
          <AddressSearch
            label="Dirección de Destino"
            icon="🔴"
            value={destQuery}
            onChange={(val) => {
              setDestQuery(val);
              debouncedSearch(val, 'dest');
            }}
            onSelect={(r) => {
              setDestination(r);
              setDestQuery(r.address);
              setDestResults([]);
            }}
            results={destResults}
            isLoading={isSearchingDest}
          />

          {/* Error */}
          {error && (
            <div style={{
              padding: '0.6rem 0.8rem',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '8px',
              color: '#dc2626',
              fontSize: '0.82rem',
              marginBottom: '0.75rem',
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Route result */}
          {routeInfo && !error && (
            <div style={{
              padding: '0.8rem',
              backgroundColor: 'var(--bg-surface, #f8f9fa)',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #e5e7eb)',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
              }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #666)' }}>
                  🛣️ Distancia
                </span>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary, #222)' }}>
                  {routeInfo.distanceKm} km
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.75rem',
              }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #666)' }}>
                  ⏱️ Tiempo estimado
                </span>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary, #222)' }}>
                  {routeInfo.durationMinutes} min
                </span>
              </div>

              <div style={{
                borderTop: '1px solid var(--border-color, #e0e0e0)',
                paddingTop: '0.65rem',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted, #888)',
                  marginBottom: '0.25rem',
                }}>
                  <span>Valor base</span>
                  <span>${basePrice.toLocaleString('es-CL')}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted, #888)',
                  marginBottom: '0.5rem',
                }}>
                  <span>{routeInfo.distanceKm} km × ${pricePerKm.toLocaleString('es-CL')}/km</span>
                  <span>${(routeInfo.distanceKm * pricePerKm).toLocaleString('es-CL')}</span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  color: 'var(--text-primary, #222)',
                  borderTop: '1px dashed var(--border-color, #ddd)',
                  paddingTop: '0.5rem',
                }}>
                  <span>Subtotal (1 viaje)</span>
                  <span>${estimatedPrice?.toLocaleString('es-CL')}</span>
                </div>
                <p style={{
                  fontSize: '0.72rem',
                  color: 'var(--text-muted, #999)',
                  marginTop: '0.35rem',
                  fontStyle: 'italic',
                }}>
                  * El precio final se calcula según el volumen de tu carga en el paso siguiente.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FreightRouteMap;
