import express from 'express';
import { getFavorites, addFavorite, removeFavorite, checkFavorite } from '../controllers/favoritesController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All favorites endpoints require authentication
router.use(authenticateToken);

// GET /api/favorites - Get all favorites
router.get('/', getFavorites);

// POST /api/favorites - Add to favorites
router.post('/', addFavorite);

// DELETE /api/favorites/:serviceId - Remove from favorites
router.delete('/:serviceId', removeFavorite);

// GET /api/favorites/check/:serviceId - Check if service is favorited
router.get('/check/:serviceId', checkFavorite);

export default router;
