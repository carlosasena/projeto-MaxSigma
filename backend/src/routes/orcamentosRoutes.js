import { Router } from 'express';
import { criarOrcamento, obterListasProducao } from '../controllers/orcamentosController.js';

const router = Router();

router.post('/', criarOrcamento);
router.get('/:id/producao', obterListasProducao);

export default router;
