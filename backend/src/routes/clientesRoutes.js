import { Router } from 'express';
import { criarCliente, listarClientes, buscarClientePorId } from '../controllers/clientesController.js';

const router = Router();

router.post('/', criarCliente);
router.get('/', listarClientes);
router.get('/:id', buscarClientePorId);

export default router;
