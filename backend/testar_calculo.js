import { calcularItemPerfil } from './src/services/calculoService.js';

console.log("🧪 Rodando testes do motor de cálculo MaxSigma...\n");

// Teste 1: Solicitando 5 metros (deve pedir 1 barra de 6m)
const c1 = calcularItemPerfil({ pesoMetro: 1.25, precoKg: 35, metroLinearNecessario: 5 });
console.log(`Caso 5m: Pediu ${c1.barrasNecessarias} barra(s) | Peso: ${c1.pesoTotalKg}kg | R$ ${c1.precoTotal}`);

// Teste 2: Solicitando 6.1 metros (deve pular para 2 barras de 6m = 12m)
const c2 = calcularItemPerfil({ pesoMetro: 1.25, precoKg: 35, metroLinearNecessario: 6.1 });
console.log(`Caso 6.1m (Arredondado para Cima): Pediu ${c2.barrasNecessarias} barra(s) | Total: ${c2.metroLinearTotal}m | R$ ${c2.precoTotal}`);

console.log("\n✅ Integração do serviço concluída com sucesso!");
