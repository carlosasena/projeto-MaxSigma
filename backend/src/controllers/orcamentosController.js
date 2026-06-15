import pool from '../config/db.js';
import { z } from 'zod';
import { 
    calcularMetragemPorFormula, 
    calcularLotePerfis 
} from '../services/calculoService.js';

// Schema de validação (Sem empresa_id no corpo do JSON)
const orcamentoSchema = z.object({
    projeto_id: z.number().int().positive(),
    cliente_id: z.number().int().positive(),
    endereco_obra_id: z.number().int().positive(),
    largura_mm: z.number().positive(),
    altura_mm: z.number().positive(),
    mao_de_obra: z.number().nonnegative().default(0),
    status: z.string().optional().default('Em Orçamento')
});

export const criarOrcamento = async (req, res) => {
    try {
        const empresa_id = req.empresa_id;

        if (!empresa_id) {
            return res.status(400).json({ error: 'Identificação da empresa (Tenant) ausente.' });
        }

        const dados = orcamentoSchema.parse(req.body);
        const client = await pool.connect();

        try {
            // Validação de Integridade: O cliente pertence a esta empresa?
            const checkIntegridade = await client.query(`
                SELECT id FROM clientes 
                WHERE id = $1 AND empresa_id = $2
            `, [dados.cliente_id, empresa_id]);

            if (checkIntegridade.rows.length === 0) {
                return res.status(403).json({ error: 'O cliente selecionado não pertence a esta empresa ou não existe.' });
            }

            await client.query('BEGIN');

            // 1. Busca componentes com JOIN seguro (Multi-Tenant)
            const componentes = await client.query(`
                SELECT ct.*, i.id as insumo_id, i.preco_unitario, 
                       i.peso_metro, i.tipo, i.codigo as insumo_codigo, i.descricao as insumo_descricao
                FROM componentes_tipologia ct
                JOIN insumos i ON ct.insumo_id = i.id
                WHERE ct.tipologia_id = $1 AND i.empresa_id = $2
            `, [dados.projeto_id, empresa_id]);

            if (componentes.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: 'Esta tipologia não possui componentes cadastrados ou não pertence à sua empresa.' 
                });
            }

            const larguraMetros = dados.largura_mm / 1000;
            const alturaMetros = dados.altura_mm / 1000;
            const itensParaCalcular = [];

            // 2. Resolve fórmulas dinâmicas
            for (const comp of componentes.rows) {
                let metragemLinearNecessaria = 0;

                if (comp.tipo === 'aluminio') {
                    if (comp.formula_largura) {
                        metragemLinearNecessaria += calcularMetragemPorFormula(
                            comp.formula_largura,
                            dados.largura_mm,
                            dados.altura_mm
                        ) * comp.quantidade_base;
                    }
                    if (comp.formula_altura) {
                        metragemLinearNecessaria += calcularMetragemPorFormula(
                            comp.formula_altura,
                            dados.largura_mm,
                            dados.altura_mm
                        ) * comp.quantidade_base;
                    }
                } else {
                    // Se não for alumínio, assume-se a quantidade base fixa
                    metragemLinearNecessaria = comp.quantidade_base;
                }

                // O PUSH DEVE ESTAR FORA DOS IFS, DENTRO DO FOR
                itensParaCalcular.push({
                    codigoPerfil: comp.insumo_codigo,
                    descricao: comp.insumo_descricao,
                    pesoMetro: Number(comp.peso_metro) || 0,
                    precoKg: Number(comp.preco_unitario) || 0,
                    metroLinearNecessaria: metragemLinearNecessaria || 0 
                });
            } // Fim do loop for (agora está correto)

            // 3. Processa motor de cálculo
            const resultadoMecanico = calcularLotePerfis(itensParaCalcular);

            // 4. Persiste no Banco de Dados
            const novoOrcamento = await client.query(`
                INSERT INTO orcamentos (
                    empresa_id, projeto_id, cliente_id, endereco_obra_id, 
                    largura_mm, altura_mm, custo_material, mao_de_obra, valor_total, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id
            `, [
                empresa_id, dados.projeto_id, dados.cliente_id, dados.endereco_obra_id,
                dados.largura_mm, dados.altura_mm, resultadoMecanico.totais.totalPreco, 
                dados.mao_de_obra, (resultadoMecanico.totais.totalPreco + dados.mao_de_obra), dados.status
            ]);

            const orcamentoId = novoOrcamento.rows[0].id;

            await client.query('COMMIT');

            return res.status(201).json({
                sucesso: true,
                orcamento_id: orcamentoId,
                resumo: {
                    valor_final: resultadoMecanico.totais.totalPreco + dados.mao_de_obra,
                    total_barras_6m: resultadoMecanico.totais.totalBarras
                }
            });

        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }

   } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Dados do orçamento inválidos', detalhes: error.errors });
        }
        // MODIFIQUE ESTA LINHA:
        console.error('[Orçamentos] Erro crítico detalhado:', error); 
        return res.status(500).json({ error: 'Erro interno', detalhes: error.message });
    }
};

export const obterListasProducao = async (req, res) => {
    try {
        const empresa_id = req.empresa_id;
        // Exemplo básico de listagem para não quebrar o sistema
        const result = await pool.query('SELECT * FROM orcamentos WHERE empresa_id = $1', [empresa_id]);
        return res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao buscar listas de produção' });
    }
};