import pg from 'pg';

const { Pool } = pg;

// Configuração robusta da piscina de conexões (Padrão Enterprise SaaS)
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME, // Alinhado com o seu .env atualizado
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  
  // Configurações de Performance do DeepSeek:
  max: 20, 
  idleTimeoutMillis: 30000, 
  connectionTimeoutMillis: 2000, 
});

// Teste rápido de conexão seguro e assíncrono
const testarConexao = async () => {
  try {
    const cliente = await pool.connect();
    const res = await cliente.query('SELECT NOW()');
    console.log('🚀 Conexão com o banco de dados estabelecida com sucesso em:', res.rows[0].now);
    cliente.release(); 
  } catch (err) {
    console.error('❌ Erro crítico ao conectar no PostgreSQL do Docker:', err.message);
  }
};

testarConexao();

export default pool;