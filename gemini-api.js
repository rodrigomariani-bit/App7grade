/*
 * Cliente da Google Gemini API direto do navegador (CORS oficial).
 *
 * Usa o endpoint generateContent do Generative Language API com a chave
 * passada via query string (?key=...). Adequado a apps client-only onde
 * cada usuário fornece sua própria chave do Google AI Studio.
 *
 * Saída forçada por JSON Schema (responseSchema) — devolve sempre
 * { category, object_name, confidence, reasoning } no formato exato.
 */
(function (global) {
  "use strict";

  const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

  const CATEGORIES = ["organico", "papel", "metal", "vidro", "indefinido"];

  // Schema de saída — Gemini aceita um subset de OpenAPI 3.0.
  // Importante: NÃO usar `additionalProperties` (não é suportado).
  //
  // `propertyOrdering` controla a ORDEM em que o modelo GERA cada campo.
  // Colocamos "object_name" e "reasoning" antes de "category" para forçar
  // chain-of-thought: o modelo descreve o item e pensa nas regras antes
  // de se comprometer com uma categoria. Isso reduz drasticamente a
  // tendência de cair em "indefinido" por excesso de cautela.
  const RESPONSE_SCHEMA = {
    type: "object",
    properties: {
      object_name: {
        type: "string",
        description:
          "Nome curto do objeto em português brasileiro, mesmo que seja resto/sobra. Ex.: 'Casca de banana', 'Maçã mordida', 'Lata de refrigerante amassada', 'Garrafa de cerveja'. Máximo 6 palavras.",
      },
      reasoning: {
        type: "string",
        description:
          "Pense em voz alta: descreva o que vê, qual material parece ser e por que se encaixa em UMA das 4 categorias principais. 1 a 2 frases curtas, em português brasileiro simples (público escolar, 7º ano).",
      },
      confidence: {
        type: "string",
        enum: ["alta", "media", "baixa"],
        description:
          "'alta' quando o item é claro; 'media' quando há alguma ambiguidade; 'baixa' quando a foto está mal iluminada ou borrada.",
      },
      category: {
        type: "string",
        enum: CATEGORIES,
        description:
          "Categoria final, baseada no raciocínio acima. Use 'indefinido' SOMENTE para plástico, isopor, eletrônico, pilha, tecido, ou se realmente não houver objeto identificável.",
      },
    },
    required: ["object_name", "reasoning", "confidence", "category"],
    propertyOrdering: ["object_name", "reasoning", "confidence", "category"],
  };

  const SYSTEM_PROMPT = `Você é a IA visual de uma lixeira inteligente brasileira. Olhe a foto e classifique o item em UMA destas 4 categorias da Resolução Conama 275/2001:

🟫 ORGÂNICO — qualquer resto biológico que se decompõe.
   Ex.: cascas de fruta/legume/ovo, restos de comida (cozida ou crua), pão velho, borra de café, sachê de chá, folhas, podas, talos, sementes, ossos, guardanapo sujo de comida.

📘 PAPEL — material celulósico SECO E LIMPO.
   Ex.: livros, cadernos, jornais, revistas, folhas avulsas, papelão, caixa de cereal, embalagem cartonada (Tetra Pak limpa), envelopes, papel de presente sem plástico.

🥫 METAL — itens metálicos.
   Ex.: latas de alumínio (refrigerante, cerveja, energético), latas de aço (sardinha, leite condensado, conserva), tampas metálicas, talheres, panelas, frigideiras, ferramentas, pregos, parafusos, papel-alumínio.

🍾 VIDRO — itens de vidro.
   Ex.: garrafas (cerveja, vinho, refrigerante, suco), potes (geleia, palmito, conserva), copos, taças, frascos de cosméticos/perfume/remédio.

❓ INDEFINIDO — APENAS quando NENHUMA das 4 acima se aplica:
   • Plástico (PET, sacolas, isopor, embalagem flexível, garrafa transparente leve)
   • Eletrônicos, pilhas, baterias, lâmpadas
   • Tecido, couro, calçados, fraldas
   • Madeira tratada, pneus
   • Foto sem objeto claro (paisagem, pessoa, cena vazia)
   • Foto borrada ou escura demais

REGRAS IMPORTANTES:
1. SEMPRE prefira uma das 4 categorias principais quando o item plausivelmente se encaixa nelas. "Indefinido" é o ÚLTIMO recurso.
2. Identifique o item ESPECÍFICO mesmo se for resto. "Casca de banana" (orgânico), não "Banana". "Maçã mordida" (orgânico). "Lata amassada" continua sendo lata (metal).
3. Garrafa transparente fina e leve = plástico PET → indefinido. Garrafa pesada, parede grossa, geralmente colorida e com brilho nítido = vidro.
4. Embalagem cartonada (caixa de leite, de suco) é PAPEL (mesmo que tenha película interna).
5. Se o objeto NÃO está claro mas você consegue palpitar com base no formato/cor, use confiança "media" ou "baixa" e ESCOLHA uma das 4 principais — não fuja para indefinido.

Responda primeiro descrevendo o item e raciocinando. Só então comprometa-se com a categoria.`;

  /**
   * Classifica uma imagem usando o Gemini.
   *
   * @param {object} opts
   * @param {string} opts.apiKey   Chave da API do Google AI Studio (AIza...).
   * @param {string} opts.model    ID do modelo Gemini (ex. gemini-2.5-flash).
   * @param {string} opts.imageBase64  JPEG codificado em base64 (sem prefixo data:).
   * @param {string} [opts.mediaType="image/jpeg"]
   * @param {AbortSignal} [opts.signal]
   * @returns {Promise<{category, object_name, confidence, reasoning}>}
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

    const url =
      API_BASE + "/" + encodeURIComponent(model) +
      ":generateContent?key=" + encodeURIComponent(apiKey);

    const body = {
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: mediaType,
                data: imageBase64,
              },
            },
            {
              text: "Classifique este item seguindo as regras. Devolva apenas o JSON.",
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        // Sem thinkingConfig: o Gemini 2.5 (Flash/Flash-Lite/Pro) usa
        // thinking dinâmico por padrão, o que dá decisões muito melhores
        // do que com thinking desligado.
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
      ],
    };

    let response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      const errStatus = (detail && detail.error && detail.error.status) || "";
      const errMsg = (detail && detail.error && detail.error.message) || `HTTP ${response.status}`;
      throw new ApiError(
        mapErrorType(response.status, errStatus, errMsg),
        friendlyError(response.status, errStatus, errMsg),
        detail
      );
    }

    const data = await response.json();
    return parseResult(data);
  }

  function parseResult(data) {
    // Resposta Gemini: candidates[0].content.parts[0].text contém o JSON
    // (porque pedimos responseMimeType: application/json).
    const candidate = data && data.candidates && data.candidates[0];
    if (!candidate) {
      throw new ApiError(
        "empty_response",
        "A IA não devolveu nenhuma resposta. Tente de novo.",
        data
      );
    }

    // Bloqueio por safety
    if (candidate.finishReason === "SAFETY" || candidate.finishReason === "BLOCKLIST") {
      throw new ApiError(
        "safety_block",
        "A imagem foi bloqueada pelos filtros de segurança do Gemini. Tente outra foto.",
        candidate
      );
    }

    const parts = candidate.content && candidate.content.parts;
    // Ignora partes marcadas como "thought" (raciocínio interno) — só
    // queremos o JSON final que o modelo retornou.
    const textBlock = parts && parts.find((p) => typeof p.text === "string" && !p.thought);
    if (!textBlock) {
      throw new ApiError(
        "empty_response",
        "A IA devolveu uma resposta vazia. Tente de novo.",
        candidate
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch (_) {
      throw new ApiError(
        "invalid_json",
        "A IA devolveu uma resposta em formato inesperado.",
        textBlock.text
      );
    }

    // Validação leve
    if (!CATEGORIES.includes(parsed.category)) parsed.category = "indefinido";
    if (!["alta", "media", "baixa"].includes(parsed.confidence)) parsed.confidence = "media";
    parsed.object_name = String(parsed.object_name || "Objeto não identificado");
    parsed.reasoning = String(parsed.reasoning || "");

    return parsed;
  }

  function mapErrorType(status, errStatus, msg) {
    if (status === 400 && /API key not valid|API_KEY_INVALID/i.test(msg)) return "auth";
    if (status === 401) return "auth";
    if (status === 403) return "permission";
    if (status === 429) return "rate_limit";
    if (status >= 500) return "server";
    if (errStatus === "INVALID_ARGUMENT") return "bad_request";
    return "api_error";
  }

  function friendlyError(status, errStatus, msg) {
    if (status === 400 && /API key not valid|API_KEY_INVALID/i.test(msg)) {
      return "Chave de API inválida. Verifique nas Configurações.";
    }
    if (status === 401) return "Chave de API inválida ou ausente.";
    if (status === 403) {
      if (/quota|billing/i.test(msg)) {
        return "Cota grátis esgotada por hoje. Espere um pouco ou ative o billing no Google Cloud.";
      }
      return "Sua chave não tem permissão para esse modelo.";
    }
    if (status === 429) {
      return "Muitas requisições — limite de uso/minuto. Aguarde alguns segundos e tente de novo.";
    }
    if (status >= 500) {
      return "A API está temporariamente indisponível. Tente novamente em instantes.";
    }
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

  global.VisionAPI = {
    classifyImage,
    captureFrameBase64,
    ApiError,
    CATEGORIES,
    PROVIDER: "gemini",
  };
})(window);
