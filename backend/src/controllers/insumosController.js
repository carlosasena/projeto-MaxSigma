import pool from '../config/db.js';
import { z } from 'zod';

const insumoSchema = z.object({
    empresa_id: z.number().int().positive(),
    codigo: z.string().min(1).max(50),
    descricao: z.string().optional().default(''),
    tipo: z.enum(['aluminio', 'vidro', 'componente', 'acessorio', 'borracha']).optional().default('aluminio'),
    preco_unitario: z.number().positive().optional().default(0),
    unidade_medida: z.string().max(10).optional().default('KG'),
    peso_metro: z.number().nonnegative().optional().default(0)
});

// 1. CRIAR INSUMO
export const criarInsumo = async (req, res) => {
    try {
        const dados = insumoSchema.parse(req.body);
        
        const novo = await pool.query(
            `INSERT INTO insumos (empresa_id, codigo, descricao, tipo, preco_unitario, unidade_medida, peso_metro) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING *`,
            [dados.empresa_id, dados.codigo.toUpperCase().trim(), dados.descricao, 
             dados.tipo, dados.preco_unitario, dados.unidade_medida, dados.peso_metro]
        );
        
        return res.status(201).json(novo.rows[0]);
        
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', detalhes: error.errors });
        }
        
        if (error.constraint === 'insumos_empresa_id_codigo_key') {
            return res.status(409).json({ error: 'Código já existe para esta empresa' });
        }
        
        console.error('[Insumos] Erro:', error.message);
        return res.status(500).json({ error: 'Erro interno' });
    }
};

// 2. LISTAR INSUMOS (COM PAGINAÇÃO)
export const listarInsumos = async (req, res) => {
    try {
        const { empresa_id, pagina = 1, limite = 50, tipo = '' } = req.query;
        
        if (!empresa_id) {
            return res.status(400).json({ error: 'empresa_id é obrigatório' });
        }
        
        const offset = (parseInt(pagina) - 1) * parseInt(limite);
        let query = 'SELECT * FROM insumos WHERE empresa_id = $1';
        const params = [empresa_id];
        
        if (tipo) {
            query += ' AND tipo = $' + (params.length + 1);
            params.push(tipo);
        }
        
        // Contagem
        const countResult = await pool.query(
            'SELECT COUNT(*) as total FROM insumos WHERE empresa_id = $1' + (tipo ? ' AND tipo = $2' : ''),
            tipo ? [empresa_id, tipo] : [empresa_id]
        );
        
        query += ' ORDER BY codigo ASC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(parseInt(limite), offset);
        
        const insumos = await pool.query(query, params);
        
        return res.status(200).json({
            dados: insumos.rows,
            paginacao: {
                pagina: parseInt(pagina),
                limite: parseInt(limite),
                total: parseInt(countResult.rows[0].total)
            }
        });
        
    } catch (error) {
        console.error('[Insumos] Erro:', error.message);
        return res.status(500).json({ error: 'Erro interno' });
    }
};

// 3. IMPORTAÇÃO EM LOTE (SEGURA)
export const importarCatalogoLote = async (req, res) => {
    try {
        const { empresa_id, perfis } = req.body;
        
        if (!empresa_id) {
            return res.status(400).json({ error: 'empresa_id é obrigatório' });
        }
        
        if (!Array.isArray(perfis) || perfis.length === 0) {
            return res.status(400).json({ error: 'Array de perfis obrigatório' });
        }
        
        // Limite de segurança
        const MAX_LOTE = parseInt(process.env.MAX_LOTE_IMPORT || '500');
        if (perfis.length > MAX_LOTE) {
            return res.status(400).json({ 
                error: `Lote máximo: ${MAX_LOTE} perfis. Recebido: ${perfis.length}` 
            });
        }
        
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');
            
            let importados = 0;
            
            for (const perfil of perfis) {
                const dados = insumoSchema.parse({
                    ...perfil,
                    empresa_id: parseInt(empresa_id)
                });
                
                await client.query(
                    `INSERT INTO insumos (empresa_id, codigo, descricao, tipo, peso_metro, preco_unitario, unidade_medida)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     ON CONFLICT (empresa_id, codigo) DO UPDATE SET
                         descricao = EXCLUDED.descricao,
                         peso_metro = EXCLUDED.peso_metro,
                         preco_unitario = EXCLUDED.preco_unitario,
                         updated_at = NOW()`,
                    [dados.empresa_id, dados.codigo, dados.descricao, dados.tipo,
                     dados.peso_metro, dados.preco_unitario, dados.unidade_medida]
                );
                
                importados++;
            }
            
            await client.query('COMMIT');
            
            return res.status(201).json({
                message: 'Importação concluída',
                total_processado: importados
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error) {
        console.error('[Insumos] Erro importação:', error.message);
        return res.status(500).json({ error: 'Erro na importação em lote' });
    }
};
