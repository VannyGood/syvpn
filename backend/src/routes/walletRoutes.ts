import { Router } from 'express';
import { authJwt } from '../middlewares/authJwt.js';
import { addFundsMock, getWallet } from '../controllers/walletController.js';

export const walletRoutes = Router();

walletRoutes.get('/wallet', authJwt, getWallet);
walletRoutes.post('/wallet/add', authJwt, addFundsMock);

