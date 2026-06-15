import pool from '../src/config/db.js';

async function seed() {
    console.log("🚀 Iniciando a população do banco de dados...");

    try {
        // 1. Limpeza: Opcional, remove dados antigos para recomeçar do zero
        await pool.query('DELETE FROM insumos');
        console.log("🧹 Tabelas limpas.");

        // 2. Inserção de dados fictícios para o Tenant 1 e Tenant 2
        const insumos = [
            // Tenant 1 (Empresa A)
            [1, 'ALU-001', 'Perfil Aluminio 20mm', 'aluminio', 45.50, 'M', 0.8],
            [1, 'VID-001', 'Vidro Temperado 8mm', 'vidro', 120.00, 'M2', 20.0],
            
            // Tenant 2 (Empresa B)
            [2, 'ALU-002', 'Perfil Aluminio 30mm', 'aluminio', 65.00, 'M', 1.2],
            [2, 'ACC-001', 'Kit Rodanas Simples', 'acessorio', 15.00, 'UN', 0.1]
        ];

        for (const item of insumos) {
            await pool.query(
                `INSERT INTO insumos (empresa_id, codigo, descricao, tipo, preco_unitario, unidade_medida, peso_metro) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                item
            );
        }

        console.log("✅ Dados inseridos com sucesso!");
    } catch (err) {
        console.error("❌ Erro ao rodar seed:", err);
    } finally {
        await pool.end();
        console.log("🔌 Conexão encerrada.");
    }
}

seed();