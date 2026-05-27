import { Router } from 'express';
import { criarOrcamento, obterListasProducao } from '../controllers/orcamentosController.js';

const router = Router();

// Rota 1: Dispara o Motor de Cálculo, gera o orçamento pai e explode os itens em barras arredondadas para cima
router.post('/criar', criarOrcamento);

// Rota 2: Busca o orçamento gerado e agrupa os materiais em listas limpas para a fábrica
router.get('/producao/:id', obterListasProducao);

export default router;