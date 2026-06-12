import { Router } from 'express';
import { verificarTenant } from '../middlewares/tenant.js'; // <-- ADICIONADO
import { criarTipologia, adicionarComponente, listarTipologias } from '../controllers/tipologiasController.js';

const router = Router();

router.use(verificarTenant); // 🛡️ Protege todas as rotas de tipologias automaticamente

router.post('/', criarTipologia);
router.get('/', listarTipologias);
router.post('/componentes', adicionarComponente);

export default router;
