import { Router } from 'express';
import { verificarTenant } from '../middlewares/tenant.js'; // <-- Importa o protetor
import { criarInsumo, listarInsumos, importarCatalogoLote } from '../controllers/insumosController.js';

const router = Router();

// 🛡️ Protege todas as rotas de insumos/catálogos automaticamente
router.use(verificarTenant);

router.post('/', criarInsumo);
router.get('/', listarInsumos);
router.post('/importar', importarCatalogoLote);

export default router;
