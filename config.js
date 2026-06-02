// =====================================================================
//  CONFIGURAÇÕES DO APP — Lixeira Inteligente
// =====================================================================
//
// MODO ATUAL: cada pessoa cola a própria chave do Gemini.
//
// Ao abrir o site, o app pede a chave (que começa com "AIza") na tela
// de boas-vindas. Cada navegador guarda a chave localmente e não
// precisa colar de novo nas próximas visitas.
//
// Esse modo é o mais seguro: nenhuma chave fica no código fonte e o
// Google não tem como detectar e desativar.
//
// =====================================================================
//  COMO CADA PESSOA PEGA UMA CHAVE GRÁTIS
// =====================================================================
//
// 1. Abre  https://aistudio.google.com/app/apikey
// 2. Faz login com qualquer conta Google
// 3. Clica em "Criar chave de API"
// 4. Copia a chave (começa com "AIza...")
// 5. Cola na tela de boas-vindas do app
//
// =====================================================================

window.AppConfig = {
  // Modelo padrão. Opções:
  //   "gemini-2.5-flash"      — equilibrado (recomendado)
  //   "gemini-2.5-flash-lite" — mais rápido, cota maior
  //   "gemini-2.5-pro"        — mais preciso, cota menor
  defaultModel: "gemini-2.5-flash",

  // Modo "chave embutida" desligado. Cada pessoa cola a própria chave.
  useEmbeddedKey: false,
  embeddedApiKeyParts: [],
};
