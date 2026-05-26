import pg from 'pg';
import dotenv from 'dotenv';

// Carrega as variáveis do arquivo .env
dotenv.config();

const { Pool } = pg;

// Configura o ponto de encontro com o Postgres do Docker
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Teste rápido para avisar no terminal se a conexão deu certo
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Erro ao conectar no PostgreSQL do Docker:', err.stack);
  } else {
    console.log('🚀 Conexão com o banco de dados estabelecida com sucesso em:', res.rows[0].now);
  }
});

export default pool;