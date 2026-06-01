import pool from '../config/db.js';

// 1. Criar Tipologia (Modelo da Esquadria)
export const criarTipologia = async (req, res) => {
  // Deixa preparado para pegar do middleware de auth ou do body temporariamente
  const empresa_id = req.empresaId || req.body.empresa_id;
  const { nome, linha } = req.body;

  if (!empresa_id || !nome || !linha) {
    return res.status(400).json({ error: 'Os campos empresa_id, nome e linha são obrigatórios.' });
  }

  try {
    const novaTipologia = await pool.query(
      'INSERT INTO tipologias (empresa_id, nome, linha) VALUES ($1, $2, $3) RETURNING *',
      [empresa_id, nome, linha]
    );
    return res.status(201).json(novaTipologia.rows[0]);
  } catch (error) {
    console.error('📋 Erro ao criar tipologia:', error.message);
    return res.status(500).json({ error: 'Erro interno ao criar tipologia.' });
  }
};

// 2. Associar um Componente/Insumo com Fórmulas Dinâmicas à Tipologia
export const adicionarComponente = async (req, res) => {
  const empresa_id = req.empresaId || req.body.empresa_id; // Garante isolamento multi-tenant
  const { tipologia_id, insumo_id, quantidade_base, formula_largura, formula_altura } = req.body;

  if (!empresa_id || !tipologia_id || !insumo_id) {
    return res.status(400).json({ error: 'Os campos empresa_id, tipologia_id e insumo_id são obrigatórios.' });
  }

  try {
    // 🛡️ REGRA DE SEGURANÇA MÁXIMA: Verifica se a tipologia pertence a esta empresa antes de alterar
    const checaTipologia = await pool.query(
      'SELECT id FROM tipologias WHERE id = $1 AND empresa_id = $2',
      [tipologia_id, empresa_id]
    );

    if (checaTipologia.rowCount === 0) {
      return res.status(403).json({ error: 'Operação não permitida. Esta tipologia não pertence à sua empresa ou não existe.' });
    }

    // 🛡️ Opcional: Você pode fazer o mesmo check para o insumo_id se quiser blindagem 100%

    // Inserção segura após validação de posse do registro
    const novoComponente = await pool.query(
      `INSERT INTO componentes_tipologia (tipologia_id, insumo_id, quantidade_base, formula_largura, formula_altura) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [tipologia_id, insumo_id, quantidade_base || 1, formula_largura || null, formula_altura || null]
    );

    return res.status(201).json(novoComponente.rows[0]);
  } catch (error) {
    console.error('📐 Erro ao adicionar componente à tipologia:', error.message);
    return res.status(500).json({ error: 'Erro interno ao adicionar componente.' });
  }
};