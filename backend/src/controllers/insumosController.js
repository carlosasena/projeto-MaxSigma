import pool from '../config/db.js';

// 1. CRIAR INSUMO INDIVIDUAL
export const criarInsumo = async (req, res) => {
  const { empresa_id, codigo, descricao, tipo, preco_unitario, unidade_medida } = req.body;

  if (!empresa_id || !codigo) {
    return res.status(400).json({ error: 'Os campos empresa_id e codigo são obrigatórios.' });
  }

  try {
    const novoInsumo = await pool.query(
      'INSERT INTO insumos (empresa_id, codigo, descricao, tipo, preco_unitario, unidade_medida) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [empresa_id, codigo.toUpperCase().trim(), descricao, tipo, preco_unitario, unidade_medida]
    );
    return res.status(201).json(novoInsumo.rows[0]);
  } catch (error) {
    console.error('Erro ao cadastrar insumo:', error.message);
    return res.status(500).json({ error: 'Erro interno ao salvar o insumo.' });
  }
};

// 2. LISTAR INSUMOS (Blindado para Multi-tenancy)
export const listarInsumos = async (req, res) => {
  const { empresa_id } = req.query; // Capturado da URL de forma segura

  if (!empresa_id) {
    return res.status(400).json({ error: 'É necessário informar o empresa_id para listar os insumos.' });
  }

  try {
    const todosInsumos = await pool.query(
      'SELECT * FROM insumos WHERE empresa_id = $1 ORDER BY codigo ASC',
      [empresa_id]
    );
    return res.status(200).json(todosInsumos.rows);
  } catch (error) {
    console.error('Erro ao buscar insumos:', error.message);
    return res.status(500).json({ error: 'Erro interno ao buscar insumos.' });
  }
};

// 3. IMPORTAÇÃO MASSIVA EM LOTE (Segurança Multi-tenant Corrigida)
export const importarCatalogoLote = async (req, res) => {
  const perfis = req.body;
  // Captura o ID da empresa que está fazendo a requisição via Query ou Header de autenticação
  const empresaIdRequisicao = req.query.empresa_id || req.body[0]?.empresa_id; 

  if (!Array.isArray(perfis) || perfis.length === 0) {
    return res.status(400).json({ error: 'O corpo da requisição deve ser um array preenchido de perfis.' });
  }

  if (!empresaIdRequisicao) {
    return res.status(400).json({ error: 'É necessário especificar o empresa_id para realizar a carga.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log(`🔄 MaxSigma: Processando lote de ${perfis.length} perfis para a Empresa [${empresaIdRequisicao}]...`);

    for (const perfil of perfis) {
      const codigo = String(perfil.codigo).toUpperCase().trim();
      const peso_metro = perfil.peso_metro || 0.000;
      const descricao = perfil.descricao || `Perfil Alumínio ${codigo}`;
      const preco_unitario = perfil.preco_unitario || 120.00;
      const unidade_medida = perfil.unidade_padrao || 'BR';

      // 🔥 CORREÇÃO DE IMPACTO: Conflito chaveado pelo PAR composto (empresa_id, codigo)
      // Garante que o código de uma empresa nunca altere o registro de outra
      const queryInsert = `
        INSERT INTO insumos (empresa_id, codigo, descricao, tipo, peso_metro, preco_unitario, unidade_medida)
        VALUES ($1, $2, $3, 'aluminio', $4, $5, $6)
        ON CONFLICT (empresa_id, codigo) DO UPDATE SET
          peso_metro = EXCLUDED.peso_metro,
          descricao = EXCLUDED.descricao,
          preco_unitario = EXCLUDED.preco_unitario
      `;

      await client.query(queryInsert, [empresaIdRequisicao, codigo, descricao, peso_metro, preco_unitario, unidade_medida]);
    }

    await client.query('COMMIT');
    return res.status(201).json({
      message: 'Catálogo importado e sincronizado com sucesso de forma isolada!',
      total_perfis_processados: perfis.length
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro crítico ao importar lote no MaxSigma:', error.message);
    return res.status(500).json({ error: 'Erro interno ao processar a carga massiva.' });
  } finally {
    client.release();
  }
};