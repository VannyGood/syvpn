import { Router } from 'express';
import { authJwt } from '../middlewares/authJwt.js';
import { approveTransaction, iPaid } from '../controllers/paymentController.js';

export const paymentRoutes = Router();

// User marks they've paid (creates pending tx + notifies admin)
paymentRoutes.post('/payments/i-paid', authJwt, iPaid);

// Admin approval link (token-based)
paymentRoutes.get('/admin/transactions/approve', approveTransaction);

