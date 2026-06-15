import pool from '../config/db.js';
import { z } from 'zod';

// Schemas de validação
const clienteSchema = z.object({
    nome: z.string().min(3).max(100),
    documento: z.string().min(11).max(18).optional(),
    email: z.string().email().optional(),
    telefone: z.string().optional(),
    endereco: z.string().optional(),
    observacoes: z.string().optional(),
});

const obraSchema = z.object({
    descricao_obra: z.string().min(3),
    logradouro: z.string(),
    numero: z.string().optional(),
    cidade: z.string(),
    estado: z.string().length(2)
});

// ============================================
// 1. FUNÇÃO PARA BUSCAR CLIENTE POR ID
// ============================================
export const buscarClientePorId = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.empresa_id;
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ error: 'ID do cliente é obrigatório' });
        }

        const result = await pool.query(
            'SELECT * FROM clientes WHERE id = $1 AND empresa_id = $2',
            [id, tenantId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado ou acesso negado.' });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('[Clientes] Erro ao buscar cliente:', error);
        return res.status(500).json({ error: 'Erro interno ao buscar cliente.' });
    }
};

// ============================================
// 2. FUNÇÃO PARA CRIAR CLIENTE (NOVA)
// ============================================
export const criarCliente = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.empresa_id;
        
        if (!tenantId) {
            return res.status(400).json({ error: 'Identificação da empresa (Tenant) ausente.' });
        }

        const dados = clienteSchema.parse(req.body);
        
        const result = await pool.query(
            `INSERT INTO clientes (empresa_id, nome, documento, email, telefone, endereco, observacoes, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
             RETURNING *`,
            [tenantId, dados.nome, dados.documento, dados.email, dados.telefone, dados.endereco, dados.observacoes]
        );
        
        return res.status(201).json({
            success: true,
            data: result.rows[0],
            message: 'Cliente criado com sucesso'
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', detalhes: error.errors });
        }
        if (error.code === '23505') {
            return res.status(409).json({ error: 'Documento já cadastrado para esta empresa' });
        }
        console.error('[Clientes] Erro ao criar cliente:', error);
        return res.status(500).json({ error: 'Erro interno ao criar cliente' });
    }
};

// ============================================
// 3. FUNÇÃO PARA LISTAR CLIENTES (NOVA)
// ============================================
export const listarClientes = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.empresa_id;
        const { page = 1, limit = 50, search, ativo = 'true' } = req.query;
        
        const limitInt = parseInt(limit);
        const offset = (parseInt(page) - 1) * limitInt;

        // 1. Construção da cláusula WHERE compartilhada
        let whereClause = `WHERE empresa_id = $1`;
        const params = [tenantId];
        let paramIndex = 2;

        // Filtro de ativo
        if (ativo === 'true') {
            whereClause += ` AND (ativo IS NOT FALSE)`; 
        } else if (ativo === 'false') {
            whereClause += ` AND ativo = false`;
        }

        // Filtro de busca
        if (search) {
            whereClause += ` AND (nome ILIKE $${paramIndex} OR documento ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        // 2. Consulta de contagem (Total)
        const countSql = `SELECT COUNT(*) FROM clientes ${whereClause}`;
        const countResult = await pool.query(countSql, params);
        const total = parseInt(countResult.rows[0].count);

        // 3. Consulta principal (Paginação)
        const sql = `SELECT * FROM clientes ${whereClause} ORDER BY nome ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        const result = await pool.query(sql, [...params, limitInt, offset]);
        
        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: limitInt,
                total: total,
                pages: Math.ceil(total / limitInt)
            }
        });
    } catch (error) {
        console.error('[Clientes] Erro ao listar clientes:', error);
        res.status(500).json({ error: 'Erro interno ao listar clientes' });
    }
};

// ============================================
// 4. FUNÇÃO PARA ATUALIZAR CLIENTE
// ============================================
export const atualizarCliente = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.empresa_id;
        const { id } = req.params;
        const dados = clienteSchema.partial().parse(req.body);
        
        const updates = [];
        const values = [tenantId, id];
        let paramIndex = 3;
        
        if (dados.nome !== undefined) {
            updates.push(`nome = $${paramIndex++}`);
            values.push(dados.nome);
        }
        if (dados.documento !== undefined) {
            updates.push(`documento = $${paramIndex++}`);
            values.push(dados.documento);
        }
        if (dados.email !== undefined) {
            updates.push(`email = $${paramIndex++}`);
            values.push(dados.email);
        }
        if (dados.telefone !== undefined) {
            updates.push(`telefone = $${paramIndex++}`);
            values.push(dados.telefone);
        }
        if (dados.endereco !== undefined) {
            updates.push(`endereco = $${paramIndex++}`);
            values.push(dados.endereco);
        }
        if (dados.observacoes !== undefined) {
            updates.push(`observacoes = $${paramIndex++}`);
            values.push(dados.observacoes);
        }
        
        updates.push(`updated_at = NOW()`);
        
        const sql = `UPDATE clientes SET ${updates.join(', ')} WHERE id = $2 AND empresa_id = $1 RETURNING *`;
        
        const result = await pool.query(sql, values);
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        
        res.json({
            success: true,
            data: result.rows[0],
            message: 'Cliente atualizado com sucesso'
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', detalhes: error.errors });
        }
        console.error('[Clientes] Erro ao atualizar cliente:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar cliente' });
    }
};

// ============================================
// 5. FUNÇÃO PARA DELETAR CLIENTE (SOFT DELETE)
// ============================================
export const deletarCliente = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.empresa_id;
        const { id } = req.params;
        
        const result = await pool.query(
            `UPDATE clientes SET ativo = false, updated_at = NOW() 
             WHERE id = $1 AND empresa_id = $2 
             RETURNING id`,
            [id, tenantId]
        );
        
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        
        res.json({
            success: true,
            message: 'Cliente removido com sucesso'
        });
    } catch (error) {
        console.error('[Clientes] Erro ao deletar cliente:', error);
        res.status(500).json({ error: 'Erro interno ao deletar cliente' });
    }
};

// ============================================
// 6. FUNÇÃO PARA CRIAR ENDEREÇO DE OBRA
// ============================================
export const criarEnderecoObra = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.empresa_id;
        const { clienteId } = req.params;
        const dados = obraSchema.parse(req.body);

        // Bloqueio Multi-Tenant ativo
        const clienteValido = await pool.query(
            'SELECT id FROM clientes WHERE id = $1 AND empresa_id = $2',
            [clienteId, tenantId]
        );
        
        if (clienteValido.rowCount === 0) {
            return res.status(403).json({ error: 'Operação negada. Cliente não pertence à sua organização.' });
        }

        const query = `
            INSERT INTO enderecos_obra (empresa_id, cliente_id, descricao_obra, logradouro, numero, cidade, estado, created_at) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) 
            RETURNING *
        `;
        
        const novaObra = await pool.query(query, [
            tenantId, 
            clienteId, 
            dados.descricao_obra, 
            dados.logradouro, 
            dados.numero || null, 
            dados.cidade, 
            dados.estado
        ]);
        
        return res.status(201).json(novaObra.rows[0]);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', detalhes: error.errors });
        }
        console.error('[Clientes] Erro ao criar obra:', error);
        return res.status(500).json({ error: 'Erro ao registrar obra.' });
    }
};

// ============================================
// 7. FUNÇÃO PARA LISTAR OBRAS DO CLIENTE (NOVA)
// ============================================
export const listarObrasDoCliente = async (req, res) => {
    try {
        const tenantId = req.tenantId || req.empresa_id;
        const { clienteId } = req.params;
        
        // Verifica se o cliente pertence ao tenant
        const clienteValido = await pool.query(
            'SELECT id FROM clientes WHERE id = $1 AND empresa_id = $2',
            [clienteId, tenantId]
        );
        
        if (clienteValido.rowCount === 0) {
            return res.status(403).json({ error: 'Cliente não encontrado ou acesso negado.' });
        }
        
        const result = await pool.query(
            `SELECT * FROM enderecos_obra WHERE cliente_id = $1 AND empresa_id = $2 ORDER BY created_at DESC`,
            [clienteId, tenantId]
        );
        
        res.json({
            success: true,
            data: result.rows,
            count: result.rowCount
        });
    } catch (error) {
        console.error('[Clientes] Erro ao listar obras:', error);
        res.status(500).json({ error: 'Erro interno ao listar obras' });
    }
};