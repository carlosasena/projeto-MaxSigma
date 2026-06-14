import { Router } from 'express';
import { verificarTenant } from '../middlewares/tenant.js'; 
import { 
    criarCliente, 
    listarClientes, 
    buscarClientePorId,
    criarEnderecoObra,
    listarObrasDoCliente 
} from '../controllers/clientesController.js';

const router = Router();

// Exige o cabeçalho X-Tenant-ID validado para todas as rotas abaixo
router.use(verificarTenant); 

// Rotas principais de Clientes
router.post('/', criarCliente);
router.get('/', listarClientes);
router.get('/:id', buscarClientePorId);

// Sub-rotas para gerenciamento das Obras ligadas ao Cliente
router.post('/:clienteId/obras', criarEnderecoObra);       // POST para cadastrar obra do cliente
router.get('/:clienteId/obras', listarObrasDoCliente);    // GET para listar todas as obras do cliente

export default router;