import dotenv from 'dotenv';
import pino from 'pino';

// Carrega as variáveis de ambiente do arquivo .env na raiz do projeto
dotenv.config();

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// 1. Configura o ambiente padrão caso não esteja definido
if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
}

// 2. CORREÇÃO: Aplica de fato os valores padrão se estivermos em desenvolvimento
if (process.env.NODE_ENV === 'development') {
    process.env.PORT = process.env.PORT || '3000';
    process.env.DB_HOST = process.env.DB_HOST || 'localhost';
    process.env.DB_PORT = process.env.DB_PORT || '5432';
    process.env.DB_NAME = process.env.DB_NAME || 'maxsigma_db';
    process.env.DB_USER = process.env.DB_USER || 'admin';
    process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'senha_segura_123';
}

// 3. Validação estrita de variáveis obrigatórias (Crítico para Produção)
const requiredVars = ['DB_USER', 'DB_HOST', 'DB_NAME', 'DB_PASSWORD'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    logger.error(`❌ [ENV] Variáveis de ambiente obrigatórias ausentes: ${missingVars.join(', ')}`);
    logger.error('Por favor, verifique o seu arquivo .env na raiz do projeto.');
    
    if (process.env.NODE_ENV === 'production') {
        logger.fatal('Encerramento forçado: O sistema não pode rodar em produção sem essas variáveis.');
        process.exit(1);
    }
}

// 4. Logs de inicialização limpos e informativos
logger.info(`[ENV] Ambiente ativo: ${process.env.NODE_ENV.toUpperCase()}`);
logger.info(`[ENV] API MaxSigma escutando na porta: ${process.env.PORT}`);
logger.info(`[ENV] Conexão mapeada para: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);