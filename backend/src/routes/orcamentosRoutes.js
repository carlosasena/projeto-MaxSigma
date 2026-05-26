import { Router } from 'express';
import { criarOrcamento, obterListasProducao } from '../controllers/orcamentosController.js';

const router = Router();

router.post('/', criarOrcamento); // POST /orcamentos (Cria o orçamento)
router.get('/:id/producao', obterListasProducao); // GET /orcamentos/1/producao (Separa os materiais)

export default router;