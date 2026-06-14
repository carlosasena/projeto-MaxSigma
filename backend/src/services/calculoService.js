const COMPRIMENTO_BARRA_METROS = 6;

export function calcularItemPerfil({ pesoMetro, precoKg, metroLinearNecessario }) {
    const barrasNecessarias = Math.ceil(metroLinearNecessario / COMPRIMENTO_BARRA_METROS);
    const metroLinearTotal = barrasNecessarias * COMPRIMENTO_BARRA_METROS;
    const pesoTotalKg = Number((metroLinearTotal * pesoMetro).toFixed(3));
    const precoTotal = Number((pesoTotalKg * precoKg).toFixed(2));
    const desperdicioMetros = Number((metroLinearTotal - metroLinearNecessario).toFixed(3));

    return { barrasNecessarias, metroLinearTotal, pesoTotalKg, precoTotal, desperdicioMetros };
}

// Mapeado exatamente para a assinatura esperada pelo orcamentosController
export function calcularLotePerfis(itens) {
    if (!Array.isArray(itens) || itens.length === 0) {
        return { resultadosIndividuais: [], totais: { totalBarras: 0, totalMetros: 0, totalPesoKg: 0, totalPreco: 0, totalDesperdicioMetros: 0 } };
    }

    const resultadosIndividuais = itens.map(item => {
        const resultado = calcularItemPerfil({
            pesoMetro: item.peso_metro || item.pesoMetro,
            precoKg: item.preco_unitario || item.precoKg,
            metroLinearNecessario: item.metroLinearNecessario
        });
        return { codigoPerfil: item.codigo || 'desconhecido', ...resultado };
    });

    const totais = resultadosIndividuais.reduce((acc, item) => {
        acc.totalBarras += item.barrasNecessarias;
        acc.totalMetros += item.metroLinearTotal;
        acc.totalPesoKg += item.pesoTotalKg;
        acc.totalPreco += item.precoTotal;
        acc.totalDesperdicioMetros += item.desperdicioMetros;
        return acc;
    }, { totalBarras: 0, totalMetros: 0, totalPesoKg: 0, totalPreco: 0, totalDesperdicioMetros: 0 });

    return { resultadosIndividuais, totais };
}

// Interpretador matemático seguro de fórmulas estruturais (Ex: "L - 0.04")
export function calcularMetragemPorFormula(formula, larguraMM, alturaMM) {
    if (!formula) return 0;
    const L = larguraMM / 1000;
    const H = alturaMM / 1000;
    const expressaoLimpa = formula.toUpperCase().replace(/[^0-9+\-*/().LH]/g, '');
    try {
        const expressaoResolvida = expressaoLimpa.replace(/L/g, L.toString()).replace(/H/g, H.toString());
        const resultado = Function(`"use strict"; return (${expressaoResolvida})`)();
        return Number(resultado) > 0 ? Number(resultado) : 0;
    } catch {
        return 0; 
    }
}