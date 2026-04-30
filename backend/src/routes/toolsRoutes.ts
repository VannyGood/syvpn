import { Router } from 'express';
import { flagify, happSub } from '../controllers/toolsController.js';

export const toolsRoutes = Router();

// Public utility endpoint: fetch Marzban subscription and add flag hints per node.
toolsRoutes.get('/flagify', flagify);
toolsRoutes.get('/happ-sub', happSub);

