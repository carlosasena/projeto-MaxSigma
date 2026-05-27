import { Router } from 'express';
import { criarInsumo, listarInsumos, importarCatalogoLote } from '../controllers/insumosController.js';

const router = Router();

router.post('/', criarInsumo); 
router.get('/', listarInsumos); 

// Nova rota para testes futuros e cargas massivas de catálogos
router.post('/importar-catalogo', importarCatalogoLote);

export default router;