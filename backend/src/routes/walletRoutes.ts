import { Router } from 'express';
import { authJwt } from '../middlewares/authJwt.js';
import { addFundsMock, getWallet, listTransactions } from '../controllers/walletController.js';

export const walletRoutes = Router();

walletRoutes.get('/wallet', authJwt, getWallet);
walletRoutes.get('/wallet/transactions', authJwt, listTransactions);
walletRoutes.post('/wallet/add', authJwt, addFundsMock);

