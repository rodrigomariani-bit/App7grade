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
      icon: '<path d="M12 22s-7-5-7-12a7 7 0 0 1 14 0c0 7-7 12-7 12z"/><path d="M12 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>',
    },
    papel: {
      label: "Papel",
      bin: "Lixeira azul — mantenha seco e limpo",
      icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6M9 9h2"/>',
    },
    metal: {
      label: "Metal",
      bin: "Lixeira amarela — lave antes de descartar",
      icon: '<path d="M8 2h8v4l-1 2v10a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V8L8 6z"/><path d="M8 6h8"/>',
    },
    vidro: {
      label: "Vidro",
      bin: "Lixeira verde — cuidado com cacos",
      icon: '<path d="M10 2h4v3l2 3v11a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3V8l2-3z"/>',
    },
    indefinido: {
      label: "Não identificado",
      bin: "Tente outra foto ou outro ângulo",
      icon: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17h.01"/>',
    },
  };

  const SETTINGS_KEY = "lixeira-inteligente.settings.v1";
  const DEFAULT_MODEL = "claude-opus-4-7";

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

  const resultEl = $("result");
  const resultHeader = resultEl.querySelector(".result-header");
  const resultBadge = $("resultBadge");
  const resultIcon = $("resultIcon");
  const resultCategory = $("resultCategory");
  const resultObject = $("resultObject");
  const resultConfidence = $("resultConfidence");
  const resultExplanation = $("resultExplanation");
  const resultBin = $("resultBin");

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

  // ----- Settings (localStorage) -----
  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return { apiKey: "", model: DEFAULT_MODEL };
      const parsed = JSON.parse(raw);
      return {
        apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
        model: typeof parsed.model === "string" ? parsed.model : DEFAULT_MODEL,
      };
    } catch (_) {
      return { apiKey: "", model: DEFAULT_MODEL };
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
    const s = loadSettings();
    apiKeyInput.value = s.apiKey;
    apiKeyInput.type = "password";
    modelSelect.value = s.model;
    openModal(settingsModal);
    setTimeout(() => apiKeyInput.focus(), 80);
  }

  document.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", () => closeModal(settingsModal));
  });
  settingsBtn.addEventListener("click", openSettings);

  showKeyBtn.addEventListener("click", () => {
    apiKeyInput.type = apiKeyInput.type === "password" ? "text" : "password";
  });

  saveSettingsBtn.addEventListener("click", () => {
    const apiKey = apiKeyInput.value.trim();
    const model = modelSelect.value;
    if (apiKey && !apiKey.startsWith("sk-ant-")) {
      if (!confirm("Esta chave não começa com 'sk-ant-'. Salvar mesmo assim?")) return;
    }
    saveSettings({ apiKey, model });
    closeModal(settingsModal);
    setStatus(apiKey ? "Configurações salvas." : "Chave removida.", apiKey ? "" : "error");
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
      imageBase64 = ClaudeAPI.captureFrameBase64(video);
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
      const result = await ClaudeAPI.classifyImage({
        apiKey: settings.apiKey,
        model: settings.model,
        imageBase64,
        signal: inFlight.signal,
      });
      showResult(result);
      setStatus("Pronto. Analise o resultado abaixo.", "live");
    } catch (err) {
      if (err && err.name === "AbortError") {
        setStatus("Análise cancelada.");
      } else if (err instanceof ClaudeAPI.ApiError) {
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

  function showResult(r) {
    const info = CATEGORY_INFO[r.category] || CATEGORY_INFO.indefinido;
    resultHeader.dataset.category = r.category;
    resultIcon.innerHTML = info.icon;
    resultCategory.textContent = info.label;
    resultObject.textContent = r.object_name;
    resultExplanation.textContent = r.reasoning;
    resultBin.querySelector(".bin-text").textContent = info.bin;

    resultConfidence.textContent =
      r.confidence === "alta" ? "Confiança alta" :
      r.confidence === "media" ? "Confiança média" :
      "Confiança baixa";
    resultConfidence.className = "result-confidence " + r.confidence;

    resultEl.hidden = false;
    // re-aplica a animação
    resultEl.style.animation = "none";
    resultEl.offsetHeight;
    resultEl.style.animation = "";

    requestAnimationFrame(() => {
      resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
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
