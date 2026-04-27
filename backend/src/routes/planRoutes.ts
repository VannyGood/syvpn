import { Router } from 'express';
import { listPlans } from '../controllers/planController.js';

export const planRoutes = Router();

planRoutes.get('/plans', listPlans);

