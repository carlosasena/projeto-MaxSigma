import pool from '../config/db.js';

// Controller existente: Criar Insumo individual
export const criarInsumo = async (req, res) => {
  const { empresa_id, codigo, descricao, tipo, preco_unitario, unidade_medida } = req.body;
  try {
    const novoInsumo = await pool.query(
      'INSERT INTO insumos (empresa_id, codigo, descricao, tipo, preco_unitario, unidade_medida) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [empresa_id, codigo, descricao, tipo, preco_unitario, unidade_medida]
    );
    return res.status(201).json(novoInsumo.rows[0]);
  } catch (error) {
    console.error('Erro ao cadastrar insumo:', error.message);
    return res.status(500).json({ error: 'Erro interno ao salvar o insumo.' });
  }
};

// Controller existente: Listar todos os insumos
export const listarInsumos = async (req, res) => {
  try {
    const todosInsumos = await pool.query('SELECT * FROM insumos');
    return res.status(200).json(todosInsumos.rows);
  } catch (error) {
    console.error('Erro ao buscar insumos:', error.message);
    return res.status(500).json({ error: 'Erro interno ao buscar insumos.' });
  }
};

// NOVO CONTROLLER: Importação massiva do catálogo extraído
export const importarCatalogoLote = async (req, res) => {
  const perfis = req.body; // Array vindo do JSON gerado pelo script extrator

  if (!Array.isArray(perfis) || perfis.length === 0) {
    return res.status(400).json({ error: 'O corpo da requisição deve ser um array preenchido de perfis.' });
  }

  // Abre um cliente dedicado do pool para gerenciar a transação isolada de alta performance
  const client = await pool.connect();

  try {
    // Inicia a transação (BEGIN) para evitar dados parciais em caso de erro
    await client.query('BEGIN');

    console.log(`🔄 MaxSigma: Processando lote de ${perfis.length} perfis para testes futuros...`);

    for (const perfil of perfis) {
      const codigo = perfil.codigo;
      const peso_metro = perfil.peso_metro || 0.000;
      const descricao = perfil.descricao || `Perfil Alumínio de Mercado ${codigo}`;
      const linha = perfil.linha || 'Geral/Mercado';
      const preco_unitario = perfil.preco_unitario || 120.00; // Custo base fictício para testes
      const unidade_medida = perfil.unidade_padrao || 'BR';
      const empresa_id = perfil.empresa_id || 1; // ID padrão de testes para o ecossistema SaaS

      // Query adaptada para a estrutura da sua tabela atual com a trava de conflito
      const queryInsert = `
        INSERT INTO insumos (empresa_id, codigo, descricao, tipo, peso_metro, preco_unitario, unidade_medida)
        VALUES ($1, $2, $3, 'aluminio', $4, $5, $6)
        ON CONFLICT (codigo) DO UPDATE SET
          peso_metro = EXCLUDED.peso_metro,
          descricao = EXCLUDED.descricao,
          preco_unitario = EXCLUDED.preco_unitario
      `;

      await client.query(queryInsert, [empresa_id, codigo, descricao, peso_metro, preco_unitario, unidade_medida]);
    }

    // Confirma em definitivo todas as inserções no PostgreSQL
    await client.query('COMMIT');
    console.log('✅ Banco de dados alimentado com sucesso!');

    return res.status(201).json({
      message: 'Catálogo de teste importado e sincronizado com sucesso!',
      total_perfis_processados: perfis.length
    });

  } catch (error) {
    // Caso ocorra qualquer falha no meio do processo, desfaz tudo (ROLLBACK) para manter o banco limpo
    await client.query('ROLLBACK');
    console.error('❌ Erro crítico ao importar lote:', error.message);
    return res.status(500).json({ error: 'Erro interno ao processar a carga massiva.' });
  } finally {
    // Libera o cliente de volta para o pool de conexões
    client.release();
  }
};