import { Router } from 'express';
import { verificarTenant } from '../middlewares/tenant.js'; 
import { 
    criarInsumo, 
    listarInsumos, 
    buscarInsumoPorId, 
    atualizarInsumo, // Agora esta função existe!
    deletarInsumo, 
    importarCatalogoLote 
} from '../controllers/insumosController.js';

const router = Router();

router.use(verificarTenant);

router.post('/', criarInsumo);
router.get('/', listarInsumos);
router.get('/:id', buscarInsumoPorId);
router.put('/:id', atualizarInsumo); // Esta linha agora funcionará
router.delete('/:id', deletarInsumo);
router.post('/importar', importarCatalogoLote);

export default router;