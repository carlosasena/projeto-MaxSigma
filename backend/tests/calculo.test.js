import { calcularItemPerfil, calcularMetragemPorFormula } from '../src/services/calculoService.js';

describe('Motor de Cálculo - MaxSigma', () => {
    
    describe('calcularItemPerfil', () => {
        
        test('5m deve pedir 1 barra de 6m', () => {
            const resultado = calcularItemPerfil({
                pesoMetro: 1.25,
                precoKg: 35,
                metroLinearNecessario: 5
            });
            
            expect(resultado.barrasNecessarias).toBe(1);
            expect(resultado.metroLinearTotal).toBe(6);
            expect(resultado.pesoTotalKg).toBe(7.5);
            expect(resultado.precoTotal).toBe(262.5);
            expect(resultado.desperdicioMetros).toBe(1);
            expect(resultado.percentualDesperdicio).toBe(20);
        });
        
        test('6.1m deve pular para 2 barras (12m)', () => {
            const resultado = calcularItemPerfil({
                pesoMetro: 1.25,
                precoKg: 35,
                metroLinearNecessario: 6.1
            });
            
            expect(resultado.barrasNecessarias).toBe(2);
            expect(resultado.metroLinearTotal).toBe(12);
        });
        
        test('0m deve retornar zeros', () => {
            const resultado = calcularItemPerfil({
                pesoMetro: 1.25,
                precoKg: 35,
                metroLinearNecessario: 0
            });
            
            expect(resultado.barrasNecessarias).toBe(0);
            expect(resultado.precoTotal).toBe(0);
        });
        
        test('valores negativos devem retornar zero', () => {
            const resultado = calcularItemPerfil({
                pesoMetro: -1,
                precoKg: -35,
                metroLinearNecessario: -5
            });
            
            expect(resultado.barrasNecessarias).toBe(0);
        });
    });
    
    describe('calcularMetragemPorFormula', () => {
        
        test('fórmula L * 2 + H * 2', () => {
            const resultado = calcularMetragemPorFormula({
                largura: 1.5,
                altura: 1.2,
                formula: 'L * 2 + H * 2',
                quantidade: 2
            });
            
            // (1.5 * 2 + 1.2 * 2) * 2 = (3 + 2.4) * 2 = 10.8
            expect(resultado).toBe(10.8);
        });
        
        test('fórmula inválida deve lançar erro', () => {
            expect(() => {
                calcularMetragemPorFormula({
                    largura: 1,
                    altura: 1,
                    formula: ''
                });
            }).toThrow('Fórmula inválida');
        });
        
        test('fórmula com caracteres maliciosos deve ser sanitizada', () => {
            const resultado = calcularMetragemPorFormula({
                largura: 2,
                altura: 1,
                formula: 'L * 2; console.log("hack"); // + H',
                quantidade: 1
            });
            
            // Apenas parte matemática válida: L * 2 = 4
            expect(resultado).toBe(4);
        });
    });
});
