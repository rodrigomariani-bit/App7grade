/*
 * Lixeira Inteligente — controle da câmera + inferência com MobileNet.
 * O modelo é carregado uma vez e roda continuamente sobre frames do <video>.
 */
(function () {
  "use strict";

  const video = document.getElementById("video");
  const canvas = document.getElementById("canvas");
  const startBtn = document.getElementById("startBtn");
  const captureBtn = document.getElementById("captureBtn");
  const switchBtn = document.getElementById("switchBtn");
  const statusPill = document.getElementById("statusPill");
  const resultCard = document.getElementById("resultCard");
  const badgeIcon = document.getElementById("badgeIcon");
  const categoryLabel = document.getElementById("categoryLabel");
  const objectName = document.getElementById("objectName");
  const confidenceEl = document.getElementById("confidence");
  const explanationEl = document.getElementById("explanation");
  const binTagEl = document.getElementById("binTag");

  let model = null;
  let stream = null;
  let facingMode = "environment"; // câmera traseira por padrão
  let loopHandle = null;
  let inferenceBusy = false;
  const LOOP_INTERVAL_MS = 1000;

  // Suaviza variações: só troca o card se a nova categoria/objeto mudar
  // por 2 frames seguidos OU se a confiança subir bem acima da atual.
  let lastShown = { category: null, objectName: null, confidence: 0 };
  let pendingCandidate = null;
  let pendingCount = 0;

  function setStatus(text) {
    statusPill.textContent = text;
  }

  async function loadModel() {
    if (model) return model;
    setStatus("Carregando modelo de IA…");
    try {
      // MobileNet v2 com alpha 1.0 — bom equilíbrio precisão/velocidade.
      model = await mobilenet.load({ version: 2, alpha: 1.0 });
      setStatus("Modelo pronto. Aponte a câmera para um item.");
      return model;
    } catch (err) {
      console.error("Falha ao carregar o modelo:", err);
      setStatus("Erro ao carregar a IA. Verifique sua conexão.");
      throw err;
    }
  }

  async function startCamera() {
    if (stream) return; // já ligado

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus("Seu navegador não permite acesso à câmera.");
      return;
    }

    setStatus("Pedindo permissão da câmera…");
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      setStatus("Câmera ligada. Identificando…");
      startBtn.textContent = "⏹️ Parar câmera";
      captureBtn.disabled = false;
      switchBtn.disabled = false;
      startLoop();
    } catch (err) {
      console.error("Erro ao acessar a câmera:", err);
      if (err && err.name === "NotAllowedError") {
        setStatus("Permissão negada. Habilite a câmera nas configurações.");
      } else if (err && err.name === "NotFoundError") {
        setStatus("Nenhuma câmera encontrada.");
      } else {
        setStatus("Não foi possível acessar a câmera.");
      }
    }
  }

  function stopCamera() {
    stopLoop();
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    video.srcObject = null;
    startBtn.textContent = "📷 Ligar câmera";
    captureBtn.disabled = true;
    switchBtn.disabled = true;
    setStatus("Câmera desligada.");
    hideResult();
  }

  async function switchCamera() {
    if (!stream) return;
    facingMode = facingMode === "environment" ? "user" : "environment";
    stopCamera();
    await startCamera();
  }

  function startLoop() {
    stopLoop();
    loopHandle = setInterval(() => {
      runInference().catch((e) => console.warn("inference error", e));
    }, LOOP_INTERVAL_MS);
  }

  function stopLoop() {
    if (loopHandle) {
      clearInterval(loopHandle);
      loopHandle = null;
    }
  }

  async function runInference() {
    if (inferenceBusy) return;
    if (!model || !video.videoWidth) return;
    inferenceBusy = true;
    try {
      // O MobileNet recebe um HTMLVideoElement diretamente.
      const predictions = await model.classify(video, 5);
      const result = WasteClassifier.classifyWaste(predictions);
      consider(result);
    } finally {
      inferenceBusy = false;
    }
  }

  // Decide se atualiza o card ou aguarda mais um frame para confirmar.
  function consider(result) {
    const sameAsShown =
      lastShown.category === result.category &&
      lastShown.objectName === result.objectName;

    // Se é o mesmo do que já está na tela, só atualiza a confiança.
    if (sameAsShown) {
      pendingCandidate = null;
      pendingCount = 0;
      lastShown.confidence = result.confidence;
      updateConfidence(result.confidence);
      return;
    }

    // Mudança de categoria/objeto: exige confirmação ou confiança alta.
    const strong = result.confidence >= 0.55;
    if (
      pendingCandidate &&
      pendingCandidate.category === result.category &&
      pendingCandidate.objectName === result.objectName
    ) {
      pendingCount += 1;
    } else {
      pendingCandidate = result;
      pendingCount = 1;
    }

    if (strong || pendingCount >= 2) {
      showResult(result);
      lastShown = {
        category: result.category,
        objectName: result.objectName,
        confidence: result.confidence,
      };
      pendingCandidate = null;
      pendingCount = 0;
    }
  }

  function showResult(r) {
    resultCard.dataset.category = r.category;
    resultCard.classList.remove("hidden");
    badgeIcon.textContent = r.icon;
    categoryLabel.textContent = r.categoryLabel;
    objectName.textContent = r.objectName;
    explanationEl.textContent = r.explanation;
    binTagEl.textContent = "Lixeira: " + r.bin;
    updateConfidence(r.confidence);
  }

  function updateConfidence(p) {
    const pct = Math.max(0, Math.min(100, Math.round(p * 100)));
    confidenceEl.textContent = pct + "%";
  }

  function hideResult() {
    resultCard.classList.add("hidden");
    lastShown = { category: null, objectName: null, confidence: 0 };
    pendingCandidate = null;
    pendingCount = 0;
  }

  async function captureNow() {
    // Força uma classificação imediata, ignorando a janela de suavização.
    if (!model || !video.videoWidth) return;
    setStatus("Analisando…");
    try {
      const predictions = await model.classify(video, 5);
      const result = WasteClassifier.classifyWaste(predictions);
      showResult(result);
      lastShown = {
        category: result.category,
        objectName: result.objectName,
        confidence: result.confidence,
      };
      pendingCandidate = null;
      pendingCount = 0;
      setStatus("Pronto.");
    } catch (err) {
      console.error(err);
      setStatus("Falha ao analisar a imagem.");
    }
  }

  // ===== Eventos =====
  startBtn.addEventListener("click", async () => {
    if (stream) {
      stopCamera();
      return;
    }
    startBtn.disabled = true;
    try {
      await loadModel();
      await startCamera();
    } finally {
      startBtn.disabled = false;
    }
  });

  captureBtn.addEventListener("click", captureNow);
  switchBtn.addEventListener("click", switchCamera);

  // Carrega o modelo em segundo plano assim que a página abre — assim, ao
  // clicar em "Ligar câmera", a inferência começa rapidamente.
  window.addEventListener("load", () => {
    loadModel().catch(() => {});
  });

  // Limpa stream se a aba for fechada ou recarregada.
  window.addEventListener("pagehide", stopCamera);
})();
