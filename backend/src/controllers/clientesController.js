import pool from '../config/db.js';
import { z } from 'zod';

// Schema de validação (Não precisamos mais obrigar o front-end a enviar o empresa_id aqui)
const clienteSchema = z.object({
    nome: z.string().min(3).max(100),
    email: z.string().email().optional().nullable(),
    telefone: z.string().max(20).optional().nullable()
});

// 1. CRIAR CLIENTE
export const criarCliente = async (req, res) => {
    try {
        const empresa_id = req.empresa_id; // ✅ Injetado via middleware de segurança
        
        if (!empresa_id) {
            return res.status(400).json({ error: 'Identificação da empresa (Tenant) ausente.' });
        }

        // Validação dos dados (Nome, Email, Telefone)
        const dados = clienteSchema.parse(req.body);
        
        // Verifica email duplicado estritamente dentro do mesmo tenant (empresa)
        if (dados.email) {
            const emailExistente = await pool.query(
                'SELECT id FROM clientes WHERE email = $1 AND empresa_id = $2',
                [dados.email, empresa_id]
            );
            
            if (emailExistente.rows.length > 0) {
                return res.status(409).json({ 
                    error: 'Email já cadastrado para esta empresa' 
                });
            }
        }
        
        const novoCliente = await pool.query(
            `INSERT INTO clientes (empresa_id, nome, email, telefone) 
             VALUES ($1, $2, $3, $4) 
             RETURNING id, nome, email, telefone, criado_em`,
            [empresa_id, dados.nome, dados.email, dados.telefone]
        );
        
        return res.status(201).json(novoCliente.rows[0]);
        
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({ 
                error: 'Dados inválidos',
                detalhes: error.errors 
            });
        }
        
        console.error('[Clientes] Erro ao criar:', error.message);
        return res.status(500).json({ error: 'Erro interno ao salvar cliente' });
    }
};

// 2. LISTAR CLIENTES (COM PAGINAÇÃO)
export const listarClientes = async (req, res) => {
    try {
        const empresa_id = req.empresa_id; // ✅ Injetado via middleware de segurança
        // CORREÇÃO: Extraindo explicitamente a variável "busca" enviada via query param
        const { pagina = 1, limite = 10, busca } = req.query; 
        
        if (!empresa_id) {
            return res.status(400).json({ 
                error: 'Identificação da empresa (Tenant) ausente.' 
            });
        }
        
        const offset = (parseInt(pagina) - 1) * parseInt(limite);
        
        // Query com busca opcional
        let query = 'SELECT id, nome, email, telefone, criado_em FROM clientes WHERE empresa_id = $1';
        const params = [empresa_id];
        
        // CORREÇÃO: Agora "busca" existe no escopo e funciona sem quebrar!
        if (busca) {
            query += ' AND (nome ILIKE $2 OR email ILIKE $2)';
            params.push(`%${busca}%`);
        }
        
        // Contagem total para a paginação correta no front-end
        let countQuery = 'SELECT COUNT(*) as total FROM clientes WHERE empresa_id = $1';
        const countParams = [empresa_id];
        if (busca) {
            countQuery += ' AND (nome ILIKE $2 OR email ILIKE $2)';
            countParams.push(`%${busca}%`);
        }
        
        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].total);
        
        // Dados paginados
        query += ' ORDER BY nome ASC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(parseInt(limite), offset);
        
        const clientes = await pool.query(query, params);
        
        return res.status(200).json({
            dados: clientes.rows,
            paginacao: {
                pagina: parseInt(pagina),
                limite: parseInt(limite),
                total,
                paginas: Math.ceil(total / parseInt(limite))
            }
        });
        
    } catch (error) {
        console.error('[Clientes] Erro ao listar:', error.message);
        return res.status(500).json({ error: 'Erro interno ao buscar clientes' });
    }
};

// 3. BUSCAR CLIENTE POR ID
export const buscarClientePorId = async (req, res) => {
    try {
        const { id } = req.params;
        const empresa_id = req.empresa_id; // ✅ CORREÇÃO: Captura segura do middleware de segurança, ignorando fraudes no query param
        
        if (!empresa_id) {
            return res.status(400).json({ error: 'Identificação da empresa (Tenant) ausente.' });
        }
        
        const cliente = await pool.query(
            'SELECT * FROM clientes WHERE id = $1 AND empresa_id = $2',
            [id, empresa_id]
        );
        
        if (cliente.rows.length === 0) {
            return res.status(404).json({ error: 'Cliente não encontrado' });
        }
        
        return res.status(200).json(cliente.rows[0]);
        
    } catch (error) {
        console.error('[Clientes] Erro ao buscar:', error.message);
        return res.status(500).json({ error: 'Erro interno' });
    }
};
