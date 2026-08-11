import { pool } from '../config/db.js';
import logger from '../config/logger.js';

// ============================================================
// FREIGHT VEHICLES CRUD
// ============================================================

// GET /api/freight/services/:serviceId/vehicles
export const getVehicles = async (req, res, next) => {
    try {
        const { serviceId } = req.params;

        const result = await pool.query(
            `SELECT *, 
                ROUND((height_cm::numeric * width_cm::numeric * depth_cm::numeric) / 1000000, 2) as volume_m3
             FROM freight_vehicles 
             WHERE service_id = $1 AND is_available = TRUE
             ORDER BY created_at ASC`,
            [serviceId]
        );

        res.json({
            status: 'success',
            vehicles: result.rows
        });
    } catch (err) {
        logger.error(`Get Freight Vehicles Error: ${err.message}`);
        next(err);
    }
};

// POST /api/freight/services/:serviceId/vehicles
export const addVehicle = async (req, res, next) => {
    try {
        const { serviceId } = req.params;
        const userId = req.user.id;
        const { name, height_cm, width_cm, depth_cm, max_weight_kg } = req.body;

        // Validate ownership
        const serviceCheck = await pool.query('SELECT provider_id FROM services WHERE id = $1', [serviceId]);
        if (serviceCheck.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Servicio no encontrado' });
        }
        if (serviceCheck.rows[0].provider_id !== userId) {
            return res.status(403).json({ status: 'error', message: 'No autorizado' });
        }

        // Validate dimensions
        if (!name || !height_cm || !width_cm || !depth_cm) {
            return res.status(400).json({ status: 'error', message: 'Nombre y dimensiones son obligatorios' });
        }
        if (height_cm <= 0 || width_cm <= 0 || depth_cm <= 0) {
            return res.status(400).json({ status: 'error', message: 'Las dimensiones deben ser mayores a 0' });
        }

        const result = await pool.query(
            `INSERT INTO freight_vehicles (service_id, name, height_cm, width_cm, depth_cm, max_weight_kg)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *, ROUND((height_cm::numeric * width_cm::numeric * depth_cm::numeric) / 1000000, 2) as volume_m3`,
            [serviceId, name, height_cm, width_cm, depth_cm, max_weight_kg || null]
        );

        logger.info(`Freight vehicle added: ${name} for service ${serviceId} by user ${userId}`);

        res.status(201).json({
            status: 'success',
            vehicle: result.rows[0]
        });
    } catch (err) {
        logger.error(`Add Freight Vehicle Error: ${err.message}`);
        next(err);
    }
};

// PUT /api/freight/services/:serviceId/vehicles/:vehicleId
export const updateVehicle = async (req, res, next) => {
    try {
        const { serviceId, vehicleId } = req.params;
        const userId = req.user.id;
        const { name, height_cm, width_cm, depth_cm, max_weight_kg, is_available } = req.body;

        // Validate ownership
        const serviceCheck = await pool.query('SELECT provider_id FROM services WHERE id = $1', [serviceId]);
        if (serviceCheck.rows.length === 0 || serviceCheck.rows[0].provider_id !== userId) {
            return res.status(403).json({ status: 'error', message: 'No autorizado' });
        }

        const result = await pool.query(
            `UPDATE freight_vehicles 
             SET name = COALESCE($1, name),
                 height_cm = COALESCE($2, height_cm),
                 width_cm = COALESCE($3, width_cm),
                 depth_cm = COALESCE($4, depth_cm),
                 max_weight_kg = COALESCE($5, max_weight_kg),
                 is_available = COALESCE($6, is_available)
             WHERE id = $7 AND service_id = $8
             RETURNING *, ROUND((height_cm::numeric * width_cm::numeric * depth_cm::numeric) / 1000000, 2) as volume_m3`,
            [name, height_cm, width_cm, depth_cm, max_weight_kg, is_available, vehicleId, serviceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Vehículo no encontrado' });
        }

        res.json({ status: 'success', vehicle: result.rows[0] });
    } catch (err) {
        logger.error(`Update Freight Vehicle Error: ${err.message}`);
        next(err);
    }
};

// DELETE /api/freight/services/:serviceId/vehicles/:vehicleId
export const deleteVehicle = async (req, res, next) => {
    try {
        const { serviceId, vehicleId } = req.params;
        const userId = req.user.id;

        // Validate ownership
        const serviceCheck = await pool.query('SELECT provider_id FROM services WHERE id = $1', [serviceId]);
        if (serviceCheck.rows.length === 0 || serviceCheck.rows[0].provider_id !== userId) {
            return res.status(403).json({ status: 'error', message: 'No autorizado' });
        }

        const result = await pool.query(
            'DELETE FROM freight_vehicles WHERE id = $1 AND service_id = $2 RETURNING id',
            [vehicleId, serviceId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Vehículo no encontrado' });
        }

        res.json({ status: 'success', message: 'Vehículo eliminado' });
    } catch (err) {
        logger.error(`Delete Freight Vehicle Error: ${err.message}`);
        next(err);
    }
};

// ============================================================
// LOGISTICS CALCULATOR
// ============================================================

// POST /api/freight/services/:serviceId/calculate-logistics
export const calculateLogistics = async (req, res, next) => {
    try {
        const { serviceId } = req.params;
        const { client_volume_m3, distance_km } = req.body;

        if (!client_volume_m3 || client_volume_m3 <= 0) {
            return res.status(400).json({ status: 'error', message: 'Debes indicar el volumen estimado de tu carga' });
        }
        if (!distance_km || distance_km <= 0) {
            return res.status(400).json({ status: 'error', message: 'Distancia inválida' });
        }
        if (distance_km > 1000) {
            return res.status(400).json({ status: 'error', message: 'La distancia máxima permitida es 1.000 km' });
        }

        // Fetch service pricing
        const serviceRes = await pool.query(
            'SELECT freight_base_price, freight_price_per_km FROM services WHERE id = $1',
            [serviceId]
        );
        if (serviceRes.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Servicio no encontrado' });
        }

        const { freight_base_price, freight_price_per_km } = serviceRes.rows[0];
        if (!freight_base_price || !freight_price_per_km) {
            return res.status(400).json({ status: 'error', message: 'Este servicio no tiene tarifas de flete configuradas' });
        }

        // Fetch available vehicles
        const vehiclesRes = await pool.query(
            `SELECT id, name, height_cm, width_cm, depth_cm, max_weight_kg,
                ROUND((height_cm::numeric * width_cm::numeric * depth_cm::numeric) / 1000000, 2) as volume_m3
             FROM freight_vehicles 
             WHERE service_id = $1 AND is_available = TRUE
             ORDER BY (height_cm::numeric * width_cm::numeric * depth_cm::numeric) DESC`,
            [serviceId]
        );

        if (vehiclesRes.rows.length === 0) {
            return res.status(400).json({ status: 'error', message: 'Este proveedor no tiene vehículos registrados' });
        }

        const vehicles = vehiclesRes.rows.map(v => ({
            ...v,
            volume_m3: parseFloat(v.volume_m3)
        }));

        const options = generateLogisticsOptions(
            vehicles,
            client_volume_m3,
            distance_km,
            freight_base_price,
            freight_price_per_km
        );

        res.json({
            status: 'success',
            client_volume_m3,
            distance_km,
            options
        });
    } catch (err) {
        logger.error(`Calculate Logistics Error: ${err.message}`);
        next(err);
    }
};

/**
 * Generates logistics options for the client based on available vehicles,
 * cargo volume, and distance.
 */
function generateLogisticsOptions(vehicles, clientVolume, distanceKm, basePrice, pricePerKm) {
    const options = [];
    const largestVehicle = vehicles[0]; // Already sorted DESC by volume

    // --- Option: Single trip with a single vehicle ---
    const fittingVehicle = vehicles.find(v => v.volume_m3 >= clientVolume);
    if (fittingVehicle) {
        const total = basePrice + (distanceKm * pricePerKm);
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
                total
            },
            is_recommended: true
        });
        return options; // Best case — no need for alternatives
    }

    // --- Cargo doesn't fit in any single vehicle ---

    // Option A: Multi-vehicle (1 trip with multiple vehicles)
    if (vehicles.length > 1) {
        const totalCombinedVolume = vehicles.reduce((sum, v) => sum + v.volume_m3, 0);

        if (totalCombinedVolume >= clientVolume) {
            // Find minimum subset of vehicles needed (greedy: largest first)
            let accumulatedVolume = 0;
            const selectedVehicles = [];
            for (const v of vehicles) {
                selectedVehicles.push({ id: v.id, name: v.name, volume_m3: v.volume_m3 });
                accumulatedVolume += v.volume_m3;
                if (accumulatedVolume >= clientVolume) break;
            }

            const vehicleCount = selectedVehicles.length;
            const totalMultiVehicle = (basePrice * vehicleCount) + (distanceKm * pricePerKm);
            const vehicleNames = selectedVehicles.map(v => `"${v.name}" (${v.volume_m3} m³)`).join(' + ');

            options.push({
                mode: 'multi_vehicle',
                vehicles: selectedVehicles,
                trips_count: 1,
                total_vehicle_volume_m3: accumulatedVolume,
                client_volume_m3: clientVolume,
                explanation: `Tu carga estimada (${clientVolume} m³) se reparte entre ${vehicleCount} vehículos: ${vehicleNames}. Capacidad total: ${accumulatedVolume.toFixed(1)} m³. Se realiza en un solo viaje, lo que es más rápido y eficiente.`,
                price_breakdown: {
                    base_per_unit: basePrice,
                    units: vehicleCount,
                    distance_km: distanceKm,
                    price_per_km: pricePerKm,
                    km_multiplier: 1,
                    total: totalMultiVehicle
                },
                is_recommended: true
            });
        }
    }

    // Option B: Multi-trip with the largest vehicle
    const tripsNeeded = Math.ceil(clientVolume / largestVehicle.volume_m3);
    const totalMultiTrip = (basePrice * tripsNeeded) + (distanceKm * pricePerKm * tripsNeeded);

    options.push({
        mode: 'multi_trip',
        vehicles: [{ id: largestVehicle.id, name: largestVehicle.name, volume_m3: largestVehicle.volume_m3 }],
        trips_count: tripsNeeded,
        total_vehicle_volume_m3: largestVehicle.volume_m3,
        client_volume_m3: clientVolume,
        explanation: `Tu carga estimada (${clientVolume} m³) excede la capacidad del vehículo "${largestVehicle.name}" (${largestVehicle.volume_m3} m³). Por seguridad, se requieren ${tripsNeeded} viajes. Cada viaje recorre los ${distanceKm.toFixed(1)} km de la ruta completa.`,
        price_breakdown: {
            base_per_unit: basePrice,
            units: tripsNeeded,
            distance_km: distanceKm,
            price_per_km: pricePerKm,
            km_multiplier: tripsNeeded,
            total: totalMultiTrip
        },
        is_recommended: options.length === 0 // Recommended only if no multi-vehicle option exists
    });

    // Sort: recommended first, then by price
    options.sort((a, b) => {
        if (a.is_recommended !== b.is_recommended) return a.is_recommended ? -1 : 1;
        return a.price_breakdown.total - b.price_breakdown.total;
    });

    return options;
}

// ============================================================
// DB MIGRATION
// ============================================================

// POST /api/admin/migrate-freight
export const migrateFreightSchema = async (req, res, next) => {
    try {
        await pool.query('BEGIN');

        // 1. Create freight_vehicles table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS freight_vehicles (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                height_cm INTEGER NOT NULL,
                width_cm INTEGER NOT NULL,
                depth_cm INTEGER NOT NULL,
                max_weight_kg INTEGER DEFAULT NULL,
                is_available BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Add freight columns to services
        await pool.query(`
            ALTER TABLE services 
            ADD COLUMN IF NOT EXISTS freight_base_price INTEGER DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS freight_price_per_km INTEGER DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS freight_max_distance_km INTEGER DEFAULT 1000
        `);

        // 3. Add freight columns to bookings
        await pool.query(`
            ALTER TABLE bookings
            ADD COLUMN IF NOT EXISTS freight_origin_address TEXT DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS freight_origin_lat DOUBLE PRECISION DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS freight_origin_lng DOUBLE PRECISION DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS freight_dest_address TEXT DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS freight_dest_lat DOUBLE PRECISION DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS freight_dest_lng DOUBLE PRECISION DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS freight_distance_km DOUBLE PRECISION DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS freight_client_volume_m3 DOUBLE PRECISION DEFAULT NULL,
            ADD COLUMN IF NOT EXISTS freight_logistics_plan JSONB DEFAULT NULL
        `);

        await pool.query('COMMIT');

        logger.info('Freight schema migration completed successfully');
        res.json({
            status: 'success',
            message: 'Migración de esquema de fletes completada. Tabla freight_vehicles creada, columnas agregadas a services y bookings.'
        });
    } catch (err) {
        await pool.query('ROLLBACK');
        logger.error(`Freight Schema Migration Error: ${err.message}`);
        res.status(500).json({ status: 'error', message: err.message });
    }
};
