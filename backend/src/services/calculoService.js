// backend/src/services/calculoService.js

/**
 * Motor de Cálculo MaxSigma
 * @param {number} largura - Largura em mm (ex: 1500)
 * @param {number} altura - Altura em mm (ex: 1200)
 * @param {Array} composicao - Lista de perfis trazidos do banco com suas fórmulas e pesos
 */
export function calcularEstruturaEsquadria(largura, altura, composicao) {
  return composicao.map(item => {
    let tamanhoCorteMM = 0;
    const formula = item.formula.toUpperCase().trim();

    // Interpretador básico de fórmulas de engenharia do MaxSigma
    if (formula === 'W') {
      tamanhoCorteMM = largura;
    } else if (formula === 'H') {
      tamanhoCorteMM = altura;
    } else if (formula === 'H - 45') {
      tamanhoCorteMM = altura - 45;
    } else if (formula === 'W / 2') {
      tamanhoCorteMM = largura / 2;
    } else {
      // Caso seja uma folha de vidro ou medida fixa
      tamanhoCorteMM = altura; 
    }

    // Regra de cálculo do Carlos: Barra de 6m (6000mm) arredondando SEMPRE para cima
    const quantidadePecasTotal = item.quantidade_pecas || 1;
    const corteTotalNecessarioMM = tamanhoCorteMM * quantidadePecasTotal;
    const tamanhoBarraMM = 6000;
    
    // Math.ceil faz o arredondamento estrito para cima (ex: 1.1 barras vira 2)
    const barrasAComprar = Math.ceil(corteTotalNecessarioMM / tamanhoBarraMM);
    
    // Peso total em KG do alumínio consumido
    const metrosLineares = corteTotalNecessarioMM / 1000;
    const pesoTotalKg = metrosLineares * parseFloat(item.peso_metro || 0);

    return {
      insumo_id: item.insumo_id,
      codigo: item.codigo,
      descricao: item.descricao,
      linha: item.linha,
      tamanho_corte_mm: tamanhoCorteMM,
      quantidade_cortes: quantidadePecasTotal,
      barras_necessarias: barrasAComprar,
      peso_total_kg: parseFloat(pesoTotalKg.toFixed(3))
    };
  });
}