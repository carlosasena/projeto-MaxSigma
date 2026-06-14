import pool from '../config/db.js';
import { z } from 'zod';

const insumoSchema = z.object({
    codigo: z.string().min(1).max(50),
    descricao: z.string().optional().default(''),
    tipo: z.enum(['aluminio', 'vidro', 'componente', 'acessorio', 'borracha']).optional().default('aluminio'),
    preco_unitario: z.coerce.number().nonnegative().optional().default(0), // Evita quebras se vier como string
    unidade_medida: z.string().max(10).optional().default('KG'),
    peso_metro: z.coerce.number().nonnegative().optional().default(0)     // Coerção de tipo
});

export const criarInsumo = async (req, res) => {
    try {
        const empresa_id = req.empresa_id; // Injeção segura via header
        if (!empresa_id) return res.status(400).json({ error: 'Tenant inválido.' });

        const dados = insumoSchema.parse(req.body);
        const query = `
            INSERT INTO insumos (empresa_id, codigo, descricao, tipo, preco_unitario, unidade_medida, peso_metro) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) 
            ON CONFLICT (empresa_id, codigo) DO UPDATE SET
                descricao = EXCLUDED.descricao, preco_unitario = EXCLUDED.preco_unitario, peso_metro = EXCLUDED.peso_metro, updated_at = NOW()
            RETURNING *`;
        const novo = await pool.query(query, [empresa_id, dados.codigo.toUpperCase().trim(), dados.descricao, dados.tipo, dados.preco_unitario, dados.unidade_medida, dados.peso_metro]);
        return res.status(201).json(novo.rows[0]);
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao salvar insumo.' });
    }
};
// ... (Métodos listarInsumos, buscarInsumoPorId e deletarInsumo utilizam sempre [id, req.empresa_id])