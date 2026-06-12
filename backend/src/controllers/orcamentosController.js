import pool from '../config/db.js';
import { z } from 'zod';
import { 
    calcularItemPerfil, 
    calcularMetragemPorFormula, // ✅ Certifique-se de que este é o nome exato exportado no seu calculoService.js
    calcularLotePerfis 
} from '../services/calculoService.js';

// Schema de validação (Sem empresa_id no corpo do JSON)
const orcamentoSchema = z.object({
    projeto_id: z.number().int().positive(),
    largura_mm: z.number().positive(),
    altura_mm: z.number().positive(),
    mao_de_obra: z.number().nonnegative().default(0),
    status: z.string().optional().default('Em Orçamento')
});

// 1. CRIAR ORÇAMENTO (Alinhado com o Motor de Cálculo e Multi-Tenant)
export const criarOrcamento = async (req, res) => {
    try {
        const empresa_id = req.empresa_id; // 🛡️ Segurança Multi-Tenant garantida
        
        if (!empresa_id) {
            return res.status(400).json({ error: 'Identificação da empresa (Tenant) ausente.' });
        }

        const dados = orcamentoSchema.parse(req.body);
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            // 1. Busca os componentes da tipologia e garante o JOIN com os insumos daquela EMPRESA
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

            // Converter as dimensões de MM para Metros para o motor de cálculo (se o seu motor esperar metros)
            const larguraMetros = dados.largura_mm / 1000;
            const alturaMetros = dados.altura_mm / 1000;

            const itensParaCalcular = [];

            // 2. Resolver as fórmulas dinâmicas para cada componente encontrado no JOIN
            for (const comp of componentes.rows) {
                let metragemLinearNecessaria = 0;

                if (comp.tipo === 'aluminio') {
                    // Executa a fórmula de LARGURA se existir
                    if (comp.formula_largura) {
                        metragemLinearNecessaria += calcularMetragemPorFormula({
                            largura: larguraMetros,
                            altura: alturaMetros,
                            formula: comp.formula_largura,
                            quantidade: comp.quantidade_base
                        });
                    }
                    // Executa a fórmula de ALTURA se existir
                    if (comp.formula_altura) {
                        metragemLinearNecessaria += calcularMetragemPorFormula({
                            largura: larguraMetros,
                            altura: alturaMetros,
                            formula: comp.formula_altura,
                            quantidade: comp.quantidade_base
                        });
                    }
                    
                    // Se não houver fórmula cadastrada, assume uma metragem padrão baseada na quantidade fixa
                    if (!comp.formula_largura && !comp.formula_altura) {
                        metragemLinearNecessaria = comp.quantidade_base;
                    }

                    itensParaCalcular.push({
                        codigoPerfil: comp.insumo_codigo,
                        descricao: comp.insumo_descricao,
                        pesoMetro: parseFloat(comp.peso_metro),
                        precoKg: parseFloat(comp.preco_unitario), // No alumínio, o preço unitário costuma ser o preço por KG
                        metroLinearNecessario: metragemLinearNecessaria
                    });
                }
            }

            // 3. Chamar o motor puro do calculoService para processar o lote de perfis (Barras de 6m, desperdício, etc)
            const resultadoMecanico = calcularLotePerfis(itensParaCalcular);

            // 4. Salva o Orçamento Principal no Banco de Dados
            const novoOrcamento = await client.query(`
                INSERT INTO orcamentos (empresa_id, tipologia_id, largura_mm, altura_mm, custo_material, mao_de_obra, valor_total, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING id, criado_em
            `, [
                empresa_id, 
                dados.projeto_id, 
                dados.largura_mm, 
                dados.altura_mm, 
                resultadoMecanico.totais.totalPreco, 
                dados.mao_de_obra,
                (resultadoMecanico.totais.totalPreco + dados.mao_de_obra),
                dados.status
            ]);

            const orcamentoId = novoOrcamento.rows[0].id;

            // 5. Opcional: Salvar os itens calculados na tabela de junção (ex: itens_orcamento) para auditoria futura
            // (Se você tiver essa tabela, insira os registros aqui dentro do laço)

            await client.query('COMMIT');

            // Retorna a resposta estruturada para o Front-end
            return res.status(201).json({
                sucesso: true,
                orcamento_id: orcamentoId,
                dados_projeto: {
                    largura_mm: dados.largura_mm,
                    altura_mm: dados.altura_mm,
                    status: dados.status
                },
                calculos_perfil: resultadoMecanico.resultadosIndividuais,
                resumo: {
                    custo_material: resultadoMecanico.totais.totalPreco,
                    mao_de_obra: dados.mao_de_obra,
                    valor_final: resultadoMecanico.totais.totalPreco + dados.mao_de_obra,
                    peso_total_kg: resultadoMecanico.totais.totalPesoKg,
                    total_barras_6m: resultadoMecanico.totais.totalBarras,
                    desperdicio_linear_m: resultadoMecanico.totais.totalDesperdicioMetros
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
        console.error('[Orçamentos] Erro crítico ao calcular:', error.message);
        return res.status(500).json({ error: 'Erro interno no motor de cálculo do orçamento' });
    }
};

// 2. OBTER LISTAS DE PRODUÇÃO
export const obterListasProducao = async (req, res) => {
    // ... Mantém a lógica existente filtrando estritamente por req.empresa_id
};
