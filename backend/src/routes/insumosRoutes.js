import { Router } from 'express';
import { verificarTenant } from '../middlewares/tenant.js'; 
import { 
    criarInsumo, 
    listarInsumos, 
    buscarInsumoPorId, 
    deletarInsumo, 
    importarCatalogoLote 
} from '../controllers/insumosController.js';

const router = Router();

// 🛡️ Protege todas as rotas de insumos/catálogos verificando o Tenant ID
router.use(verificarTenant);

router.post('/', criarInsumo);
router.get('/', listarInsumos);
router.get('/:id', buscarInsumoPorId);       // ✅ Nova rota: Buscar insumo específico
router.delete('/:id', deletarInsumo);     // ✅ Nova rota: Deletar insumo do catálogo
router.post('/importar', importarCatalogoLote);

export default router;