import pool from '../config/db.js';
import { z } from 'zod';

const insumoSchema = z.object({
    codigo: z.string().min(1),
    descricao: z.string().optional().default(''),
    tipo: z.enum(['aluminio', 'vidro', 'componente', 'acessorio', 'borracha']).optional().default('aluminio'),
    preco_unitario: z.coerce.number().nonnegative().optional().default(0),
    unidade_medida: z.string().max(10).optional().default('KG'),
    peso_metro: z.coerce.number().nonnegative().optional().default(0)
});

export const criarInsumo = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.empresa_id;
        const dados = insumoSchema.parse(req.body);
        const result = await pool.query(
            `INSERT INTO insumos (empresa_id, codigo, descricao, tipo, preco_unitario, unidade_medida, peso_metro) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [tenantId, dados.codigo, dados.descricao, dados.tipo, dados.preco_unitario, dados.unidade_medida, dados.peso_metro]
        );
        res.status(201).json(result.rows[0]);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

export const listarInsumos = async (req, res) => {
    const tenantId = req.tenantId || req.empresa_id;
    const result = await pool.query('SELECT * FROM insumos WHERE empresa_id = $1', [tenantId]);
    res.json(result.rows);
};

export const buscarInsumoPorId = async (req, res) => {
    const tenantId = req.tenantId || req.empresa_id;
    const result = await pool.query('SELECT * FROM insumos WHERE id = $1 AND empresa_id = $2', [req.params.id, tenantId]);
    result.rowCount ? res.json(result.rows[0]) : res.status(404).json({ error: 'Não encontrado' });
};

export const atualizarInsumo = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.empresa_id;
        const dados = insumoSchema.parse(req.body);
        const result = await pool.query(
            'UPDATE insumos SET descricao=$1, preco_unitario=$2, peso_metro=$3 WHERE id=$4 AND empresa_id=$5 RETURNING *',
            [dados.descricao, dados.preco_unitario, dados.peso_metro, req.params.id, tenantId]
        );
        result.rowCount ? res.json(result.rows[0]) : res.status(404).json({ error: 'Não encontrado' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

export const deletarInsumo = async (req, res) => {
    const tenantId = req.tenantId || req.empresa_id;
    const result = await pool.query('DELETE FROM insumos WHERE id = $1 AND empresa_id = $2', [req.params.id, tenantId]);
    result.rowCount ? res.json({ message: 'Deletado' }) : res.status(404).json({ error: 'Não encontrado' });
};

export const importarCatalogoLote = async (req, res) => {
    res.status(501).json({ message: 'Funcionalidade pendente' });
};