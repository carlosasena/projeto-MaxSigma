/**
 * db.js - Configuração do Banco de Dados PostgreSQL
 * 
 * Melhorias:
 * - Retry logic para conexão
 * - Health check endpoint
 * - Monitoramento de pool
 */

import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const { Pool } = pg;

// Configuração robusta com retry logic
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'maxsigma_db',
  password: String(process.env.DB_PASSWORD || ''),
  port: Number(process.env.DB_PORT || 5432),
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Aumentado para 5s
  // Retry logic automática
  retryDelay: 1000,
  retryMax: 3
});

// Eventos de monitoramento do pool
pool.on('error', (err) => {
  console.error('[DB] Erro inesperado no pool de conexões:', err.message);
});

pool.on('connect', () => {
  console.log('[DB] Nova conexão estabelecida');
});

pool.on('remove', () => {
  console.log('[DB] Conexão removida do pool');
});

// Health check com retry
const testarConexao = async (tentativa = 1) => {
  const maxTentativas = 5;
  const tempoEspera = 2000;
  
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW() as now, version() as version');
    console.log('✅ Conexão com PostgreSQL estabelecida:', res.rows[0].now);
    console.log(`📦 Versão: ${res.rows[0].version.split(',')[0]}`);
    client.release();
  } catch (err) {
    console.error(`❌ Tentativa ${tentativa}/${maxTentativas} falhou:`, err.message);
    
    if (tentativa < maxTentativas) {
      console.log(`🔄 Aguardando ${tempoEspera/1000}s para nova tentativa...`);
      await new Promise(resolve => setTimeout(resolve, tempoEspera));
      return testarConexao(tentativa + 1);
    } else {
      console.error('❌ Falha crítica: Não foi possível conectar ao PostgreSQL');
      console.error('   Verifique se o container Docker está rodando: docker ps');
      throw err;
    }
  }
};

// Executa teste de conexão (não bloqueia inicialização)
testarConexao().catch(err => {
  console.warn('⚠️  Sistema iniciará, mas verifique a conectividade com o banco');
});

// Função auxiliar para obter cliente com retry
export async function getClientWithRetry() {
  let ultimoErro;
  for (let i = 0; i < 3; i++) {
    try {
      return await pool.connect();
    } catch (err) {
      ultimoErro = err;
      console.log(`🔄 Tentativa ${i + 1}/3 de conexão falhou, aguardando...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw ultimoErro;
}

export default pool;