import React, { useState } from 'react';
import type { FreightVehicle } from '../../types';

interface FreightVehicleManagerProps {
  vehicles: FreightVehicle[];
  onAdd: (vehicle: Omit<FreightVehicle, 'id' | 'service_id' | 'is_available' | 'volume_m3'>) => Promise<void>;
  onUpdate: (vehicleId: string, data: Partial<FreightVehicle>) => Promise<void>;
  onDelete: (vehicleId: string) => Promise<void>;
  isLoading?: boolean;
}

interface VehicleFormData {
  name: string;
  height_cm: string;
  width_cm: string;
  depth_cm: string;
  max_weight_kg: string;
}

const defaultForm: VehicleFormData = { name: '', height_cm: '', width_cm: '', depth_cm: '', max_weight_kg: '' };

const FreightVehicleManager: React.FC<FreightVehicleManagerProps> = ({
  vehicles,
  onAdd,
  onUpdate,
  onDelete,
  isLoading = false,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<VehicleFormData>(defaultForm);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const calcVolume = (h: string, w: string, d: string) => {
    const hN = parseFloat(h) || 0;
    const wN = parseFloat(w) || 0;
    const dN = parseFloat(d) || 0;
    return ((hN * wN * dN) / 1000000).toFixed(2);
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.height_cm || !form.width_cm || !form.depth_cm) return;
    setIsSaving(true);
    try {
      if (editId) {
        await onUpdate(editId, {
          name: form.name,
          height_cm: parseInt(form.height_cm),
          width_cm: parseInt(form.width_cm),
          depth_cm: parseInt(form.depth_cm),
          max_weight_kg: form.max_weight_kg ? parseInt(form.max_weight_kg) : undefined,
        });
      } else {
        await onAdd({
          name: form.name,
          height_cm: parseInt(form.height_cm),
          width_cm: parseInt(form.width_cm),
          depth_cm: parseInt(form.depth_cm),
          max_weight_kg: form.max_weight_kg ? parseInt(form.max_weight_kg) : undefined,
        });
      }
      setForm(defaultForm);
      setShowForm(false);
      setEditId(null);
    } catch (err) {
      console.error('Vehicle save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (v: FreightVehicle) => {
    setForm({
      name: v.name,
      height_cm: String(v.height_cm),
      width_cm: String(v.width_cm),
      depth_cm: String(v.depth_cm),
      max_weight_kg: v.max_weight_kg ? String(v.max_weight_kg) : '',
    });
    setEditId(v.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    setIsSaving(true);
    try {
      await onDelete(id);
      setConfirmDelete(null);
    } catch (err) {
      console.error('Vehicle delete error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const totalVolume = vehicles.reduce((sum, v) => sum + v.volume_m3, 0);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.55rem 0.65rem',
    border: '1.5px solid var(--border-color, #e0e0e0)',
    borderRadius: '8px',
    fontSize: '0.88rem',
    backgroundColor: 'var(--bg-card, #fff)',
    color: 'var(--text-primary, #222)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    marginBottom: '0.2rem',
    color: 'var(--text-secondary, #666)',
  };

  return (
    <div style={{
      border: '1px solid var(--border-color, #e0e0e0)',
      borderRadius: '12px',
      padding: '1rem',
      backgroundColor: 'var(--bg-card, #fff)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary, #222)' }}>
          🚚 Tus Vehículos
        </h4>
        {vehicles.length > 0 && (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #888)' }}>
            Capacidad total: {totalVolume.toFixed(1)} m³
          </span>
        )}
      </div>

      {/* Vehicle list */}
      {vehicles.map((v) => (
        <div
          key={v.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.65rem 0.8rem',
            backgroundColor: 'var(--bg-surface, #f8f9fa)',
            borderRadius: '8px',
            marginBottom: '0.5rem',
            border: '1px solid var(--border-color, #eee)',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary, #222)' }}>
              {v.name}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #666)', marginTop: '0.15rem' }}>
              {v.height_cm} × {v.width_cm} × {v.depth_cm} cm → {v.volume_m3} m³
              {v.max_weight_kg ? ` · Peso máx: ${v.max_weight_kg.toLocaleString()} kg` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={() => startEdit(v)}
              style={{
                padding: '0.3rem 0.55rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #ddd)',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: 'var(--text-secondary, #666)',
              }}
            >
              ✏️
            </button>
            {confirmDelete === v.id ? (
              <button
                onClick={() => handleDelete(v.id)}
                disabled={isSaving}
                style={{
                  padding: '0.3rem 0.55rem',
                  borderRadius: '6px',
                  border: '1px solid #ef4444',
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                }}
              >
                Confirmar
              </button>
            ) : (
              <button
                onClick={() => setConfirmDelete(v.id)}
                style={{
                  padding: '0.3rem 0.55rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #ddd)',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary, #666)',
                }}
              >
                🗑️
              </button>
            )}
          </div>
        </div>
      ))}

      {vehicles.length === 0 && !showForm && (
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted, #999)', textAlign: 'center', margin: '0.75rem 0' }}>
          Aún no has registrado vehículos. Agrega al menos uno para activar tu servicio de flete.
        </p>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div style={{
          padding: '1rem',
          border: '1px dashed var(--border-color, #ccc)',
          borderRadius: '10px',
          marginTop: '0.5rem',
          marginBottom: '0.5rem',
          backgroundColor: 'var(--bg-surface, #fafafa)',
        }}>
          <h5 style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary, #222)' }}>
            {editId ? '✏️ Editar Vehículo' : '➕ Nuevo Vehículo'}
          </h5>

          {/* Name */}
          <div style={{ marginBottom: '0.65rem' }}>
            <label style={labelStyle}>Nombre del vehículo</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder='Ej: "Camión Grande", "Furgón Delivery"'
              style={inputStyle}
            />
          </div>

          {/* Dimensions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div>
              <label style={labelStyle}>Alto (cm)</label>
              <input
                type="number"
                value={form.height_cm}
                onChange={(e) => setForm({ ...form, height_cm: e.target.value })}
                placeholder="180"
                min={1}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Ancho (cm)</label>
              <input
                type="number"
                value={form.width_cm}
                onChange={(e) => setForm({ ...form, width_cm: e.target.value })}
                placeholder="200"
                min={1}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Prof. (cm)</label>
              <input
                type="number"
                value={form.depth_cm}
                onChange={(e) => setForm({ ...form, depth_cm: e.target.value })}
                placeholder="300"
                min={1}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Volume preview */}
          {form.height_cm && form.width_cm && form.depth_cm && (
            <div style={{
              fontSize: '0.82rem',
              color: 'var(--color-primary, #4f46e5)',
              fontWeight: 600,
              marginBottom: '0.65rem',
            }}>
              📦 Volumen: {calcVolume(form.height_cm, form.width_cm, form.depth_cm)} m³
            </div>
          )}

          {/* Weight */}
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={labelStyle}>Peso máximo (kg) — opcional</label>
            <input
              type="number"
              value={form.max_weight_kg}
              onChange={(e) => setForm({ ...form, max_weight_kg: e.target.value })}
              placeholder="3000"
              min={0}
              style={{ ...inputStyle, maxWidth: '200px' }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={handleSubmit}
              disabled={isSaving || !form.name || !form.height_cm || !form.width_cm || !form.depth_cm}
              style={{
                padding: '0.55rem 1.2rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--color-primary, #4f46e5)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.6 : 1,
              }}
            >
              {isSaving ? 'Guardando...' : editId ? 'Actualizar' : 'Agregar'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditId(null); setForm(defaultForm); }}
              style={{
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #ddd)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary, #666)',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Add button */}
      {!showForm && (
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm(defaultForm); }}
          style={{
            width: '100%',
            padding: '0.6rem',
            borderRadius: '8px',
            border: '1.5px dashed var(--border-color, #ccc)',
            backgroundColor: 'transparent',
            color: 'var(--color-primary, #4f46e5)',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: 'pointer',
            marginTop: '0.25rem',
            transition: 'all 0.2s',
          }}
        >
          + Agregar Vehículo
        </button>
      )}
    </div>
  );
};

export default FreightVehicleManager;
