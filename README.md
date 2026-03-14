# VIDRATO — Sistema Integrado de Gestão ERP

Sistema completo de gestão para distribuidora e fábrica de esquadrias de alumínio.

## 🎯 Sobre o Sistema

**VIDRATO** é um ERP full-stack desenvolvido especificamente para pequenas e médias empresas do setor de esquadrias de alumínio, com foco em:

- **Distribuidora**: Gestão de vendas, estoque, clientes e fornecedores
- **Fábrica**: Ordens de produção, controle de refugo, ferramentas e cortes
- **Financeiro**: Caixa, contas a pagar/receber, comissões, DRE
- **Relatórios**: Dashboards, alertas inteligentes, previsão de demanda
- **IA**: Assistente virtual com Gemini AI

## 🚀 Stack Tecnológica

### Backend
- **Runtime**: Node.js 20 LTS
- **Framework**: Express.js
- **Banco de Dados**: MySQL 8+
- **ORM**: Drizzle ORM (JavaScript puro, sem binários)
- **Cache**: Redis com fallback automático para memória
- **Auth**: JWT + bcrypt
- **Validação**: Zod
- **Real-time**: Socket.io
- **Scheduler**: node-cron (alertas a cada 5 minutos)
- **CEP**: ViaCEP API gratuita
- **IA**: Google Gemini API (gemini-2.0-flash)

### Frontend
- **Framework**: React 18
- **Linguagem**: TypeScript 5 (strict mode)
- **Build**: Vite 5
- **Roteamento**: React Router v6
- **Estado Global**: Zustand
- **Queries/Cache**: TanStack Query v5
- **Formulários**: React Hook Form + Zod
- **Estilo**: Tailwind CSS v3
- **Componentes UI**: Radix UI (headless, acessível)
- **Ícones**: Lucide React
- **Animações**: Framer Motion
- **Gráficos**: Recharts
- **Tabelas**: TanStack Table v8
- **QR Code**: qrcode.react
- **Socket**: socket.io-client
- **PDF**: @react-pdf/renderer
- **Datas**: date-fns
- **Notificações**: Sonner

## 📁 Estrutura do Projeto

```
vidrato/
├── backend/
│   ├── drizzle/
│   │   ├── schema.js              # 40+ tabelas MySQL
│   │   └── migrations/
│   ├── src/
│   │   ├── lib/                   # Bibliotecas core
│   │   ├── middleware/            # Auth, RBAC, Audit, etc.
│   │   ├── modules/               # Módulos de negócio
│   │   ├── jobs/                  # Cron jobs
│   │   ├── services/              # Serviços auxiliares
│   │   ├── demo/                  # Seed de demonstração
│   │   ├── app.js
│   │   └── server.js
│   ├── package.json
│   ├── drizzle.config.js
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── types/                 # TypeScript types
│   │   ├── lib/                   # API client, utils
│   │   ├── store/                 # Zustand stores
│   │   ├── hooks/                 # Custom hooks
│   │   ├── components/            # Componentes reutilizáveis
│   │   ├── pages/                 # Páginas
│   │   ├── router/                # Configuração de rotas
│   │   ├── styles/                # CSS global
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
└── install/
    ├── index.html                 # Wizard standalone
    ├── install.css
    └── install.js
```

## 🗄️ Modelo de Dados

O sistema possui 40+ tabelas organizadas em:

### Identidade
- **empresas**: Dados da empresa
- **configuracoes**: Configurações do sistema (alertas, descontos, comissões, etc.)

### RBAC (Controle de Acesso)
- **funcionarios**: Usuários do sistema com permissões granulares
- **tabelas_preco**: Tabelas de preço diferenciadas por cliente
- **itens_tabela_preco**: Preços específicos por produto

### Produtos e Estoque
- **categorias_produto**: Categorização de produtos
- **produtos**: Cadastro completo com localização em galpão
- **historico_precos**: Auditoria automática de mudanças de preço
- **movimentacoes_estoque**: Log append-only de toda movimentação
- **cortes_aluminio**: Controle de retalhos (retalhos > 20cm viram produtos)

### Vendas
- **orcamentos** + **itens_orcamento**: Cotações
- **vendas** + **itens_venda**: PDV completo
- **pagamentos_venda**: Suporte a pagamento misto
- **solicitacoes_desconto**: Workflow de aprovação de descontos

### Produção
- **ordens_producao**: OPs com QR Code e foto
- **etapas_op**: Corte, montagem, acabamento, instalação
- **itens_op**: Materiais reservados/consumidos/devolvidos

### Almoxarifado
- **ferramentas** + **movimentacoes_ferramentas**: Controle de empréstimo
- **pedidos_compra** + **itens_pedido_compra**: Compras de fornecedores

### Financeiro
- **caixas**: Abertura/fechamento de caixa
- **contas_receber** / **contas_pagar**: Fluxo de caixa
- **comissoes**: Calculadas automaticamente por venda
- **garantias**: Geradas automaticamente (90 dias padrão)
- **creditos_cliente**: Devoluções viram crédito

### Comunicação
- **notificacoes**: Alertas do sistema
- **avisos_chefe**: Comunicados com leitura obrigatória (URGENTE bloqueia UI)
- **leituras_aviso**: Auditoria de leitura (IP, timestamp, via)

### Auditoria
- **logs_auditoria**: Todas as operações CRUD
- **logs_seguranca**: Tentativas de login, IPs suspeitos, etc.

## ⚙️ Instalação e Configuração

### Pré-requisitos

- Node.js >= 20.0.0
- MySQL 8+
- Redis (opcional - sistema usa memória como fallback)

### 1. Backend

```bash
cd backend
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env com suas configurações de banco

# Criar estrutura do banco
npm run db:push

# (Opcional) Popular com dados de demonstração
npm run seed:demo

# Iniciar servidor de desenvolvimento
npm run dev
```

O backend estará rodando em `http://localhost:3000`

### 2. Frontend

```bash
cd frontend
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

O frontend estará rodando em `http://localhost:5173`

### 3. Build para Produção

**Backend:**
```bash
npm start
# Ou com PM2:
pm2 start src/server.js --name vidrato-api
```

**Frontend:**
```bash
npm run build
# Os arquivos estarão em dist/
```

## 🎭 Modos de Operação

### Modo DEMO (Development)

```env
DEMO_MODE=true
SETUP_COMPLETED=false
```

- Funciona imediatamente após `npm install && npm run dev`
- Seed automático com dados fictícios realistas
- Banner laranja "⚠️ MODO DEMONSTRAÇÃO" na topbar
- Credenciais de acesso:
  - `admin@vidrato.demo / demo123` (ADMIN)
  - `vendedor@vidrato.demo / demo123` (VENDEDOR)
  - `almoxarife@vidrato.demo / demo123` (ALMOXARIFE)
  - `operador@vidrato.demo / demo123` (OPERADOR_FABRICA)
  - `financeiro@vidrato.demo / demo123` (FINANCEIRO)

### Modo PRODUÇÃO

```env
DEMO_MODE=false
SETUP_COMPLETED=false
```

1. Ao acessar o sistema, será redirecionado para `/install`
2. Wizard web:
   - Testa conexão com MySQL
   - Cria estrutura do banco
   - Solicita dados da empresa
   - Cria usuário Admin
   - Salva configurações
3. Após wizard: `SETUP_COMPLETED=true` e sistema abre limpo

## 🔐 Sistema de Permissões (RBAC)

### Perfis Base

- **ADMIN**: Todas as permissões
- **VENDEDOR**: Vendas, orçamentos, clientes
- **ALMOXARIFE**: Estoque, ferramentas, recebimentos
- **OPERADOR_FABRICA**: Ordens de produção
- **EXPEDIDOR**: Separação de pedidos
- **FINANCEIRO**: Caixa, contas, comissões

### Permissões Granulares

Cada perfil possui um conjunto de permissões base que pode ser:
- **Ampliado**: `permissoes_extras` adiciona novas permissões
- **Restringido**: `permissoes_removidas` remove permissões do perfil

**Exemplo**: Vendedor sem permissão para criar clientes
```json
{
  "perfil_base": "VENDEDOR",
  "permissoes_removidas": ["perm_cliente_criar"]
}
```

### Permissões Críticas (Somente ADMIN)

- `perm_produto_ver_custo`: Ver preço de custo
- `perm_venda_cancelar`: Cancelar vendas (requer senha)
- `perm_venda_desconto_ilimitado`: Descontos sem limite
- `perm_ferramenta_override`: Sobrescrever trava de ferramenta

## 📊 Funcionalidades Principais

### 🛒 PDV (Ponto de Venda)
- Busca de produtos com sugestões
- Aplicação de tabela de preços por cliente
- Desconto por item ou total
- Saldo disponível em tempo real (estoque - reservas de OP)
- Solicitação de desconto acima do limite (WebSocket notifica admin)
- Pagamento misto (dinheiro + cartão + PIX)
- Geração de comissão automática

### 🏭 Produção
- Criação de OP com QR Code
- Reserva de estoque ao abrir OP
- Registro de cortes com cálculo de retalhos
- Retalhos > 20cm viram produtos automaticamente
- Registro de refugo
- Etapas com cronometragem
- Upload de foto do produto final

### 📦 Almoxarifado
- Mapa visual do galpão (Grid CSS colorido)
- Entrada de mercadoria com parser de XML NF-e
- Controle de ferramentas (empréstimo com trava)
- Fila de avaria
- Separação de pedidos

### 💰 Financeiro
- Abertura/fechamento de caixa
- DRE (Demonstrativo de Resultados)
- Contas a pagar/receber com vencimento
- Comissões por vendedor
- Garantias automáticas
- Créditos de devolução

### 📈 Relatórios e Dashboards
- Vendas por período, produto, vendedor
- Estoque crítico, zerado, excesso
- OPs atrasadas
- Metas de vendedores
- Previsão de demanda (IA)
- Relatório executivo em PDF

### 🔔 Sistema de Alertas

Cron job a cada 5 minutos verifica:
- Estoque crítico (< X% do mínimo)
- Estoque zerado
- OPs atrasadas
- Contas vencendo (próximas 48h)
- Ferramentas perdidas
- Divergências em recebimentos
- Aniversários de clientes

**Anti-duplicata**: Só gera alerta se não houver um não-lido do mesmo tipo

### 💬 Avisos do Chefe

- **NORMAL**: Aparece no sino de notificações
- **URGENTE**: Modal bloqueante no login (z-index 9999, sem ESC/X, só "Li e Entendi")
- Auditoria de leitura: quem leu, quando, por qual via (popup/sino/sistema), IP
- Reenvio automático para quem não leu

### 🤖 Assistente IA (Gemini)

Botão flutuante (bottom-right) com:
- Histórico de conversas
- Chips de ações rápidas
- Contexto do sistema (vendas, estoque, OPs)
- Execução de ações (criar OP, gerar relatório)
- Typing indicator animado

## 🔒 Segurança

### Implementado
- ✅ JWT com refresh token
- ✅ Bcrypt para senhas (12 rounds)
- ✅ Rate limiting (100 req/15min global, 5 tentativas login)
- ✅ RBAC granular
- ✅ Auditoria completa (logs append-only)
- ✅ Serialização de custo (nunca expor para perfis sem permissão)
- ✅ SQL injection impossible (Drizzle usa queries parametrizadas)
- ✅ CORS configurado
- ✅ Validação de uploads (tipo + tamanho)
- ✅ Logs de segurança (tentativas de login, IPs suspeitos)

### Regras de Negócio Invioláveis

1. **Saldo Real Anti-Furo**:
   ```js
   saldo_disponivel = estoque_atual - SUM(itens_op WHERE status='RESERVADO')
   ```
   Verificado NO BACKEND antes de confirmar venda ou abrir OP

2. **Snapshots de Preço**:
   Vendas guardam `preco_unit` e `preco_custo` na criação.
   NUNCA usar preço atual após venda fechada.

3. **Histórico de Preços**:
   Trigger automático ao editar `preco_custo` ou `preco_venda`

4. **Cancelamento de Venda**:
   - Somente ADMIN (`perm_venda_cancelar`)
   - Requer confirmação com senha do admin (bcrypt)
   - Reverte estoque
   - Registra motivo e auditoria

5. **Ferramenta Travada**:
   Backend valida status da ferramenta.
   Não é apenas validação frontend.

6. **Transições de Status de Material**:
   Bloqueadas no backend para evitar estados inválidos

## 🌐 Deploy em Produção

### Nginx (Reverse Proxy)

```nginx
server {
    listen 80;
    server_name vidrato.suaempresa.com.br;

    # Frontend (arquivos estáticos)
    location / {
        root /var/www/vidrato/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Uploads
    location /uploads {
        proxy_pass http://localhost:3000;
    }
}
```

### PM2 (Process Manager)

```bash
# Instalar PM2
npm install -g pm2

# Iniciar backend
cd backend
pm2 start src/server.js --name vidrato-api

# Auto-start no boot
pm2 startup
pm2 save

# Monitorar
pm2 monit

# Logs
pm2 logs vidrato-api
```

### Variáveis de Ambiente Produção

```env
NODE_ENV=production
DEMO_MODE=false
SETUP_COMPLETED=true

DB_HOST=localhost
DB_PORT=3306
DB_NAME=vidrato_prod
DB_USER=vidrato_user
DB_PASS=SENHA_FORTE_AQUI

JWT_SECRET=TROCAR_POR_STRING_ALEATORIA_MINIMO_32_CHARS

REDIS_URL=redis://localhost:6379

FRONTEND_URL=https://vidrato.suaempresa.com.br

GEMINI_API_KEY=sua_chave_gemini_aqui
```

## 📚 Próximos Passos de Implementação

O sistema atual possui toda a infraestrutura backend completa:
- ✅ Schema do banco (40+ tabelas)
- ✅ Conexão com MySQL + Drizzle ORM
- ✅ Cache Redis com fallback
- ✅ Socket.io configurado
- ✅ Todos os middlewares (auth, RBAC, audit, rate limiter, error handler)
- ✅ Sistema de permissões completo
- ✅ Express app e server configurados

### Para completar o backend, implemente os módulos em ordem:

1. **Auth** (`modules/auth/auth.routes.js`): Login, logout, refresh token, troca de senha
2. **Install** (`modules/install/install.routes.js`): Wizard de instalação
3. **Produtos**: CRUD + histórico de preços + ajuste de estoque
4. **Clientes e Fornecedores**: CRUD + integração ViaCEP
5. **Vendas**: PDV completo com validações
6. **Orçamentos**: Geração + conversão em venda/OP
7. **Produção**: OPs + etapas + cortes + QR Code
8. **Almoxarifado**: Entrada + ferramentas + separação
9. **Financeiro**: Caixa + contas + comissões + DRE
10. **Relatórios**: Todos os endpoints + previsão demanda
11. **Alertas**: Job cron + anti-duplicata
12. **Avisos**: CRUD + leitura + WebSocket
13. **Funcionários**: CRUD + permissões personalizadas
14. **Auditoria**: Visualização de logs
15. **Configurações**: Settings + health check
16. **IA**: Proxy Gemini + contexto + ações
17. **Devoluções**: Workflow completo
18. **NF-e**: Geração XML 4.00 + DANFE
19. **Busca Global**: Pesquisa unificada
20. **Demo Seed**: Popular banco com dados realistas

### Frontend

Seguir a mesma sequência da especificação (BLOCO 15):
1. Configuração (package.json, tsconfig, vite, tailwind)
2. Types TypeScript
3. Lib (API client, utils, stores, hooks)
4. Componentes UI base
5. Layout (Sidebar, Topbar, modais)
6. Router e páginas
7. Service Worker

## 📖 Documentação da Especificação

Este sistema foi desenvolvido com base na especificação completa em `SUPERFINAL.txt` (2095 linhas), que define:

- Arquitetura completa
- Modelo de dados (40+ tabelas)
- Regras de negócio invioláveis
- Sistema RBAC detalhado
- Fluxos de trabalho
- Seed de demonstração
- Sequência obrigatória de construção (110 arquivos)

Consulte o arquivo `SUPERFINAL.txt` para a especificação completa.

## 🤝 Contribuindo

Este é um projeto de ERP específico para o setor de esquadrias de alumínio.

## 📄 Licença

Proprietário - Vidrato Ltda.

## 🆘 Suporte

Para questões técnicas ou dúvidas sobre a implementação, consulte a especificação completa ou entre em contato com o time de desenvolvimento.

---

**Desenvolvido com ❤️ para o setor de esquadrias de alumínio**
