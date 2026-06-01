/**
 * Motor de Cálculo Avançado MaxSigma
 * Centraliza toda a matemática de engenharia, explosão de insumos e pesagem.
 * * @param {number} largura - Largura em mm (ex: 1500)
 * @param {number} altura - Altura em mm (ex: 1200)
 * @param {Array} composicao - Componentes vindos do banco (componentes_tipologia + insumos)
 */
export function calcularEstruturaEsquadria(largura, altura, composicao) {
  return composicao.map(item => {
    const tipoInsumo = item.tipo ? item.tipo.toLowerCase() : '';
    let tamanhoCorteMM = 0;

    // 1. IDENTIFICAÇÃO E RESOLUÇÃO DA FÓRMULA (Padronizado para L e H)
    // Se houver fórmula de largura ou altura, higieniza e calcula dinamicamente
    const formulaAtiva = item.formula_largura || item.formula_altura || '';
    
    if (formulaAtiva && typeof formulaAtiva === 'string') {
      let expressao = formulaAtiva
        .toUpperCase()
        .replace(/L/g, String(largura))
        .replace(/H/g, String(altura))
        .replace(/[^0-9+\-*/().\s]/g, ''); // 🛡️ Barreira de segurança: apenas matemática pura

      try {
        // Executa a fórmula matemática dinamicamente de maneira segura
        tamanhoCorteMM = new Function(`return (${expressao});`)();
      } catch (err) {
        console.error(`[Erro de Engenharia] Falha na fórmula: ${formulaAtiva}. Usando medida padrão.`, err.message);
        tamanhoCorteMM = tipoInsumo === 'vidro' ? altura : altura;
      }
    } else {
      // Medida padrão caso não haja fórmula cadastrada
      tamanhoCorteMM = tipoInsumo === 'vidro' ? altura : altura;
    }

    // 2. EXPLOSÃO EM BARRAS (REGRA ESTRETA DO CARLOS)
    const quantidadePecasTotal = Number(item.quantidade_base || 1);
    const corteTotalNecessarioMM = tamanhoCorteMM * quantidadePecasTotal;
    const tamanhoBarraMM = 6000; // Barra padrão de 6 metros
    
    let quantidadeCalculada = quantidadePecasTotal; // Padrão para vidros e estoque
    let precoItem = Number(item.preco_unitario || 0) * quantidadePecasTotal;
    let pesoTotalKg = 0;

    if (tipoInsumo === 'aluminio') {
      const totalMetrosItem = corteTotalNecessarioMM / 1000;
      
      // Arredonda SEMPRE para cima na casa das barras de 6 metros
      const barrasAComprar = Math.ceil(totalMetrosItem / 6);
      
      quantidadeCalculada = barrasAComprar; // Quantidade vira o número de barras inteiras
      precoItem = barrasAComprar * Number(item.preco_unitario || 0);
      
      // Calcula o peso real do alumínio consumido
      pesoTotalKg = totalMetrosItem * parseFloat(item.peso_metro || 0);
    } 
    else if (tipoInsumo === 'vidro') {
      // Se for vidro, calcula a área em m²
      const m2 = ((largura * altura) / 1000000) * quantidadePecasTotal; // Utiliza largura e altura da esquadria ou corte se preferir
      precoItem = m2 * Number(item.preco_unitario || 0);
    }

    return {
      insumo_id: item.insumo_id,
      tipo: tipoInsumo,
      quantidade: quantidadeCalculada,
      largura_mm: tipoInsumo === 'vidro' ? largura : (item.formula_largura ? tamanhoCorteMM : null),
      altura_mm: tipoInsumo === 'vidro' ? altura : (item.formula_altura ? tamanhoCorteMM : null),
      preco_gravado: Number(precoItem.toFixed(2)),
      peso_total_kg: Number(pesoTotalKg.toFixed(3))
    };
  });
}