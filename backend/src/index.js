import './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import pinoPretty from 'pino-pretty';

// Importação das Rotas
import clientesRoutes from './routes/clientesRoutes.js';
import insumosRoutes from './routes/insumosRoutes.js';
import orcamentosRoutes from './routes/orcamentosRoutes.js';
import tipologiasRoutes from './routes/tipologiasRoutes.js';

// Importação do middleware de tenant
import { verificarTenant, logTenant } from './middlewares/tenant.js';

// Importação da conexão de banco
import pool, { testConnection } from './config/db.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Logger
const logger = pino(
    pinoPretty({
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
    })
);

// ============================================
// 1. MIDDLEWARES GLOBAIS (ORDEM CORRETA É CRÍTICA)
// ============================================

// Security Headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
        },
    },
}));

// CORS (deve vir antes das rotas)
app.use(cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001', 'http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Tenant'],
    exposedHeaders: ['X-Total-Count', 'X-Pagination'],
}));

// Rate Limiting (proteção contra DDoS)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
    message: { error: 'Muitas requisições. Tente novamente mais tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health', // Health check não tem rate limit
});
app.use('/api/', limiter);

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging de requisições (deve vir antes das rotas)
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info({
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            tenant: req.headers['x-tenant-id'] || 'anonymous'
        });
    });
    next();
});

// ============================================
// 2. HEALTH CHECK (SEM TENANT, SEM RATE LIMIT)
// ============================================
app.get('/health', async (req, res) => {
    let client;
    try {
        const dbConnected = await testConnection();
        res.status(200).json({ 
            status: 'healthy', 
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            database: dbConnected ? 'connected' : 'disconnected',
            version: '1.0.0'
        });
    } catch (err) {
        res.status(503).json({ 
            status: 'unhealthy', 
            error: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ============================================
// 3. MIDDLEWARE DE TENANT (APLICADO ANTES DAS ROTAS)
// ============================================
app.use('/api', logTenant);

// ============================================
// 4. ROTAS DA API (TODAS COM PREFIXO /api CONFORME MAPA)
// ============================================
app.use('/api/clientes', verificarTenant, clientesRoutes);
app.use('/api/insumos', verificarTenant, insumosRoutes);
app.use('/api/orcamentos', verificarTenant, orcamentosRoutes);
app.use('/api/tipologias', verificarTenant, tipologiasRoutes);

// Rota de documentação básica (opcional)
app.get('/api', (req, res) => {
    res.json({
        name: 'MaxSigma API',
        version: '1.0.0',
        endpoints: {
            clientes: '/api/clientes',
            insumos: '/api/insumos',
            orcamentos: '/api/orcamentos',
            tipologias: '/api/tipologias',
            health: '/health'
        },
        documentation: 'Para usar, envie header X-Tenant-ID com o ID da empresa'
    });
});

// Rota 404 para endpoints não encontrados
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'NOT_FOUND',
        message: `Rota ${req.originalUrl} não encontrada`,
        availableEndpoints: ['/api/clientes', '/api/insumos', '/api/orcamentos', '/api/tipologias', '/health']
    });
});

// ============================================
// 5. HANDLER DE ERROS GLOBAL (DEVE SER O ÚLTIMO MIDDLEWARE)
// ============================================
app.use((err, req, res, next) => {
    logger.error(`[ERRO FATAL] ${err.message}`);
    logger.error(err.stack);
    
    // Erro de sintaxe JSON
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            error: 'INVALID_JSON',
            message: 'JSON inválido na requisição. Verifique a sintaxe.',
        });
    }
    
    // Erro de validação
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: err.message,
            details: err.details
        });
    }
    
    // Erro genérico
    const status = err.status || 500;
    res.status(status).json({ 
        error: err.name || 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production' ? 'Erro interno do servidor' : err.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// ============================================
// 6. INICIALIZAÇÃO DO SERVIDOR
// ============================================
async function startServer() {
    try {
        // Testa conexão com o banco ANTES de iniciar
        const dbConnected = await testConnection();
        if (!dbConnected) {
            logger.error('❌ Não foi possível conectar ao PostgreSQL. Verifique suas credenciais no .env');
            logger.error('   DB_HOST=localhost, DB_PORT=5432, DB_NAME=maxsigma_db, DB_USER=admin');
            process.exit(1);
        }
        
        logger.info('✅ Conexão com PostgreSQL estabelecida');
        
        // Inicia o servidor
        app.listen(PORT, () => {
            logger.info(`🚀 Servidor MaxSigma rodando em http://localhost:${PORT}`);
            logger.info(`📊 Health check: http://localhost:${PORT}/health`);
            logger.info(`📚 Documentação: http://localhost:${PORT}/api`);
            logger.info(`🏢 Ambiente: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`🔒 Rate Limit: 1000 req / 15min (dev) ou 100 req / 15min (prod)`);
            logger.info('');
            logger.info(`🔑 Para usar a API, envie o header:`);
            logger.info(`   X-Tenant-ID: 1`);
            logger.info('');
            logger.info(`📌 Exemplo de requisição:`);
            logger.info(`   curl -H "X-Tenant-ID: 1" http://localhost:${PORT}/api/clientes`);
        });
    } catch (err) {
        logger.error('❌ Erro fatal ao iniciar servidor:', err.message);
        process.exit(1);
    }
}

// Tratamento de sinais para desligamento gracioso
process.on('SIGTERM', () => {
    logger.info('SIGTERM recebido. Finalizando conexões...');
    pool.end().then(() => {
        logger.info('Pool de conexões fechado');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT recebido. Finalizando conexões...');
    pool.end().then(() => {
        logger.info('Pool de conexões fechado');
        process.exit(0);
    });
});

// Inicia o servidor
startServer();

export default app;