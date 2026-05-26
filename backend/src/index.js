import express from 'express';
import dotenv from 'dotenv';
import pool from './config/db.js';
import clientesRoutes from './routes/clientesRoutes.js';
import insumosRoutes from './routes/insumosRoutes.js';
import orcamentosRoutes from './routes/orcamentosRoutes.js';
import tipologiasRoutes from './routes/tipologiasRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para o Express entender JSON
app.use(express.json());

// Rota inicial de teste
app.get('/', (req, res) => {
  res.send('🖥️ API do MaxSigma rodando com sucesso!');
});

// Vincula as rotas de clientes ao caminho /clientes
app.use('/clientes', clientesRoutes);
app.use('/insumos', insumosRoutes);
app.use('/orcamentos', orcamentosRoutes); 
app.use('/tipologias', tipologiasRoutes);

// Inicia o servidor local
app.listen(PORT, () => {
  console.log(`📡 Servidor do MaxSigma ligado na porta ${PORT}`);
});