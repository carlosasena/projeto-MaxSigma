import pool from '../config/db.js';

// 1. MOTOR DE CÁLCULO: Cria o orçamento e explode os insumos com base nas fórmulas
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

    // Loop do Algoritmo: Processa cada fórmula cadastrada para esta janela
    for (const comp of componentes) {
      let larguraCorte = null;
      let alturaCorte = null;

      // Se houver fórmula de Largura, calcula. Alumínio vertical fica null para não inflar a produção
      if (comp.formula_largura && typeof comp.formula_largura === 'string') {
        larguraCorte = eval(comp.formula_largura.replace(/L/g, largura_mm).replace(/H/g, altura_mm));
      } else if (comp.tipo === 'vidro') {
        larguraCorte = largura_mm; // Vidro sempre precisa de Largura para cálculo de m²
      }

      // Se houver fórmula de Altura, calcula. Alumínio horizontal fica null para não inflar a produção
      if (comp.formula_altura && typeof comp.formula_altura === 'string') {
        alturaCorte = eval(comp.formula_altura.replace(/H/g, altura_mm).replace(/L/g, largura_mm));
      } else if (comp.tipo === 'vidro') {
        alturaCorte = altura_mm; // Vidro sempre precisa de Altura para cálculo de m²
      }

      // Calcula o preço gravado para este item do orçamento baseado na categoria do insumo
      let precoItem = 0;
      if (comp.tipo === 'aluminio') {
        // Pega a dimensão real calculada (largura ou altura)
        const medidaUsada = larguraCorte || alturaCorte || 0;
        const metros = medidaUsada / 1000;
        // Fração proporcional do preço da barra de 6 metros
        precoItem = (metros / 6) * comp.preco_unitario * comp.quantidade_base;
      } else if (comp.tipo === 'vidro') {
        // Área em m² (Largura x Altura em metros)
        const m2 = ((larguraCorte * alturaCorte) / 1000000) * comp.quantidade_base;
        precoItem = m2 * comp.preco_unitario;
      } else {
        // Componentes de estoque e acessórios multiplicam direto pela quantidade fixa
        precoItem = comp.preco_unitario * comp.quantidade_base;
      }

      totalMateriais += precoItem;

      // Grava o item calculado na tabela itens_orcamento
      await client.query(
        `INSERT INTO itens_orcamento (orcamento_id, insumo_id, quantidade, largura_mm, altura_mm, preco_gravado)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orcamentoId, comp.insumo_id, comp.quantidade_base, larguraCorte, alturaCorte, precoItem.toFixed(2)]
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
    client.release(); // Libera a conexão com a pool
  }
};

// 2. LISTA DE PRODUÇÃO: Busca os itens gerados e separa em listas organizadas para a fábrica
// 2. LISTA DE PRODUCTION: Busca os itens gerados e separa em listas organizadas e agrupadas
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

    // Objetos temporários para acumular/agrupar os valores por código de insumo
    const acumulaAluminio = {};
    const acumulaEstoque = {};
    const acumulaVidro = {};

    itens.forEach(item => {
      if (item.tipo === 'aluminio') {
        const medidaComponente = item.largura_mm || item.altura_mm || 0;
        const metrosNecessarios = (medidaComponente * item.quantidade) / 1000;

        if (acumulaAluminio[item.codigo_insumo]) {
          // Se o perfil já existe no grupo, soma a metragem necessária
          acumulaAluminio[item.codigo_insumo].total_metros += metrosNecessarios;
        } else {
          // Se é a primeira vez que o perfil aparece, cria o registro técnico
          acumulaAluminio[item.codigo_insumo] = {
            codigo: item.codigo_insumo,
            descricao: item.descricao,
            total_metros: metrosNecessarios
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

    // Pós-processamento: Transforma os objetos agrupados de volta em Arrays e aplica a regra de arredondamento de barras
    const listaAluminio = Object.values(acumulaAluminio).map(perfil => {
      return {
        ...perfil,
        barras_para_comprar: Math.ceil(perfil.total_metros / 6) // Aplica o teto de barras de 6m na soma total
      };
    });

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