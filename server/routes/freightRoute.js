import express from 'express';
import { getVehicles, addVehicle, updateVehicle, deleteVehicle, calculateLogistics } from '../controllers/freightController.js';
import { authenticateToken, requireVerified } from '../middleware/sessionAuth.js';
import { requireRole } from '../middleware/authorization.js';

const router = express.Router();

// Public Routes
router.get('/services/:serviceId/vehicles', getVehicles);
router.post('/services/:serviceId/calculate-logistics', calculateLogistics);

// Protected Routes (Provider Only)
router.post('/services/:serviceId/vehicles', authenticateToken, requireRole('provider'), requireVerified, addVehicle);
router.put('/services/:serviceId/vehicles/:vehicleId', authenticateToken, requireRole('provider'), requireVerified, updateVehicle);
router.delete('/services/:serviceId/vehicles/:vehicleId', authenticateToken, requireRole('provider'), requireVerified, deleteVehicle);

export default router;
