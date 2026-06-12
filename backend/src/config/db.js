/**
 * db.js - Configuração do Pool PostgreSQL
 * ----------------------------------------
 * ✅ Pool único para toda aplicação
 * ✅ Retry automático em falhas
 * ✅ Health check integrado
 * ✅ Eventos monitorados
 */

import pg from 'pg';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const { Pool } = pg;

// Configuração robusta
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// Eventos de monitoramento
pool.on('connect', () => {
    logger.info('[DB] Nova conexão estabelecida');
});

pool.on('remove', () => {
    logger.info('[DB] Conexão removida do pool');
});

pool.on('error', (err) => {
    logger.error(`[DB] Erro inesperado: ${err.message}`);
});

// Health check com retry automático
const testarConexao = async (tentativa = 1) => {
    const maxTentativas = 5;
    const tempoEspera = 2000;
    
    try {
        const client = await pool.connect();
        const res = await client.query('SELECT NOW() as now, version() as version');
        logger.info(`[DB] Conectado ao PostgreSQL - ${res.rows[0].now}`);
        client.release();
        return true;
    } catch (err) {
        logger.warn(`[DB] Tentativa ${tentativa}/${maxTentativas} falhou: ${err.message}`);
        
        if (tentativa < maxTentativas) {
            await new Promise(resolve => setTimeout(resolve, tempoEspera));
            return testarConexao(tentativa + 1);
        }
        
        logger.error('[DB] Todas as tentativas de conexão falharam');
        throw err;
    }
};

// Inicia teste de conexão
testarConexao().catch(err => {
    logger.warn('[DB] Sistema iniciando sem banco de dados');
});

/**
 * Obtém cliente com retry automático
 */
export async function getClient() {
    for (let i = 0; i < 3; i++) {
        try {
            return await pool.connect();
        } catch (err) {
            logger.warn(`[DB] Retry ${i + 1}/3 para obter cliente`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    throw new Error('[DB] Não foi possível obter conexão após 3 tentativas');
}

export default pool;/**
 * db.js - Configuração do Pool PostgreSQL
 * ----------------------------------------
 * ✅ Pool único para toda aplicação
 * ✅ Retry automático em falhas
 * ✅ Health check integrado
 * ✅ Eventos monitorados
 */

import pg from 'pg';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const { Pool } = pg;

// Configuração robusta
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    max: parseInt(process.env.DB_POOL_MAX || '20'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

// Eventos de monitoramento
pool.on('connect', () => {
    logger.info('[DB] Nova conexão estabelecida');
});

pool.on('remove', () => {
    logger.info('[DB] Conexão removida do pool');
});

pool.on('error', (err) => {
    logger.error(`[DB] Erro inesperado: ${err.message}`);
});

// Health check com retry automático
const testarConexao = async (tentativa = 1) => {
    const maxTentativas = 5;
    const tempoEspera = 2000;
    
    try {
        const client = await pool.connect();
        const res = await client.query('SELECT NOW() as now, version() as version');
        logger.info(`[DB] Conectado ao PostgreSQL - ${res.rows[0].now}`);
        client.release();
        return true;
    } catch (err) {
        logger.warn(`[DB] Tentativa ${tentativa}/${maxTentativas} falhou: ${err.message}`);
        
        if (tentativa < maxTentativas) {
            await new Promise(resolve => setTimeout(resolve, tempoEspera));
            return testarConexao(tentativa + 1);
        }
        
        logger.error('[DB] Todas as tentativas de conexão falharam');
        throw err;
    }
};

// Inicia teste de conexão
testarConexao().catch(err => {
    logger.warn('[DB] Sistema iniciando sem banco de dados');
});

/**
 * Obtém cliente com retry automático
 */
export async function getClient() {
    for (let i = 0; i < 3; i++) {
        try {
            return await pool.connect();
        } catch (err) {
            logger.warn(`[DB] Retry ${i + 1}/3 para obter cliente`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    throw new Error('[DB] Não foi possível obter conexão após 3 tentativas');
}

export default pool;
