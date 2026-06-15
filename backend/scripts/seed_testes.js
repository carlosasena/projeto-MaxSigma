import pool from '../src/config/db.js';

async function seedTestes() {
    console.log("🧪 Iniciando carga de dados para testes de segurança...");

    try {
        await pool.query('DELETE FROM enderecos_obra');
        await pool.query('DELETE FROM clientes');
        console.log("🧹 Banco limpo.");

        // Inserção
        const c1 = await pool.query(
            `INSERT INTO clientes (empresa_id, nome, documento, ativo) VALUES (1, 'Cliente A - Tenant 1', '11111111111', true) RETURNING id`
        );
        const c2 = await pool.query(
            `INSERT INTO clientes (empresa_id, nome, documento, ativo) VALUES (2, 'Cliente B - Tenant 2', '22222222222', true) RETURNING id`
        );

        // Debug: Verifica se os IDs existem
        console.log("IDs Criados:", c1.rows[0].id, c2.rows[0].id);

       // Inserção das Obras - Forçando a conversão para Number
        const clienteId1 = Number(c1.rows[0].id);
        const clienteId2 = Number(c2.rows[0].id);

        await pool.query(
            `INSERT INTO enderecos_obra (empresa_id, cliente_id, descricao_obra, logradouro, numero, cidade, estado) 
             VALUES (1, $1, 'Obra Privada T1', 'Rua Exemplo T1', '100', 'Florianopolis', 'SC')`,
            [clienteId1] 
        );

        await pool.query(
            `INSERT INTO enderecos_obra (empresa_id, cliente_id, descricao_obra, logradouro, numero, cidade, estado) 
             VALUES (2, $1, 'Obra Privada T2', 'Rua Exemplo T2', '200', 'Curitiba', 'PR')`,
            [clienteId2]
        );

        console.log("✅ Dados inseridos com sucesso!");
    } catch (err) {
        console.error("❌ Erro no seed:", err);
    } finally {
        await pool.end();
    }
}

seedTestes();