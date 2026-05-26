import { Router } from 'express';
import { criarCliente, listarClientes } from '../controllers/clientesController.js';

const router = Router();

router.post('/', criarCliente); // Rota para cadastrar
router.get('/', listarClientes); // Rota para listar

export default router;