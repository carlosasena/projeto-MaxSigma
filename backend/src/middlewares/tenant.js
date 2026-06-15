/**
 * Middleware de isolamento Multi-Tenant
 * 
 * Segue o mapa do sistema: injeta req.tenantId para uso em TODOS os controllers
 * Mantém compatibilidade com req.empresa_id para código legado
 */

// Cache simples de tenants válidos (em produção, use Redis)
const tenantCache = new Map();

export const verificarTenant = (req, res, next) => {
    const tenantId = req.headers['x-tenant-id'] || req.headers['x-tenant'];
    
    // 1. Bloqueia se o cabeçalho estiver completamente ausente
    if (!tenantId) {
        return res.status(401).json({ 
            error: 'TENANT_REQUIRED',
            message: 'Header X-Tenant-ID é obrigatório. Exemplo: X-Tenant-ID: 1' 
        });
    }
    
    const parsedId = parseInt(tenantId, 10);
    
    // 2. Validação do formato
    if (isNaN(parsedId) || parsedId <= 0) {
        return res.status(400).json({ 
            error: 'INVALID_TENANT',
            message: 'X-Tenant-ID deve ser um número positivo' 
        });
    }
    
    // 3. Verifica se o tenant existe (opcional - descomente quando tiver tabela de empresas)
    // const tenantExists = tenantCache.get(parsedId);
    // if (tenantExists === undefined) {
    //     // TODO: Verificar no banco se empresa existe
    //     tenantCache.set(parsedId, true);
    //     setTimeout(() => tenantCache.delete(parsedId), 5 * 60 * 1000);
    // }
    // if (!tenantExists) {
    //     return res.status(403).json({ error: 'TENANT_NOT_FOUND', message: `Tenant ${parsedId} não encontrado` });
    // }
    
    // 4. INJEÇÃO CONSISTENTE - PRIORIDADE para tenantId
    req.tenantId = parsedId;
    
    // Mantém compatibilidade com código legado (será removido gradualmente)
    req.empresa_id = parsedId;
    
    next();
};

// Middleware para rotas públicas (sem tenant)
export const skipTenant = (req, res, next) => {
    req.tenantId = null;
    req.empresa_id = null;
    next();
};

// Middleware para logging do tenant
export const logTenant = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const tenant = req.tenantId || req.headers['x-tenant-id'] || 'anonymous';
        console.log(`[TENANT:${tenant}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
};

// Helper para queries com tenant
export const withTenant = (query, tenantId) => {
    return {
        text: query,
        params: [tenantId]
    };
};

export default verificarTenant;