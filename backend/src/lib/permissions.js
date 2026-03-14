// Definição completa de todas as permissões do sistema VIDRATO
// Baseado no BLOCO 06 da especificação

export const PERFIS = {
  ADMIN: 'ADMIN',
  VENDEDOR: 'VENDEDOR',
  ALMOXARIFE: 'ALMOXARIFE',
  OPERADOR_FABRICA: 'OPERADOR_FABRICA',
  EXPEDIDOR: 'EXPEDIDOR',
  FINANCEIRO: 'FINANCEIRO'
};

export const PERMISSOES = {
  // Autenticação
  PERM_LOGIN: 'perm_login',
  PERM_ALTERAR_PROPRIA_SENHA: 'perm_alterar_propria_senha',

  // Produtos
  PERM_PRODUTO_LISTAR: 'perm_produto_listar',
  PERM_PRODUTO_VER_CUSTO: 'perm_produto_ver_custo', // SOMENTE ADMIN
  PERM_PRODUTO_CRIAR: 'perm_produto_criar',
  PERM_PRODUTO_EDITAR: 'perm_produto_editar',
  PERM_PRODUTO_DELETAR: 'perm_produto_deletar',
  PERM_PRODUTO_VER_ESTOQUE: 'perm_produto_ver_estoque',
  PERM_PRODUTO_AJUSTAR_ESTOQUE: 'perm_produto_ajustar_estoque',

  // Vendas
  PERM_VENDA_CRIAR: 'perm_venda_criar',
  PERM_VENDA_LISTAR_PROPRIAS: 'perm_venda_listar_proprias',
  PERM_VENDA_LISTAR_TODAS: 'perm_venda_listar_todas',
  PERM_VENDA_CANCELAR: 'perm_venda_cancelar', // SOMENTE ADMIN
  PERM_VENDA_VER_CUSTO: 'perm_venda_ver_custo', // SOMENTE ADMIN
  PERM_VENDA_DESCONTO_LIMITE: 'perm_venda_desconto_limite',
  PERM_VENDA_DESCONTO_ILIMITADO: 'perm_venda_desconto_ilimitado', // SOMENTE ADMIN
  PERM_ORCAMENTO_CRIAR: 'perm_orcamento_criar',
  PERM_ORCAMENTO_APROVAR: 'perm_orcamento_aprovar',
  PERM_DEVOLUCAO_CRIAR: 'perm_devolucao_criar',
  PERM_DEVOLUCAO_APROVAR: 'perm_devolucao_aprovar',

  // Produção
  PERM_OP_CRIAR: 'perm_op_criar',
  PERM_OP_LISTAR: 'perm_op_listar',
  PERM_OP_ATUALIZAR_STATUS: 'perm_op_atualizar_status',
  PERM_OP_REGISTRAR_REFUGO: 'perm_op_registrar_refugo',
  PERM_OP_CONCLUIR: 'perm_op_concluir',
  PERM_OP_CANCELAR: 'perm_op_cancelar',

  // Almoxarifado
  PERM_ALMOX_ENTRADA_MERCADORIA: 'perm_almox_entrada_mercadoria',
  PERM_ALMOX_SEPARACAO: 'perm_almox_separacao',
  PERM_FERRAMENTA_LISTAR: 'perm_ferramenta_listar',
  PERM_FERRAMENTA_SAIDA: 'perm_ferramenta_saida',
  PERM_FERRAMENTA_DEVOLUCAO: 'perm_ferramenta_devolucao',
  PERM_FERRAMENTA_OVERRIDE: 'perm_ferramenta_override', // SOMENTE ADMIN

  // Financeiro
  PERM_FINANCEIRO_VER: 'perm_financeiro_ver',
  PERM_CAIXA_ABRIR: 'perm_caixa_abrir',
  PERM_CAIXA_FECHAR: 'perm_caixa_fechar',
  PERM_CONTAS_LISTAR: 'perm_contas_listar',
  PERM_CONTAS_PAGAR: 'perm_contas_pagar',
  PERM_RELATORIO_FINANCEIRO: 'perm_relatorio_financeiro',
  PERM_COMISSAO_VER: 'perm_comissao_ver',
  PERM_COMISSAO_PAGAR: 'perm_comissao_pagar',

  // Compras
  PERM_COMPRA_CRIAR: 'perm_compra_criar',
  PERM_COMPRA_APROVAR: 'perm_compra_aprovar',
  PERM_COMPRA_RECEBER: 'perm_compra_receber',

  // Clientes e Fornecedores
  PERM_CLIENTE_LISTAR: 'perm_cliente_listar',
  PERM_CLIENTE_CRIAR: 'perm_cliente_criar',
  PERM_CLIENTE_EDITAR: 'perm_cliente_editar',
  PERM_FORNECEDOR_LISTAR: 'perm_fornecedor_listar',
  PERM_FORNECEDOR_CRIAR: 'perm_fornecedor_criar',

  // Administração
  PERM_FUNCIONARIO_CRIAR: 'perm_funcionario_criar',
  PERM_FUNCIONARIO_EDITAR: 'perm_funcionario_editar',
  PERM_FUNCIONARIO_LISTAR: 'perm_funcionario_listar',
  PERM_CONFIGURACOES_EDITAR: 'perm_configuracoes_editar',
  PERM_AUDITORIA_VER: 'perm_auditoria_ver',
  PERM_RELATORIO_EXPORTAR: 'perm_relatorio_exportar',
  PERM_NOTIFICACAO_VER: 'perm_notificacao_ver',
  PERM_AVISO_CRIAR: 'perm_aviso_criar',
  PERM_NFE_EMITIR: 'perm_nfe_emitir'
};

// Permissões por perfil base
export const PERMISSOES_POR_PERFIL = {
  [PERFIS.ADMIN]: Object.values(PERMISSOES), // Admin tem TODAS as permissões

  [PERFIS.VENDEDOR]: [
    PERMISSOES.PERM_LOGIN,
    PERMISSOES.PERM_ALTERAR_PROPRIA_SENHA,
    PERMISSOES.PERM_PRODUTO_LISTAR,
    PERMISSOES.PERM_PRODUTO_VER_ESTOQUE,
    PERMISSOES.PERM_VENDA_CRIAR,
    PERMISSOES.PERM_VENDA_LISTAR_PROPRIAS,
    PERMISSOES.PERM_ORCAMENTO_CRIAR,
    PERMISSOES.PERM_VENDA_DESCONTO_LIMITE,
    PERMISSOES.PERM_DEVOLUCAO_CRIAR,
    PERMISSOES.PERM_CLIENTE_LISTAR,
    PERMISSOES.PERM_CLIENTE_CRIAR,
    PERMISSOES.PERM_NOTIFICACAO_VER
  ],

  [PERFIS.ALMOXARIFE]: [
    PERMISSOES.PERM_LOGIN,
    PERMISSOES.PERM_PRODUTO_LISTAR,
    PERMISSOES.PERM_PRODUTO_VER_ESTOQUE,
    PERMISSOES.PERM_ALMOX_ENTRADA_MERCADORIA,
    PERMISSOES.PERM_ALMOX_SEPARACAO,
    PERMISSOES.PERM_FERRAMENTA_LISTAR,
    PERMISSOES.PERM_FERRAMENTA_SAIDA,
    PERMISSOES.PERM_FERRAMENTA_DEVOLUCAO,
    PERMISSOES.PERM_COMPRA_RECEBER,
    PERMISSOES.PERM_NOTIFICACAO_VER
  ],

  [PERFIS.OPERADOR_FABRICA]: [
    PERMISSOES.PERM_LOGIN,
    PERMISSOES.PERM_PRODUTO_LISTAR,
    PERMISSOES.PERM_PRODUTO_VER_ESTOQUE,
    PERMISSOES.PERM_OP_CRIAR,
    PERMISSOES.PERM_OP_LISTAR,
    PERMISSOES.PERM_OP_ATUALIZAR_STATUS,
    PERMISSOES.PERM_OP_REGISTRAR_REFUGO,
    PERMISSOES.PERM_OP_CONCLUIR,
    PERMISSOES.PERM_NOTIFICACAO_VER
  ],

  [PERFIS.EXPEDIDOR]: [
    PERMISSOES.PERM_LOGIN,
    PERMISSOES.PERM_ALMOX_SEPARACAO,
    PERMISSOES.PERM_NOTIFICACAO_VER
  ],

  [PERFIS.FINANCEIRO]: [
    PERMISSOES.PERM_LOGIN,
    PERMISSOES.PERM_FINANCEIRO_VER,
    PERMISSOES.PERM_CAIXA_ABRIR,
    PERMISSOES.PERM_CAIXA_FECHAR,
    PERMISSOES.PERM_CONTAS_LISTAR,
    PERMISSOES.PERM_CONTAS_PAGAR,
    PERMISSOES.PERM_COMISSAO_VER,
    PERMISSOES.PERM_RELATORIO_FINANCEIRO,
    PERMISSOES.PERM_DEVOLUCAO_APROVAR,
    PERMISSOES.PERM_NOTIFICACAO_VER
  ]
};

// Calcular permissões finais do funcionário
export function calcularPermissoes(perfilBase, permissoesExtras = [], permissoesRemovidas = []) {
  const base = PERMISSOES_POR_PERFIL[perfilBase] || [];
  const extras = Array.isArray(permissoesExtras) ? permissoesExtras : [];
  const removidas = Array.isArray(permissoesRemovidas) ? permissoesRemovidas : [];

  // (base UNION extras) MINUS removidas
  const permissoesFinais = [...new Set([...base, ...extras])].filter(
    perm => !removidas.includes(perm)
  );

  return permissoesFinais;
}

// Verificar se o usuário tem uma permissão específica
export function temPermissao(permissoesUsuario, permissaoRequerida) {
  return Array.isArray(permissoesUsuario) && permissoesUsuario.includes(permissaoRequerida);
}

// Verificar se o usuário tem pelo menos uma das permissões
export function temAlgumaPermissao(permissoesUsuario, permissoesRequeridas) {
  return Array.isArray(permissoesUsuario) &&
    permissoesRequeridas.some(perm => permissoesUsuario.includes(perm));
}

// Verificar se o usuário tem todas as permissões
export function temTodasPermissoes(permissoesUsuario, permissoesRequeridas) {
  return Array.isArray(permissoesUsuario) &&
    permissoesRequeridas.every(perm => permissoesUsuario.includes(perm));
}

export default {
  PERFIS,
  PERMISSOES,
  PERMISSOES_POR_PERFIL,
  calcularPermissoes,
  temPermissao,
  temAlgumaPermissao,
  temTodasPermissoes
};
