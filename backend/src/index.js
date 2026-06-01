// 1. Inicializa as variáveis de ambiente antes de QUALQUER outra importação do projeto
import './config/env.js'; 

import express from 'express';
import cors from 'cors'; // Habilitado para conexões multiplataforma do SaaS (Chão de fábrica/Web)

// 2. Importação das rotas do ecossistema MaxSigma
import clientesRoutes from './routes/clientesRoutes.js';
import insumosRoutes from './routes/insumosRoutes.js';
import orcamentosRoutes from './routes/orcamentosRoutes.js';
import tipologiasRoutes from './routes/tipologiasRoutes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// 3. Middlewares Globais de Segurança e Performance
app.use(cors()); // Permite acesso controlado de múltiplos dispositivos à API
app.use(express.json()); // Middleware para o Express entender JSON

// 4. Rota inicial de integridade do sistema (Healthcheck)
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    message: '🖥️ API do MaxSigma rodando com sucesso!',
    timestamp: new Date()
  });
});

// 5. Vinculação dos caminhos das Rotas (SaaS Modular)
app.use('/clientes', clientesRoutes);
app.use('/insumos', insumosRoutes);
app.use('/orcamentos', orcamentosRoutes); 
app.use('/tipologias', tipologiasRoutes);

// 6. Tratamento global para rotas não encontradas (Segurança Claude)
app.use((req, res) => {
  res.status(404).json({ error: `Rota ${req.originalUrl} não encontrada no MaxSigma.` });
});

// 7. Inicialização do Servidor
app.listen(PORT, () => {
  console.log(`📡 Servidor do MaxSigma ligado com sucesso na porta ${PORT}`);
});