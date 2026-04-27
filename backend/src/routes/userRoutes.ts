import { Router } from 'express';
import { me } from '../controllers/userController.js';
import { authJwt } from '../middlewares/authJwt.js';

export const userRoutes = Router();

userRoutes.get('/me', authJwt, me);

