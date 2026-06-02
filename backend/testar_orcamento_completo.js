import { criarOrcamento } from './src/controllers/orcamentosController.js';
import pool from './src/config/db.js';
import dotenv from 'dotenv';
dotenv.config();

async function rodarTesteOrcamento() {
    console.log("🧪 Iniciando Teste do Motor de Orçamentos Integrado...\n");

    // Simula o objeto 'req' (Request) que o frontend enviaria para criar um orçamento
    const reqSimulado = {
        body: {
            projeto_id: 1, // Tipologia/Projeto ID que queres simular
            largura_mm: 1500,
            altura_mm: 1200,
            mao_de_obra: 150.00,
            empresa_id: 1,
            status: 'Em Orçamento'
        }
    };

    // Simula o objeto 'res' (Response) do Express para capturar a resposta
    const resSimulado = {
        statusCode: 200,
        status: function(code) {
            this.statusCode = code;
            return this;
        },
        json: function(data) {
            console.log(`Status HTTP Retornado: ${this.statusCode}`);
            console.log("\n📊 ORÇAMENTO GERADO COM SUCESSO:");
            console.log(JSON.stringify(data, null, 2));
        }
    };

    try {
        // Executa a função do controlador passando os objetos simulados
        await criarOrcamento(reqSimulado, resSimulado);
    } catch (err) {
        console.error("❌ Falha crítica no teste:", err.message);
    } finally {
        // Encerra o pool do banco após o teste para o script não ficar travado no terminal
        await pool.end();
        process.exit(0);
    }
}

// Aguarda 1 segundo para o banco de dados inicializar a conexão
setTimeout(rodarTesteOrcamento, 1000);