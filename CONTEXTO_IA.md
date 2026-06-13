# 🚀 Mapa de Contexto e Arquitetura - Projeto MaxSigma (SaaS)

Este documento é a fonte única da verdade para o desenvolvimento do MaxSigma. Ele deve ser lido por qualquer IA no início de uma nova sessão para garantir o alinhamento de escopo, regras de negócio e infraestrutura.

---

## 🛠️ 1. Ambiente de Infraestrutura Atual (100% Nativo)
O ambiente baseado em Docker foi descontinuado devido a instabilidades de persistência e conflitos de portas.
* **Sistema Operacional:** Linux Mint (baseado em Ubuntu Noble).
* **Banco de Dados:** PostgreSQL instalado NATIVAMENTE no sistema operacional (inicialização automática via `systemctl`).
* **Interface de Gerenciamento (IDE):** pgAdmin 4 Desktop instalado nativamente como aplicativo de sistema.
* **Status do Banco:** O banco de dados `maxsigma_db` e o usuário `admin` foram criados no sistema, porém as tabelas e relacionamentos ainda NÃO foram gerados (o banco está vazio esperando o script inicial).

### 🔑 Credenciais do arquivo `.env` (Backend local)
* **DB_HOST:** `localhost`
* **DB_PORT:** `5432`
* **DB_NAME:** `maxsigma_db`
* **DB_USER:** `admin`
* **DB_PASSWORD:** `senha_segura_123`

---

## 📁 2. Estrutura de Pastas e Arquivos (Backend Node.js - ES6)
O projeto utiliza JavaScript moderno com a flag `"type": "module"` no `package.json`.

```text
   Projeto_MaxSigma/
├── CONTEXTO_IA.md            # Este arquivo de alinhamento para as IAs
├── estrutura_maxsigma.sql    # Script bruto com as tabelas do PostgreSQL
├── package.json              # Manifesto da raiz do projeto
├── README.md                 # Documentação geral do repositório
└── backend/                  # Pasta principal da API em Node.js
    ├── package.json          # Gerencia dependências e a flag "type": "module"
    ├── carga_insumos.js      # Script para popular banco com insumos iniciais
    ├── src/
    │   ├── index.js          # Ponto de entrada (Inicializa o Express na porta)
    │   ├── config/
    │   │   ├── db.js         # Pool de conexão com o PostgreSQL Nativo (pg.Pool)
    │   │   └── env.js        # Centralizador e validador de variáveis do .env
    │   ├── middlewares/
    │   │   └── tenant.js     # Middleware de controle e isolamento multi-empresa
    │   ├── controllers/      # Intermediários de requisições e respostas HTTP
    │   │   ├── clientesController.js
    │   │   ├── insumosController.js
    │   │   ├── orcamentosController.js
    │   │   └── tipologiasController.js
    │   ├── routes/           # Endpoints da API expostos para o Thunder Client
    │   │   ├── clientesRoutes.js
    │   │   ├── insumosRoutes.js
    │   │   ├── orcamentosRoutes.js
    │   │   └── tipologiasRoutes.js
    │   ├── services/
    │   │   └── calculoService.js  # Motor lógico e matemático de cortes/barras
    │   ├── seeds/
    │   │   └── insumos_base.json  # Base de dados em JSON para alimentar os insumos
    │   └── utils/            # Ferramentas auxiliares e catálogos técnicos
    │       ├── carga_massiva_total.json
    │       ├── extratorCatalogo.js # Script para ler dados técnicos dos PDFs
    │       ├── Catálogo Acessórios 20.09.2023.pdf
    │       ├── Catálogo de Perfis 07.11.2025.pdf
    │       ├── Catalogo_Geral_Hyspex_Aluminio_2020.pdf
    │       └── catalogo-perfis-asa-2019.pdf
    └── tests/                # Testes automatizados da API
        ├── calculo.test.js
        └── orcamento.test.js