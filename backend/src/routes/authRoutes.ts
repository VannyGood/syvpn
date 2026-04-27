import { Router } from 'express';
import { telegramAuth } from '../controllers/authController.js';

export const authRoutes = Router();

authRoutes.post('/telegram', telegramAuth);

