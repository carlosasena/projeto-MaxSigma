import pool from '../config/db.js';

// Função para cadastrar um novo cliente
export const criarCliente = async (req, res) => {
  const { empresa_id, nome, email, telefone } = req.body;

  try {
    const novoCliente = await pool.query(
      'INSERT INTO clientes (empresa_id, nome, email, telefone) VALUES ($1, $2, $3, $4) RETURNING *',
      [empresa_id, nome, email, telefone]
    );
    return res.status(201).json(novoCliente.rows[0]);
  } catch (error) {
    console.error('Erro ao cadastrar cliente:', error.message);
    return res.status(500).json({ error: 'Erro interno ao salvar o cliente.' });
  }
};

// Função para listar todos os clientes
export const listarClientes = async (req, res) => {
  try {
    const todosClientes = await pool.query('SELECT * FROM clientes');
    return res.status(200).json(todosClientes.rows);
  } catch (error) {
    console.error('Erro ao buscar clientes:', error.message);
    return res.status(500).json({ error: 'Erro interno ao buscar clientes.' });
  }
};