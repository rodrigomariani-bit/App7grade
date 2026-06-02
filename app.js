/*
 * Lixeira Inteligente — orquestra UI, câmera e chamadas ao Claude Vision.
 */
(function () {
  "use strict";

  // ----- Constantes da UI -----
  const CATEGORY_INFO = {
    organico: {
      label: "Orgânico",
      bin: "Lixeira marrom — pode virar adubo",
      fallbackEmoji: "🌱",
    },
    papel: {
      label: "Papel",
      bin: "Lixeira azul — mantenha seco e limpo",
      fallbackEmoji: "📰",
    },
    metal: {
      label: "Metal",
      bin: "Lixeira amarela — lave antes de descartar",
      fallbackEmoji: "🥫",
    },
    vidro: {
      label: "Vidro",
      bin: "Lixeira verde — cuidado com cacos",
      fallbackEmoji: "🍾",
    },
    plastico: {
      label: "Plástico",
      bin: "Lixeira vermelha — limpe e amasse antes",
      fallbackEmoji: "🧴",
    },
    indefinido: {
      label: "Não identificado",
      bin: "Tente outra foto ou outro ângulo",
      fallbackEmoji: "❓",
    },
  };

  const SETTINGS_KEY = "lixeira-inteligente.settings.v2";
  const DEFAULT_MODEL = "gemini-2.5-flash";

  // Lê a chave / modelo embutidos pelo professor em config.js.
  // A chave fica guardada "embaralhada" (base64, em pedaços) para que os
  // robôs do Google não a reconheçam no código e a desativem. Aqui ela é
  // remontada e decodificada só na hora de usar, na memória do navegador.
  function getEmbeddedConfig() {
    const cfg = window.AppConfig || {};
    let key = "";
    if (cfg.useEmbeddedKey) {
      if (Array.isArray(cfg.embeddedApiKeyParts) && cfg.embeddedApiKeyParts.length) {
        try {
          key = atob(cfg.embeddedApiKeyParts.join("")).trim();
        } catch (_) {
          key = "";
        }
      } else if (typeof cfg.embeddedApiKey === "string") {
        key = cfg.embeddedApiKey.trim();
      }
    }
    return {
      apiKey: key,
      model: cfg.defaultModel || DEFAULT_MODEL,
    };
  }

  // ----- DOM -----
  const $ = (id) => document.getElementById(id);
  const video = $("video");
  const cameraEmpty = $("cameraEmpty");
  const cameraBusy = $("cameraBusy");
  const startBtn = $("startBtn");
  const startBtnLabel = $("startBtnLabel");
  const captureBtn = $("captureBtn");
  const switchBtn = $("switchBtn");
  const settingsBtn = $("settingsBtn");
  const statusDot = $("statusDot");
  const statusText = $("statusText");

  const resultModal = $("resultModal");
  const resultCard = resultModal.querySelector(".result-card");
  const resultBadge = $("resultBadge");
  const resultPhoto = $("resultPhoto");
  const resultEmoji = $("resultEmoji");
  const resultCategory = $("resultCategory");
  const resultObject = $("resultObject");
  const resultConfidence = $("resultConfidence");
  const resultExplanation = $("resultExplanation");
  const resultBinText = $("resultBinText");

  const settingsModal = $("settingsModal");
  const onboardingModal = $("onboardingModal");
  const apiKeyInput = $("apiKeyInput");
  const showKeyBtn = $("showKeyBtn");
  const modelSelect = $("modelSelect");
  const saveSettingsBtn = $("saveSettingsBtn");
  const onboardOpenSettings = $("onboardOpenSettings");

  // ----- Estado -----
  let stream = null;
  let facingMode = "environment";
  let inFlight = null; // AbortController da requisição atual

  // ----- Settings (localStorage + config embutido) -----
  // Devolve sempre as configurações EFETIVAS. Ordem de prioridade:
  //   1) Chave salva pelo usuário no navegador (Settings)
  //   2) Chave embutida pelo professor em config.js
  //   3) Vazio (dispara onboarding)
  function loadSettings() {
    const embedded = getEmbeddedConfig();
    let saved = { apiKey: "", model: "" };
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.apiKey === "string") saved.apiKey = parsed.apiKey;
        if (typeof parsed.model === "string") saved.model = parsed.model;
      }
    } catch (_) {}

    return {
      apiKey: saved.apiKey || embedded.apiKey,
      model: saved.model || embedded.model,
      isEmbedded: !saved.apiKey && !!embedded.apiKey,
    };
  }
  // Lê só o que está em localStorage (sem o fallback embutido). Usado
  // pelo modal de Configurações para mostrar o que o usuário salvou.
  function loadSavedOnly() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { apiKey: "", model: "" };
      const parsed = JSON.parse(raw);
      return {
        apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
        model: typeof parsed.model === "string" ? parsed.model : "",
      };
    } catch (_) {
      return { apiKey: "", model: "" };
    }
  }
  function saveSettings(s) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  }
  function hasApiKey() {
    return !!loadSettings().apiKey;
  }

  // ----- Status pill -----
  function setStatus(text, kind) {
    statusText.textContent = text;
    statusDot.className = "status-dot" + (kind ? " " + kind : "");
  }

  // ----- Modais -----
  function openModal(modal) {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeModal(modal) {
    modal.hidden = true;
    document.body.style.overflow = "";
  }
  function openSettings() {
    const saved = loadSavedOnly();
    const embedded = getEmbeddedConfig();
    apiKeyInput.value = saved.apiKey;
    apiKeyInput.type = "password";
    // Se existe chave embutida, deixa claro que o campo é opcional.
    apiKeyInput.placeholder = embedded.apiKey
      ? "Deixe vazio para usar a chave do site"
      : "AIza...";
    modelSelect.value = saved.model || loadSettings().model;
    openModal(settingsModal);
    setTimeout(() => apiKeyInput.focus(), 80);
  }

  document.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", () => closeModal(settingsModal));
  });
  document.querySelectorAll("[data-close-result]").forEach((el) => {
    el.addEventListener("click", () => closeModal(resultModal));
  });
  // Tecla Esc fecha o modal de resultado.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !resultModal.hidden) closeModal(resultModal);
  });
  settingsBtn.addEventListener("click", openSettings);

  showKeyBtn.addEventListener("click", () => {
    apiKeyInput.type = apiKeyInput.type === "password" ? "text" : "password";
  });

  saveSettingsBtn.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();
    const model = modelSelect.value;
    if (apiKey && !apiKey.startsWith("AIza") && !apiKey.startsWith("AQ.")) {
      if (!confirm("Esta chave não começa com 'AIza' nem 'AQ.' (formatos esperados das chaves do Google AI Studio). Salvar mesmo assim?")) return;
    }
    saveSettings({ apiKey, model });
    closeModal(settingsModal);
    // Mostra mensagem apropriada considerando a chave embutida (fallback).
    const effective = loadSettings().apiKey;
    if (apiKey) setStatus("Configurações salvas.");
    else if (effective) setStatus("Usando a chave configurada no site.");
    else setStatus("Chave removida.", "error");
  });

  onboardOpenSettings.addEventListener("click", () => {
    closeModal(onboardingModal);
    openSettings();
  });

  // ----- Câmera -----
  async function startCamera() {
    if (stream) {
      stopCamera();
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus("Seu navegador não suporta acesso à câmera.", "error");
      return;
    }
    setStatus("Pedindo permissão da câmera…");
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      cameraEmpty.hidden = true;
      startBtnLabel.textContent = "Parar câmera";
      captureBtn.disabled = false;
      switchBtn.disabled = false;
      setStatus("Câmera ligada. Pronto para identificar.", "live");
    } catch (err) {
      console.error("getUserMedia:", err);
      const name = err && err.name;
      if (name === "NotAllowedError") setStatus("Permissão da câmera negada.", "error");
      else if (name === "NotFoundError") setStatus("Nenhuma câmera encontrada.", "error");
      else if (name === "NotReadableError") setStatus("A câmera está em uso por outro app.", "error");
      else setStatus("Não foi possível acessar a câmera.", "error");
    }
  }

  function stopCamera() {
    if (inFlight) { inFlight.abort(); inFlight = null; }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    video.srcObject = null;
    cameraEmpty.hidden = false;
    cameraBusy.hidden = true;
    startBtnLabel.textContent = "Ligar câmera";
    captureBtn.disabled = true;
    switchBtn.disabled = true;
    setStatus("Câmera desligada.");
  }

  async function switchCamera() {
    if (!stream) return;
    facingMode = facingMode === "environment" ? "user" : "environment";
    stopCamera();
    await startCamera();
  }

  // ----- Captura + Classificação -----
  async function captureAndClassify() {
    if (!stream) {
      setStatus("Ligue a câmera primeiro.", "error");
      return;
    }
    const settings = loadSettings();
    if (!settings.apiKey) {
      openSettings();
      setStatus("Insira sua chave de API para identificar.", "error");
      return;
    }

    let imageBase64;
    try {
      imageBase64 = VisionAPI.captureFrameBase64(video);
    } catch (err) {
      setStatus("Não consegui capturar a imagem. Aguarde a câmera carregar.", "error");
      return;
    }

    cameraBusy.hidden = false;
    captureBtn.disabled = true;
    setStatus("Enviando para a IA…", "busy");

    if (inFlight) inFlight.abort();
    inFlight = new AbortController();

    try {
      const result = await VisionAPI.classifyImage({
        apiKey: settings.apiKey,
        model: settings.model,
        imageBase64,
        signal: inFlight.signal,
        onRetry: ({ reason }) => {
          setStatus(
            reason === "rate_limit"
              ? "Muita gente usando ao mesmo tempo — só um instante…"
              : "Reconectando…",
            "busy"
          );
        },
      });
      showResult(result, imageBase64);
      setStatus("Pronto.", "live");
    } catch (err) {
      if (err && err.name === "AbortError") {
        setStatus("Análise cancelada.");
      } else if (err instanceof VisionAPI.ApiError) {
        console.error("ApiError:", err.type, err.detail);
        setStatus(err.message, "error");
        if (err.type === "auth") openSettings();
      } else {
        console.error(err);
        setStatus("Erro inesperado ao classificar.", "error");
      }
    } finally {
      cameraBusy.hidden = true;
      captureBtn.disabled = !stream;
      inFlight = null;
    }
  }

  function showResult(r, imageBase64) {
    const info = CATEGORY_INFO[r.category] || CATEGORY_INFO.indefinido;

    resultPhoto.src = "data:image/jpeg;base64," + imageBase64;
    resultCard.dataset.category = r.category;
    resultEmoji.textContent = r.emoji || info.fallbackEmoji;
    resultCategory.textContent = info.label;
    resultObject.textContent = r.object_name;
    resultExplanation.textContent = r.reasoning;
    resultBinText.textContent = info.bin;

    resultConfidence.textContent =
      r.confidence === "alta" ? "Confiança alta" :
      r.confidence === "media" ? "Confiança média" :
      "Confiança baixa";
    resultConfidence.className = "result-confidence " + r.confidence;

    // Reinicia a animação do badge a cada novo resultado.
    resultBadge.style.animation = "none";
    void resultBadge.offsetWidth;
    resultBadge.style.animation = "";

    openModal(resultModal);
  }

  // ----- Eventos -----
  startBtn.addEventListener("click", startCamera);
  captureBtn.addEventListener("click", captureAndClassify);
  switchBtn.addEventListener("click", switchCamera);

  window.addEventListener("pagehide", () => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
  });

  // Onboarding na primeira vez
  if (!hasApiKey()) {
    openModal(onboardingModal);
  }
})();
