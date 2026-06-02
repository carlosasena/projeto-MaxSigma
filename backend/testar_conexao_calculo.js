import { calcularInsumoPorCodigo } from './src/services/calculoService.js';
import dotenv from 'dotenv';
dotenv.config();

async function rodarTesteReal() {
    console.log("⏳ Buscando perfil 'SU-1001' no banco e calculando barras...");
    
    // Testando com o perfil SU-1001 que inserimos na carga massiva pedindo 8 metros lineares
    const resultado = await calcularInsumoPorCodigo('SU-1001', 8.5);
    
    console.log("\n📊 Resultado da Consulta + Cálculo Real:");
    console.log(JSON.stringify(resultado, null, 2));
    
    process.exit(0);
}

// Aguarda um segundo para a conexão do db.js disparar e rodar o teste
setTimeout(rodarTesteReal, 1000);
