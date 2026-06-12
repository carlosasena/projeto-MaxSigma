import pool from '../config/db.js';
import { z } from 'zod';

// ✅ CORREÇÃO: Removeu o empresa_id daqui para o front-end não poder fraudar o ID
const insumoSchema = z.object({
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
        const empresa_id = req.empresa_id; // ✅ Captura segura do middleware
        
        if (!empresa_id) {
            return res.status(400).json({ error: 'Identificação da empresa (Tenant) ausente.' });
        }

        const dados = insumoSchema.parse(req.body);
        
        const novo = await pool.query(
            `INSERT INTO insumos (empresa_id, codigo, descricao, tipo, preco_unitario, unidade_medida, peso_metro) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             ON CONFLICT (empresa_id, codigo) DO UPDATE SET
                 descricao = EXCLUDED.descricao,
                 tipo = EXCLUDED.tipo,
                 preco_unitario = EXCLUDED.preco_unitario,
                 unidade_medida = EXCLUDED.unidade_medida,
                 peso_metro = EXCLUDED.peso_metro,
                 updated_at = NOW()
             RETURNING *`,
            [empresa_id, dados.codigo.toUpperCase().trim(), dados.descricao, 
             dados.tipo, dados.preco_unitario, dados.unidade_medida, dados.peso_metro]
        );
        
        return res.status(201).json(novo.rows[0]);
        
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Dados inválidos', detalhes: error.errors });
        }
        console.error('[Insumos] Erro ao criar:', error.message);
        return res.status(500).json({ error: 'Erro interno ao salvar insumo' });
    }
};

// 2. LISTAR INSUMOS (COM FILTRO POR TENANT)
export const listarInsumos = async (req, res) => {
    try {
        const empresa_id = req.empresa_id; // ✅ Isolamento estrito de dados
        const { tipo, busca } = req.query;

        if (!empresa_id) {
            return res.status(400).json({ error: 'Identificação da empresa (Tenant) ausente.' });
        }

        let query = 'SELECT * FROM insumos WHERE empresa_id = $1';
        const params = [empresa_id];

        if (tipo) {
            query += ' AND tipo = $' + (params.length + 1);
            params.push(tipo);
        }

        if (busca) {
            query += ' AND (codigo ILIKE $' + (params.length + 1) + ' OR descricao ILIKE $' + (params.length + 1) + ')';
            params.push(`%${busca}%`);
        }

        query += ' ORDER BY codigo ASC';

        const insumos = await pool.query(query, params);
        return res.status(200).json(insumos.rows);

    } catch (error) {
        console.error('[Insumos] Erro ao listar:', error.message);
        return res.status(500).json({ error: 'Erro interno ao buscar insumos' });
    }
};

// 3. IMPORTAR CATÁLOGO EM LOTE
export const importarCatalogoLote = async (req, res) => {
    try {
        const empresa_id = req.empresa_id; // ✅ Captura segura do middleware
        const perfis = req.body;

        if (!empresa_id) {
            return res.status(400).json({ error: 'Identificação da empresa (Tenant) ausente.' });
        }

        if (!Array.isArray(perfis)) {
            return res.status(400).json({ error: 'O corpo da requisição deve ser um array de perfis' });
        }

        const client = await pool.connect();
        let importados = 0;

        try {
            await client.query('BEGIN');

            for (const perfil of perfis) {
                const dados = insumoSchema.parse({
                    ...perfil,
                    preco_unitario: perfil.preco_unitario ? parseFloat(perfil.preco_unitario) : 0,
                    peso_metro: perfil.peso_metro ? parseFloat(perfil.peso_metro) : 0
                });
                
                await client.query(
                    `INSERT INTO insumos (empresa_id, codigo, descricao, tipo, peso_metro, preco_unitario, unidade_medida)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     ON CONFLICT (empresa_id, codigo) DO UPDATE SET
                         descricao = EXCLUDED.descricao,
                         peso_metro = EXCLUDED.peso_metro,
                         preco_unitario = EXCLUDED.preco_unitario,
                         updated_at = NOW()`,
                    [empresa_id, dados.codigo.toUpperCase().trim(), dados.descricao, dados.tipo,
                     dados.peso_metro, dados.preco_unitario, dados.unidade_medida]
                );
                
                importados++;
            }
            
            await client.query('COMMIT');
            
            return res.status(201).json({
                sucesso: true,
                message: 'Importação concluída com sucesso',
                total_processado: importados
            });
            
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
        
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ error: 'Erro de validação no lote de insumos', detalhes: error.errors });
        }
        console.error('[Insumos] Erro importação:', error.message);
        return res.status(500).json({ error: 'Erro na importação em lote' });
    }
};
