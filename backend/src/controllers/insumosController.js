import pool from '../config/db.js';

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

export const listarInsumos = async (req, res) => {
  try {
    const todosInsumos = await pool.query('SELECT * FROM insumos');
    return res.status(200).json(todosInsumos.rows);
  } catch (error) {
    console.error('Erro ao buscar insumos:', error.message);
    return res.status(500).json({ error: 'Erro interno ao buscar insumos.' });
  }
};