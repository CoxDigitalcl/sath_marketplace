import express from 'express';
import { getPromotions } from '../controllers/promotionController.js';

const router = express.Router();

// Public route
router.get('/', getPromotions);

export default router;
