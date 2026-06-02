// =====================================================================
//  CONFIGURAÇÕES DO APP — Lixeira Inteligente
// =====================================================================
//
// Para que o app abra já pronto para uso (sem cada visitante precisar
// inserir sua própria chave da API), edite as 2 linhas marcadas abaixo:
//
//   1) Cole sua chave do Google AI Studio em `embeddedApiKey`
//      (a mesma que está nas Configurações do app hoje, começa com "AIza")
//   2) Mude `useEmbeddedKey` para `true`
//   3) Commit + push para o GitHub
//
// Pronto: quem abrir o site nem vê a tela de boas-vindas pedindo a
// chave. A câmera liga, fotografa e a IA já responde.
//
// ⚠️ IMPORTANTE — RESTRINJA SUA CHAVE ANTES DE PUBLICAR
//
// Como o site é público no GitHub Pages, sua chave aparece no código
// fonte (qualquer um pode ver com F12 no navegador). Pra evitar que
// alguém copie e use em outro lugar, abra:
//
//     https://aistudio.google.com/app/apikey
//
// 1. Clique nos 3 pontinhos da chave que você vai usar → "Edit API key"
// 2. Role até "Application restrictions" e selecione "Websites"
// 3. Adicione o domínio do seu GitHub Pages, por exemplo:
//        rodrigomariani-bit.github.io
// 4. Salve.
//
// Agora, mesmo se alguém copiar sua chave, só vai funcionar dentro do
// seu site — não dá pra usar em outro app.
//
// ⚠️ SOBRE A COTA GRATUITA
//
// Com a chave embutida, TODOS os visitantes consomem a MESMA cota
// gratuita diária do Google. Pro Gemini 2.5 Flash hoje é ~250 fotos
// por dia. Se a cota acabar no meio do dia, o app para e volta no dia
// seguinte. Se for usar com uma escola inteira, considere ativar
// billing no Google Cloud (continua barato — fração de centavo por foto).
//
// =====================================================================

window.AppConfig = {
  // ───── EDITE AQUI ─────

  // Mude para `true` quando quiser que o app use a chave embutida.
  useEmbeddedKey: true,

  // Cole sua chave aqui (entre as aspas). Exemplo: "AIzaSyAbCdEf..."
  embeddedApiKey: "AIzaSyCkxtsLHW9YNwTAdLTTNmTSXZUVUtQUp-A",

  // ──────────────────────

  // Modelo padrão. Opções:
  //   "gemini-2.5-flash"      — equilibrado (recomendado)
  //   "gemini-2.5-flash-lite" — mais rápido, cota maior
  //   "gemini-2.5-pro"        — mais preciso, cota menor
  defaultModel: "gemini-2.5-flash",
};
