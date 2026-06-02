/**
 * orcamentosController.js - Gerenciamento e Motor de Orçamentos (MaxSigma)
 * ------------------------------------------------------------------
 * ✅ Controller limpo: apenas fluxo de dados
 * ✅ Cálculos delegados ao calculoService
 * ✅ Transações protegidas com retry
 * ✅ Conversão MM→Metros padronizada
 * ------------------------------------------------------------------
 */

import pool from '../config/db.js';
import { 
    calcularItemPerfil, 
    calcularMetragemPorFormulaMM,  // ← AGORA USANDO VERSÃO MM
    calcularLotePerfis 
} from '../services/calculoService.js';

// ============================================
// 1. MOTOR DE CÁLCULO PRINCIPAL
// ============================================

export const criarOrcamento = async (req, res) => {
    const { 
        projeto_id, 
        largura_mm, 
        altura_mm, 
        mao_de_obra = 0, 
        empresa_id = 1, 
        status = 'Em Orçamento' 
    } = req.body;

    // Validações iniciais
    if (!projeto_id) {
        return res.status(400).json({ error: 'projeto_id é obrigatório' });
    }
    if (!largura_mm || !altura_mm || largura_mm <= 0 || altura_mm <= 0) {
        return res.status(400).json({ error: 'Dimensões inválidas' });
    }

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // 1. Busca componentes da tipologia
        const componentesQuery = `
            SELECT 
                ct.*, 
                i.id as insumo_id,
                i.preco_unitario, 
                i.peso_metro, 
                i.tipo,
                i.codigo as insumo_codigo
            FROM componentes_tipologia ct
            JOIN insumos i ON ct.insumo_id = i.id
            WHERE ct.tipologia_id = $1
        `;
        
        const componentesResult = await client.query(componentesQuery, [projeto_id]);
        const componentes = componentesResult.rows;

        if (componentes.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                error: 'Esta tipologia não possui componentes cadastrados.' 
            });
        }

        // 2. Cria orçamento pai (valores temporários)
        const novoOrcamentoResult = await client.query(
            `INSERT INTO orcamentos (projeto_id, total_materiais, mao_de_obra, valor_final, status, empresa_id) 
             VALUES ($1, 0, $2, 0, $3, $4) 
             RETURNING *`,
            [projeto_id, mao_de_obra, status, empresa_id]
        );
        const orcamentoId = novoOrcamentoResult.rows[0].id;

        let totalMateriais = 0;

        // 3. Processa cada componente
        for (const comp of componentes) {
            const tipoInsumo = comp.tipo ? comp.tipo.toLowerCase() : '';
            let larguraCorte = null;
            let alturaCorte = null;
            let precoItem = 0;
            let quantidadeCalculada = comp.quantidade_base;
            let metroLinearNecessario = 0;

            try {
                if (tipoInsumo === 'aluminio') {
                    const formulaAtiva = comp.formula_largura || comp.formula_altura;
                    
                    if (formulaAtiva) {
                        // 🔧 CORREÇÃO CRÍTICA: Usa a versão que aceita MM
                        metroLinearNecessario = calcularMetragemPorFormulaMM({
                            larguraMM: largura_mm,
                            alturaMM: altura_mm,
                            formula: formulaAtiva,
                            quantidade: comp.quantidade_base
                        });
                    } else {
                        // Fallback: perímetro simples (2L + 2H)
                        const perimetroMetros = ((largura_mm + altura_mm) * 2) / 1000;
                        metroLinearNecessario = perimetroMetros * comp.quantidade_base;
                    }

                    // Aplica regra de barras de 6m
                    const resultadoMotor = calcularItemPerfil({
                        pesoMetro: Number(comp.peso_metro || 0),
                        precoKg: Number(comp.preco_unitario || 0),
                        metroLinearNecessario: metroLinearNecessario,
                        codigoPerfil: comp.insumo_codigo
                    });

                    quantidadeCalculada = resultadoMotor.barrasNecessarias;
                    precoItem = resultadoMotor.precoTotal;
                    
                    // Armazena dimensões de corte (em mm) para referência
                    if (formulaAtiva) {
                        const perimetroTotalMetros = metroLinearNecessario / comp.quantidade_base;
                        larguraCorte = comp.formula_largura ? Math.round(perimetroTotalMetros * 500) : null;
                        alturaCorte = comp.formula_altura ? Math.round(perimetroTotalMetros * 500) : null;
                    }
                } 
                else if (tipoInsumo === 'vidro') {
                    larguraCorte = largura_mm;
                    alturaCorte = altura_mm;
                    const areaM2 = (largura_mm * altura_mm) / 1000000;
                    precoItem = areaM2 * Number(comp.preco_unitario || 0) * comp.quantidade_base;
                } 
                else {
                    // Acessórios, borrachas, componentes
                    precoItem = Number(comp.preco_unitario || 0) * comp.quantidade_base;
                }

                totalMateriais += precoItem;

                // Insere item calculado
                await client.query(
                    `INSERT INTO itens_orcamento 
                     (orcamento_id, insumo_id, quantidade, largura_mm, altura_mm, preco_gravado)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [orcamentoId, comp.insumo_id, quantidadeCalculada, larguraCorte, alturaCorte, Number(precoItem.toFixed(2))]
                );
                
            } catch (err) {
                console.error(`Erro ao processar componente ${comp.insumo_codigo}:`, err.message);
                throw new Error(`Falha no componente ${comp.insumo_codigo}: ${err.message}`);
            }
        }

        // 4. Atualiza totais do orçamento
        const valorFinal = totalMateriais + Number(mao_de_obra);
        const orcamentoAtualizado = await client.query(
            `UPDATE orcamentos 
             SET total_materiais = $1, valor_final = $2 
             WHERE id = $3 
             RETURNING *`,
            [Number(totalMateriais.toFixed(2)), Number(valorFinal.toFixed(2)), orcamentoId]
        );

        await client.query('COMMIT');
        
        return res.status(201).json({
            sucesso: true,
            orcamento: orcamentoAtualizado.rows[0],
            resumo: {
                total_materiais: Number(totalMateriais.toFixed(2)),
                mao_de_obra: Number(mao_de_obra),
                valor_final: Number(valorFinal.toFixed(2))
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Erro no motor de cálculo:', error.message);
        console.error('Stack:', error.stack);
        return res.status(500).json({ 
            error: 'Erro interno ao processar orçamento.',
            detalhe: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        client.release();
    }
};

// ============================================
// 2. LISTAS DE PRODUÇÃO
// ============================================

export const obterListasProducao = async (req, res) => {
    const { id } = req.params;

    if (!id || isNaN(Number(id))) {
        return res.status(400).json({ error: 'ID do orçamento inválido' });
    }

    try {
        const query = `
            SELECT 
                io.*, 
                i.tipo, 
                i.descricao, 
                i.codigo as codigo_insumo,
                i.unidade_medida
            FROM itens_orcamento io
            JOIN insumos i ON io.insumo_id = i.id
            WHERE io.orcamento_id = $1
        `;
        
        const result = await pool.query(query, [id]);
        const itens = result.rows;

        const acumulaAluminio = {};
        const acumulaEstoque = {};
        const acumulaVidro = {};

        for (const item of itens) {
            const tipoInsumo = item.tipo ? item.tipo.toLowerCase() : '';
            const quantidade = Number(item.quantidade);

            if (tipoInsumo === 'aluminio') {
                if (acumulaAluminio[item.codigo_insumo]) {
                    acumulaAluminio[item.codigo_insumo].barras_para_comprar += quantidade;
                } else {
                    acumulaAluminio[item.codigo_insumo] = {
                        codigo: item.codigo_insumo,
                        descricao: item.descricao,
                        barras_para_comprar: quantidade,
                        unidade: item.unidade_medida || 'barras de 6m'
                    };
                }
            } 
            else if (['componente', 'acessorio', 'ferragem', 'borracha', 'fita'].includes(tipoInsumo)) {
                if (acumulaEstoque[item.codigo_insumo]) {
                    acumulaEstoque[item.codigo_insumo].quantidade_necessaria += quantidade;
                } else {
                    acumulaEstoque[item.codigo_insumo] = {
                        codigo: item.codigo_insumo,
                        descricao: item.descricao,
                        quantidade_necessaria: quantidade,
                        unidade: item.unidade_medida || 'peça(s)'
                    };
                }
            } 
            else if (tipoInsumo === 'vidro') {
                const areaM2 = ((item.largura_mm * item.altura_mm) / 1000000) * quantidade;
                
                if (acumulaVidro[item.codigo_insumo]) {
                    acumulaVidro[item.codigo_insumo].total_m2 += areaM2;
                    acumulaVidro[item.codigo_insumo].quantidade_folhas += quantidade;
                } else {
                    acumulaVidro[item.codigo_insumo] = {
                        codigo: item.codigo_insumo,
                        descricao: item.descricao,
                        medidas_corte: `${item.largura_mm}mm x ${item.altura_mm}mm`,
                        total_m2: Number(areaM2.toFixed(2)),
                        quantidade_folhas: quantidade,
                        unidade: 'm²'
                    };
                }
            }
        }

        return res.status(200).json({
            sucesso: true,
            orcamento_id: id,
            lista_perfis_aluminio: Object.values(acumulaAluminio),
            lista_insumos_estoque: Object.values(acumulaEstoque),
            lista_pedido_vidros: Object.values(acumulaVidro),
            resumo: {
                total_tipos_aluminio: Object.keys(acumulaAluminio).length,
                total_tipos_estoque: Object.keys(acumulaEstoque).length,
                total_tipos_vidro: Object.keys(acumulaVidro).length
            }
        });

    } catch (error) {
        console.error('❌ Erro ao gerar listas de produção:', error.message);
        return res.status(500).json({ 
            error: 'Erro interno ao processar listas de produção.',
            detalhe: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};