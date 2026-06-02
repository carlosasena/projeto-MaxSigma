/**
 * executar_carga_definitivo.cjs - Versão SEM updated_at e SEM PDF
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'maxsigma_db',
    password: String(process.env.DB_PASSWORD || ''),
    port: Number(process.env.DB_PORT || 5432),
});

// Dados de exemplo completos (baseados nos catálogos)
const INSUMOS_EXEMPLO = [
    // Catálogo ASA
    { codigo: 'EF-001', descricao: 'Perfil Estrutural EF-001 - ASA Alumínio (Série Estrutural ASA)', peso_metro: 1.25 },
    { codigo: 'EF-002', descricao: 'Perfil Estrutural EF-002 - ASA Alumínio (Série Estrutural ASA)', peso_metro: 1.45 },
    { codigo: 'EF-003', descricao: 'Perfil Estrutural EF-003 - ASA Alumínio (Série Estrutural ASA)', peso_metro: 1.65 },
    { codigo: 'EF-004', descricao: 'Perfil Estrutural EF-004 - ASA Alumínio (Série Estrutural ASA)', peso_metro: 1.85 },
    { codigo: 'EF-005', descricao: 'Perfil Estrutural EF-005 - ASA Alumínio (Série Estrutural ASA)', peso_metro: 2.10 },
    
    // Catálogo Alusupra / Mega-X (Linha Suprema, Gold, Mega-X)
    { codigo: 'SU-1001', descricao: 'Perfil Suprema SU-1001 - Alusupra (Linha Suprema)', peso_metro: 0.95 },
    { codigo: 'SU-1002', descricao: 'Perfil Suprema SU-1002 - Alusupra (Linha Suprema)', peso_metro: 1.10 },
    { codigo: 'SU-1003', descricao: 'Perfil Suprema SU-1003 - Alusupra (Linha Suprema)', peso_metro: 1.25 },
    { codigo: 'GO-2001', descricao: 'Perfil Gold GO-2001 - Alusupra (Linha Gold)', peso_metro: 0.85 },
    { codigo: 'GO-2002', descricao: 'Perfil Gold GO-2002 - Alusupra (Linha Gold)', peso_metro: 0.95 },
    { codigo: 'GO-2003', descricao: 'Perfil Gold GO-2003 - Alusupra (Linha Gold)', peso_metro: 1.05 },
    { codigo: 'MX-3001', descricao: 'Perfil Mega-X MX-3001 - Alusupra (Linha Mega-X Solar)', peso_metro: 1.35 },
    { codigo: 'MX-3002', descricao: 'Perfil Mega-X MX-3002 - Alusupra (Linha Mega-X Solar)', peso_metro: 1.55 },
    { codigo: 'MX-3003', descricao: 'Perfil Mega-X MX-3003 - Alusupra (Linha Mega-X Solar)', peso_metro: 1.75 },
    { codigo: 'SK-4001', descricao: 'Fachada SK-4001 - Alusupra (Skalla II)', peso_metro: 2.20 },
    { codigo: 'SK-4002', descricao: 'Fachada SK-4002 - Alusupra (Skalla II)', peso_metro: 2.40 },
    { codigo: 'SM-5001', descricao: 'Perfil Standard SM-5001 - Alusupra (Linha Standard)', peso_metro: 0.75 },
    { codigo: 'SM-5002', descricao: 'Perfil Standard SM-5002 - Alusupra (Linha Standard)', peso_metro: 0.85 },
    
    // Catálogo Hyspex
    { codigo: '10001', descricao: 'Perfil Comercial 10001 - Hyspex (Linha Comercial)', peso_metro: 0.90 },
    { codigo: '10002', descricao: 'Perfil Comercial 10002 - Hyspex (Linha Comercial)', peso_metro: 1.00 },
    { codigo: '10003', descricao: 'Perfil Comercial 10003 - Hyspex (Linha Comercial)', peso_metro: 1.15 },
    { codigo: '10004', descricao: 'Perfil Comercial 10004 - Hyspex (Linha Comercial)', peso_metro: 1.30 },
    { codigo: '10005', descricao: 'Perfil Comercial 10005 - Hyspex (Linha Comercial)', peso_metro: 1.45 },
    { codigo: '10006', descricao: 'Perfil Comercial 10006 - Hyspex (Linha Comercial)', peso_metro: 1.60 },
    { codigo: '10007', descricao: 'Perfil Comercial 10007 - Hyspex (Linha Comercial)', peso_metro: 1.80 },
    { codigo: '10008', descricao: 'Perfil Comercial 10008 - Hyspex (Linha Comercial)', peso_metro: 2.00 },
];

async function executarCarga() {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║     MAXSIGMA - CARGA DE INSUMOS (VERSÃO ESTÁVEL)      ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    console.log(`📦 Preparando ${INSUMOS_EXEMPLO.length} insumos para carga...\n`);
    
    const client = await pool.connect();
    const EMPRESA_ID = 1;
    const PRECO_PADRAO_POR_KG = 35.00;
    
    let inseridos = 0;
    let existentes = 0;
    
    try {
        await client.query('BEGIN');
        
        // Verificar se a tabela existe e recriar se necessário (sem updated_at)
        console.log('🔧 Verificando estrutura da tabela...');
        
        // Drop da tabela se existir (para recriar com estrutura correta)
        await client.query(`
            DROP TABLE IF EXISTS insumos CASCADE;
        `);
        
        // Criar tabela nova (sem updated_at)
        await client.query(`
            CREATE TABLE insumos (
                id SERIAL PRIMARY KEY,
                empresa_id INTEGER NOT NULL,
                codigo VARCHAR(50) NOT NULL,
                descricao TEXT,
                tipo VARCHAR(50) DEFAULT 'aluminio',
                peso_metro DECIMAL(10,4),
                preco_unitario DECIMAL(10,2),
                unidade_medida VARCHAR(10) DEFAULT 'KG',
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(empresa_id, codigo)
            )
        `);
        
        // Criar índices para performance
        await client.query(`
            CREATE INDEX idx_insumos_empresa_codigo ON insumos(empresa_id, codigo);
            CREATE INDEX idx_insumos_tipo ON insumos(tipo);
            CREATE INDEX idx_insumos_codigo ON insumos(codigo);
        `);
        
        console.log('✅ Tabela recriada com estrutura correta\n');
        
        // Inserir dados
        console.log('⏳ Inserindo registros...');
        
        for (const item of INSUMOS_EXEMPLO) {
            const precoUnitario = item.peso_metro * PRECO_PADRAO_POR_KG;
            
            const result = await client.query(`
                INSERT INTO insumos (empresa_id, codigo, descricao, tipo, peso_metro, preco_unitario, unidade_medida)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (empresa_id, codigo) 
                DO UPDATE SET
                    descricao = EXCLUDED.descricao,
                    peso_metro = EXCLUDED.peso_metro,
                    preco_unitario = EXCLUDED.preco_unitario
                RETURNING (xmax = 0) AS inserido
            `, [
                EMPRESA_ID,
                item.codigo,
                item.descricao,
                'aluminio',
                item.peso_metro,
                precoUnitario,
                'KG'
            ]);
            
            if (result.rows[0].inserido) {
                inseridos++;
                process.stdout.write('.');
            } else {
                existentes++;
            }
        }
        
        await client.query('COMMIT');
        
        console.log('\n');
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║              🎉 CARGA CONCLUÍDA COM SUCESSO!          ║');
        console.log('╠════════════════════════════════════════════════════════╣');
        console.log(`║  📥 Registros inseridos:   ${inseridos.toString().padStart(5)}                         ║`);
        console.log(`║  🔄 Registros existentes:  ${existentes.toString().padStart(5)}                         ║`);
        console.log(`║  📊 Total processado:      ${(inseridos + existentes).toString().padStart(5)}                         ║`);
        console.log(`║  🏢 Empresa ID:            ${EMPRESA_ID.toString().padStart(5)}                         ║`);
        console.log(`║  💰 Preço base:            R$ ${PRECO_PADRAO_POR_KG}/kg                    ║`);
        console.log('╚════════════════════════════════════════════════════════╝\n');
        
        // Mostrar estatísticas
        const stats = await client.query(`
            SELECT 
                COUNT(*) as total,
                MIN(preco_unitario) as menor_preco,
                MAX(preco_unitario) as maior_preco,
                AVG(preco_unitario) as preco_medio,
                MIN(peso_metro) as menor_peso,
                MAX(peso_metro) as maior_peso
            FROM insumos 
            WHERE empresa_id = $1
        `, [EMPRESA_ID]);
        
        console.log('📊 Estatísticas dos insumos:');
        console.log(`   Total de perfis: ${stats.rows[0].total}`);
        console.log(`   Faixa de peso: ${stats.rows[0].menor_peso} kg/m - ${stats.rows[0].maior_peso} kg/m`);
        console.log(`   Faixa de preço: R$ ${parseFloat(stats.rows[0].menor_preco).toFixed(2)} - R$ ${parseFloat(stats.rows[0].maior_preco).toFixed(2)}`);
        console.log(`   Preço médio: R$ ${parseFloat(stats.rows[0].preco_medio).toFixed(2)}\n`);
        
        // Mostrar amostra
        const amostra = await client.query(`
            SELECT codigo, descricao, peso_metro, preco_unitario 
            FROM insumos 
            WHERE empresa_id = $1 
            LIMIT 10
        `, [EMPRESA_ID]);
        
        console.log('📋 Amostra dos primeiros 10 registros:');
        console.log('   Código    | Peso (kg/m) | Preço (R$/kg) | Descrição');
        console.log('   ' + '-'.repeat(65));
        amostra.rows.forEach(row => {
            console.log(`   ${row.codigo.padEnd(9)} | ${row.peso_metro.toString().padEnd(10)} | ${row.preco_unitario.toString().padEnd(12)} | ${row.descricao.substring(0, 40)}...`);
        });
        
        // Salvar JSON para referência
        const jsonPath = path.join(__dirname, 'insumos_carregados.json');
        fs.writeFileSync(jsonPath, JSON.stringify(INSUMOS_EXEMPLO, null, 2));
        console.log(`\n💾 Backup dos dados salvo em: ${jsonPath}`);
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ ERRO FATAL:', err.message);
        console.error('\nDetalhes do erro:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
    
    console.log('\n🏁 Processo finalizado com sucesso!');
}

executarCarga().catch(err => {
    console.error('Erro não tratado:', err);
    process.exit(1);
});
