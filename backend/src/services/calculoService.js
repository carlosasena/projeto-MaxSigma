const COMPRIMENTO_BARRA_METROS = 6;

export function calcularItemPerfil({ pesoMetro, precoKg, metroLinearNecessario }) {
    // Garante que os valores sejam números válidos
    const peso = parseFloat(pesoMetro) || 0;
    const preco = parseFloat(precoKg) || 0;
    const metros = parseFloat(metroLinearNecessario) || 0;
    
    if (peso === 0 || preco === 0 || metros === 0) {
        console.warn('Valores zerados para cálculo:', { peso, preco, metros });
    }
    
    const barrasNecessarias = Math.ceil(metros / COMPRIMENTO_BARRA_METROS);
    const metroLinearTotal = barrasNecessarias * COMPRIMENTO_BARRA_METROS;
    const pesoTotalKg = Number((metroLinearTotal * peso).toFixed(3));
    const precoTotal = Number((pesoTotalKg * preco).toFixed(2));
    const desperdicioMetros = Number((metroLinearTotal - metros).toFixed(3));

    return { 
        barrasNecessarias, 
        metroLinearTotal, 
        pesoTotalKg, 
        precoTotal, 
        desperdicioMetros 
    };
}

export function calcularLotePerfis(itens) {
    // Validação de entrada
    if (!Array.isArray(itens) || itens.length === 0) {
        console.warn('calcularLotePerfis: Lista de itens vazia ou inválida');
        return { 
            resultadosIndividuais: [], 
            totais: { 
                totalBarras: 0, 
                totalMetros: 0, 
                totalPesoKg: 0, 
                totalPreco: 0, 
                totalDesperdicioMetros: 0 
            } 
        };
    }

    console.log(`calcularLotePerfis: Processando ${itens.length} itens`);

    const resultadosIndividuais = itens.map((item, index) => {
        // LOG para debug
        console.log(`Item ${index}:`, {
            codigo: item.codigo,
            pesoMetro: item.pesoMetro,
            precoKg: item.precoKg,
            metroLinearNecessario: item.metroLinearNecessario
        });

        const resultado = calcularItemPerfil({
            pesoMetro: item.pesoMetro || 0,
            precoKg: item.precoKg || 0,
            metroLinearNecessario: item.metroLinearNecessario || 0
        });

        return { 
            codigoPerfil: item.codigo || 'desconhecido', 
            ...resultado 
        };
    });

    const totais = resultadosIndividuais.reduce((acc, item) => {
        acc.totalBarras += item.barrasNecessarias || 0;
        acc.totalMetros += item.metroLinearTotal || 0;
        acc.totalPesoKg += item.pesoTotalKg || 0;
        acc.totalPreco += item.precoTotal || 0;
        acc.totalDesperdicioMetros += item.desperdicioMetros || 0;
        return acc;
    }, { 
        totalBarras: 0, 
        totalMetros: 0, 
        totalPesoKg: 0, 
        totalPreco: 0, 
        totalDesperdicioMetros: 0 
    });

    console.log('Resultado totais:', totais);

    return { resultadosIndividuais, totais };
}

// Interpretador matemático seguro de fórmulas estruturais (Ex: "L - 0.04")
export function calcularMetragemPorFormula(formula, larguraMM, alturaMM) {
    if (!formula) return 0;
    
    const L = larguraMM / 1000;
    const H = alturaMM / 1000;
    
    // Substitui L e H, mas garante que a string resultante seja matemática pura
    let expressao = formula.toString().toUpperCase();
    expressao = expressao.replace(/L/g, L.toString());
    expressao = expressao.replace(/H/g, H.toString());
    
    // Remove qualquer caractere que não seja número ou operador matemático
    expressao = expressao.replace(/[^0-9+\-*/().]/g, '');
            
    try {
        const resultado = eval(expressao); // 'eval' é seguro aqui pois limpamos a string acima
        return isNaN(resultado) ? 0 : Number(resultado);
    } catch (e) {
        console.error("Erro ao calcular fórmula:", formula, e);
        return 0; 
    }
}