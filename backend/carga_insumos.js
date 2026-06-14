import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pool from './src/config/db.js'; // Importa a versão ESM real do seu db.js

// Recria o __dirname que não existe nativamente no modo ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega o .env subindo um nível se ele estiver na raiz do projeto, ou na mesma pasta
dotenv.config({ path: path.join(__dirname, '.env') });

// Lê a semente JSON usando o fs
const INSUMOS_EXEMPLO = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'src', 'seeds', 'insumos_base.json'), 'utf-8')
);

const EMPRESA_ID = parseInt(process.argv[2]) || null;
const PRECO_PADRAO_POR_KG = parseFloat(process.env.PRECO_PADRAO_KG || '35.00');

async function executarCarga() {
  
    if (process.env.NODE_ENV === 'production' && !process.env.FORCE_RECREATE) {
        console.error('[CARGA] Bloqueado em produção. Use FORCE_RECREATE=true para forçar.');
        process.exit(1);
    }

    if (!EMPRESA_ID) {
        console.error('[CARGA] Uso: node carga_insumos.js <EMPRESA_ID>');
        console.error('[CARGA] Exemplo: node carga_insumos.js 1');
        process.exit(1);
    }

    console.log(`[CARGA] Iniciando carga para empresa ID: ${EMPRESA_ID}`);
    console.log(`[CARGA] Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[CARGA] Total de insumos: ${INSUMOS_EXEMPLO.length}`);

    const client = await pool.connect();
    
    let inseridos = 0;
    let atualizados = 0;
    
    try {
        await client.query('BEGIN');
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS insumos (
                id SERIAL PRIMARY KEY,
                empresa_id INTEGER NOT NULL,
                codigo VARCHAR(50) NOT NULL,
                descricao TEXT,
                tipo VARCHAR(50) DEFAULT 'aluminio',
                peso_metro DECIMAL(10,4),
                preco_unitario DECIMAL(10,2),
                unidade_medida VARCHAR(10) DEFAULT 'KG',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(empresa_id, codigo)
            )
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_insumos_empresa_codigo ON insumos(empresa_id, codigo);
            CREATE INDEX IF NOT EXISTS idx_insumos_tipo ON insumos(tipo);
        `);

        console.log('[CARGA] Estrutura verificada. Inserindo registros...');
        
        const batchSize = 50;
        for (let i = 0; i < INSUMOS_EXEMPLO.length; i += batchSize) {
            const batch = INSUMOS_EXEMPLO.slice(i, i + batchSize);
            
            for (const item of batch) {
                const precoUnitario = (item.peso_metro * PRECO_PADRAO_POR_KG).toFixed(2);
                
                // CORREÇÃO: Parêntese fechando a query corretamente antes do array de parâmetros
                const result = await client.query(`
                    INSERT INTO insumos (empresa_id, codigo, descricao, tipo, peso_metro, preco_unitario, unidade_medida)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (empresa_id, codigo) 
                    DO UPDATE SET
                        descricao = EXCLUDED.descricao,
                        peso_metro = EXCLUDED.peso_metro,
                        preco_unitario = EXCLUDED.preco_unitario,
                        updated_at = NOW()
                    RETURNING (xmax = 0) AS inserido
                `, [
                    EMPRESA_ID,
                    item.codigo,
                    item.descricao,
                    item.tipo || 'aluminio',
                    item.peso_metro,
                    precoUnitario,
                    item.unidade_medida || 'KG'
                ]);
                
                if (result.rows[0]?.inserido) {
                    inseridos++;
                } else {
                    atualizados++;
                }
            }
            
            console.log(`[CARGA] Progresso: ${Math.min(i + batchSize, INSUMOS_EXEMPLO.length)}/${INSUMOS_EXEMPLO.length}`);
        }
        
        await client.query('COMMIT');
        
        console.log('\n========================================');
        console.log('       CARGA CONCLUÍDA COM SUCESSO       ');
        console.log('========================================');
        console.log(`  Inseridos:   ${inseridos}`);
        console.log(`  Atualizados: ${atualizados}`);
        console.log(`  Total:       ${inseridos + atualizados}`); 
        console.log(`  Empresa ID:  ${EMPRESA_ID}`);
        console.log(`  Preço base:  R$ ${PRECO_PADRAO_POR_KG}/kg`);
        console.log('========================================\n');
        
        // Estatísticas
        const stats = await client.query(`
            SELECT 
                COUNT(*) as total,
                ROUND(MIN(preco_unitario)::numeric, 2) as menor_preco,
                ROUND(MAX(preco_unitario)::numeric, 2) as maior_preco,
                ROUND(AVG(preco_unitario)::numeric, 2) as preco_medio
            FROM insumos 
            WHERE empresa_id = $1
        `, [EMPRESA_ID]);
        
        if (stats.rows.length > 0) {
            const s = stats.rows[0];
            console.log(`[CARGA] Total perfis: ${s.total}`);
            console.log(`[CARGA] Faixa preço: R$ ${s.menor_preco} - R$ ${s.maior_preco}`);
            console.log(`[CARGA] Preço médio: R$ ${s.preco_medio}`);
        }
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[CARGA] ERRO CRÍTICO:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

executarCarga().catch(err => {
    console.error('[CARGA] Erro não tratado:', err);
    process.exit(1);
});
