/**
 * extratorCatalogo.js — MaxSigma ERP
 * ----------------------------------------------------
 * Responsabilidade : Varrer PDFs de catálogos técnicos
 *                    de alumínio e consolidar os perfis
 *                    em `carga_massiva_total.json`.
 *
 * Saída garantida por perfil:
 *   { codigo, descricao, peso_metro, tipo }
 *
 * Engenharia : Claude (Codificação & Arquitetura)
 * Escopo     : aprovado pelo Gemini (Gerente de Projeto)
 * ----------------------------------------------------
 */

import fs   from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

// ─── Resolução de caminhos compatível com ESM ────────────────────────────────
const __dirname  = path.dirname(new URL(import.meta.url).pathname);
const pastaUtils = path.join(__dirname, 'src', 'utils');

// ─── Importação dinâmica do pdf-parse (compatível com ESM sem createRequire) ──
// pdf-parse é um módulo CJS; o import() dinâmico resolve sem hacks.
const { default: pdfParse } = await import('pdf-parse');


// ═════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO DOS CATÁLOGOS
// Cada entrada define: arquivo, origem, linha comercial e a regex de extração.
//
// COMO A REGEX FUNCIONA:
//   Grupo 1 → código do perfil  (ex: MX-210, SU-601, 12345)
//   Grupo 2 → valor numérico do peso
//   Grupo 3 → unidade           (kg/m  ou  KG/Barra 6m)
//
// ⚠️  IMPORTANTE — NÃO use o flag /g diretamente no objeto de configuração.
//     Regex com /g mantém estado interno (.lastIndex). Recriamos a regex
//     a cada catálogo via new RegExp() para evitar matches pulados.
// ═════════════════════════════════════════════════════════════════════════════
const CATALOGOS = [
  {
    nomeArquivo  : 'catalogo-perfis-asa-2019.pdf',
    origem       : 'ASA Alumínio',
    linhaPadrao  : 'Série Estrutural ASA',
    // Padrão: "AB-123  ... 1,245 kg/m"
    regexFonte   : String.raw`([A-Z]{2,3}-\d{3,4})\s+[^\n]{0,80}?(\d{1,2}[.,]\d{2,4})\s*(kg\/m)`,
    regexFlags   : 'gi',
  },
  {
    nomeArquivo  : 'Catálogo de Perfis 07.11.2025.pdf',
    origem       : 'Alusupra / Mega-X',
    linhaPadrao  : 'Linha Suprema / Mega-X',
    // Padrão: "MX-210  ... 2,340 KG/Barra 6m"  ou  "SM-101 ... 1,120 kg/m"
    regexFonte   : String.raw`(MX-\d{3,4}|SM-\d{3,4}|SU-\d{3,4}|GO-\d{3,4}|SK-\d{3,4}|[A-Z]{2}-\d{3,4})\s+[^\n]{0,80}?(\d{1,2}[.,]\d{2,4})\s*(KG\/Barra\s+6m|kg\/m)`,
    regexFlags   : 'gi',
  },
  {
    nomeArquivo  : 'Catalogo_Geral_Hyspex_Aluminio_2020.pdf',
    origem       : 'Hyspex',
    linhaPadrao  : 'Linha Comercial Hyspex',
    // Padrão: "12345  ... 0,980 Kg/m"
    // ⚠️  Âncora \b para evitar capturar sequências de 5 dígitos no meio de
    //     números maiores (ex: páginas, referências internas de tabela).
    regexFonte   : String.raw`\b(\d{5})\b\s+[^\n]{0,80}?(\d{1,2}[.,]\d{2,4})\s*(Kg\/m)`,
    regexFlags   : 'gi',
  },
];

// ─── Mapeamento prefixo → linha comercial ─────────────────────────────────────
const PREFIXO_LINHA = {
  SU : 'Linha Suprema',
  GO : 'Linha Gold',
  MX : 'Linha Mega-X Solar',
  SK : 'Fachada Skalla II',
  SM : 'Linha Standard',
};

function resolverLinha(codigo, linhaPadrao) {
  const prefixo = codigo.substring(0, 2).toUpperCase();
  return PREFIXO_LINHA[prefixo] ?? linhaPadrao;
}


// ═════════════════════════════════════════════════════════════════════════════
// SANITIZAÇÃO DE TEXTO
//
// PDFs exportam texto com:
//   • Hifenização silábica no meio de palavras  → "perfil\nal-\numínio"
//   • Espaços múltiplos entre colunas           → "MX-210     2,340"
//   • Quebras de linha dentro de células        → separamos e rejuntamos
//
// A estratégia aqui é conservadora: apenas normaliza espaços/hífens
// sem destruir a estrutura linha-a-linha, que as regex dependem.
// ═════════════════════════════════════════════════════════════════════════════
function sanitizarTexto(texto) {
  return texto
    // Remove hifenização silábica ao final de linha: "alu-\nmínio" → "alumínio"
    .replace(/-\n([a-záéíóúãõâêîôûàç])/gi, '$1')
    // Colapsa espaços múltiplos (mantém \n)
    .replace(/[ \t]{2,}/g, ' ')
    // Remove caracteres nulos e de controle (exceto \n)
    .replace(/[^\x20-\x7E\xC0-\xFF\n]/g, ' ');
}


// ═════════════════════════════════════════════════════════════════════════════
// EXTRATOR PRINCIPAL
// ═════════════════════════════════════════════════════════════════════════════
async function extrairTodosOsCatalogos() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  MaxSigma — Extrator de Catálogos de Alumínio   ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  /** @type {Map<string, object>}  chave = codigo, evita duplicatas */
  const mapaInsumos = new Map();

  for (const catalogo of CATALOGOS) {
    const caminhoCompleto = path.join(pastaUtils, catalogo.nomeArquivo);

    if (!fs.existsSync(caminhoCompleto)) {
      console.warn(`⚠️  Arquivo não encontrado: "${catalogo.nomeArquivo}" — pulando.\n`);
      continue;
    }

    console.log(`📖 Lendo: ${catalogo.nomeArquivo}`);
    console.log(`   Origem: ${catalogo.origem}`);

    const buffer = fs.readFileSync(caminhoCompleto);
    const parsed = await pdfParse(buffer);

    // Sanitiza antes de aplicar qualquer regex
    const texto = sanitizarTexto(parsed.text);

    // ⚠️  Recria a RegExp a cada iteração para zerar .lastIndex
    const regex = new RegExp(catalogo.regexFonte, catalogo.regexFlags);

    let match;
    let contadorLocal = 0;

    while ((match = regex.exec(texto)) !== null) {
      const codigo      = match[1].toUpperCase().trim();
      const unidade     = (match[3] ?? 'kg/m').toLowerCase();
      let   pesoRaw     = parseFloat(match[2].replace(',', '.'));

      // Regra de negócio: peso por barra de 6 m → converter para kg/m
      if (unidade.includes('barra')) {
        pesoRaw = parseFloat((pesoRaw / 6).toFixed(4));
      }

      // Filtro de ruído: valores fora da faixa física realista de perfis de Al
      if (pesoRaw < 0.05 || pesoRaw > 30.0) continue;

      // Deduplica pelo código (primeiro catálogo que declara o perfil vence)
      if (mapaInsumos.has(codigo)) continue;

      /** @type {InsumoMaxSigma} */
      const insumo = {
        codigo      : codigo,
        descricao   : `Perfil Alumínio ${codigo} — ${catalogo.origem}`,
        peso_metro  : pesoRaw,
        tipo        : 'aluminio',          // ← campo obrigatório do requisito
        linha       : resolverLinha(codigo, catalogo.linhaPadrao),
      };

      mapaInsumos.set(codigo, insumo);
      contadorLocal++;
    }

    console.log(`   ✅ ${contadorLocal} perfis únicos extraídos.\n`);
  }

  // ─── Serialização ──────────────────────────────────────────────────────────
  const listaFinal = Array.from(mapaInsumos.values());

  console.log(`🎯 Total consolidado: ${listaFinal.length} perfis únicos.\n`);

  const destino = path.join(pastaUtils, 'carga_massiva_total.json');
  fs.writeFileSync(destino, JSON.stringify(listaFinal, null, 2), 'utf-8');

  console.log(`💾 Arquivo gerado: ${destino}`);
  console.log('🚀 Pronto! Cole o JSON no Thunder Client para a rota POST /insumos/carga-massiva.\n');
}


// ─── Bootstrap ────────────────────────────────────────────────────────────────
extrairTodosOsCatalogos().catch(err => {
  console.error('❌ Erro crítico no extrator:', err.message);
  process.exit(1);
});