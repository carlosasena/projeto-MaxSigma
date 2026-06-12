/**
 * extratorCatalogo.js — MaxSigma ERP
 * Extrator de PDFs de catálogos de alumínio
 */

import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const pastaUtils = path.join(__dirname, '..', 'utils');

const { default: pdfParse } = await import('pdf-parse');

const CATALOGOS = [
    {
        nomeArquivo: 'catalogo-perfis-asa-2019.pdf',
        origem: 'ASA Alumínio',
        linhaPadrao: 'Série Estrutural ASA',
        regexFonte: String.raw`([A-Z]{2,3}-\d{3,4})\s+[^\n]{0,80}?(\d{1,2}[.,]\d{2,4})\s*(kg\/m)`,
        regexFlags: 'gi',
    },
    {
        nomeArquivo: 'Catálogo de Perfis 07.11.2025.pdf',
        origem: 'Alusupra / Mega-X',
        linhaPadrao: 'Linha Suprema / Mega-X',
        regexFonte: String.raw`(MX-\d{3,4}|SM-\d{3,4}|SU-\d{3,4}|GO-\d{3,4}|SK-\d{3,4}|[A-Z]{2}-\d{3,4})\s+[^\n]{0,80}?(\d{1,2}[.,]\d{2,4})\s*(KG\/Barra\s+6m|kg\/m)`,
        regexFlags: 'gi',
    },
    {
        nomeArquivo: 'Catalogo_Geral_Hyspex_Aluminio_2020.pdf',
        origem: 'Hyspex',
        linhaPadrao: 'Linha Comercial Hyspex',
        regexFonte: String.raw`\b(\d{5})\b\s+[^\n]{0,80}?(\d{1,2}[.,]\d{2,4})\s*(Kg\/m)`,
        regexFlags: 'gi',
    },
];

const PREFIXO_LINHA = {
    SU: 'Linha Suprema',
    GO: 'Linha Gold',
    MX: 'Linha Mega-X Solar',
    SK: 'Fachada Skalla II',
    SM: 'Linha Standard',
};

function resolverLinha(codigo, linhaPadrao) {
    const prefixo = codigo.substring(0, 2).toUpperCase();
    return PREFIXO_LINHA[prefixo] ?? linhaPadrao;
}

function sanitizarTexto(texto) {
    return texto
        .replace(/-\n([a-záéíóúãõâêîôûàç])/gi, '$1')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/[^\x20-\x7E\xC0-\xFF\n]/g, ' ');
}

async function extrairTodosOsCatalogos() {
    console.log('[Extrator] Iniciando extração de catálogos...\n');
    
    const mapaInsumos = new Map();
    
    for (const catalogo of CATALOGOS) {
        const caminhoCompleto = path.join(pastaUtils, catalogo.nomeArquivo);
        
        if (!fs.existsSync(caminhoCompleto)) {
            console.warn(`[Extrator] Arquivo não encontrado: ${catalogo.nomeArquivo}`);
            continue;
        }
        
        console.log(`[Extrator] Processando: ${catalogo.nomeArquivo}`);
        
        try {
            const buffer = fs.readFileSync(caminhoCompleto);
            const parsed = await pdfParse(buffer);
            const texto = sanitizarTexto(parsed.text);
            const regex = new RegExp(catalogo.regexFonte, catalogo.regexFlags);
            
            let match;
            let contador = 0;
            
            while ((match = regex.exec(texto)) !== null) {
                const codigo = match[1].toUpperCase().trim();
                const unidade = (match[3] ?? 'kg/m').toLowerCase();
                let pesoRaw = parseFloat(match[2].replace(',', '.'));
                
                if (unidade.includes('barra')) {
                    pesoRaw = parseFloat((pesoRaw / 6).toFixed(4));
                }
                
                if (pesoRaw < 0.05 || pesoRaw > 30.0) continue;
                if (mapaInsumos.has(codigo)) continue;
                
                mapaInsumos.set(codigo, {
                    codigo,
                    descricao: `Perfil Alumínio ${codigo} — ${catalogo.origem}`,
                    peso_metro: pesoRaw,
                    tipo: 'aluminio',
                    linha: resolverLinha(codigo, catalogo.linhaPadrao),
                });
                
                contador++;
            }
            
            console.log(`[Extrator]   ${contador} perfis extraídos`);
            
        } catch (err) {
            console.error(`[Extrator] Erro ao processar ${catalogo.nomeArquivo}: ${err.message}`);
        }
    }
    
    const listaFinal = Array.from(mapaInsumos.values());
    console.log(`\n[Extrator] Total consolidado: ${listaFinal.length} perfis`);
    
    const destino = path.join(pastaUtils, 'carga_massiva_total.json');
    fs.writeFileSync(destino, JSON.stringify(listaFinal, null, 2), 'utf-8');
    console.log(`[Extrator] JSON salvo em: ${destino}`);
}

extrairTodosOsCatalogos().catch(err => {
    console.error('[Extrator] Erro crítico:', err.message);
    process.exit(1);
});
