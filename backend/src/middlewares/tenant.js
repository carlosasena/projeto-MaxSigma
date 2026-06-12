export const verificarTenant = (req, res, next) => {
    const tenantId = req.headers['x-tenant-id'];
    
    // 1. Bloqueia se o cabeçalho estiver completamente ausente
    if (!tenantId) {
        return res.status(401).json({ 
            error: 'Acesso negado. O cabeçalho de identificação da empresa (X-Tenant-ID) está ausente.' 
        });
    }
    
    const parsedId = parseInt(tenantId, 10);
    
    // 2. Bloqueia se não for um número válido ou se for menor/igual a zero
    if (isNaN(parsedId) || parsedId <= 0) {
        return res.status(400).json({ 
            error: 'Identificação da empresa (X-Tenant-ID) inválida.' 
        });
    }
    
    // Injeta o ID 100% limpo e validado na requisição para uso seguro nos controladores
    req.empresa_id = parsedId;
    next();
};
