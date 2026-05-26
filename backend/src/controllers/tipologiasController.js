import pool from '../config/db.js';

// Função para cadastrar o nome da Tipologia
export const criarTipologia = async (req, res) => {
  const { empresa_id, nome, linha } = req.body;
  try {
    const novaTipologia = await pool.query(
      'INSERT INTO tipologias (empresa_id, nome, linha) VALUES ($1, $2, $3) RETURNING *',
      [empresa_id, nome, linha]
    );
    return res.status(201).json(novaTipologia.rows[0]);
  } catch (error) {
    console.error('Erro ao criar tipologia:', error.message);
    return res.status(500).json({ error: 'Erro interno ao criar tipologia.' });
  }
};

// Função para associar um insumo/fórmula a essa tipologia
export const adicionarComponente = async (req, res) => {
  const { tipologia_id, insumo_id, quantidade_base, formula_largura, formula_altura } = req.body;
  try {
    const novoComponente = await pool.query(
      `INSERT INTO componentes_tipologia (tipologia_id, insumo_id, quantidade_base, formula_largura, formula_altura) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tipologia_id, insumo_id, quantidade_base, formula_largura, formula_altura]
    );
    return res.status(201).json(novoComponente.rows[0]);
  } catch (error) {
    console.error('Erro ao adicionar componente:', error.message);
    return res.status(500).json({ error: 'Erro interno ao adicionar componente.' });
  }
};