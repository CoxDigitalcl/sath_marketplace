import React, { useState, useEffect } from 'react';
import type { FreightVehicle, LogisticsPlan, LogisticsMode } from '../../types';

// Volume reference items for helping clients estimate
const VOLUME_REFERENCES = [
  { label: 'Una habitación pequeña', m3: '5-8 m³', value: 6.5 },
  { label: 'Un departamento estudio', m3: '10-15 m³', value: 12.5 },
  { label: 'Departamento 2 ambientes', m3: '15-25 m³', value: 20 },
  { label: 'Casa de 3 dormitorios', m3: '30-45 m³', value: 37.5 },
  { label: 'Casa grande (4+ dormitorios)', m3: '45-65 m³', value: 55 },
];

interface FreightLogisticsCalculatorProps {
  vehicles: FreightVehicle[];
  basePrice: number;
  pricePerKm: number;
  distanceKm: number;
  onPlanSelected: (plan: LogisticsPlan) => void;
  onPlanCleared?: () => void;
}

/**
 * Core logistics algorithm. Generates all viable options
 * given the provider's vehicles and the client's estimated volume.
 */
function generateOptions(
  vehicles: FreightVehicle[],
  clientVolume: number,
  distanceKm: number,
  basePrice: number,
  pricePerKm: number
): LogisticsPlan[] {
  const options: LogisticsPlan[] = [];

  // Sort vehicles by volume descending
  const sorted = [...vehicles].sort((a, b) => b.volume_m3 - a.volume_m3);
  const largest = sorted[0];

  // Case 1: Single trip, single vehicle
  const fittingVehicle = sorted.find((v) => v.volume_m3 >= clientVolume);
  if (fittingVehicle) {
    const total = basePrice + distanceKm * pricePerKm;
    options.push({
      mode: 'single_trip',
      vehicles: [{ id: fittingVehicle.id, name: fittingVehicle.name, volume_m3: fittingVehicle.volume_m3 }],
      trips_count: 1,
      total_vehicle_volume_m3: fittingVehicle.volume_m3,
      client_volume_m3: clientVolume,
      explanation: `Tu carga estimada (${clientVolume} m³) cabe en el vehículo "${fittingVehicle.name}" (${fittingVehicle.volume_m3} m³). Se necesita un solo viaje.`,
      price_breakdown: {
        base_per_unit: basePrice,
        units: 1,
        distance_km: distanceKm,
        price_per_km: pricePerKm,
        km_multiplier: 1,
        total,
      },
      is_recommended: true,
    });
    return options; // Best possible case
  }

  // Case 2: Multi-vehicle (1 trip with N vehicles)
  if (sorted.length > 1) {
    let accumulated = 0;
    const selected: { id: string; name: string; volume_m3: number }[] = [];
    for (const v of sorted) {
      selected.push({ id: v.id, name: v.name, volume_m3: v.volume_m3 });
      accumulated += v.volume_m3;
      if (accumulated >= clientVolume) break;
    }

    if (accumulated >= clientVolume) {
      const n = selected.length;
      const total = basePrice * n + distanceKm * pricePerKm;
      const vehicleNames = selected.map((v) => `"${v.name}" (${v.volume_m3} m³)`).join(' + ');
      options.push({
        mode: 'multi_vehicle',
        vehicles: selected,
        trips_count: 1,
        total_vehicle_volume_m3: parseFloat(accumulated.toFixed(1)),
        client_volume_m3: clientVolume,
        explanation: `Tu carga estimada (${clientVolume} m³) se reparte entre ${n} vehículos: ${vehicleNames}. Capacidad combinada: ${accumulated.toFixed(1)} m³. Se realiza en un solo viaje, lo cual es más rápido y seguro que dividir en múltiples recorridos.`,
        price_breakdown: {
          base_per_unit: basePrice,
          units: n,
          distance_km: distanceKm,
          price_per_km: pricePerKm,
          km_multiplier: 1,
          total,
        },
        is_recommended: true,
      });
    }
  }

  // Case 3: Multi-trip with the largest vehicle
  const tripsNeeded = Math.ceil(clientVolume / largest.volume_m3);
  const totalMultiTrip = basePrice * tripsNeeded + distanceKm * pricePerKm * tripsNeeded;
  options.push({
    mode: 'multi_trip',
    vehicles: [{ id: largest.id, name: largest.name, volume_m3: largest.volume_m3 }],
    trips_count: tripsNeeded,
    total_vehicle_volume_m3: largest.volume_m3,
    client_volume_m3: clientVolume,
    explanation: `Tu carga estimada (${clientVolume} m³) excede la capacidad del vehículo "${largest.name}" (${largest.volume_m3} m³). Por seguridad, se requieren ${tripsNeeded} viajes. Cada viaje recorre los ${distanceKm.toFixed(1)} km de la ruta completa.`,
    price_breakdown: {
      base_per_unit: basePrice,
      units: tripsNeeded,
      distance_km: distanceKm,
      price_per_km: pricePerKm,
      km_multiplier: tripsNeeded,
      total: totalMultiTrip,
    },
    is_recommended: options.length === 0,
  });

  // Sort: recommended first, then price ascending
  options.sort((a, b) => {
    if (a.is_recommended !== b.is_recommended) return a.is_recommended ? -1 : 1;
    return a.price_breakdown.total - b.price_breakdown.total;
  });

  return options;
}

// =========================================================
// COMPONENT
// =========================================================

const FreightLogisticsCalculator: React.FC<FreightLogisticsCalculatorProps> = ({
  vehicles,
  basePrice,
  pricePerKm,
  distanceKm,
  onPlanSelected,
  onPlanCleared,
}) => {
  const [clientVolume, setClientVolume] = useState<number>(10);
  const [options, setOptions] = useState<LogisticsPlan[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (clientVolume > 0 && vehicles.length > 0) {
      const generated = generateOptions(vehicles, clientVolume, distanceKm, basePrice, pricePerKm);
      setOptions(generated);
    } else {
      setOptions([]);
    }
    setSelectedIdx(null);
    onPlanCleared?.();
  }, [clientVolume, vehicles, distanceKm, basePrice, pricePerKm, onPlanCleared]);

  const handleSelect = (idx: number) => {
    setSelectedIdx(idx);
    onPlanSelected(options[idx]);
  };

  const modeLabels: Record<LogisticsMode, string> = {
    single_trip: '1 viaje, 1 vehículo',
    multi_trip: 'Múltiples viajes, 1 vehículo',
    multi_vehicle: '1 viaje, múltiples vehículos',
  };

  const modeIcons: Record<LogisticsMode, string> = {
    single_trip: '🚛',
    multi_trip: '🔄',
    multi_vehicle: '🚛🚐',
  };

  return (
    <div style={{
      borderRadius: '12px',
      border: '1px solid var(--border-color, #e0e0e0)',
      backgroundColor: 'var(--bg-card, #fff)',
      padding: '1.25rem',
    }}>
      <h4 style={{
        fontSize: '1rem',
        fontWeight: 700,
        margin: '0 0 1rem',
        color: 'var(--text-primary, #222)',
      }}>
        📦 ¿Cuánto necesitas transportar?
      </h4>

      {/* Volume input */}
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <input
            type="range"
            min={1}
            max={80}
            step={0.5}
            value={clientVolume}
            onChange={(e) => setClientVolume(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: '#4f46e5' }}
          />
          <div style={{
            minWidth: '70px',
            textAlign: 'center',
            padding: '0.35rem 0.5rem',
            backgroundColor: 'var(--bg-surface, #f0f0f0)',
            borderRadius: '6px',
            fontWeight: 700,
            fontSize: '0.95rem',
            color: 'var(--text-primary, #222)',
          }}>
            {clientVolume} m³
          </div>
        </div>

        {/* Quick reference */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.35rem',
          marginBottom: '1rem',
        }}>
          {VOLUME_REFERENCES.map((ref) => (
            <button
              key={ref.label}
              onClick={() => setClientVolume(ref.value)}
              style={{
                padding: '0.3rem 0.6rem',
                fontSize: '0.72rem',
                borderRadius: '99px',
                border: '1px solid var(--border-color, #ddd)',
                backgroundColor:
                  clientVolume === ref.value
                    ? 'var(--color-primary, #4f46e5)'
                    : 'var(--bg-surface, #f5f5f5)',
                color:
                  clientVolume === ref.value ? '#fff' : 'var(--text-secondary, #666)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {ref.label} ({ref.m3})
            </button>
          ))}
        </div>
      </div>

      {/* Options */}
      {options.length > 0 && (
        <>
          <h4 style={{
            fontSize: '0.9rem',
            fontWeight: 700,
            margin: '0 0 0.75rem',
            color: 'var(--text-primary, #222)',
            borderTop: '1px solid var(--border-color, #e5e7eb)',
            paddingTop: '0.85rem',
          }}>
            📋 Plan de Logística
          </h4>

          {options.map((option, idx) => {
            const isSelected = selectedIdx === idx;
            return (
              <div
                key={idx}
                style={{
                  border: isSelected
                    ? '2px solid var(--color-primary, #4f46e5)'
                    : '1px solid var(--border-color, #e0e0e0)',
                  borderRadius: '10px',
                  padding: '1rem',
                  marginBottom: '0.75rem',
                  backgroundColor: isSelected
                    ? 'rgba(79, 70, 229, 0.04)'
                    : 'var(--bg-card, #fff)',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                }}
                onClick={() => handleSelect(idx)}
              >
                {/* Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.6rem',
                }}>
                  <div>
                    {option.is_recommended && (
                      <span style={{
                        display: 'inline-block',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        color: '#059669',
                        marginBottom: '0.3rem',
                      }}>
                        ⭐ RECOMENDADA
                      </span>
                    )}
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary, #222)' }}>
                      {modeIcons[option.mode]} {modeLabels[option.mode]}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: 'var(--color-primary, #4f46e5)',
                  }}>
                    ${option.price_breakdown.total.toLocaleString('es-CL')}
                  </div>
                </div>

                {/* Vehicles list */}
                <div style={{ marginBottom: '0.5rem' }}>
                  {option.vehicles.map((v, vidx) => (
                    <div key={vidx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary, #555)',
                      marginBottom: '0.2rem',
                    }}>
                      <span style={{ marginRight: '0.4rem' }}>🚛</span>
                      {v.name} ({v.volume_m3} m³)
                    </div>
                  ))}
                  {option.trips_count > 1 && (
                    <div style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-muted, #888)',
                      marginTop: '0.2rem',
                    }}>
                      × {option.trips_count} viajes — cada viaje recorre {distanceKm} km
                    </div>
                  )}
                </div>

                {/* Explanation */}
                <div style={{
                  padding: '0.6rem 0.75rem',
                  backgroundColor: 'rgba(79, 70, 229, 0.04)',
                  borderRadius: '6px',
                  borderLeft: '3px solid var(--color-primary, #4f46e5)',
                  marginBottom: '0.65rem',
                }}>
                  <p style={{
                    fontSize: '0.8rem',
                    margin: 0,
                    color: 'var(--text-primary, #333)',
                    lineHeight: 1.5,
                  }}>
                    ℹ️ {option.explanation}
                  </p>
                </div>

                {/* Price breakdown */}
                <div style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-muted, #888)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Valor base × {option.price_breakdown.units} {option.mode === 'multi_vehicle' ? 'vehículos' : 'viajes'}</span>
                    <span>${(option.price_breakdown.base_per_unit * option.price_breakdown.units).toLocaleString('es-CL')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{distanceKm} km × ${pricePerKm.toLocaleString('es-CL')}/km × {option.price_breakdown.km_multiplier}</span>
                    <span>${(distanceKm * pricePerKm * option.price_breakdown.km_multiplier).toLocaleString('es-CL')}</span>
                  </div>
                </div>

                {/* Select button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(idx);
                  }}
                  style={{
                    marginTop: '0.75rem',
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    backgroundColor: isSelected
                      ? 'var(--color-primary, #4f46e5)'
                      : 'var(--bg-surface, #f0f0f0)',
                    color: isSelected ? '#fff' : 'var(--text-primary, #333)',
                  }}
                >
                  {isSelected ? '✓ Opción seleccionada' : 'Seleccionar esta opción'}
                </button>
              </div>
            );
          })}
        </>
      )}

      {vehicles.length === 0 && (
        <div style={{
          padding: '1rem',
          textAlign: 'center',
          color: 'var(--text-muted, #999)',
          fontSize: '0.85rem',
        }}>
          Este proveedor no ha registrado vehículos aún.
        </div>
      )}
    </div>
  );
};

export default FreightLogisticsCalculator;
