import pool from '../config/db.js';
import { z } from 'zod';

// REMOVIDO: empresa_id do schema do Body para evitar que um utilizador mude o ID de outra empresa por JSON
const tipologiaSchema = z.object({
    nome: z.string().min(3).max(100),
    linha: z.string().min(1).max(50)
});

const componentSchema = z.object({
    tipologia_id: z.number().int().positive(),
    insumo_id: z.number().int().positive(),
    quantidade_base: z.number().positive().default(1),
    formula_largura: z.string().optional().nullable(),
    formula_altura: z.string().optional().nullable()
});

// CRIAR TIPOLOGIA
export const criarTipologia = async (req, res) => {
    try {
        const empresa_id = req.empresa_id; // Captura segura vinda do Middleware
        if (!empresa_id) return res.status(400).json({ error: 'Identificação da empresa (Tenant) ausente.' });

        const dados = tipologiaSchema.parse(req.body);
        
        const nova = await pool.query(
            'INSERT INTO tipologias (empresa_id, nome, linha) VALUES ($1, $2, $3) RETURNING *',
            [empresa_id, dados.nome, dados.linha]
        );
        return res.status(201).json(nova.rows[0]);
    } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ error: 'Dados inválidos', detalhes: error.errors });
        return res.status(500).json({ error: 'Erro ao criar tipologia' });
    }
};

// LISTAR TIPOLOGIAS
export const listarTipologias = async (req, res) => {
    try {
        const empresa_id = req.empresa_id; // Filtro por inquilino
        const resultado = await pool.query(
            'SELECT * FROM tipologias WHERE empresa_id = $1 ORDER BY criado_em DESC',
            [empresa_id]
        );
        return res.status(200).json(resultado.rows);
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao listar tipologias' });
    }
};

// ADICIONAR COMPONENTE
export const adicionarComponente = async (req, res) => {
    try {
        const empresa_id = req.empresa_id;
        const dados = componentSchema.parse(req.body);
        
        // Garante que a tipologia alvo pertence à empresa autenticada
        const tipologia = await pool.query(
            'SELECT id FROM tipologias WHERE id = $1 AND empresa_id = $2',
            [dados.tipologia_id, empresa_id]
        );
        if (tipologia.rowCount === 0) return res.status(403).json({ error: 'Acesso negado. Esta tipologia não pertence à sua empresa.' });
        
        // Garante que o insumo pertence ao catálogo da própria empresa
        const insumo = await pool.query(
            'SELECT id FROM insumos WHERE id = $1 AND empresa_id = $2',
            [dados.insumo_id, empresa_id]
        );
        if (insumo.rowCount === 0) return res.status(403).json({ error: 'Acesso negado. O insumo não pertence à sua empresa.' });

        const novo = await pool.query(
            `INSERT INTO componentes_tipologia (tipologia_id, insumo_id, quantidade_base, formula_largura, formula_altura) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [dados.tipologia_id, dados.insumo_id, dados.quantidade_base, dados.formula_largura, dados.formula_altura]
        );
        return res.status(201).json(novo.rows[0]);
    } catch (error) {
        if (error instanceof z.ZodError) return res.status(400).json({ error: 'Dados inválidos', detalhes: error.errors });
        return res.status(500).json({ error: 'Erro ao adicionar componente' });
    }
};