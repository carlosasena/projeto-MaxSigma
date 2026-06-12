import './config/env.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pino from 'pino';

import clientesRoutes from './routes/clientesRoutes.js';
import insumosRoutes from './routes/insumosRoutes.js';
import orcamentosRoutes from './routes/orcamentosRoutes.js';
import tipologiasRoutes from './routes/tipologiasRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Logger estruturado
const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: { colorize: true }
    } : undefined
});

// ============================================
// MIDDLEWARES GLOBAIS DE SEGURANÇA
// ============================================

// Helmet: headers de segurança HTTP
app.use(helmet());

// CORS: Restrito em produção
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? process.env.ALLOWED_ORIGINS?.split(',') 
        : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID']
}));

// Rate Limiting: Proteção contra abusos
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
    message: { error: 'Muitas requisições. Tente novamente mais tarde.' }
});
app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================
// LOGGING MIDDLEWARE
// ============================================
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
// ROTAS
// ============================================

// Health Check (separado da raiz)
app.get('/health', async (req, res) => {
    try {
        const pool = (await import('./config/db.js')).default;
        await pool.query('SELECT 1');
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        });
    } catch (err) {
        res.status(503).json({
            status: 'unhealthy',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Database connection failed'
        });
    }
});

// Rota raiz informativa
app.get('/', (req, res) => {
    res.status(200).json({
        name: 'MaxSigma API',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        docs: '/api/docs',
        health: '/health'
    });
});

// Rotas da aplicação
app.use('/clientes', clientesRoutes);
app.use('/insumos', insumosRoutes);
app.use('/orcamentos', orcamentosRoutes);
app.use('/tipologias', tipologiasRoutes);

// ============================================
// TRATAMENTO DE ERROS
// ============================================

// Rota não encontrada
app.use((req, res) => {
    res.status(404).json({
        error: 'Rota não encontrada',
        path: req.originalUrl,
        method: req.method
    });
});

// Erro global (middleware com 4 parâmetros)
app.use((err, req, res, next) => {
    logger.error({
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.originalUrl,
        method: req.method
    });
    
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'Erro interno do servidor' 
            : err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ============================================
// INICIALIZAÇÃO
// ============================================

app.listen(PORT, () => {
    logger.info(`MaxSigma rodando na porta ${PORT}`);
    logger.info(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Health check: http://localhost:${PORT}/health`);
});

export default app;
