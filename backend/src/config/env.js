import dotenv from 'dotenv';
import pino from 'pino';

dotenv.config();

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Validação de variáveis obrigatórias
const requiredVars = ['DB_USER', 'DB_HOST', 'DB_NAME', 'DB_PASSWORD'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    logger.error(`Variáveis de ambiente ausentes: ${missingVars.join(', ')}`);
    logger.error('Verifique o arquivo .env na raiz do projeto');
    
    if (process.env.NODE_ENV === 'production') {
        process.exit(1);
    } else {
        logger.warn('Usando valores padrão para desenvolvimento');
    }
}

// Valores default para desenvolvimento
if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
}

if (!process.env.PORT) {
    process.env.PORT = '3000';
}

logger.info(`[ENV] Ambiente: ${process.env.NODE_ENV}`);
logger.info(`[ENV] Banco: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
