import { Router } from 'express';
import { verificarTenant } from '../middlewares/tenant.js'; // <-- Importa o protetor
import { criarCliente, listarClientes, buscarClientePorId } from '../controllers/clientesController.js';

const router = Router();

// 🛡️ ATENÇÃO: Tudo o que estiver abaixo desta linha exige o X-Tenant-ID validado
router.use(verificarTenant); 

router.post('/', criarCliente);
router.get('/', listarClientes);
router.get('/:id', buscarClientePorId);

export default router;
