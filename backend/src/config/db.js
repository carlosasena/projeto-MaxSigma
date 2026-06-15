import pg from 'pg';
import 'dotenv/config'; // Garante que as variáveis de ambiente sejam carregadas

const { Pool } = pg;

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432', 10),
});

// A chave é este "export" aqui:
export const testConnection = async () => {
    try {
        const client = await pool.connect();
        console.log('[DB] Conexão estabelecida com sucesso.');
        client.release();
        return true;
    } catch (err) {
        console.error('[DB] Erro ao conectar:', err.message);
        return false;
    }
};

export default pool;