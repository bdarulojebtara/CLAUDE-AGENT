# GUIA DE IMPLEMENTAÇÃO — VIDRATO ERP

Este documento fornece instruções detalhadas para completar a implementação do sistema VIDRATO.

## 📊 Status Atual da Implementação

### ✅ Completado

#### Backend Infrastructure (100%)
- [x] **Database Schema** (`drizzle/schema.js`): 40+ tabelas MySQL com Drizzle ORM
- [x] **Database Connection** (`lib/db.js`): Pool MySQL + Drizzle instance + health checks
- [x] **Cache Layer** (`lib/cache.js`): Redis com fallback automático para Map() em memória
- [x] **WebSocket** (`lib/socket.js`): Socket.io configurado e pronto
- [x] **Environment** (`lib/env.js`): Validação de .env com Zod
- [x] **Permissions** (`lib/permissions.js`): Sistema RBAC completo com 50+ permissões

#### Middleware (100%)
- [x] **Auth** (`middleware/auth.js`): JWT authentication com verificação de usuário ativo
- [x] **RBAC** (`middleware/rbac.js`): Validação de permissões granulares
- [x] **Audit** (`middleware/audit.js`): Log automático de operações
- [x] **Rate Limiter** (`middleware/rateLimiter.js`): Proteção contra abuso (100 req/15min)
- [x] **Error Handler** (`middleware/errorHandler.js`): Tratamento centralizado de erros
- [x] **Performance** (`middleware/performance.js`): Monitoramento de tempo de resposta
- [x] **Install Guard** (`middleware/installGuard.js`): Redirecionamento para wizard se não instalado

#### Core Files (100%)
- [x] **App** (`app.js`): Express bootstrap com todos middlewares e CORS
- [x] **Server** (`server.js`): Inicialização com health checks e graceful shutdown
- [x] **Config** (`package.json`, `.env.example`, `.gitignore`, `drizzle.config.js`)

#### Auth Module (100%)
- [x] **Routes** (`modules/auth/auth.routes.js`): Login, logout, refresh, trocar senha, /me

### 🔨 Pendente

#### Backend Modules (0% - 19 módulos)
- [ ] Install (wizard de instalação)
- [ ] Produtos (CRUD + histórico de preços)
- [ ] Clientes / Fornecedores (CRUD + ViaCEP)
- [ ] Vendas (PDV completo)
- [ ] Orçamentos
- [ ] Devoluções
- [ ] NF-e
- [ ] Produção (OPs)
- [ ] Almoxarifado
- [ ] Financeiro
- [ ] Relatórios
- [ ] Alertas + Cron Job
- [ ] Avisos
- [ ] Funcionários
- [ ] Auditoria
- [ ] Configurações
- [ ] IA (Gemini)
- [ ] Services
- [ ] Busca Global

#### Frontend (0% - 90+ arquivos)
- [ ] Configuração (package.json, tsconfig, vite, tailwind)
- [ ] Types
- [ ] Lib (API client, stores, hooks)
- [ ] Components UI
- [ ] Layout
- [ ] Pages
- [ ] Router

#### Extras (0%)
- [ ] Demo Seed
- [ ] Service Worker
- [ ] Install Wizard HTML

---

## 🏗️ Como Continuar a Implementação

### Padrão de Módulo Backend

Cada módulo segue este padrão consistente:

```
backend/src/modules/{modulo}/
  ├── {modulo}.routes.js      # Rotas Express
  ├── {modulo}.controller.js  # (Opcional) Lógica de negócio
  └── {modulo}.service.js     # (Opcional) Camada de serviços
```

### Template de Rota

```javascript
import express from 'express';
import { z } from 'zod';
import db from '../../lib/db.js';
import { tabela } from '../../../drizzle/schema.js';
import { eq } from 'drizzle-orm';
import { authenticate } from '../../middleware/auth.js';
import { requirePermissions } from '../../middleware/rbac.js';
import { auditLog } from '../../middleware/audit.js';
import { PERMISSOES } from '../../lib/permissions.js';

const router = express.Router();

// Schema de validação
const createSchema = z.object({
  // campos...
});

// GET /api/v1/{modulo}
router.get('/',
  authenticate,
  requirePermissions(PERMISSOES.PERM_MODULO_LISTAR),
  async (req, res, next) => {
    try {
      // Filtrar por empresa_id do usuário autenticado
      const items = await db
        .select()
        .from(tabela)
        .where(eq(tabela.empresa_id, req.user.empresaId));

      res.json({
        success: true,
        data: items
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/v1/{modulo}
router.post('/',
  authenticate,
  requirePermissions(PERMISSOES.PERM_MODULO_CRIAR),
  auditLog('MODULO', 'CRIAR'),
  async (req, res, next) => {
    try {
      const data = createSchema.parse(req.body);

      const [newItem] = await db
        .insert(tabela)
        .values({
          ...data,
          empresa_id: req.user.empresaId
        })
        .$returningId();

      res.status(201).json({
        success: true,
        message: 'Item criado com sucesso',
        data: newItem
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/v1/{modulo}/:id
router.put('/:id',
  authenticate,
  requirePermissions(PERMISSOES.PERM_MODULO_EDITAR),
  auditLog('MODULO', 'ATUALIZAR'),
  async (req, res, next) => {
    try {
      const data = createSchema.partial().parse(req.body);
      const id = parseInt(req.params.id);

      // Verificar se pertence à empresa do usuário
      const [existing] = await db
        .select()
        .from(tabela)
        .where(and(
          eq(tabela.id, id),
          eq(tabela.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Item não encontrado'
        });
      }

      await db
        .update(tabela)
        .set(data)
        .where(eq(tabela.id, id));

      res.json({
        success: true,
        message: 'Item atualizado com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/v1/{modulo}/:id
router.delete('/:id',
  authenticate,
  requirePermissions(PERMISSOES.PERM_MODULO_DELETAR),
  auditLog('MODULO', 'DELETAR'),
  async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);

      // Verificar se pertence à empresa
      const [existing] = await db
        .select()
        .from(tabela)
        .where(and(
          eq(tabela.id, id),
          eq(tabela.empresa_id, req.user.empresaId)
        ))
        .limit(1);

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Item não encontrado'
        });
      }

      await db
        .delete(tabela)
        .where(eq(tabela.id, id));

      res.json({
        success: true,
        message: 'Item deletado com sucesso'
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
```

### Após criar uma rota, registre em `app.js`:

```javascript
import moduloRoutes from './modules/modulo/modulo.routes.js';

app.use('/api/v1/modulo', authenticate, moduloRoutes);
```

---

## 📋 Próximos Passos Recomendados

### 1. Criar Módulo de Produtos (CRÍTICO)

**Arquivo**: `backend/src/modules/produtos/produtos.routes.js`

**Funcionalidades**:
- CRUD básico de produtos
- Filtro por categoria
- Busca por código ou nome
- Atualização de preços com histórico automático
- Ajuste manual de estoque
- Serialização: NUNCA retornar `preco_custo` para usuários sem `perm_produto_ver_custo`

**Validação Zod**:
```javascript
const produtoSchema = z.object({
  codigo: z.string().min(1),
  nome: z.string().min(1),
  categoria_id: z.number().optional(),
  unidade: z.enum(['UN', 'ML', 'M2', 'KG', 'PCT', 'KIT', 'M3', 'M']),
  preco_custo: z.number().min(0),
  preco_venda: z.number().min(0),
  estoque_minimo: z.number().default(0),
  estoque_maximo: z.number().default(9999),
  fornecedor_id: z.number().optional(),
  localizacao_galpao: z.string().optional(),
  localizacao_corredor: z.string().optional(),
  localizacao_prateleira: z.string().optional(),
  localizacao_posicao: z.string().optional()
});
```

**Regra de Negócio**: Ao atualizar `preco_custo` ou `preco_venda`, inserir em `historico_precos`:

```javascript
// Após update de produto
if (data.preco_custo || data.preco_venda) {
  await db.insert(historico_precos).values({
    produto_id: id,
    preco_custo: data.preco_custo || existing.preco_custo,
    preco_venda: data.preco_venda || existing.preco_venda,
    alterado_por: req.user.userId,
    motivo: req.body.motivo || 'Alteração manual'
  });
}
```

### 2. Criar Módulo de Clientes e Fornecedores

**Arquivos**:
- `backend/src/modules/clientes/clientes.routes.js`
- `backend/src/modules/fornecedores/fornecedores.routes.js`

**Integração ViaCEP**:
```javascript
router.get('/cep/:cep', authenticate, async (req, res, next) => {
  try {
    const cep = req.params.cep.replace(/\D/g, '');
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await response.json();

    if (data.erro) {
      return res.status(404).json({
        success: false,
        message: 'CEP não encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        endereco: data.logradouro,
        bairro: data.bairro,
        cidade: data.localidade,
        estado: data.uf
      }
    });
  } catch (error) {
    next(error);
  }
});
```

### 3. Criar Módulo de Vendas (PDV)

**Arquivo**: `backend/src/modules/vendas/vendas.routes.js`

**Funcionalidades Críticas**:

#### Verificação de Saldo Disponível

```javascript
// Calcular saldo disponível (estoque - reservas de OP)
async function getSaldoDisponivel(produtoId) {
  const [produto] = await db
    .select({ estoque_atual: produtos.estoque_atual })
    .from(produtos)
    .where(eq(produtos.id, produtoId))
    .limit(1);

  const [reservas] = await db
    .select({
      total: sql`COALESCE(SUM(quantidade_plan), 0)`
    })
    .from(itens_op)
    .where(and(
      eq(itens_op.produto_id, produtoId),
      eq(itens_op.status, 'RESERVADO')
    ));

  const saldoDisponivel = produto.estoque_atual - (reservas.total || 0);
  return saldoDisponivel;
}

// Usar antes de confirmar venda
router.post('/', async (req, res, next) => {
  // ... validação ...

  // Verificar saldo de cada item
  for (const item of req.body.itens) {
    const saldo = await getSaldoDisponivel(item.produto_id);
    if (saldo < item.quantidade) {
      return res.status(409).json({
        success: false,
        message: `Estoque insuficiente para ${item.produto_nome}`,
        saldo_disponivel: saldo,
        quantidade_solicitada: item.quantidade
      });
    }
  }

  // Prosseguir com criação da venda...
});
```

#### Snapshot de Preços

**CRÍTICO**: Sempre salvar preço_unit e preco_custo NO MOMENTO da venda:

```javascript
// Ao inserir itens_venda, buscar preços atuais
for (const item of itens) {
  const [produto] = await db
    .select({
      preco_venda: produtos.preco_venda,
      preco_custo: produtos.preco_custo
    })
    .from(produtos)
    .where(eq(produtos.id, item.produto_id))
    .limit(1);

  await db.insert(itens_venda).values({
    venda_id: vendaId,
    produto_id: item.produto_id,
    quantidade: item.quantidade,
    preco_unit: item.preco_unit || produto.preco_venda, // Snapshot
    preco_custo: produto.preco_custo, // Snapshot
    desconto_pct: item.desconto_pct || 0,
    total_item: item.total_item
  });
}
```

#### Movimentação de Estoque

```javascript
// Ao confirmar venda, dar baixa no estoque
await db.insert(movimentacoes_estoque).values({
  empresa_id: req.user.empresaId,
  produto_id: item.produto_id,
  tipo: 'SAIDA_VENDA',
  quantidade: -item.quantidade,
  estoque_antes: produto.estoque_atual,
  estoque_depois: produto.estoque_atual - item.quantidade,
  referencia_id: vendaId,
  referencia_tipo: 'VENDA',
  funcionario_id: req.user.userId,
  status_material: 'EM_ESTOQUE'
});

await db
  .update(produtos)
  .set({
    estoque_atual: sql`estoque_atual - ${item.quantidade}`
  })
  .where(eq(produtos.id, item.produto_id));
```

#### Geração de Comissão

```javascript
// Após confirmar venda
await db.insert(comissoes).values({
  empresa_id: req.user.empresaId,
  funcionario_id: vendedorId,
  venda_id: vendaId,
  valor_venda: venda.total,
  percentual: comissaoPct, // Da configuração ou perfil
  valor_comissao: venda.total * (comissaoPct / 100),
  status: 'PENDENTE',
  mes_referencia: new Date().toISOString().substring(0, 7) // "2026-03"
});
```

#### Geração de Garantia

```javascript
// Para cada produto da venda
const validadeGarantia = new Date();
validadeGarantia.setDate(validadeGarantia.getDate() + garantiaPadraoDias);

await db.insert(garantias).values({
  empresa_id: req.user.empresaId,
  venda_id: vendaId,
  cliente_id: clienteId,
  produto_id: item.produto_id,
  validade: validadeGarantia,
  status: 'ATIVA'
});
```

### 4. Criar Cron Job de Alertas

**Arquivo**: `backend/src/jobs/estoqueMonitor.js`

```javascript
import cron from 'node-cron';
import db from '../lib/db.js';
import { produtos, notificacoes, ordens_producao, contas_receber, clientes } from '../../drizzle/schema.js';
import { eq, lt, and } from 'drizzle-orm';
import { emitToEmpresa } from '../lib/socket.js';

// Executar a cada 5 minutos
export function iniciarMonitorEstoque() {
  cron.schedule('*/5 * * * *', async () => {
    console.log('🔔 Verificando alertas de estoque...');

    try {
      await verificarEstoqueCritico();
      await verificarEstoqueZerado();
      await verificarOPsAtrasadas();
      await verificarContasVencendo();
    } catch (error) {
      console.error('Erro ao processar alertas:', error);
    }
  });

  console.log('✅ Monitor de alertas iniciado (executa a cada 5 minutos)');
}

async function verificarEstoqueCritico() {
  // Produtos com estoque < estoque_minimo
  const produtosCriticos = await db
    .select()
    .from(produtos)
    .where(and(
      lt(produtos.estoque_atual, produtos.estoque_minimo),
      eq(produtos.ativo, true)
    ));

  for (const produto of produtosCriticos) {
    // Verificar se já existe notificação não lida (anti-duplicata)
    const [existente] = await db
      .select()
      .from(notificacoes)
      .where(and(
        eq(notificacoes.tipo, 'ESTOQUE_CRITICO'),
        eq(notificacoes.lida, false),
        eq(notificacoes.empresa_id, produto.empresa_id)
        // Idealmente verificar também link_interno contendo produto.id
      ))
      .limit(1);

    if (!existente) {
      // Criar notificação
      const [notif] = await db.insert(notificacoes).values({
        empresa_id: produto.empresa_id,
        destinatario_id: null, // Para todos
        tipo: 'ESTOQUE_CRITICO',
        titulo: `Estoque crítico: ${produto.nome}`,
        mensagem: `O produto ${produto.nome} está com estoque de ${produto.estoque_atual} ${produto.unidade}, abaixo do mínimo de ${produto.estoque_minimo}.`,
        lida: false,
        link_interno: `/produtos/${produto.id}`
      }).$returningId();

      // Emitir via WebSocket
      emitToEmpresa(produto.empresa_id, 'nova_notificacao', {
        id: notif.id,
        tipo: 'ESTOQUE_CRITICO',
        titulo: `Estoque crítico: ${produto.nome}`,
        link: `/produtos/${produto.id}`
      });
    }
  }
}

// Implementar verificarEstoqueZerado, verificarOPsAtrasadas, verificarContasVencendo...
```

**Registrar no server.js**:
```javascript
import { iniciarMonitorEstoque } from './jobs/estoqueMonitor.js';

// Após iniciar servidor
if (env.SETUP_COMPLETED || env.DEMO_MODE) {
  iniciarMonitorEstoque();
}
```

### 5. Criar Demo Seed

**Arquivo**: `backend/src/demo/seed.js`

Baseado no BLOCO 14 da especificação, criar:
- 1 empresa (Vidrato Ltda)
- 7 funcionários com senhas demo123
- 25 produtos (2 zerados, 1 crítico)
- 8 clientes
- 5 fornecedores
- 5 OPs
- 8 ferramentas
- 5 orçamentos
- 60 vendas nos últimos 30 dias
- 1 aviso URGENTE

```javascript
import bcrypt from 'bcrypt';
import db from '../lib/db.js';
import { empresas, funcionarios, produtos, categorias_produto, clientes, fornecedores } from '../../drizzle/schema.js';
import { calcularPermissoes } from '../lib/permissions.js';

export async function carregarSeedDemo() {
  console.log('🎭 Carregando seed de demonstração...');

  // Verificar se já existe dados
  const [empresaExistente] = await db.select().from(empresas).limit(1);
  if (empresaExistente) {
    console.log('✅ Seed já carregado anteriormente');
    return;
  }

  // Criar empresa
  const [empresa] = await db.insert(empresas).values({
    nome: 'Distribuidora de Alumínio VIDRATO Ltda',
    cnpj: '12.345.678/0001-99',
    endereco: 'Rua das Esquadrias, 123 - Centro',
    telefone: '(11) 3456-7890'
  }).$returningId();

  const empresaId = empresa.id;

  // Hash de senha padrão
  const senhaHash = await bcrypt.hash('demo123', 12);

  // Criar funcionários
  const funcionariosDemo = [
    {
      nome: 'Admin Vidrato',
      email: 'admin@vidrato.demo',
      perfil_base: 'ADMIN',
      setor: 'ESCRITORIO'
    },
    {
      nome: 'Carlos Vendedor',
      email: 'vendedor@vidrato.demo',
      perfil_base: 'VENDEDOR',
      setor: 'VENDAS'
    },
    {
      nome: 'Ana Almoxarife',
      email: 'almoxarife@vidrato.demo',
      perfil_base: 'ALMOXARIFE',
      setor: 'ALMOXARIFADO'
    },
    {
      nome: 'João Operador',
      email: 'operador@vidrato.demo',
      perfil_base: 'OPERADOR_FABRICA',
      setor: 'FABRICA'
    },
    {
      nome: 'Maria Financeiro',
      email: 'financeiro@vidrato.demo',
      perfil_base: 'FINANCEIRO',
      setor: 'ESCRITORIO'
    }
  ];

  for (const func of funcionariosDemo) {
    const permissoes = calcularPermissoes(func.perfil_base, [], []);

    await db.insert(funcionarios).values({
      empresa_id: empresaId,
      nome: func.nome,
      email: func.email,
      senha_hash: senhaHash,
      cargo: func.perfil_base,
      setor: func.setor,
      perfil_base: func.perfil_base,
      permissoes: permissoes,
      permissoes_extras: [],
      permissoes_removidas: [],
      ativo: true,
      primeiro_acesso: false
    });
  }

  // Criar categorias e produtos (seguir BLOCO 14)
  // ...

  console.log('✅ Seed de demonstração carregado com sucesso!');
}
```

---

## 🎨 Frontend

Para o frontend, siga a mesma estrutura modular:

### 1. Configurar package.json e tsconfig

Use o template do BLOCO 03 da especificação.

### 2. Criar types TypeScript

```typescript
// frontend/src/types/auth.ts
export interface User {
  id: number;
  nome: string;
  email: string;
  cargo: string;
  setor: string;
  perfil: string;
  permissoes: string[];
  empresa_id: number;
}

export interface LoginRequest {
  email: string;
  senha: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: User;
  demo_mode: boolean;
}
```

### 3. Criar API client com axios

```typescript
// frontend/src/lib/api.ts
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor de request - anexar token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor de response - refresh automático em 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/v1/auth/refresh', {
            refreshToken
          });

          useAuthStore.getState().setToken(data.data.token);
          originalRequest.headers.Authorization = `Bearer ${data.data.token}`;

          return api(originalRequest);
        } catch (refreshError) {
          useAuthStore.getState().logout();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

### 4. Criar Zustand store

```typescript
// frontend/src/store/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types/auth';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  setRefreshToken: (refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      setToken: (token) => set({ token, isAuthenticated: true }),
      setUser: (user) => set({ user }),
      setRefreshToken: (refreshToken) => set({ refreshToken }),
      logout: () => set({
        token: null,
        refreshToken: null,
        user: null,
        isAuthenticated: false
      })
    }),
    {
      name: 'vidrato-auth',
      storage: sessionStorage
    }
  )
);
```

---

## 🔧 Testes e Debugging

### Testar Auth Module

```bash
# 1. Iniciar backend em modo demo
cd backend
DEMO_MODE=true npm run dev

# 2. Testar login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@vidrato.demo","senha":"demo123"}'

# 3. Testar /me com token
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

### Logs úteis

```javascript
// Ver logs de performance
import { getPerformanceStats } from './middleware/performance.js';

app.get('/dev/performance', (req, res) => {
  res.json(getPerformanceStats());
});
```

---

## 📖 Recursos Úteis

- **Drizzle ORM Docs**: https://orm.drizzle.team/
- **Zod Validation**: https://zod.dev/
- **Socket.io**: https://socket.io/docs/
- **JWT**: https://jwt.io/
- **React Query**: https://tanstack.com/query/latest
- **Tailwind CSS**: https://tailwindcss.com/
- **Radix UI**: https://www.radix-ui.com/

---

## 🎯 Priorização Recomendada

1. **Produtos** → Base para vendas e estoque
2. **Clientes** → Necessário para vendas
3. **Vendas (PDV)** → Core business
4. **Orçamentos** → Converte em vendas
5. **Produção (OPs)** → Reserva estoque
6. **Alertas** → Notificações automáticas
7. **Almoxarifado** → Controle de ferramentas
8. **Financeiro** → Caixa e contas
9. **Relatórios** → Dashboards
10. **Demais módulos** → Conforme necessidade

**Boa sorte com a implementação! 🚀**
