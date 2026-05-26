import { Router } from 'express';
import { criarInsumo, listarInsumos } from '../controllers/insumosController.js';

const router = Router();

router.post('/', criarInsumo); 
router.get('/', listarInsumos); 

export default router;