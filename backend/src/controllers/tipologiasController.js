import pool from '../config/db.js';
import { z } from 'zod';

const tipologiaSchema = z.object({
    empresa_id: z.number().int().positive(),
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

// 1. CRIAR TIPOLOGIA
export const criarTipologia = async (req, res) => {
    try {
        const dados = tipologiaSchema.parse(req.body);
        
        const nova = await pool.query(
            'INSERT INTO tipologias (empresa_id, nome, linha) VALUES ($1, $2, $3) RETURNING *',
            [dados.empresa_id, dados.nome, dados.linha]
        );
        
        return res.status(201).json(nova.rows[0]);
        
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', detalhes: error.errors });
        }
        
        console.error('[Tipologias] Erro:', error.message);
        return res.status(500).json({ error: 'Erro ao criar tipologia' });
    }
};

// 2. LISTAR TIPOLOGIAS
export const listarTipologias = async (req, res) => {
    try {
        const { empresa_id } = req.query;
        
        if (!empresa_id) {
            return res.status(400).json({ error: 'empresa_id é obrigatório' });
        }
        
        const tipologias = await pool.query(
            'SELECT * FROM tipologias WHERE empresa_id = $1 ORDER BY nome ASC',
            [empresa_id]
        );
        
        return res.status(200).json(tipologias.rows);
        
    } catch (error) {
        console.error('[Tipologias] Erro:', error.message);
        return res.status(500).json({ error: 'Erro ao listar tipologias' });
    }
};

// 3. ADICIONAR COMPONENTE
export const adicionarComponente = async (req, res) => {
    try {
        const dados = componentSchema.parse(req.body);
        
        // Verifica se tipologia pertence à empresa
        const empresa_id = req.body.empresa_id;
        const tipologia = await pool.query(
            'SELECT id FROM tipologias WHERE id = $1 AND empresa_id = $2',
            [dados.tipologia_id, empresa_id]
        );
        
        if (tipologia.rowCount === 0) {
            return res.status(403).json({ 
                error: 'Tipologia não pertence à sua empresa' 
            });
        }
        
        const novo = await pool.query(
            `INSERT INTO componentes_tipologia (tipologia_id, insumo_id, quantidade_base, formula_largura, formula_altura) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [dados.tipologia_id, dados.insumo_id, dados.quantidade_base, 
             dados.formula_largura, dados.formula_altura]
        );
        
        return res.status(201).json(novo.rows[0]);
        
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', detalhes: error.errors });
        }
        
        console.error('[Tipologias] Erro componente:', error.message);
        return res.status(500).json({ error: 'Erro ao adicionar componente' });
    }
};
