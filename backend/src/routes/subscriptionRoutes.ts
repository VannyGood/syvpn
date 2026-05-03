import { Router } from 'express';
import { authJwt } from '../middlewares/authJwt.js';
import { claimTrial, getConfig, resetSubDevices, subscribe } from '../controllers/subscriptionController.js';

export const subscriptionRoutes = Router();

subscriptionRoutes.post('/subscribe', authJwt, subscribe);
subscriptionRoutes.post('/trial/claim', authJwt, claimTrial);
subscriptionRoutes.get('/config', authJwt, getConfig);
subscriptionRoutes.post('/config/sub-devices/reset', authJwt, resetSubDevices);

