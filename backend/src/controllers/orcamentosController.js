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
            SELECT 
                c.insumo_id, 
                i.codigo as insumo_codigo, 
                i.descricao as insumo_descricao, 
                i.peso_metro, 
                i.preco_unitario, 
                i.tipo,
                c.quantidade_base, 
                c.formula_largura, 
                c.formula_altura
            FROM componentes_tipologia c
            JOIN insumos i ON c.insumo_id = i.id
            WHERE c.tipologia_id = $1
        `, [dados.projeto_id]); // Use o ID da tipologia/projeto correto aqui
            console.log('Componentes encontrados:', JSON.stringify(componentes.rows, null, 2));

            if (componentes.rows.length === 0) {
                return res.status(404).json({ error: 'Nenhum componente encontrado para esta tipologia.' });
            }

            // REMOVA A LINHA: const itensParaCalcular = []; 

            // 2. Resolve fórmulas dinâmicas - VERSÃO CORRIGIDA
const itensParaCalcular = componentes.rows.map(comp => {
    // Garante que os valores sejam números
    const tipo = Number(comp.tipo);
    const quantidadeBase = parseFloat(comp.quantidade_base) || 1;
    const pesoMetro = parseFloat(comp.peso_metro) || 0;
    const precoKg = parseFloat(comp.preco_unitario) || 0;
    
    let metroLinearNecessario = 0;

    if (tipo === 3) {
        // Alumínio - usa fórmulas estruturais
        let metragemCalculada = 0;
        
        if (comp.formula_largura) {
            metragemCalculada += calcularMetragemPorFormula(
                comp.formula_largura, 
                dados.largura_mm, 
                dados.altura_mm
            );
        }
        if (comp.formula_altura) {
            metragemCalculada += calcularMetragemPorFormula(
                comp.formula_altura, 
                dados.largura_mm, 
                dados.altura_mm
            );
        }
        
        // Aplica a quantidade base (pode ser 1 ou mais)
        metroLinearNecessario = metragemCalculada * quantidadeBase;
        
    } 
    else {
        // Acessório (1) ou Vidro (2) - usa quantidade base diretamente
        // Neste caso, a quantidade_base representa a metragem ou quantidade necessária
        metroLinearNecessario = quantidadeBase;
    }

    // Retorna objeto com a nomenclatura CORRETA (metroLinearNecessario)
    return {
        codigo: comp.insumo_codigo || 'desconhecido',
        pesoMetro: pesoMetro,
        precoKg: precoKg,
        metroLinearNecessario: metroLinearNecessario // <-- NOME CORRETO
    };
});

// LOG PARA DEBUG (opcional, remova em produção)
console.log('Itens para calcular:', JSON.stringify(itensParaCalcular, null, 2));
           // 3. Processa motor de cálculo
const resultadoMecanico = calcularLotePerfis(itensParaCalcular);

// LOG DE VERIFICAÇÃO
console.log('RESULTADO MECANICO:', JSON.stringify(resultadoMecanico, null, 2));
console.log('Total Preco:', resultadoMecanico.totais.totalPreco);

// 4. Persiste no Banco de Dados
const novoOrcamento = await client.query(`
    INSERT INTO orcamentos (
        empresa_id, projeto_id, cliente_id, endereco_obra_id, 
        largura_mm, altura_mm, custo_material, mao_de_obra, valor_total, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id
`, [
    empresa_id, 
    dados.projeto_id, 
    dados.cliente_id, 
    dados.endereco_obra_id,
    dados.largura_mm, 
    dados.altura_mm, 
    resultadoMecanico.totais.totalPreco || 0, // Garante que não seja null
    dados.mao_de_obra || 0, 
    (resultadoMecanico.totais.totalPreco || 0) + (dados.mao_de_obra || 0), 
    dados.status || 'Em Orçamento'
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