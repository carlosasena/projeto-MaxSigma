import { Router } from 'express';
import { verificarTenant } from '../middlewares/tenant.js'; // <-- ADICIONADO
import { criarOrcamento, obterListasProducao } from '../controllers/orcamentosController.js';

const router = Router();

router.use(verificarTenant); // 🛡️ Protege todas as rotas de orçamentos automaticamente

router.post('/', criarOrcamento);
router.get('/:id/producao', obterListasProducao);

export default router;
