import { mysqlTable, serial, varchar, text, decimal, int, boolean, datetime, timestamp, json, mysqlEnum, unique, index } from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';

// ═══════════════════════════════════════════════════════════════════════════════
//  IDENTIDADE
// ═══════════════════════════════════════════════════════════════════════════════

export const empresas = mysqlTable('empresas', {
  id: serial('id').primaryKey(),
  nome: varchar('nome', { length: 255 }).notNull(),
  cnpj: varchar('cnpj', { length: 18 }).unique().notNull(),
  endereco: text('endereco'),
  telefone: varchar('telefone', { length: 20 }),
  logo_url: varchar('logo_url', { length: 500 }),
  criado_em: timestamp('criado_em').defaultNow().notNull()
});

export const configuracoes = mysqlTable('configuracoes', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  alerta_estoque_pct: int('alerta_estoque_pct').default(100),
  desconto_maximo_vendedor: decimal('desconto_maximo_vendedor', { precision: 5, scale: 2 }).default('5.00'),
  sessao_timeout_min: int('sessao_timeout_min').default(480),
  gemini_api_key: varchar('gemini_api_key', { length: 500 }),
  comissao_padrao_pct: decimal('comissao_padrao_pct', { precision: 5, scale: 2 }).default('3.00'),
  garantia_padrao_dias: int('garantia_padrao_dias').default(90),
  prazo_orcamento_dias: int('prazo_orcamento_dias').default(7),
  criado_em: timestamp('criado_em').defaultNow().notNull(),
  atualizado_em: timestamp('atualizado_em').defaultNow().onUpdateNow()
}, (table) => ({
  empresaUniqueIdx: unique('empresa_unique_idx').on(table.empresa_id)
}));

// ═══════════════════════════════════════════════════════════════════════════════
//  FUNCIONÁRIOS E RBAC
// ═══════════════════════════════════════════════════════════════════════════════

export const funcionarios = mysqlTable('funcionarios', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  nome: varchar('nome', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  senha_hash: varchar('senha_hash', { length: 255 }).notNull(),
  cargo: varchar('cargo', { length: 100 }),
  setor: mysqlEnum('setor', ['ESCRITORIO', 'ALMOXARIFADO', 'VENDAS', 'DISTRIBUIDORA', 'FABRICA']).notNull(),
  perfil_base: mysqlEnum('perfil_base', ['ADMIN', 'VENDEDOR', 'ALMOXARIFE', 'OPERADOR_FABRICA', 'EXPEDIDOR', 'FINANCEIRO']).notNull(),
  permissoes: json('permissoes').$type<string[]>().notNull(),
  permissoes_extras: json('permissoes_extras').$type<string[]>().default([]),
  permissoes_removidas: json('permissoes_removidas').$type<string[]>().default([]),
  ativo: boolean('ativo').default(true).notNull(),
  primeiro_acesso: boolean('primeiro_acesso').default(true).notNull(),
  ultimo_login: datetime('ultimo_login'),
  ultimo_login_ip: varchar('ultimo_login_ip', { length: 45 }),
  meta_mensal: decimal('meta_mensal', { precision: 10, scale: 2 }),
  criado_em: timestamp('criado_em').defaultNow().notNull()
}, (table) => ({
  empresaIdx: index('empresa_idx').on(table.empresa_id)
}));

export const tabelas_preco = mysqlTable('tabelas_preco', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  nome: varchar('nome', { length: 255 }).notNull(),
  descricao: text('descricao'),
  ativa: boolean('ativa').default(true).notNull()
});

export const itens_tabela_preco = mysqlTable('itens_tabela_preco', {
  id: serial('id').primaryKey(),
  tabela_id: int('tabela_id').notNull().references(() => tabelas_preco.id),
  produto_id: int('produto_id').notNull(),
  preco_venda: decimal('preco_venda', { precision: 10, scale: 2 }).notNull(),
  desconto_max: decimal('desconto_max', { precision: 5, scale: 2 }).default('0.00')
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PRODUTOS E ESTOQUE
// ═══════════════════════════════════════════════════════════════════════════════

export const categorias_produto = mysqlTable('categorias_produto', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  nome: varchar('nome', { length: 255 }).notNull(),
  cor_hex: varchar('cor_hex', { length: 7 })
});

export const produtos = mysqlTable('produtos', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  codigo: varchar('codigo', { length: 100 }).unique().notNull(),
  nome: varchar('nome', { length: 255 }).notNull(),
  descricao: text('descricao'),
  categoria_id: int('categoria_id').references(() => categorias_produto.id),
  unidade: mysqlEnum('unidade', ['UN', 'ML', 'M2', 'KG', 'PCT', 'KIT', 'M3', 'M']).notNull(),
  preco_custo: decimal('preco_custo', { precision: 10, scale: 2 }).notNull(),
  preco_venda: decimal('preco_venda', { precision: 10, scale: 2 }).notNull(),
  estoque_atual: decimal('estoque_atual', { precision: 10, scale: 2 }).default('0.00').notNull(),
  estoque_minimo: decimal('estoque_minimo', { precision: 10, scale: 2 }).default('0.00').notNull(),
  estoque_maximo: decimal('estoque_maximo', { precision: 10, scale: 2 }).default('9999.00').notNull(),
  fornecedor_id: int('fornecedor_id'),
  foto_url: varchar('foto_url', { length: 500 }),
  localizacao_galpao: varchar('localizacao_galpao', { length: 50 }),
  localizacao_corredor: varchar('localizacao_corredor', { length: 50 }),
  localizacao_prateleira: varchar('localizacao_prateleira', { length: 50 }),
  localizacao_posicao: varchar('localizacao_posicao', { length: 50 }),
  localizacao_display: varchar('localizacao_display', { length: 100 }),
  localizacao_obs: text('localizacao_obs'),
  ativo: boolean('ativo').default(true).notNull(),
  criado_em: timestamp('criado_em').defaultNow().notNull(),
  atualizado_em: timestamp('atualizado_em').defaultNow().onUpdateNow()
}, (table) => ({
  empresaIdx: index('empresa_idx').on(table.empresa_id),
  codigoIdx: index('codigo_idx').on(table.codigo)
}));

export const historico_precos = mysqlTable('historico_precos', {
  id: serial('id').primaryKey(),
  produto_id: int('produto_id').notNull().references(() => produtos.id),
  preco_custo: decimal('preco_custo', { precision: 10, scale: 2 }).notNull(),
  preco_venda: decimal('preco_venda', { precision: 10, scale: 2 }).notNull(),
  alterado_por: int('alterado_por').notNull().references(() => funcionarios.id),
  motivo: text('motivo'),
  criado_em: timestamp('criado_em').defaultNow().notNull()
}, (table) => ({
  produtoIdx: index('produto_idx').on(table.produto_id)
}));

export const movimentacoes_estoque = mysqlTable('movimentacoes_estoque', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  produto_id: int('produto_id').notNull().references(() => produtos.id),
  tipo: mysqlEnum('tipo', [
    'ENTRADA_COMPRA', 'SAIDA_VENDA', 'RESERVA_OP', 'CONSUMO_OP', 'DEVOLUCAO_OP',
    'AJUSTE_ADMIN', 'REFUGO', 'AMOSTRA', 'DEVOLUCAO_CLIENTE'
  ]).notNull(),
  quantidade: decimal('quantidade', { precision: 10, scale: 2 }).notNull(),
  estoque_antes: decimal('estoque_antes', { precision: 10, scale: 2 }).notNull(),
  estoque_depois: decimal('estoque_depois', { precision: 10, scale: 2 }).notNull(),
  referencia_id: int('referencia_id'),
  referencia_tipo: varchar('referencia_tipo', { length: 50 }),
  funcionario_id: int('funcionario_id').references(() => funcionarios.id),
  status_material: mysqlEnum('status_material', [
    'EM_ESTOQUE', 'RESERVADO', 'EM_PRODUCAO', 'DEFEITUOSO', 'DEVOLVIDO', 'DESCARTADO'
  ]),
  observacoes: text('observacoes'),
  criado_em: timestamp('criado_em').defaultNow().notNull()
}, (table) => ({
  empresaCriadoIdx: index('empresa_criado_idx').on(table.empresa_id, table.criado_em),
  produtoIdx: index('produto_idx').on(table.produto_id)
}));

export const cortes_aluminio = mysqlTable('cortes_aluminio', {
  id: serial('id').primaryKey(),
  op_id: int('op_id').notNull(),
  produto_id: int('produto_id').notNull().references(() => produtos.id),
  comprimento_original_cm: decimal('comprimento_original_cm', { precision: 10, scale: 2 }).notNull(),
  comprimento_usado_cm: decimal('comprimento_usado_cm', { precision: 10, scale: 2 }).notNull(),
  retalho_cm: decimal('retalho_cm', { precision: 10, scale: 2 }).notNull(),
  retalho_localizacao: varchar('retalho_localizacao', { length: 100 }),
  status_retalho: mysqlEnum('status_retalho', ['DISPONIVEL', 'USADO', 'DESCARTADO']).default('DISPONIVEL'),
  criado_em: timestamp('criado_em').defaultNow().notNull()
});

// ═══════════════════════════════════════════════════════════════════════════════
//  CLIENTES E FORNECEDORES
// ═══════════════════════════════════════════════════════════════════════════════

export const clientes = mysqlTable('clientes', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  tipo: mysqlEnum('tipo', ['PF', 'PJ']).notNull(),
  nome: varchar('nome', { length: 255 }).notNull(),
  cpf_cnpj: varchar('cpf_cnpj', { length: 18 }),
  telefone: varchar('telefone', { length: 20 }),
  whatsapp: varchar('whatsapp', { length: 20 }),
  email: varchar('email', { length: 255 }),
  endereco: text('endereco'),
  cep: varchar('cep', { length: 10 }),
  cidade: varchar('cidade', { length: 100 }),
  estado: varchar('estado', { length: 2 }),
  classificacao: mysqlEnum('classificacao', ['VIP', 'REGULAR', 'OCASIONAL', 'CONSTRUTORA', 'INSTALADOR', 'INTERNO']).default('REGULAR'),
  tabela_preco_id: int('tabela_preco_id').references(() => tabelas_preco.id),
  limite_credito: decimal('limite_credito', { precision: 10, scale: 2 }).default('0.00'),
  data_nascimento: datetime('data_nascimento'),
  observacoes: text('observacoes'),
  ativo: boolean('ativo').default(true).notNull(),
  criado_em: timestamp('criado_em').defaultNow().notNull()
}, (table) => ({
  empresaIdx: index('empresa_idx').on(table.empresa_id)
}));

export const fornecedores = mysqlTable('fornecedores', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  razao_social: varchar('razao_social', { length: 255 }).notNull(),
  cnpj: varchar('cnpj', { length: 18 }).notNull(),
  contato: varchar('contato', { length: 255 }),
  telefone: varchar('telefone', { length: 20 }),
  email: varchar('email', { length: 255 }),
  prazo_entrega: int('prazo_entrega'),
  condicao_pgto: varchar('condicao_pgto', { length: 255 }),
  ativo: boolean('ativo').default(true).notNull(),
  criado_em: timestamp('criado_em').defaultNow().notNull()
}, (table) => ({
  empresaIdx: index('empresa_idx').on(table.empresa_id)
}));

export const creditos_cliente = mysqlTable('creditos_cliente', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  cliente_id: int('cliente_id').notNull().references(() => clientes.id),
  devolucao_id: int('devolucao_id'),
  valor: decimal('valor', { precision: 10, scale: 2 }).notNull(),
  saldo_restante: decimal('saldo_restante', { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum('status', ['ATIVO', 'USADO', 'EXPIRADO']).default('ATIVO'),
  criado_em: timestamp('criado_em').defaultNow().notNull()
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ORÇAMENTOS
// ═══════════════════════════════════════════════════════════════════════════════

export const orcamentos = mysqlTable('orcamentos', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  numero: varchar('numero', { length: 50 }).unique().notNull(),
  cliente_id: int('cliente_id').notNull().references(() => clientes.id),
  vendedor_id: int('vendedor_id').notNull().references(() => funcionarios.id),
  status: mysqlEnum('status', ['RASCUNHO', 'ENVIADO', 'APROVADO', 'REJEITADO', 'EXPIRADO']).default('RASCUNHO'),
  valido_ate: datetime('valido_ate'),
  desconto_pct: decimal('desconto_pct', { precision: 5, scale: 2 }).default('0.00'),
  desconto_valor: decimal('desconto_valor', { precision: 10, scale: 2 }).default('0.00'),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  observacoes: text('observacoes'),
  pdf_url: varchar('pdf_url', { length: 500 }),
  criado_em: timestamp('criado_em').defaultNow().notNull()
}, (table) => ({
  empresaIdx: index('empresa_idx').on(table.empresa_id),
  numeroIdx: index('numero_idx').on(table.numero)
}));

export const itens_orcamento = mysqlTable('itens_orcamento', {
  id: serial('id').primaryKey(),
  orcamento_id: int('orcamento_id').notNull().references(() => orcamentos.id),
  produto_id: int('produto_id').notNull().references(() => produtos.id),
  quantidade: decimal('quantidade', { precision: 10, scale: 2 }).notNull(),
  preco_unit: decimal('preco_unit', { precision: 10, scale: 2 }).notNull(),
  desconto_pct: decimal('desconto_pct', { precision: 5, scale: 2 }).default('0.00'),
  total_item: decimal('total_item', { precision: 10, scale: 2 }).notNull()
});

// ═══════════════════════════════════════════════════════════════════════════════
//  VENDAS
// ═══════════════════════════════════════════════════════════════════════════════

export const vendas = mysqlTable('vendas', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  numero: varchar('numero', { length: 50 }).unique().notNull(),
  tipo: mysqlEnum('tipo', ['VENDA', 'ORCAMENTO', 'AMOSTRA', 'DEVOLUCAO']).default('VENDA'),
  status: mysqlEnum('status', ['RASCUNHO', 'CONFIRMADA', 'SEPARANDO', 'ENTREGUE', 'CANCELADA']).default('RASCUNHO'),
  orcamento_id: int('orcamento_id').references(() => orcamentos.id),
  cliente_id: int('cliente_id').notNull().references(() => clientes.id),
  vendedor_id: int('vendedor_id').notNull().references(() => funcionarios.id),
  desconto_pct: decimal('desconto_pct', { precision: 5, scale: 2 }).default('0.00'),
  desconto_valor: decimal('desconto_valor', { precision: 10, scale: 2 }).default('0.00'),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  forma_pgto: mysqlEnum('forma_pgto', ['DINHEIRO', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'CHEQUE', 'APRAZO', 'BOLETO', 'MISTO']),
  parcelas: int('parcelas').default(1),
  observacoes: text('observacoes'),
  nfe_numero: varchar('nfe_numero', { length: 50 }),
  nfe_xml_url: varchar('nfe_xml_url', { length: 500 }),
  nfe_pdf_url: varchar('nfe_pdf_url', { length: 500 }),
  cancelada_por: int('cancelada_por').references(() => funcionarios.id),
  motivo_cancel: text('motivo_cancel'),
  criado_em: timestamp('criado_em').defaultNow().notNull(),
  atualizado_em: timestamp('atualizado_em').defaultNow().onUpdateNow()
}, (table) => ({
  empresaIdx: index('empresa_idx').on(table.empresa_id),
  numeroIdx: index('numero_idx').on(table.numero),
  vendedorIdx: index('vendedor_idx').on(table.vendedor_id)
}));

export const itens_venda = mysqlTable('itens_venda', {
  id: serial('id').primaryKey(),
  venda_id: int('venda_id').notNull().references(() => vendas.id),
  produto_id: int('produto_id').notNull().references(() => produtos.id),
  quantidade: decimal('quantidade', { precision: 10, scale: 2 }).notNull(),
  preco_unit: decimal('preco_unit', { precision: 10, scale: 2 }).notNull(),
  preco_custo: decimal('preco_custo', { precision: 10, scale: 2 }).notNull(),
  desconto_pct: decimal('desconto_pct', { precision: 5, scale: 2 }).default('0.00'),
  total_item: decimal('total_item', { precision: 10, scale: 2 }).notNull()
});

export const pagamentos_venda = mysqlTable('pagamentos_venda', {
  id: serial('id').primaryKey(),
  venda_id: int('venda_id').notNull().references(() => vendas.id),
  forma: mysqlEnum('forma', ['DINHEIRO', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'CHEQUE', 'APRAZO']).notNull(),
  valor: decimal('valor', { precision: 10, scale: 2 }).notNull(),
  nsu: varchar('nsu', { length: 100 }),
  criado_em: timestamp('criado_em').defaultNow().notNull()
});

export const solicitacoes_desconto = mysqlTable('solicitacoes_desconto', {
  id: serial('id').primaryKey(),
  venda_id: int('venda_id').notNull().references(() => vendas.id),
  vendedor_id: int('vendedor_id').notNull().references(() => funcionarios.id),
  desconto_pct: decimal('desconto_pct', { precision: 5, scale: 2 }).notNull(),
  motivo: text('motivo'),
  status: mysqlEnum('status', ['PENDENTE', 'APROVADO', 'RECUSADO']).default('PENDENTE'),
  aprovado_por: int('aprovado_por').references(() => funcionarios.id),
  criado_em: timestamp('criado_em').defaultNow().notNull(),
  resolvido_em: datetime('resolvido_em')
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DEVOLUÇÕES
// ═══════════════════════════════════════════════════════════════════════════════

export const devolucoes = mysqlTable('devolucoes', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  venda_id: int('venda_id').notNull().references(() => vendas.id),
  cliente_id: int('cliente_id').notNull().references(() => clientes.id),
  solicitante_id: int('solicitante_id').notNull().references(() => funcionarios.id),
  tipo: mysqlEnum('tipo', ['DEVOLUCAO', 'TROCA']).default('DEVOLUCAO'),
  status: mysqlEnum('status', ['ABERTA', 'APROVADA', 'REJEITADA', 'CONCLUIDA']).default('ABERTA'),
  motivo: text('motivo'),
  observacoes: text('observacoes'),
  aprovado_por: int('aprovado_por').references(() => funcionarios.id),
  criado_em: timestamp('criado_em').defaultNow().notNull()
}, (table) => ({
  empresaIdx: index('empresa_idx').on(table.empresa_id)
}));

export const itens_devolucao = mysqlTable('itens_devolucao', {
  id: serial('id').primaryKey(),
  devolucao_id: int('devolucao_id').notNull().references(() => devolucoes.id),
  produto_id: int('produto_id').notNull().references(() => produtos.id),
  quantidade: decimal('quantidade', { precision: 10, scale: 2 }).notNull(),
  preco_unit: decimal('preco_unit', { precision: 10, scale: 2 }).notNull(),
  destino_estoque: mysqlEnum('destino_estoque', ['DISPONIVEL', 'DEFEITUOSO', 'DESCARTE']).default('DISPONIVEL')
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PRODUÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

export const ordens_producao = mysqlTable('ordens_producao', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  numero: varchar('numero', { length: 50 }).unique().notNull(),
  tipo_produto: mysqlEnum('tipo_produto', ['PORTA', 'PORTAO', 'JANELA', 'VENEZIANA', 'GRADE', 'OUTRO']).notNull(),
  descricao: text('descricao').notNull(),
  largura_cm: decimal('largura_cm', { precision: 10, scale: 2 }),
  altura_cm: decimal('altura_cm', { precision: 10, scale: 2 }),
  cliente_id: int('cliente_id').references(() => clientes.id),
  venda_id: int('venda_id').references(() => vendas.id),
  operador_id: int('operador_id').references(() => funcionarios.id),
  status: mysqlEnum('status', ['PLANEJADA', 'LIBERADA', 'EM_PRODUCAO', 'PAUSADA', 'CONCLUIDA', 'CANCELADA']).default('PLANEJADA'),
  prioridade: mysqlEnum('prioridade', ['BAIXA', 'NORMAL', 'ALTA', 'URGENTE']).default('NORMAL'),
  prazo_entrega: datetime('prazo_entrega'),
  iniciada_em: datetime('iniciada_em'),
  concluida_em: datetime('concluida_em'),
  tempo_total_min: int('tempo_total_min'),
  observacoes: text('observacoes'),
  foto_url: varchar('foto_url', { length: 500 }),
  qrcode_url: varchar('qrcode_url', { length: 500 }),
  criado_em: timestamp('criado_em').defaultNow().notNull(),
  atualizado_em: timestamp('atualizado_em').defaultNow().onUpdateNow()
}, (table) => ({
  empresaIdx: index('empresa_idx').on(table.empresa_id),
  numeroIdx: index('numero_idx').on(table.numero)
}));

export const etapas_op = mysqlTable('etapas_op', {
  id: serial('id').primaryKey(),
  op_id: int('op_id').notNull().references(() => ordens_producao.id),
  nome: mysqlEnum('nome', ['CORTE', 'MONTAGEM', 'ACABAMENTO', 'INSTALACAO', 'OUTRO']).notNull(),
  operador_id: int('operador_id').references(() => funcionarios.id),
  status: mysqlEnum('status', ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA', 'PAUSADA']).default('PENDENTE'),
  iniciada_em: datetime('iniciada_em'),
  concluida_em: datetime('concluida_em'),
  tempo_min: int('tempo_min'),
  observacoes: text('observacoes')
});

export const itens_op = mysqlTable('itens_op', {
  id: serial('id').primaryKey(),
  op_id: int('op_id').notNull().references(() => ordens_producao.id),
  produto_id: int('produto_id').notNull().references(() => produtos.id),
  quantidade_plan: decimal('quantidade_plan', { precision: 10, scale: 2 }).notNull(),
  quantidade_real: decimal('quantidade_real', { precision: 10, scale: 2 }).default('0.00'),
  quantidade_refu: decimal('quantidade_refu', { precision: 10, scale: 2 }).default('0.00'),
  status: mysqlEnum('status', ['RESERVADO', 'EM_PRODUCAO', 'CONSUMIDO', 'DEVOLVIDO']).default('RESERVADO')
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ALMOXARIFADO
// ═══════════════════════════════════════════════════════════════════════════════

export const ferramentas = mysqlTable('ferramentas', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  nome: varchar('nome', { length: 255 }).notNull(),
  numero_serie: varchar('numero_serie', { length: 100 }).unique().notNull(),
  categoria: mysqlEnum('categoria', ['CHAVE_MANUAL', 'MAQUINA_ELETRICA', 'EQUIPAMENTO', 'OUTRO']).notNull(),
  status: mysqlEnum('status', ['DISPONIVEL', 'EM_USO', 'MANUTENCAO', 'DESCARTADA', 'PERDIDA']).default('DISPONIVEL'),
  funcionario_posse_id: int('funcionario_posse_id').references(() => funcionarios.id),
  data_aquisicao: datetime('data_aquisicao'),
  valor_aquisicao: decimal('valor_aquisicao', { precision: 10, scale: 2 }),
  observacoes: text('observacoes'),
  foto_url: varchar('foto_url', { length: 500 }),
  criado_em: timestamp('criado_em').defaultNow().notNull()
}, (table) => ({
  empresaIdx: index('empresa_idx').on(table.empresa_id)
}));

export const movimentacoes_ferramentas = mysqlTable('movimentacoes_ferramentas', {
  id: serial('id').primaryKey(),
  ferramenta_id: int('ferramenta_id').notNull().references(() => ferramentas.id),
  tipo: mysqlEnum('tipo', ['SAIDA', 'DEVOLUCAO', 'DESCARTE', 'PERDA', 'MANUTENCAO']).notNull(),
  funcionario_id: int('funcionario_id').notNull().references(() => funcionarios.id),
  ferramenta_devolvida_id: int('ferramenta_devolvida_id').references(() => ferramentas.id),
  condicao_devolvida: mysqlEnum('condicao_devolvida', ['OK', 'DESGASTADA', 'QUEBRADA', 'PERDIDA']),
  motivo_perda: text('motivo_perda'),
  autorizado_por: int('autorizado_por').references(() => funcionarios.id),
  criado_em: timestamp('criado_em').defaultNow().notNull()
});

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPRAS
// ═══════════════════════════════════════════════════════════════════════════════

export const pedidos_compra = mysqlTable('pedidos_compra', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  numero: varchar('numero', { length: 50 }).unique().notNull(),
  fornecedor_id: int('fornecedor_id').notNull().references(() => fornecedores.id),
  solicitante_id: int('solicitante_id').notNull().references(() => funcionarios.id),
  aprovado_por: int('aprovado_por').references(() => funcionarios.id),
  status: mysqlEnum('status', ['RASCUNHO', 'ENVIADO', 'CONFIRMADO', 'RECEBIDO', 'CANCELADO']).default('RASCUNHO'),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  observacoes: text('observacoes'),
  previsao_entrega: datetime('previsao_entrega'),
  recebido_em: datetime('recebido_em'),
  criado_em: timestamp('criado_em').defaultNow().notNull()
}, (table) => ({
  empresaIdx: index('empresa_idx').on(table.empresa_id)
}));

export const itens_pedido_compra = mysqlTable('itens_pedido_compra', {
  id: serial('id').primaryKey(),
  pedido_id: int('pedido_id').notNull().references(() => pedidos_compra.id),
  produto_id: int('produto_id').notNull().references(() => produtos.id),
  quantidade: decimal('quantidade', { precision: 10, scale: 2 }).notNull(),
  quantidade_recebida: decimal('quantidade_recebida', { precision: 10, scale: 2 }).default('0.00'),
  preco_unit: decimal('preco_unit', { precision: 10, scale: 2 }).notNull(),
  total_item: decimal('total_item', { precision: 10, scale: 2 }).notNull()
});

// ═══════════════════════════════════════════════════════════════════════════════
//  FINANCEIRO
// ═══════════════════════════════════════════════════════════════════════════════

export const contas_receber = mysqlTable('contas_receber', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  venda_id: int('venda_id').references(() => vendas.id),
  cliente_id: int('cliente_id').references(() => clientes.id),
  descricao: varchar('descricao', { length: 255 }).notNull(),
  valor: decimal('valor', { precision: 10, scale: 2 }).notNull(),
  vencimento: datetime('vencimento').notNull(),
  recebido_em: datetime('recebido_em'),
  status: mysqlEnum('status', ['PENDENTE', 'RECEBIDO', 'ATRASADO', 'CANCELADO']).default('PENDENTE'),
  forma_pgto: varchar('forma_pgto', { length: 50 }),
  criado_em: timestamp('criado_em').defaultNow().notNull()
}, (table) => ({
  empresaIdx: index('empresa_idx').on(table.empresa_id)
}));

export const contas_pagar = mysqlTable('contas_pagar', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  pedido_id: int('pedido_id').references(() => pedidos_compra.id),
  fornecedor_id: int('fornecedor_id').references(() => fornecedores.id),
  descricao: varchar('descricao', { length: 255 }).notNull(),
  valor: decimal('valor', { precision: 10, scale: 2 }).notNull(),
  vencimento: datetime('vencimento').notNull(),
  pago_em: datetime('pago_em'),
  status: mysqlEnum('status', ['PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO']).default('PENDENTE'),
  forma_pgto: varchar('forma_pgto', { length: 50 }),
  criado_em: timestamp('criado_em').defaultNow().notNull()
}, (table) => ({
  empresaIdx: index('empresa_idx').on(table.empresa_id)
}));

export const caixas = mysqlTable('caixas', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  funcionario_id: int('funcionario_id').notNull().references(() => funcionarios.id),
  fundo_inicial: decimal('fundo_inicial', { precision: 10, scale: 2 }).notNull(),
  total_dinheiro: decimal('total_dinheiro', { precision: 10, scale: 2 }).default('0.00'),
  total_pix: decimal('total_pix', { precision: 10, scale: 2 }).default('0.00'),
  total_debito: decimal('total_debito', { precision: 10, scale: 2 }).default('0.00'),
  total_credito: decimal('total_credito', { precision: 10, scale: 2 }).default('0.00'),
  total_outros: decimal('total_outros', { precision: 10, scale: 2 }).default('0.00'),
  total_sistema: decimal('total_sistema', { precision: 10, scale: 2 }).default('0.00'),
  diferenca: decimal('diferenca', { precision: 10, scale: 2 }).default('0.00'),
  observacoes: text('observacoes'),
  aberto_em: timestamp('aberto_em').defaultNow().notNull(),
  fechado_em: datetime('fechado_em'),
  status: mysqlEnum('status', ['ABERTO', 'FECHADO']).default('ABERTO')
}, (table) => ({
  empresaIdx: index('empresa_idx').on(table.empresa_id)
}));

export const comissoes = mysqlTable('comissoes', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  funcionario_id: int('funcionario_id').notNull().references(() => funcionarios.id),
  venda_id: int('venda_id').notNull().references(() => vendas.id),
  valor_venda: decimal('valor_venda', { precision: 10, scale: 2 }).notNull(),
  percentual: decimal('percentual', { precision: 5, scale: 2 }).notNull(),
  valor_comissao: decimal('valor_comissao', { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum('status', ['PENDENTE', 'PAGO']).default('PENDENTE'),
  mes_referencia: varchar('mes_referencia', { length: 7 }),
  pago_em: datetime('pago_em'),
  criado_em: timestamp('criado_em').defaultNow().notNull()
}, (table) => ({
  empresaIdx: index('empresa_idx').on(table.empresa_id)
}));

export const garantias = mysqlTable('garantias', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  venda_id: int('venda_id').notNull().references(() => vendas.id),
  cliente_id: int('cliente_id').notNull().references(() => clientes.id),
  produto_id: int('produto_id').notNull().references(() => produtos.id),
  validade: datetime('validade').notNull(),
  status: mysqlEnum('status', ['ATIVA', 'EXPIRADA', 'ACIONADA']).default('ATIVA'),
  criado_em: timestamp('criado_em').defaultNow().notNull()
}, (table) => ({
  empresaIdx: index('empresa_idx').on(table.empresa_id)
}));

// ═══════════════════════════════════════════════════════════════════════════════
//  NF-e
// ═══════════════════════════════════════════════════════════════════════════════

export const nfe_emissoes = mysqlTable('nfe_emissoes', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  venda_id: int('venda_id').references(() => vendas.id),
  orcamento_id: int('orcamento_id').references(() => orcamentos.id),
  tipo: mysqlEnum('tipo', ['NFE', 'NFCE', 'MDFE']).default('NFE'),
  numero: varchar('numero', { length: 50 }),
  serie: varchar('serie', { length: 10 }),
  chave_acesso: varchar('chave_acesso', { length: 44 }),
  status: mysqlEnum('status', ['RASCUNHO', 'EMITIDA', 'CANCELADA', 'DENEGADA']).default('RASCUNHO'),
  xml_url: varchar('xml_url', { length: 500 }),
  pdf_url: varchar('pdf_url', { length: 500 }),
  data_emissao: datetime('data_emissao'),
  criado_em: timestamp('criado_em').defaultNow().notNull()
}, (table) => ({
  empresaIdx: index('empresa_idx').on(table.empresa_id)
}));

// ═══════════════════════════════════════════════════════════════════════════════
//  COMUNICAÇÃO
// ═══════════════════════════════════════════════════════════════════════════════

export const notificacoes = mysqlTable('notificacoes', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  destinatario_id: int('destinatario_id').references(() => funcionarios.id),
  tipo: mysqlEnum('tipo', [
    'ESTOQUE_CRITICO', 'ESTOQUE_ZERO', 'OP_ATRASADA', 'CONTA_VENCENDO',
    'FERRAMENTA_PERDIDA', 'DESCONTO_PENDENTE', 'ANIVERSARIO_CLIENTE',
    'VENDA_CANCELADA', 'NOVA_OP', 'LOGIN_SUSPEITO', 'DIVERGENCIA_RECEBIMENTO',
    'PRODUTO_NAO_CADASTRADO', 'META_ATINGIDA', 'ESTOQUE_REABASTECIDO', 'OUTRO'
  ]).notNull(),
  titulo: varchar('titulo', { length: 255 }).notNull(),
  mensagem: text('mensagem').notNull(),
  lida: boolean('lida').default(false).notNull(),
  link_interno: varchar('link_interno', { length: 255 }),
  criado_em: timestamp('criado_em').defaultNow().notNull()
}, (table) => ({
  empresaDestinatarioIdx: index('empresa_destinatario_idx').on(table.empresa_id, table.destinatario_id)
}));

export const avisos_chefe = mysqlTable('avisos_chefe', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  remetente_id: int('remetente_id').notNull().references(() => funcionarios.id),
  destinatario_id: int('destinatario_id').references(() => funcionarios.id),
  setor_destino: mysqlEnum('setor_destino', ['TODOS', 'ESCRITORIO', 'ALMOXARIFADO', 'VENDAS', 'DISTRIBUIDORA', 'FABRICA']).default('TODOS'),
  titulo: varchar('titulo', { length: 255 }).notNull(),
  mensagem: text('mensagem').notNull(),
  prioridade: mysqlEnum('prioridade', ['NORMAL', 'URGENTE']).default('NORMAL'),
  ativo: boolean('ativo').default(true).notNull(),
  expira_em: datetime('expira_em'),
  reenvios: int('reenvios').default(0),
  total_destinatarios: int('total_destinatarios').default(0),
  criado_em: timestamp('criado_em').defaultNow().notNull()
}, (table) => ({
  empresaIdx: index('empresa_idx').on(table.empresa_id)
}));

export const leituras_aviso = mysqlTable('leituras_aviso', {
  id: serial('id').primaryKey(),
  aviso_id: int('aviso_id').notNull().references(() => avisos_chefe.id),
  funcionario_id: int('funcionario_id').notNull().references(() => funcionarios.id),
  lido_em: timestamp('lido_em').defaultNow().notNull(),
  ip: varchar('ip', { length: 45 }),
  via: mysqlEnum('via', ['POPUP_LOGIN', 'NOTIFICACAO_SISTEMA', 'SINO']).notNull()
}, (table) => ({
  avisoFuncUniqueIdx: unique('aviso_func_unique_idx').on(table.aviso_id, table.funcionario_id)
}));

// ═══════════════════════════════════════════════════════════════════════════════
//  AUDITORIA
// ═══════════════════════════════════════════════════════════════════════════════

export const logs_auditoria = mysqlTable('logs_auditoria', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').notNull().references(() => empresas.id),
  funcionario_id: int('funcionario_id').references(() => funcionarios.id),
  acao: varchar('acao', { length: 100 }).notNull(),
  modulo: varchar('modulo', { length: 100 }).notNull(),
  item_tipo: varchar('item_tipo', { length: 100 }),
  item_id: int('item_id'),
  valor_antes: json('valor_antes'),
  valor_depois: json('valor_depois'),
  ip: varchar('ip', { length: 45 }),
  user_agent: text('user_agent'),
  criado_em: timestamp('criado_em').defaultNow().notNull()
}, (table) => ({
  empresaCriadoIdx: index('empresa_criado_idx').on(table.empresa_id, table.criado_em)
}));

export const logs_seguranca = mysqlTable('logs_seguranca', {
  id: serial('id').primaryKey(),
  empresa_id: int('empresa_id').references(() => empresas.id),
  funcionario_id: int('funcionario_id').references(() => funcionarios.id),
  evento: mysqlEnum('evento', [
    'LOGIN_SUCESSO', 'LOGIN_FALHOU', 'SENHA_ALTERADA', 'ACESSO_NEGADO',
    'IP_SUSPEITO', 'TOKEN_INVALIDO', 'LOGOUT'
  ]).notNull(),
  ip: varchar('ip', { length: 45 }),
  user_agent: text('user_agent'),
  tentativas: int('tentativas').default(1),
  bloqueado: boolean('bloqueado').default(false),
  criado_em: timestamp('criado_em').defaultNow().notNull()
}, (table) => ({
  empresaCriadoIdx: index('empresa_criado_idx').on(table.empresa_id, table.criado_em)
}));
