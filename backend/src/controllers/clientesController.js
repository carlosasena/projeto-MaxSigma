import pool from '../config/db.js';

// 1. CADASTRAR CLIENTE (Com validação básica e proteção multi-tenant)
export const criarCliente = async (req, res) => {
  const { empresa_id, nome, email, telefone } = req.body;

  // Validação preventiva do Claude: impede registros sem informações essenciais
  if (!empresa_id || !nome) {
    return res.status(400).json({ error: 'Os campos empresa_id e nome são obrigatórios para o cadastro.' });
  }

  try {
    // Validação do DeepSeek: Evita a duplicação do mesmo e-mail dentro da MESMA empresa
    if (email) {
      const emailExistente = await pool.query(
        'SELECT id FROM clientes WHERE email = $1 AND empresa_id = $2',
        [email, empresa_id]
      );
      if (emailExistente.rows.length > 0) {
        return res.status(400).json({ error: 'Já existe um cliente cadastrado com este e-mail na sua empresa.' });
      }
    }

    const novoCliente = await pool.query(
      'INSERT INTO clientes (empresa_id, nome, email, telefone) VALUES ($1, $2, $3, $4) RETURNING *',
      [empresa_id, nome, email, telefone]
    );
    
    return res.status(201).json(novoCliente.rows[0]);
  } catch (error) {
    console.error('Erro ao cadastrar cliente no MaxSigma:', error.message);
    return res.status(500).json({ error: 'Erro interno ao salvar o cliente.' });
  }
};

// 2. LISTAR CLIENTES (Blindado para Multi-tenancy - Mostra apenas dados da própria empresa)
export const listarClientes = async (req, res) => {
  // Captura o empresa_id via Query Param (ex: /clientes?empresa_id=1) 
  // Nota: No futuro, isso será extraído automaticamente do Token de Login (JWT)
  const { empresa_id } = req.query;

  if (!empresa_id) {
    return res.status(400).json({ error: 'É necessário informar o empresa_id para listar os clientes.' });
  }

  try {
    // Cláusula WHERE obrigatória garante que uma empresa jamais veja os dados de outra
    const todosClientes = await pool.query(
      'SELECT id, nome, email, telefone, criado_em FROM clientes WHERE empresa_id = $1 ORDER BY nome ASC',
      [empresa_id]
    );
    
    return res.status(200).json(todosClientes.rows);
  } catch (error) {
    console.error('Erro ao buscar clientes no MaxSigma:', error.message);
    return res.status(500).json({ error: 'Erro interno ao buscar clientes.' });
  }
};