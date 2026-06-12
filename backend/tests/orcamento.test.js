import { criarOrcamento } from '../src/controllers/orcamentosController.js';
import pool from '../src/config/db.js';

describe('Orçamento Completo - Integração', () => {
    
    beforeAll(async () => {
        // Verifica conexão com banco
        await pool.query('SELECT 1');
    });
    
    afterAll(async () => {
        await pool.end();
    });
    
    test('deve criar orçamento com sucesso', async () => {
        const req = {
            body: {
                projeto_id: 1,
                largura_mm: 1500,
                altura_mm: 1200,
                mao_de_obra: 150.00,
                empresa_id: 1,
                status: 'Em Orçamento'
            }
        };
        
        let responseData = null;
        let statusCode = null;
        
        const res = {
            status: function(code) {
                statusCode = code;
                return this;
            },
            json: function(data) {
                responseData = data;
                return this;
            }
        };
        
        await criarOrcamento(req, res);
        
        expect(statusCode).toBe(201);
        expect(responseData.sucesso).toBe(true);
        expect(responseData.orcamento).toBeDefined();
        expect(responseData.resumo.valor_final).toBeGreaterThan(0);
    });
    
    test('deve rejeitar sem projeto_id', async () => {
        const req = {
            body: {
                largura_mm: 1500,
                altura_mm: 1200
            }
        };
        
        let responseData = null;
        let statusCode = null;
        
        const res = {
            status: function(code) {
                statusCode = code;
                return this;
            },
            json: function(data) {
                responseData = data;
                return this;
            }
        };
        
        await criarOrcamento(req, res);
        
        expect(statusCode).toBe(400);
        expect(responseData.error).toContain('projeto_id');
    });
});
