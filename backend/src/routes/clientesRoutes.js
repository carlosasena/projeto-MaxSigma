import { Router } from 'express';
import { verificarTenant } from '../middlewares/tenant.js'; 
import { 
    criarCliente, 
    listarClientes, 
    buscarClientePorId,
    atualizarCliente,
    deletarCliente,
    criarEnderecoObra,
    listarObrasDoCliente 
} from '../controllers/clientesController.js';

const router = Router();

// O tenant já foi verificado no index.js, mas mantemos por segurança
// router.use(verificarTenant); // Removido pois já está no index.js

// Rotas principais de Clientes
router.post('/', criarCliente);
router.get('/', listarClientes);
router.get('/:id', buscarClientePorId);
router.put('/:id', atualizarCliente);
router.delete('/:id', deletarCliente);

// Sub-rotas para gerenciamento das Obras ligadas ao Cliente
router.post('/:clienteId/obras', criarEnderecoObra);
router.get('/:clienteId/obras', listarObrasDoCliente);

export default router;