import pool from '../config/db.js';

// 1. MOTOR DE CÁLCULO: Cria o orçamento e explode os insumos arredondando as barras para cima
export const criarOrcamento = async (req, res) => {
  const { projeto_id, largura_mm, altura_mm, mao_de_obra, empresa_id, status } = req.body;

  // Inicia a conexão com o cliente da pool para controle de transação segura
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

      // Se houver fórmula de Largura, calcula.
      if (comp.formula_largura && typeof comp.formula_largura === 'string') {
        larguraCorte = eval(comp.formula_largura.replace(/L/g, largura_mm).replace(/H/g, altura_mm));
      } else if (comp.tipo === 'vidro') {
        larguraCorte = largura_mm;
      }

      // Se houver fórmula de Altura, calcula.
      if (comp.formula_altura && typeof comp.formula_altura === 'string') {
        alturaCorte = eval(comp.formula_altura.replace(/H/g, altura_mm).replace(/L/g, largura_mm));
      } else if (comp.tipo === 'vidro') {
        alturaCorte = altura_mm;
      }

      // Calcula o preço baseado na nossa regra estrita
      let precoItem = 0;
      let quantidadeCalculada = comp.quantidade_base; // Padrão para acessórios/estoque

      if (comp.tipo === 'aluminio') {
        // Pega a dimensão real de corte gerada pela fórmula
        const medidaUsada = larguraCorte || alturaCorte || 0;
        
        // Total de metros necessários para a quantidade deste perfil na peça
        const totalMetrosItem = (medidaUsada * comp.quantidade_base) / 1000;
        
        // REGRA DO CARLOS: Calcula quantas BARRAS de 6 metros serão gastas, arredondando para cima
        const barrasNecessarias = Math.ceil(totalMetrosItem / 6);
        
        // Guarda a quantidade de barras para salvar no banco
        quantidadeCalculada = barrasNecessarias;
        
        // O preço cobrado será baseado na quantidade de barras inteiras compradas
        precoItem = barrasNecessarias * comp.preco_unitario;
      } 
      else if (comp.tipo === 'vidro') {
        // Área em m² (Largura x Altura em metros) multiplicada pela quantidade de folhas
        const m2 = ((larguraCorte * alturaCorte) / 1000000) * comp.quantidade_base;
        precoItem = m2 * comp.preco_unitario;
      } 
      else {
        // Componentes de estoque, borrachas e acessórios fixos
        precoItem = comp.preco_unitario * comp.quantidade_base;
      }

      totalMateriais += precoItem;

      // Grava o item calculado na tabela itens_orcamento
      await client.query(
        `INSERT INTO itens_orcamento (orcamento_id, insumo_id, quantidade, largura_mm, altura_mm, preco_gravado)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orcamentoId, comp.insumo_id, quantidadeCalculada, larguraCorte, alturaCorte, precoItem.toFixed(2)]
      );
    }

    // Atualiza o orçamento pai com a soma real de materiais e calcula o Valor Final
    const valorFinal = totalMateriais + Number(mao_de_obra || 0);
    const orcamentoAtualizado = await client.query(
      `UPDATE orcamentos 
       SET total_materiais = $1, valor_final = $2 
       WHERE id = $3 RETURNING *`,
      [totalMateriais.toFixed(2), valorFinal.toFixed(2), orcamentoId]
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
      if (item.tipo === 'aluminio') {
        // Como agora salvamos a quantidade de barras calculadas direto no item_orcamento:
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
      else if (item.tipo === 'componente' || item.tipo === 'acessorio' || item.tipo === 'estoque') {
        if (acumulaEstoque[item.codigo_insumo]) {
          acumulaEstoque[item.codigo_insumo].quantidade_necessaria += item.quantidade;
        } else {
          acumulaEstoque[item.codigo_insumo] = {
            codigo: item.codigo_insumo,
            descricao: item.descricao,
            quantidade_necessaria: item.quantidade
          };
        }
      } 
      else if (item.tipo === 'vidro') {
        const metrosQuadrados = ((item.largura_mm * item.altura_mm) / 1000000) * item.quantidade;
        
        if (acumulaVidro[item.codigo_insumo]) {
          acumulaVidro[item.codigo_insumo].total_m2 = (Number(acumulaVidro[item.codigo_insumo].total_m2) + metrosQuadrados).toFixed(2);
          acumulaVidro[item.codigo_insumo].quantidade_folhas += item.quantidade;
        } else {
          acumulaVidro[item.codigo_insumo] = {
            codigo: item.codigo_insumo,
            descricao: item.descricao,
            medidas_corte: `${item.largura_mm}mm x ${item.altura_mm}mm`,
            total_m2: metrosQuadrados.toFixed(2),
            quantidade_folhas: item.quantidade
          };
        }
      }
    });

    // Transforma os objetos agrupados de volta em Arrays limpos para a resposta
    const listaAluminio = Object.values(acumulaAluminio);
    const listaEstoque = Object.values(acumulaEstoque);
    const listaVidro = Object.values(acumulaVidro);

    return res.status(200).json({
      orcamento_id: id,
      lista_perfis_aluminio: listaAluminio,
      lista_insumos_estoque: listaEstoque,
      lista_pedido_vidros: listaVidro
    });

  } catch (error) {
    console.error('Erro ao gerar listas de produção:', error.message);
    return res.status(500).json({ error: 'Erro interno ao processar listas de produção.' });
  }
};