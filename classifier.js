/*
 * Mapeia as classes do ImageNet (devolvidas pelo MobileNet) para as quatro
 * categorias de lixo da lixeira inteligente, com nomes em português.
 *
 * Estratégia:
 *   1. Tenta um match direto na tabela DIRECT_MAP (normalizado para minúsculas).
 *   2. Se não achar, tenta a lista KEYWORD_RULES (substring com prioridade).
 *   3. Se nenhuma regra casar, devolve "indefinido".
 */
(function (global) {
  "use strict";

  const CATEGORY_INFO = {
    organico: {
      label: "Orgânico",
      icon: "🍎",
      bin: "Lixeira marrom",
      explanation:
        "Resto orgânico (alimento, casca, folha). Pode virar adubo por compostagem. Vai na lixeira marrom.",
    },
    papel: {
      label: "Papel",
      icon: "📄",
      bin: "Lixeira azul",
      explanation:
        "Material de papel ou papelão. Mantenha seco e limpo para reciclagem. Vai na lixeira azul.",
    },
    metal: {
      label: "Metal",
      icon: "🥫",
      bin: "Lixeira amarela",
      explanation:
        "Material metálico (latas, talheres, ferragens). Lave antes de descartar. Vai na lixeira amarela.",
    },
    vidro: {
      label: "Vidro",
      icon: "🍾",
      bin: "Lixeira verde",
      explanation:
        "Material de vidro. Cuidado com cacos — embale com jornal se quebrado. Vai na lixeira verde.",
    },
    indefinido: {
      label: "Indefinido",
      icon: "❔",
      bin: "Categoria não identificada",
      explanation:
        "Não foi possível identificar com segurança. Aproxime o objeto, melhore a iluminação ou tente outro ângulo.",
    },
  };

  // Mapa direto: class name (lowercase, sem espaços extras) -> {category, name}
  // Inclui todas as variações relevantes do ImageNet 1000.
  const DIRECT_MAP = {
    /* ===================== ORGÂNICO ===================== */
    // Frutas
    "banana": { c: "organico", n: "Banana" },
    "granny smith": { c: "organico", n: "Maçã" },
    "orange": { c: "organico", n: "Laranja" },
    "lemon": { c: "organico", n: "Limão" },
    "strawberry": { c: "organico", n: "Morango" },
    "pineapple": { c: "organico", n: "Abacaxi" },
    "fig": { c: "organico", n: "Figo" },
    "pomegranate": { c: "organico", n: "Romã" },
    "jackfruit": { c: "organico", n: "Jaca" },
    "custard apple": { c: "organico", n: "Fruta-do-conde" },
    // Legumes / verduras
    "broccoli": { c: "organico", n: "Brócolis" },
    "cauliflower": { c: "organico", n: "Couve-flor" },
    "zucchini": { c: "organico", n: "Abobrinha" },
    "courgette": { c: "organico", n: "Abobrinha" },
    "cucumber": { c: "organico", n: "Pepino" },
    "cuke": { c: "organico", n: "Pepino" },
    "artichoke": { c: "organico", n: "Alcachofra" },
    "globe artichoke": { c: "organico", n: "Alcachofra" },
    "bell pepper": { c: "organico", n: "Pimentão" },
    "cardoon": { c: "organico", n: "Cardo" },
    "mushroom": { c: "organico", n: "Cogumelo" },
    "head cabbage": { c: "organico", n: "Repolho" },
    "acorn squash": { c: "organico", n: "Abóbora" },
    "butternut squash": { c: "organico", n: "Abóbora" },
    "spaghetti squash": { c: "organico", n: "Abóbora" },
    "ear": { c: "organico", n: "Espiga de milho" },
    "corn": { c: "organico", n: "Milho" },
    // Comidas preparadas
    "pizza": { c: "organico", n: "Pizza" },
    "hamburger": { c: "organico", n: "Hambúrguer" },
    "cheeseburger": { c: "organico", n: "Hambúrguer" },
    "hotdog": { c: "organico", n: "Cachorro-quente" },
    "hot dog": { c: "organico", n: "Cachorro-quente" },
    "burrito": { c: "organico", n: "Burrito" },
    "taco": { c: "organico", n: "Taco" },
    "ice cream": { c: "organico", n: "Sorvete" },
    "ice lolly": { c: "organico", n: "Picolé" },
    "popsicle": { c: "organico", n: "Picolé" },
    "french loaf": { c: "organico", n: "Pão francês" },
    "bagel": { c: "organico", n: "Pão" },
    "pretzel": { c: "organico", n: "Pretzel" },
    "guacamole": { c: "organico", n: "Guacamole" },
    "meat loaf": { c: "organico", n: "Bolo de carne" },
    "meatloaf": { c: "organico", n: "Bolo de carne" },
    "trifle": { c: "organico", n: "Sobremesa" },
    "mashed potato": { c: "organico", n: "Purê de batata" },
    "carbonara": { c: "organico", n: "Macarrão" },
    "chocolate sauce": { c: "organico", n: "Calda de chocolate" },
    "dough": { c: "organico", n: "Massa" },
    "potpie": { c: "organico", n: "Torta" },
    "consomme": { c: "organico", n: "Sopa" },
    "hay": { c: "organico", n: "Feno" },
    // Plantas / flores (descarte verde)
    "daisy": { c: "organico", n: "Margarida" },
    "yellow lady's slipper": { c: "organico", n: "Flor" },

    /* ===================== PAPEL ===================== */
    "book jacket": { c: "papel", n: "Livro" },
    "dust cover": { c: "papel", n: "Livro" },
    "comic book": { c: "papel", n: "Revista em quadrinhos" },
    "envelope": { c: "papel", n: "Envelope" },
    "carton": { c: "papel", n: "Caixa de papelão" },
    "paper towel": { c: "papel", n: "Papel toalha" },
    "toilet tissue": { c: "papel", n: "Papel higiênico" },
    "toilet paper": { c: "papel", n: "Papel higiênico" },
    "bathroom tissue": { c: "papel", n: "Papel higiênico" },
    "notebook": { c: "papel", n: "Caderno" },
    "binder": { c: "papel", n: "Fichário" },
    "ring-binder": { c: "papel", n: "Fichário" },
    "menu": { c: "papel", n: "Cardápio" },
    "packet": { c: "papel", n: "Embalagem de papel" },
    "crossword puzzle": { c: "papel", n: "Jornal/Revista" },
    "crossword": { c: "papel", n: "Jornal/Revista" },

    /* ===================== METAL ===================== */
    "beer can": { c: "metal", n: "Lata de cerveja" },
    "soda can": { c: "metal", n: "Lata de refrigerante" },
    "tin can": { c: "metal", n: "Lata" },
    "can opener": { c: "metal", n: "Abridor de lata" },
    "saucepan": { c: "metal", n: "Panela" },
    "frying pan": { c: "metal", n: "Frigideira" },
    "frypan": { c: "metal", n: "Frigideira" },
    "skillet": { c: "metal", n: "Frigideira" },
    "wok": { c: "metal", n: "Wok" },
    "dutch oven": { c: "metal", n: "Caçarola" },
    "caldron": { c: "metal", n: "Caldeirão" },
    "cauldron": { c: "metal", n: "Caldeirão" },
    "spatula": { c: "metal", n: "Espátula" },
    "ladle": { c: "metal", n: "Concha" },
    "nail": { c: "metal", n: "Prego" },
    "screw": { c: "metal", n: "Parafuso" },
    "hook": { c: "metal", n: "Gancho" },
    "claw": { c: "metal", n: "Gancho" },
    "cleaver": { c: "metal", n: "Cutelo" },
    "meat cleaver": { c: "metal", n: "Cutelo" },
    "chopper": { c: "metal", n: "Cutelo" },
    "letter opener": { c: "metal", n: "Abre-cartas" },
    "knife": { c: "metal", n: "Faca" },
    "chain": { c: "metal", n: "Corrente" },
    "chain mail": { c: "metal", n: "Cota de malha" },
    "padlock": { c: "metal", n: "Cadeado" },
    "combination lock": { c: "metal", n: "Cadeado" },
    "hammer": { c: "metal", n: "Martelo" },
    "shovel": { c: "metal", n: "Pá" },
    "spoon": { c: "metal", n: "Colher" },
    "wooden spoon": { c: "organico", n: "Colher de pau" },
    "fork": { c: "metal", n: "Garfo" },
    "bucket": { c: "metal", n: "Balde" },
    "pail": { c: "metal", n: "Balde" },
    "safe": { c: "metal", n: "Cofre" },
    "safety pin": { c: "metal", n: "Alfinete" },
    "thimble": { c: "metal", n: "Dedal" },
    "torch": { c: "metal", n: "Lanterna" },
    "lighter": { c: "metal", n: "Isqueiro" },
    "key": { c: "metal", n: "Chave" },
    "bow": { c: "metal", n: "Arco" },

    /* ===================== VIDRO ===================== */
    "wine bottle": { c: "vidro", n: "Garrafa de vinho" },
    "beer bottle": { c: "vidro", n: "Garrafa de cerveja" },
    "water bottle": { c: "vidro", n: "Garrafa de água" },
    "pop bottle": { c: "vidro", n: "Garrafa de refrigerante" },
    "soda bottle": { c: "vidro", n: "Garrafa de refrigerante" },
    "pill bottle": { c: "vidro", n: "Frasco de remédio" },
    "perfume": { c: "vidro", n: "Frasco de perfume" },
    "essence": { c: "vidro", n: "Frasco de perfume" },
    "goblet": { c: "vidro", n: "Taça" },
    "beer glass": { c: "vidro", n: "Copo de cerveja" },
    "wine glass": { c: "vidro", n: "Taça de vinho" },
    "cocktail shaker": { c: "metal", n: "Coqueteleira" },
    "vase": { c: "vidro", n: "Vaso" },
    "measuring cup": { c: "vidro", n: "Copo medidor" },
    "mirror": { c: "vidro", n: "Espelho" },
    "magnifying glass": { c: "vidro", n: "Lupa" },
    "hourglass": { c: "vidro", n: "Ampulheta" },
  };

  // Regras por palavra-chave (substring) — aplicadas se o DIRECT_MAP não bater.
  // A ordem importa: regras mais específicas vêm antes.
  const KEYWORD_RULES = [
    // Vidro (garrafas/copos)
    { kw: ["wine bottle"], c: "vidro", n: "Garrafa de vinho" },
    { kw: ["beer bottle"], c: "vidro", n: "Garrafa de cerveja" },
    { kw: ["bottle"],      c: "vidro", n: "Garrafa" },
    { kw: ["jar"],         c: "vidro", n: "Pote de vidro" },
    { kw: ["glass"],       c: "vidro", n: "Objeto de vidro" },
    { kw: ["vase"],        c: "vidro", n: "Vaso" },

    // Metal (latas, panelas, ferragens)
    { kw: ["can"],          c: "metal", n: "Lata" },
    { kw: ["tin"],          c: "metal", n: "Lata" },
    { kw: ["pan", "pot"],   c: "metal", n: "Panela" },
    { kw: ["kettle"],       c: "metal", n: "Chaleira" },
    { kw: ["spoon"],        c: "metal", n: "Colher" },
    { kw: ["fork"],         c: "metal", n: "Garfo" },
    { kw: ["knife"],        c: "metal", n: "Faca" },
    { kw: ["nail"],         c: "metal", n: "Prego" },
    { kw: ["screw"],        c: "metal", n: "Parafuso" },
    { kw: ["wrench"],       c: "metal", n: "Chave inglesa" },
    { kw: ["hammer"],       c: "metal", n: "Martelo" },
    { kw: ["scissors"],     c: "metal", n: "Tesoura" },

    // Papel
    { kw: ["book"],         c: "papel", n: "Livro" },
    { kw: ["newspaper"],    c: "papel", n: "Jornal" },
    { kw: ["magazine"],     c: "papel", n: "Revista" },
    { kw: ["envelope"],     c: "papel", n: "Envelope" },
    { kw: ["paper"],        c: "papel", n: "Papel" },
    { kw: ["cardboard"],    c: "papel", n: "Papelão" },
    { kw: ["carton"],       c: "papel", n: "Caixa de papelão" },

    // Orgânico (frutas/legumes/comidas/plantas genéricas)
    { kw: ["fruit"],        c: "organico", n: "Fruta" },
    { kw: ["vegetable"],    c: "organico", n: "Vegetal" },
    { kw: ["apple"],        c: "organico", n: "Maçã" },
    { kw: ["bread"],        c: "organico", n: "Pão" },
    { kw: ["cake"],         c: "organico", n: "Bolo" },
    { kw: ["soup"],         c: "organico", n: "Sopa" },
    { kw: ["salad"],        c: "organico", n: "Salada" },
    { kw: ["seed"],         c: "organico", n: "Semente" },
    { kw: ["leaf"],         c: "organico", n: "Folha" },
    { kw: ["flower"],       c: "organico", n: "Flor" },
    { kw: ["squash"],       c: "organico", n: "Abóbora" },
    { kw: ["pepper"],       c: "organico", n: "Pimentão" },
    { kw: ["potato"],       c: "organico", n: "Batata" },
    { kw: ["egg"],          c: "organico", n: "Ovo" },
    { kw: ["cheese"],       c: "organico", n: "Queijo" },
    { kw: ["meat"],         c: "organico", n: "Carne" },
  ];

  // Limite mínimo de confiança para considerar uma classificação confiável.
  const CONFIDENCE_THRESHOLD = 0.18;

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[‘’']/g, "'")
      .trim();
  }

  // ImageNet costuma devolver sinônimos: "barrel, cask".
  // Devolvemos cada sinônimo separadamente.
  function splitSynonyms(className) {
    return normalize(className)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function lookupDirect(name) {
    return DIRECT_MAP[name] || null;
  }

  function lookupKeyword(name) {
    for (const rule of KEYWORD_RULES) {
      if (rule.kw.some((k) => name.includes(k))) {
        return { c: rule.c, n: rule.n };
      }
    }
    return null;
  }

  /**
   * @param {Array<{className:string, probability:number}>} predictions
   * @returns {{
   *   category: 'organico'|'papel'|'metal'|'vidro'|'indefinido',
   *   categoryLabel: string,
   *   icon: string,
   *   bin: string,
   *   objectName: string,
   *   explanation: string,
   *   confidence: number,
   *   raw: string
   * }}
   */
  function classifyWaste(predictions) {
    if (!Array.isArray(predictions) || predictions.length === 0) {
      return buildResult("indefinido", "—", 0, "");
    }

    // Percorre as previsões em ordem de confiança e devolve o primeiro match.
    for (const pred of predictions) {
      const conf = pred.probability || 0;
      const synonyms = splitSynonyms(pred.className);

      // 1) Match direto
      for (const syn of synonyms) {
        const hit = lookupDirect(syn);
        if (hit) {
          return buildResult(hit.c, hit.n, conf, pred.className);
        }
      }
      // 2) Match por palavra-chave
      for (const syn of synonyms) {
        const hit = lookupKeyword(syn);
        if (hit) {
          return buildResult(hit.c, hit.n, conf, pred.className);
        }
      }
    }

    // Sem match — usa o nome bruto da melhor previsão.
    const best = predictions[0];
    const bestName = splitSynonyms(best.className)[0] || "objeto";
    return buildResult("indefinido", capitalize(bestName), best.probability || 0, best.className);
  }

  function buildResult(category, objectName, confidence, raw) {
    const info = CATEGORY_INFO[category] || CATEGORY_INFO.indefinido;
    const reliable = confidence >= CONFIDENCE_THRESHOLD;
    return {
      category: reliable ? category : (category === "indefinido" ? "indefinido" : category),
      categoryLabel: info.label,
      icon: info.icon,
      bin: info.bin,
      objectName: objectName || "—",
      explanation: reliable
        ? info.explanation
        : "Confiança baixa. Aproxime o objeto da câmera, melhore a iluminação ou tente outro ângulo.",
      confidence,
      raw: raw || "",
    };
  }

  function capitalize(s) {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Expõe a API
  global.WasteClassifier = {
    classifyWaste,
    CATEGORY_INFO,
    CONFIDENCE_THRESHOLD,
  };
})(window);
