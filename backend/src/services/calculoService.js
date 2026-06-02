/**
 * calculoService.js - Motor de Cálculo com Integração ao Banco (MaxSigma)
 * ------------------------------------------------------------------
 * ✅ Matemática pura isolada
 * ✅ Sanitização rigorosa de fórmulas
 * ✅ Conversão consistente de unidades (mm ↔ metros)
 * ✅ Tipagem forte e tratamento de erros
 * ------------------------------------------------------------------
 */

import pool from '../config/db.js';

const COMPRIMENTO_BARRA_METROS = 6;
const COMPRIMENTO_BARRA_MM = 6000;

// ============================================
// 1. FUNÇÕES MATEMÁTICAS PURAS (Nível Base)
// ============================================

/**
 * Calcula quantidade de barras necessárias (arredonda SEMPRE para cima)
 */
function calcularBarrasNecessarias(metroLinearNecessario) {
    if (metroLinearNecessario <= 0) return 0;
    if (typeof metroLinearNecessario !== 'number' || isNaN(metroLinearNecessario)) {
        throw new Error('[calculoService] metroLinearNecessario deve ser um número válido');
    }
    return Math.ceil(metroLinearNecessario / COMPRIMENTO_BARRA_METROS);
}

/**
 * Calcula metragem linear total baseada nas barras
 */
function calcularMetroLinearTotal(barrasNecessarias) {
    if (barrasNecessarias < 0) return 0;
    return barrasNecessarias * COMPRIMENTO_BARRA_METROS;
}

/**
 * Calcula peso total em KG
 */
function calcularPesoTotal(metroLinearTotal, pesoMetro) {
    if (metroLinearTotal <= 0 || pesoMetro <= 0) return 0;
    const peso = metroLinearTotal * pesoMetro;
    return Number(peso.toFixed(3));
}

/**
 * Calcula preço total baseado no peso
 */
function calcularPrecoTotal(pesoTotalKg, precoKg) {
    if (pesoTotalKg <= 0 || precoKg <= 0) return 0;
    const preco = pesoTotalKg * precoKg;
    return Number(preco.toFixed(2));
}

// ============================================
// 2. FUNÇÃO PRINCIPAL PARA CÁLCULO DE PERFIL
// ============================================

/**
 * Calcula métricas completas para um perfil de alumínio
 */
export function calcularItemPerfil({ pesoMetro, precoKg, metroLinearNecessario, codigoPerfil = null }) {
    // Validações robustas
    if (metroLinearNecessario <= 0) {
        return {
            barrasNecessarias: 0,
            metroLinearTotal: 0,
            pesoTotalKg: 0,
            precoTotal: 0,
            desperdicioMetros: 0,
            percentualDesperdicio: 0
        };
    }

    if (pesoMetro <= 0 || precoKg <= 0) {
        console.warn(`[calculoService] Valores inválidos - pesoMetro: ${pesoMetro}, precoKg: ${precoKg}, codigo: ${codigoPerfil}`);
    }

    const barrasNecessarias = calcularBarrasNecessarias(metroLinearNecessario);
    const metroLinearTotal = calcularMetroLinearTotal(barrasNecessarias);
    const pesoTotalKg = calcularPesoTotal(metroLinearTotal, pesoMetro);
    const precoTotal = calcularPrecoTotal(pesoTotalKg, precoKg);
    
    const desperdicioMetros = Number((metroLinearTotal - metroLinearNecessario).toFixed(3));
    const percentualDesperdicio = metroLinearNecessario > 0 
        ? Number(((desperdicioMetros / metroLinearNecessario) * 100).toFixed(2))
        : 0;

    return {
        barrasNecessarias,
        metroLinearTotal,
        pesoTotalKg,
        precoTotal,
        desperdicioMetros,
        percentualDesperdicio
    };
}

// ============================================
// 3. SEGURANÇA: PARSER DE FÓRMULAS MATEMÁTICAS
// ============================================

/**
 * Sanitiza e avalia fórmulas matemáticas (ex: "L * 2 + H * 2")
 * 🔒 SEGURANÇA: Remove qualquer caractere não matemático
 * 
 * @param {Object} params
 * @param {number} params.largura - Largura em METROS (NÃO mm)
 * @param {number} params.altura - Altura em METROS (NÃO mm)
 * @param {string} params.formula - Fórmula matemática (ex: "L * 2 + H * 2")
 * @param {number} params.quantidade - Quantidade de peças (padrão 1)
 * @returns {number} Metragem linear total em METROS
 */
export function calcularMetragemPorFormula({ largura, altura, formula, quantidade = 1 }) {
    if (!formula || typeof formula !== 'string') {
        throw new Error('[calculoService] Fórmula inválida ou não fornecida');
    }

    // Validação de tipos
    if (typeof largura !== 'number' || isNaN(largura) || largura <= 0) {
        throw new Error(`[calculoService] Largura inválida: ${largura}`);
    }
    if (typeof altura !== 'number' || isNaN(altura) || altura <= 0) {
        throw new Error(`[calculoService] Altura inválida: ${altura}`);
    }

    // 🔒 SANITIZAÇÃO RIGOROSA: Permite apenas números, operadores matemáticos e L/H
    let expressao = formula
        .toUpperCase()
        .replace(/L/g, String(largura))
        .replace(/H/g, String(altura))
        // Permite: números, +, -, *, /, ., (, ), espaços
        .replace(/[^0-9+\-*/().\s]/g, '');
    
    // Validação extra: verifica se a expressão está vazia após sanitização
    if (!expressao.trim()) {
        throw new Error(`[calculoService] Fórmula sanitizada ficou vazia: ${formula}`);
    }

    let metroPorPeca = 0;
    try {
        // ⚠️ Nota: new Function é seguro pois a string foi rigorosamente sanitizada
        metroPorPeca = new Function(`return (${expressao});`)();
        
        if (typeof metroPorPeca !== 'number' || isNaN(metroPorPeca) || !isFinite(metroPorPeca)) {
            throw new Error(`Resultado inválido: ${metroPorPeca}`);
        }
    } catch (err) {
        console.error(`[calculoService] Erro na fórmula "${formula}" → expressão: "${expressao}"`, err.message);
        throw new Error(`Fórmula inválida: ${formula}. Detalhe: ${err.message}`);
    }
    
    const metragemTotal = metroPorPeca * quantidade;
    
    // Log para debug (apenas desenvolvimento)
    if (process.env.NODE_ENV === 'development') {
        console.log(`[calculoService] 📐 Fórmula: ${formula} → ${metroPorPeca.toFixed(3)}m/peça → ${metragemTotal.toFixed(3)}m total`);
    }
    
    return Number(metragemTotal.toFixed(3));
}

/**
 * Versão que aceita largura/altura em MM e converte automaticamente
 * (Interface mais amigável para o controller)
 */
export function calcularMetragemPorFormulaMM({ larguraMM, alturaMM, formula, quantidade = 1 }) {
    const larguraMetros = larguraMM / 1000;
    const alturaMetros = alturaMM / 1000;
    return calcularMetragemPorFormula({
        largura: larguraMetros,
        altura: alturaMetros,
        formula,
        quantidade
    });
}

// ============================================
// 4. INTEGRAÇÃO COM BANCO DE DADOS
// ============================================

/**
 * Busca o insumo no banco pelo código e aplica o cálculo completo
 */
export async function calcularInsumoPorCodigo(codigo, metroLinearNecessario, empresaId = 1) {
    if (!codigo || typeof codigo !== 'string') {
        throw new Error('[calculoService] Código do insumo inválido');
    }
    
    if (typeof metroLinearNecessario !== 'number' || metroLinearNecessario <= 0) {
        throw new Error('[calculoService] Metragem linear necessária inválida');
    }

    const query = `
        SELECT codigo, descricao, peso_metro, preco_unitario, tipo
        FROM insumos 
        WHERE empresa_id = $1 AND UPPER(codigo) = UPPER($2)
        LIMIT 1;
    `;

    try {
        const resultado = await pool.query(query, [empresaId, codigo]);

        if (resultado.rows.length === 0) {
            throw new Error(`Insumo com código "${codigo}" não encontrado`);
        }

        const insumo = resultado.rows[0];
        
        const metricasCalculadas = calcularItemPerfil({
            pesoMetro: Number(insumo.peso_metro),
            precoKg: Number(insumo.preco_unitario),
            metroLinearNecessario: metroLinearNecessario,
            codigoPerfil: insumo.codigo
        });

        return {
            sucesso: true,
            dadosInsumo: {
                codigo: insumo.codigo,
                descricao: insumo.descricao,
                tipo: insumo.tipo,
                pesoMetroOriginal: Number(insumo.peso_metro),
                precoKgOriginal: Number(insumo.preco_unitario)
            },
            calculo: metricasCalculadas
        };

    } catch (error) {
        console.error(`[calculoService] Erro:`, error.message);
        return {
            sucesso: false,
            erro: error.message
        };
    }
}

/**
 * Cálculo em lote para múltiplos perfis
 */
export function calcularLotePerfis(itens) {
    if (!itens || !Array.isArray(itens) || itens.length === 0) {
        return {
            itens: [],
            totais: {
                totalBarras: 0,
                totalMetros: 0,
                totalPesoKg: 0,
                totalPreco: 0,
                totalDesperdicioMetros: 0
            }
        };
    }

    const resultadosIndividuais = itens.map(item => {
        const resultado = calcularItemPerfil({
            pesoMetro: item.pesoMetro,
            precoKg: item.precoKg,
            metroLinearNecessario: item.metroLinearNecessario,
            codigoPerfil: item.codigoPerfil
        });

        return {
            codigoPerfil: item.codigoPerfil || 'desconhecido',
            ...resultado
        };
    });

    const totais = resultadosIndividuais.reduce((acc, item) => {
        acc.totalBarras += item.barrasNecessarias;
        acc.totalMetros += item.metroLinearTotal;
        acc.totalPesoKg += item.pesoTotalKg;
        acc.totalPreco += item.precoTotal;
        acc.totalDesperdicioMetros += item.desperdicioMetros;
        return acc;
    }, {
        totalBarras: 0,
        totalMetros: 0,
        totalPesoKg: 0,
        totalPreco: 0,
        totalDesperdicioMetros: 0
    });

    totais.totalPesoKg = Number(totais.totalPesoKg.toFixed(3));
    totais.totalPreco = Number(totais.totalPreco.toFixed(2));
    totais.totalDesperdicioMetros = Number(totais.totalDesperdicioMetros.toFixed(3));

    return {
        itens: resultadosIndividuais,
        totais
    };
}

export const CONSTANTES = {
    COMPRIMENTO_BARRA_METROS,
    COMPRIMENTO_BARRA_MM
};