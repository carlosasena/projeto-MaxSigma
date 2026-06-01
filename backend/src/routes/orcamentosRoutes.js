import { Router } from 'express';
import { criarOrcamento, obterListasProducao } from '../controllers/orcamentosController.js';

const router = Router();

// Rota 1: Cria o orçamento pai e dispara o motor de cálculo (Explosão de materiais)
// Acessível via: POST /orcamentos
router.post('/', criarOrcamento);

// Rota 2: Busca a lista de produção/materiais vinculada a um orçamento específico
// Acessível via: GET /orcamentos/:id/producao
router.get('/:id/producao', obterListasProducao);

export default router;