import express from 'express';
import { getVehicles, addVehicle, updateVehicle, deleteVehicle, calculateLogistics } from '../controllers/freightController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Public Routes
router.get('/services/:serviceId/vehicles', getVehicles);
router.post('/services/:serviceId/calculate-logistics', calculateLogistics);

// Protected Routes (Provider Only)
router.post('/services/:serviceId/vehicles', authenticateToken, addVehicle);
router.put('/services/:serviceId/vehicles/:vehicleId', authenticateToken, updateVehicle);
router.delete('/services/:serviceId/vehicles/:vehicleId', authenticateToken, deleteVehicle);

export default router;
