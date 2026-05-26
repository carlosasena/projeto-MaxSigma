import { Router } from 'express';
import { criarTipologia, adicionarComponente } from '../controllers/tipologiasController.js';

const router = Router();

router.post('/', criarTipologia); // POST /tipologias
router.post('/componentes', adicionarComponente); // POST /tipologias/componentes

export default router;