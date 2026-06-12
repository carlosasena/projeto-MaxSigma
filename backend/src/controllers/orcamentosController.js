import pool from '../config/db.js';
import { z } from 'zod';
import { 
    calcularItemPerfil, 
    calcularMetragemPorFormulaMM,
    calcularLotePerfis 
} from '../services/calculoService.js';

// Schema de validação
const orcamentoSchema = z.object({
    projeto_id: z.number().int().positive(),
    largura_mm: z.number().positive(),
    altura_mm: z.number().positive(),
    mao_de_obra: z.number().nonnegative().default(0),
    empresa_id: z.number().int().positive().default(1),
    status: z.string().optional().default('Em Orçamento')
});

// 1. CRIAR ORÇAMENTO
export const criarOrcamento = async (req, res) => {
    try {
        const dados = orcamentoSchema.parse(req.body);
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // Busca componentes
            const componentes = await client.query(`
                SELECT ct.*, i.id as insumo_id, i.preco_unitario, 
                       i.peso_metro, i.tipo, i.codigo as insumo_codigo
                FROM componentes_tipologia ct
                JOIN insumos i ON ct.insumo_id = i.id
                WHERE ct.tipologia_id = $1
            `, [dados.projeto_id]);
            
            if (componentes.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: 'Tipologia sem componentes cadastrados' 
                });
            }
            
            // Cria orçamento
            const orcamento = await client.query(
                `INSERT INTO orcamentos (projeto_id, total_materiais, mao_de_obra, valor_final, status, empresa_id) 
                 VALUES ($1, 0, $2, 0, $3, $4) RETURNING *`,
                [dados.projeto_id, dados.mao_de_obra, dados.status, dados.empresa_id]
            );
            const orcamentoId = orcamento.rows[0].id;
            
            let totalMateriais = 0;
            
            // Processa cada componente
            for (const comp of componentes.rows) {
                let precoItem = 0;
                let quantidadeCalculada = comp.quantidade_base;
                
                if (comp.tipo === 'aluminio') {
                    const formulaAtiva = comp.formula_largura || comp.formula_altura;
                    
                    const metroLinear = formulaAtiva
                        ? calcularMetragemPorFormulaMM({
                            larguraMM: dados.largura_mm,
                            alturaMM: dados.altura_mm,
                            formula: formulaAtiva,
                            quantidade: comp.quantidade_base
                        })
                        : ((dados.largura_mm + dados.altura_mm) * 2 / 1000) * comp.quantidade_base;
                    
                    const resultado = calcularItemPerfil({
                        pesoMetro: Number(comp.peso_metro || 0),
                        precoKg: Number(comp.preco_unitario || 0),
                        metroLinearNecessario: metroLinear
                    });
                    
                    quantidadeCalculada = resultado.barrasNecessarias;
                    precoItem = resultado.precoTotal;
                } 
                else if (comp.tipo === 'vidro') {
                    const areaM2 = (dados.largura_mm * dados.altura_mm) / 1000000;
                    precoItem = areaM2 * Number(comp.preco_unitario || 0) * comp.quantidade_base;
                } 
                else {
                    precoItem = Number(comp.preco_unitario || 0) * comp.quantidade_base;
                }
                
                totalMateriais += precoItem;
                
                await client.query(
                    `INSERT INTO itens_orcamento (orcamento_id, insumo_id, quantidade, preco_gravado)
                     VALUES ($1, $2, $3, $4)`,
                    [orcamentoId, comp.insumo_id, quantidadeCalculada, Number(precoItem.toFixed(2))]
                );
            }
            
            // Atualiza totais
            const valorFinal = totalMateriais + Number(dados.mao_de_obra);
            const atualizado = await client.query(
                `UPDATE orcamentos SET total_materiais = $1, valor_final = $2 
                 WHERE id = $3 RETURNING *`,
                [Number(totalMateriais.toFixed(2)), Number(valorFinal.toFixed(2)), orcamentoId]
            );
            
            await client.query('COMMIT');
            
            return res.status(201).json({
                sucesso: true,
                orcamento: atualizado.rows[0],
                resumo: {
                    total_materiais: Number(totalMateriais.toFixed(2)),
                    mao_de_obra: Number(dados.mao_de_obra),
                    valor_final: Number(valorFinal.toFixed(2))
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
            return res.status(400).json({ error: 'Dados inválidos', detalhes: error.errors });
        }
        
        console.error('[Orçamentos] Erro:', error.message);
        return res.status(500).json({ 
            error: 'Erro ao processar orçamento',
            detalhe: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// 2. LISTAS DE PRODUÇÃO
export const obterListasProducao = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id || isNaN(Number(id))) {
            return res.status(400).json({ error: 'ID inválido' });
        }
        
        const itens = await pool.query(`
            SELECT io.*, i.tipo, i.descricao, i.codigo as codigo_insumo, i.unidade_medida
            FROM itens_orcamento io
            JOIN insumos i ON io.insumo_id = i.id
            WHERE io.orcamento_id = $1
        `, [id]);
        
        // Agrupa por categoria
        const aluminio = {};
        const estoque = {};
        const vidro = {};
        
        for (const item of itens.rows) {
            const tipo = (item.tipo || '').toLowerCase();
            const qtd = Number(item.quantidade);
            
            if (tipo === 'aluminio') {
                aluminio[item.codigo_insumo] = {
                    codigo: item.codigo_insumo,
                    descricao: item.descricao,
                    barras_para_comprar: (aluminio[item.codigo_insumo]?.barras_para_comprar || 0) + qtd,
                    unidade: 'barras de 6m'
                };
            } 
            else if (tipo === 'vidro') {
                const areaM2 = ((item.largura_mm || 0) * (item.altura_mm || 0)) / 1000000 * qtd;
                vidro[item.codigo_insumo] = {
                    codigo: item.codigo_insumo,
                    descricao: item.descricao,
                    total_m2: (vidro[item.codigo_insumo]?.total_m2 || 0) + Number(areaM2.toFixed(2)),
                    quantidade_folhas: (vidro[item.codigo_insumo]?.quantidade_folhas || 0) + qtd
                };
            } 
            else {
                estoque[item.codigo_insumo] = {
                    codigo: item.codigo_insumo,
                    descricao: item.descricao,
                    quantidade_necessaria: (estoque[item.codigo_insumo]?.quantidade_necessaria || 0) + qtd
                };
            }
        }
        
        return res.status(200).json({
            sucesso: true,
            orcamento_id: parseInt(id),
            lista_perfis_aluminio: Object.values(aluminio),
            lista_insumos_estoque: Object.values(estoque),
            lista_pedido_vidros: Object.values(vidro),
            resumo: {
                total_tipos_aluminio: Object.keys(aluminio).length,
                total_tipos_estoque: Object.keys(estoque).length,
                total_tipos_vidro: Object.keys(vidro).length
            }
        });
        
    } catch (error) {
        console.error('[Listas] Erro:', error.message);
        return res.status(500).json({ error: 'Erro ao gerar listas de produção' });
    }
};
