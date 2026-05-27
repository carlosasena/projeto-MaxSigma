import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

// Cria o require seguro para ler o pdf-parse sem dar erro de módulo ESM
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const __dirname = path.resolve();
const pastaUtils = path.join(__dirname, 'src', 'utils');

// Mapeamento de todos os arquivos que você possui
const catalogos = [
  {
    nomeArquivo: 'catalogo-perfis-asa-2019.pdf',
    regex: /([A-Z]{2,3}-\d{3})\s+.*?(\d+[\d,.]*)\s*(kg\/m)/gi,
    origem: 'ASA Alumínio',
    linhaPadrao: 'Série Estrutural'
  },
  {
    nomeArquivo: 'Catálogo de Perfis 07.11.2025.pdf',
    regex: /(MX-\d{3}|SM-\d{3}|[A-Z]{2}-\d{3}|\d{4})\s+.*?(\d+[\d,.]*)\s*(KG\/Barra\s+6m|kg\/m)/gi,
    origem: 'Alusupra / Mega-X',
    linhaPadrao: 'Linha Suprema/Mega-X'
  },
  {
    nomeArquivo: 'Catalogo_Geral_Hyspex_Aluminio_2020.pdf',
    regex: /(\d{5})\s+.*?(\d+[\d,.]*)\s*(Kg\/m)/gi,
    origem: 'Hyspex',
    linhaPadrao: 'Linha Comercial Hyspex'
  }
];

async function extrairTodosOsCatalogos() {
  try {
    console.log('🔄 [MaxSigma] Iniciando varredura e mineração em lote dos catálogos...');
    const listaGeralInsumos = [];

    for (const catalogo of catalogos) {
      const caminhoCompleto = path.join(pastaUtils, catalogo.nomeArquivo);

      if (!fs.existsSync(caminhoCompleto)) {
        console.log(`⚠️  Arquivo não encontrado na pasta utils: "${catalogo.nomeArquivo}". Pulando...`);
        continue;
      }

      console.log(`\n📖 Lendo arquivo: ${catalogo.nomeArquivo} (${catalogo.origem})...`);
      const dataBuffer = fs.readFileSync(caminhoCompleto);
      const data = await pdf(dataBuffer);
      const textoCompleto = data.text;

      let correspondencia;
      let contadorLocal = 0;

      while ((correspondencia = catalogo.regex.exec(textoCompleto)) !== null) {
        const codigo = correspondencia[1].toUpperCase();
        let peso = parseFloat(correspondencia[2].replace(',', '.'));
        const unidadeTexto = correspondencia[3] ? correspondencia[3].toLowerCase() : 'kg/m';

        // Regra de Negócio MaxSigma: Se for peso por Barra de 6m, divide por 6 para salvar kg/m
        if (unidadeTexto.includes('barra')) {
          peso = parseFloat((peso / 6).toFixed(3));
        }

        // Validação de segurança para ignorar ruídos textuais do PDF
        if (peso > 0.01 && peso < 35.0) {
          if (!listaGeralInsumos.some(p => p.codigo === codigo)) {
            
            // Define dinamicamente o nome da linha com base no código
            let nomeLinha = catalogo.linhaPadrao;
            if (codigo.startsWith('SU')) nomeLinha = 'Linha Suprema';
            if (codigo.startsWith('GO')) nomeLinha = 'Linha Gold';
            if (codigo.startsWith('MX')) nomeLinha = 'Linha Mega-X Solar';
            if (codigo.startsWith('SK')) nomeLinha = 'Fachada Skalla II';

            listaGeralInsumos.push({
              codigo: codigo,
              peso_metro: peso,
              descricao: `Perfil Alumínio ${codigo} - ${catalogo.origem}`,
              linha: nomeLinha,
              unidade_padrao: 'BR',
              empresa_id: 1
            });
            contadorLocal++;
          }
        }
      }
      console.log(`✨ Extraídos ${contadorLocal} perfis exclusivos deste manual.`);
    }

    console.log(`\n🎯 [Mineração Concluída] Total de perfis consolidados no sistema: ${listaGeralInsumos.length}`);

    // Salva a carga massiva geral unificada
    const caminhoDestino = path.join(pastaUtils, 'carga_massiva_total.json');
    fs.writeFileSync(caminhoDestino, JSON.stringify(listaGeralInsumos, null, 2));
    
    console.log(`💾 Arquivo mestre gerado em: ${caminhoDestino}`);
    console.log('🚀 Pronto! Agora basta copiar o conteúdo desse JSON e enviar pelo Thunder Client.');

  } catch (error) {
    console.error('❌ Erro crítico no processo de importação total:', error.message);
  }
}

extrairTodosOsCatalogos();