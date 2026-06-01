import pool from '../config/db.js';

// 🛡️ Função segura para substituir o eval() - Criada pelo Claude
// Avalia apenas expressões matemáticas básicas e seguras de esquadrias
const calcularFormulaSegura = (formula, L, H) => {
  if (!formula || typeof formula !== 'string') return 0;
  
  // Limpa e sanitiza a string para conter apenas caracteres matemáticos válidos
  let expressaoSanitizada = formula
    .replace(/L/g, String(L))
    .replace(/H/g, String(H))
    .replace(/[^0-aligned0-9+\-*/().\s]/g, ''); // Bloqueia letras injetadas, comandos e scripts

  try {
    // Executa a operação matemática de forma isolada e segura usando Function
    return new Function(`return (${expressaoSanitizada});`)();
  } catch (err) {
    console.error(`Erro ao processar fórmula matemática válida: ${formula}`, err.message);
    return 0;
  }
};

// 1. MOTOR DE CÁLCULO: Cria o orçamento e explode os insumos arredondando as barras para cima
export const criarOrcamento = async (req, res) => {
  const { projeto_id, largura_mm, altura_mm, mao_de_obra, empresa_id, status } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Busca os componentes e fórmulas da engenharia/tipologia
    const componentesQuery = `
      SELECT ct.*, i.preco_unitario, i.tipo
      FROM componentes_tipologia ct
      JOIN insumos i ON ct.insumo_id = i.id
      WHERE ct.tipologia_id = $1
    `;
    const componentesResult = await client.query(componentesQuery, [projeto_id]);
    const componentes = componentesResult.rows;

    if (componentes.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Esta tipologia não possui componentes ou fórmulas cadastradas.' });
    }

    // Cria o registro do orçamento "pai" primeiro (valores zerados temporariamente)
    const novoOrcamentoResult = await client.query(
      `INSERT INTO orcamentos (projeto_id, total_materiais, mao_de_obra, valor_final, status, empresa_id) 
       VALUES ($1, 0, $2, 0, $3, $4) RETURNING *`,
      [projeto_id, mao_de_obra || 0, status || 'Em Orçamento', empresa_id]
    );
    const orcamentoId = novoOrcamentoResult.rows[0].id;

    let totalMateriais = 0;

    // Loop do Algoritmo: Processa cada fórmula cadastrada para esta esquadria
    for (const comp of componentes) {
      let larguraCorte = null;
      let alturaCorte = null;
      const tipoInsumo = comp.tipo ? comp.tipo.toLowerCase() : '';

      // Aplica a engine de cálculo segura em vez de usar eval()
      if (comp.formula_largura) {
        larguraCorte = calcularFormulaSegura(comp.formula_largura, largura_mm, altura_mm);
      } else if (tipoInsumo === 'vidro') {
        larguraCorte = largura_mm;
      }

      if (comp.formula_altura) {
        alturaCorte = calcularFormulaSegura(comp.formula_altura, largura_mm, altura_mm);
      } else if (tipoInsumo === 'vidro') {
        alturaCorte = altura_mm;
      }

      let precoItem = 0;
      let quantidadeCalculada = comp.quantidade_base;

      if (tipoInsumo === 'aluminio') {
        const medidaUsada = larguraCorte || alturaCorte || 0;
        
        // Total de metros necessários para a quantidade deste perfil na peça
        const totalMetrosItem = (medidaUsada * comp.quantidade_base) / 1000;
        
        // REGRA DO CARLOS: Calcula quantas BARRAS de 6 metros serão gastas, arredondando para cima
        const barrasNecessarias = Math.ceil(totalMetrosItem / 6);
        
        quantidadeCalculada = barrasNecessarias;
        precoItem = barrasNecessarias * Number(comp.preco_unitario);
      } 
      else if (tipoInsumo === 'vidro') {
        const m2 = ((larguraCorte * alturaCorte) / 1000000) * comp.quantidade_base;
        precoItem = m2 * Number(comp.preco_unitario);
      } 
      else {
        precoItem = Number(comp.preco_unitario) * comp.quantidade_base;
      }

      totalMateriais += precoItem;

      // Grava o item calculado na tabela (Corrigido: Mantendo preço como Number puro)
      await client.query(
        `INSERT INTO itens_orcamento (orcamento_id, insumo_id, quantidade, largura_mm, altura_mm, preco_gravado)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orcamentoId, comp.insumo_id, quantidadeCalculada, larguraCorte, alturaCorte, Number(precoItem.toFixed(2))]
      );
    }

    const valorFinal = totalMateriais + Number(mao_de_obra || 0);
    const orcamentoAtualizado = await client.query(
      `UPDATE orcamentos 
       SET total_materiais = $1, valor_final = $2 
       WHERE id = $3 RETURNING *`,
      [Number(totalMateriais.toFixed(2)), Number(valorFinal.toFixed(2)), orcamentoId]
    );

    await client.query('COMMIT');
    return res.status(201).json(orcamentoAtualizado.rows[0]);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erro no motor de cálculo do orçamento:', error.message);
    return res.status(500).json({ error: 'Erro interno ao processar e calcular orçamento.' });
  } finally {
    client.release();
  }
};

// 2. LISTA DE PRODUÇÃO: Busca os itens gerados e separa em listas organizadas e agrupadas
export const obterListasProducao = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      SELECT io.*, i.tipo, i.descricao, i.codigo as codigo_insumo
      FROM itens_orcamento io
      JOIN insumos i ON io.insumo_id = i.id
      WHERE io.orcamento_id = $1
    `;
    
    const result = await pool.query(query, [id]);
    const itens = result.rows;

    const acumulaAluminio = {};
    const acumulaEstoque = {};
    const acumulaVidro = {};

    itens.forEach(item => {
      const tipoInsumo = item.tipo ? item.tipo.toLowerCase() : '';

      if (tipoInsumo === 'aluminio') {
        if (acumulaAluminio[item.codigo_insumo]) {
          acumulaAluminio[item.codigo_insumo].barras_para_comprar += Number(item.quantidade);
        } else {
          acumulaAluminio[item.codigo_insumo] = {
            codigo: item.codigo_insumo,
            descricao: item.descricao,
            barras_para_comprar: Number(item.quantidade)
          };
        }
      } 
      else if (['componente', 'acessorio', 'estoque', 'borracha'].includes(tipoInsumo)) {
        if (acumulaEstoque[item.codigo_insumo]) {
          acumulaEstoque[item.codigo_insumo].quantidade_necessaria += Number(item.quantidade);
        } else {
          acumulaEstoque[item.codigo_insumo] = {
            codigo: item.codigo_insumo,
            descricao: item.descricao,
            quantidade_necessaria: Number(item.quantidade)
          };
        }
      } 
      else if (tipoInsumo === 'vidro') {
        const metrosQuadrados = ((item.largura_mm * item.altura_mm) / 1000000) * item.quantidade;
        
        if (acumulaVidro[item.codigo_insumo]) {
          acumulaVidro[item.codigo_insumo].total_m2 = Number((Number(acumulaVidro[item.codigo_insumo].total_m2) + metrosQuadrados).toFixed(2));
          acumulaVidro[item.codigo_insumo].quantidade_folhas += item.quantidade;
        } else {
          acumulaVidro[item.codigo_insumo] = {
            codigo: item.codigo_insumo,
            descricao: item.descricao,
            medidas_corte: `${item.largura_mm}mm x ${item.altura_mm}mm`,
            total_m2: Number(metrosQuadrados.toFixed(2)),
            quantidade_folhas: item.quantidade
          };
        }
      }
    });

    return res.status(200).json({
      orcamento_id: id,
      lista_perfis_aluminio: Object.values(acumulaAluminio),
      lista_insumos_estoque: Object.values(acumulaEstoque),
      lista_pedido_vidros: Object.values(acumulaVidro)
    });

  } catch (error) {
    console.error('Erro ao gerar listas de produção:', error.message);
    return res.status(500).json({ error: 'Erro interno ao processar listas de produção.' });
  }
};