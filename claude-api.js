/*
 * Cliente do Claude Messages API direto do navegador.
 *
 * Usa o cabeçalho `anthropic-dangerous-direct-browser-access: true` para
 * permitir CORS em chamadas client-side. Adequado a apps client-only onde
 * cada usuário fornece sua própria API key.
 *
 * Saída forçada por JSON Schema (output_config.format) — devolve sempre
 * { category, object_name, confidence, reasoning } no formato exato.
 */
(function (global) {
  "use strict";

  const API_URL = "https://api.anthropic.com/v1/messages";
  const ANTHROPIC_VERSION = "2023-06-01";

  // Categorias suportadas pela lixeira inteligente.
  const CATEGORIES = ["organico", "papel", "metal", "vidro", "indefinido"];

  // Esquema da resposta — força a IA a devolver SEMPRE neste formato.
  const RESPONSE_SCHEMA = {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: CATEGORIES,
        description:
          "Categoria do resíduo segundo a Resolução Conama 275/2001. Use 'indefinido' apenas quando o objeto não é claramente identificável ou pertence a uma categoria fora dessas quatro (ex.: plástico, isopor, eletrônicos, pilhas, tecido).",
      },
      object_name: {
        type: "string",
        description:
          "Nome curto do objeto em português brasileiro, mesmo que seja um resto/sobra. Ex.: 'Casca de banana', 'Maçã mordida', 'Lata de refrigerante amassada', 'Garrafa de cerveja'. Máximo 6 palavras.",
      },
      confidence: {
        type: "string",
        enum: ["alta", "media", "baixa"],
        description:
          "Confiança na identificação. 'alta' quando o item é claro e bem visível; 'media' quando há alguma ambiguidade; 'baixa' quando o item está mal iluminado, parcialmente visível, ou difícil de classificar.",
      },
      reasoning: {
        type: "string",
        description:
          "Em 1 a 2 frases curtas, em português brasileiro e linguagem simples (público escolar, 7º ano), explique POR QUE este objeto pertence a essa categoria. Evite jargão.",
      },
    },
    required: ["category", "object_name", "confidence", "reasoning"],
    additionalProperties: false,
  };

  // System prompt — define o papel da IA. Marcado com cache_control para
  // ativar prompt caching nas requisições subsequentes (quando o tamanho
  // do prefixo cruzar o mínimo do modelo).
  const SYSTEM_PROMPT = `Você é a IA visual de uma lixeira inteligente brasileira que separa resíduos automaticamente. Seu trabalho é olhar uma foto e classificar o item em UMA destas quatro categorias da Resolução Conama 275/2001:

1) "organico" — Resíduo biológico que se decompõe naturalmente.
   Exemplos: restos de comida (cozida ou crua), cascas de frutas/legumes/ovos, borra de café, sachês de chá, folhas, podas, talos, sementes, ossos, guardanapo sujo de comida, comida estragada.

2) "papel" — Material celulósico SECO E LIMPO.
   Exemplos: jornais, revistas, livros, cadernos, folhas, caixas de papelão, embalagens cartonadas (Tetra Pak limpas), envelopes, papel de presente sem plástico.
   ⚠ Papel sujo de comida vai em ORGÂNICO. Papel plastificado/parafinado vai em INDEFINIDO.

3) "metal" — Itens metálicos.
   Exemplos: latas de alumínio (refrigerante, cerveja, energético), latas de aço (conserva, leite condensado, sardinha), tampas metálicas, talheres, panelas, frigideiras, ferramentas, pregos, parafusos, fios, sucata, papel-alumínio.

4) "vidro" — Itens de vidro.
   Exemplos: garrafas (cerveja, vinho, refrigerante, suco), potes (geleia, palmito, conserva), copos, taças, frascos de cosméticos/perfume/remédio, espelhos.

Quando usar "indefinido":
- Plástico de qualquer tipo (PET, PEAD, sacolas, isopor, embalagens flexíveis, PVC).
- Eletrônicos, pilhas, baterias, lâmpadas.
- Tecido, couro, calçados, fraldas.
- Madeira tratada, pneus.
- Quando não houver objeto claro de descarte na imagem (paisagem, pessoa, cena genérica).
- Quando a imagem está borrada ou escura demais para identificar.

Regras adicionais:
- Identifique o objeto ESPECÍFICO mesmo que seja um resto. Casca de banana é "Casca de banana" (orgânico), não "Banana".
- Maçã mordida ou parcialmente comida é orgânico.
- Garrafa PET (transparente, leve, com listras de injeção no fundo) é PLÁSTICO → "indefinido". Garrafa de vidro é mais pesada, mais grossa e geralmente colorida.
- Lata amassada continua sendo lata (metal).
- Quando houver ambiguidade vidro x plástico, observe brilho, espessura e marca da boca da garrafa: vidro tem reflexo mais nítido e parede mais grossa.

Devolva SEMPRE um JSON estritamente no formato definido pelo schema. Nada além do JSON.`;

  /**
   * Classifica uma imagem usando o Claude Vision.
   *
   * @param {object} opts
   * @param {string} opts.apiKey   Chave da API Anthropic (sk-ant-...).
   * @param {string} opts.model    ID do modelo (claude-opus-4-7, claude-sonnet-4-6, claude-haiku-4-5).
   * @param {string} opts.imageBase64  Imagem JPEG codificada em base64 (sem o prefixo data:).
   * @param {string} [opts.mediaType]  Tipo MIME da imagem. Padrão "image/jpeg".
   * @param {AbortSignal} [opts.signal]  AbortSignal opcional para cancelar.
   * @returns {Promise<{category: string, object_name: string, confidence: string, reasoning: string}>}
   */
  async function classifyImage(opts) {
    const {
      apiKey,
      model,
      imageBase64,
      mediaType = "image/jpeg",
      signal,
    } = opts;

    if (!apiKey) throw new ApiError("missing_api_key", "Chave de API não configurada.");
    if (!imageBase64) throw new ApiError("missing_image", "Sem imagem para classificar.");

    const body = {
      model,
      max_tokens: 600,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: "Classifique este item segundo as regras. Devolva apenas o JSON.",
            },
          ],
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: RESPONSE_SCHEMA,
        },
      },
    };

    let response;
    try {
      response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (err && err.name === "AbortError") throw err;
      throw new ApiError(
        "network_error",
        "Falha de rede ao chamar a API. Verifique sua conexão.",
        err
      );
    }

    if (!response.ok) {
      let detail = null;
      try { detail = await response.json(); } catch (_) {}
      const errType = (detail && detail.error && detail.error.type) || "api_error";
      const errMsg = (detail && detail.error && detail.error.message) || `HTTP ${response.status}`;
      throw new ApiError(mapErrorType(response.status, errType), friendlyError(response.status, errType, errMsg), detail);
    }

    const data = await response.json();
    return parseResult(data);
  }

  function parseResult(data) {
    // Resposta do Claude: { content: [{type: "text", text: "..."}] }
    const blocks = (data && data.content) || [];
    const textBlock = blocks.find((b) => b.type === "text");
    if (!textBlock || !textBlock.text) {
      throw new ApiError(
        "empty_response",
        "A IA devolveu uma resposta vazia. Tente de novo."
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch (err) {
      throw new ApiError(
        "invalid_json",
        "A IA devolveu uma resposta em formato inesperado.",
        textBlock.text
      );
    }

    // Validação leve: garante o esqueleto esperado.
    if (!CATEGORIES.includes(parsed.category)) parsed.category = "indefinido";
    if (!["alta", "media", "baixa"].includes(parsed.confidence)) parsed.confidence = "media";
    parsed.object_name = String(parsed.object_name || "Objeto não identificado");
    parsed.reasoning = String(parsed.reasoning || "");

    return parsed;
  }

  function mapErrorType(status, errType) {
    if (status === 401) return "auth";
    if (status === 403) return "permission";
    if (status === 429) return "rate_limit";
    if (status >= 500) return "server";
    if (errType === "invalid_request_error") return "bad_request";
    return "api_error";
  }

  function friendlyError(status, errType, msg) {
    if (status === 401) return "Chave de API inválida. Verifique nas Configurações.";
    if (status === 403) return "Sua chave não tem permissão para usar este modelo.";
    if (status === 429) return "Muitas requisições. Aguarde alguns segundos e tente de novo.";
    if (status === 400 && /credit|billing/i.test(msg)) {
      return "Sua conta Anthropic não tem créditos. Adicione um método de pagamento no console.";
    }
    if (status >= 500) return "A API está temporariamente indisponível. Tente novamente em instantes.";
    return "Erro na API: " + msg;
  }

  class ApiError extends Error {
    constructor(type, message, detail) {
      super(message);
      this.name = "ApiError";
      this.type = type;
      this.detail = detail;
    }
  }

  /**
   * Captura um frame do <video> em um JPEG redimensionado e devolve a string
   * base64 (sem o prefixo data:).
   *
   * Limita a maior dimensão a `maxSize` para reduzir custo de tokens da API.
   *
   * @param {HTMLVideoElement} video
   * @param {number} [maxSize=1024]
   * @param {number} [quality=0.85]
   * @returns {string} base64 sem prefixo
   */
  function captureFrameBase64(video, maxSize = 1024, quality = 0.85) {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) throw new Error("Vídeo ainda não carregou.");

    const scale = Math.min(1, maxSize / Math.max(vw, vh));
    const w = Math.round(vw * scale);
    const h = Math.round(vh * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);

    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    return dataUrl.split(",")[1];
  }

  global.ClaudeAPI = {
    classifyImage,
    captureFrameBase64,
    ApiError,
    CATEGORIES,
  };
})(window);
