import { Router } from 'express';
import { criarTipologia, adicionarComponente, listarTipologias } from '../controllers/tipologiasController.js';

const router = Router();

router.post('/', criarTipologia);
router.get('/', listarTipologias);
router.post('/componentes', adicionarComponente);

export default router;
