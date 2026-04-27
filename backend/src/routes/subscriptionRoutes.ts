import { Router } from 'express';
import { authJwt } from '../middlewares/authJwt.js';
import { getConfig, subscribe } from '../controllers/subscriptionController.js';

export const subscriptionRoutes = Router();

subscriptionRoutes.post('/subscribe', authJwt, subscribe);
subscriptionRoutes.get('/config', authJwt, getConfig);

