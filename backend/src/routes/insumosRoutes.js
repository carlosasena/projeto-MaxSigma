import { Router } from 'express';
import { criarInsumo, listarInsumos, importarCatalogoLote } from '../controllers/insumosController.js';

const router = Router();

router.post('/', criarInsumo);
router.get('/', listarInsumos);
router.post('/importar', importarCatalogoLote);

export default router;
