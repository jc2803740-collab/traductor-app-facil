// ============================================================================
// 🌱 TRADUCTOR APP_FACIL — Modo Rápido Básico (Año 1 y 2 de Inglés · A1-A2)
// Pantalla única sin distracciones · Compatible con Samsung, iPhone y PC
// ============================================================================

(function () {
  "use strict";

  const STORAGE_KEY = "traductor_app_facil_v1";
  const PUBLIC_URL = "https://jc2803740-collab.github.io/traductor-app-facil/";

  const ua = navigator.userAgent || "";
  const IS_IOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const IS_ANDROID = /Android/i.test(ua);
  const IS_MOBILE = IS_IOS || IS_ANDROID;
  const IS_LOCALHOST = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

  const state = {
    viewMode: "practice", // "practice" | "free"
    direction: "en2es",   // "en2es" | "es2en"
    freeDir: "es2en",     // "es2en" | "en2es"
    cat: "all",
    level: "ALL",
    autoSpeak: false,
    fontPx: IS_MOBILE ? 18 : 19,
    filteredList: [],
    currentIndex: 0,
    currentExercise: null,
    isListening: false,
    listenTarget: "practice", // "practice" | "free"
    recognition: null,
    finalTranscript: "",
    interimTranscript: "",
    altTranscripts: ["", "", "", ""],
    silenceTimer: null,
    voices: [],
    ttsUnlocked: false,
    deferredInstallPrompt: null,
    freeDebounceTimer: null,
    freeAbortCtrl: null,
    lastFreeSrc: "",
    lastFreeOut: "",
    progress: {
      scores: {},
      favorites: {},
      totalAttempts: 0,
      customExercises: []
    }
  };

  // ==========================================================================
  // 1. NÚMEROS, SINÓNIMOS Y REGLAS PARA PRINCIPIANTES (A1–A2)
  // ==========================================================================

  const SPANISH_NUMBERS = {
    "0": "cero", "1": "uno", "2": "dos", "3": "tres", "4": "cuatro",
    "5": "cinco", "6": "seis", "7": "siete", "8": "ocho", "9": "nueve",
    "10": "diez", "11": "once", "12": "doce", "13": "trece", "14": "catorce",
    "15": "quince", "16": "dieciseis", "17": "diecisiete", "18": "dieciocho",
    "19": "diecinueve", "20": "veinte", "25": "veinticinco", "30": "treinta",
    "32": "treinta y dos", "40": "cuarenta", "50": "cincuenta", "100": "cien"
  };

  const EN_NUMBERS = {
    "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four",
    "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine",
    "10": "ten", "11": "eleven", "12": "twelve", "15": "fifteen",
    "20": "twenty", "30": "thirty", "32": "thirty two", "50": "fifty", "100": "one hundred"
  };

  const SPANISH_SYNONYM_GROUPS = [
    ["hola", "buenas"],
    ["perdone", "disculpe", "perdona", "disculpa", "lo siento"],
    ["puedes", "podrias", "puede", "podria"],
    ["quieres", "quiere", "apetece", "gustaria"],
    ["quiero", "querria", "quisiera", "me pone"],
    ["tienes", "tiene"],
    ["estas", "esta"],
    ["vas", "va"],
    ["sueles", "suele", "normalmente", "habitualmente"],
    ["coche", "auto", "carro"],
    ["piso", "apartamento"],
    ["movil", "celular", "telefono"],
    ["ordenador", "computadora", "pc"],
    ["cuenta", "factura", "ticket", "recibo"],
    ["camarero", "mesero"],
    ["baño", "servicio", "servicios", "aseo"],
    ["tienda", "comercio"],
    ["rebajas", "oferta", "descuento"],
    ["efectivo", "metalico"],
    ["maleta", "equipaje"],
    ["autobus", "bus"],
    ["metro", "subterraneo"],
    ["cerca", "proximo"],
    ["bonito", "precioso", "lindo"],
    ["rico", "riquisimo", "delicioso", "buenisimo"],
    ["rapido", "deprisa"],
    ["despacio", "lento"],
    ["coger", "tomar", "llevar"],
    ["enviar", "mandar"],
    ["ayudar", "echar"],
    ["volver", "regresar"],
    ["empezar", "comenzar"],
    ["terminar", "acabar"]
  ];

  const SPANISH_SYN_MAP = new Map();
  SPANISH_SYNONYM_GROUPS.forEach((grp, idx) => {
    grp.forEach(w => {
      if (!SPANISH_SYN_MAP.has(w)) SPANISH_SYN_MAP.set(w, new Set());
      SPANISH_SYN_MAP.get(w).add(idx);
    });
  });

  function areSpanishSynonyms(a, b) {
    if (a === b) return true;
    const sa = SPANISH_SYN_MAP.get(a);
    const sb = SPANISH_SYN_MAP.get(b);
    if (!sa || !sb) return false;
    for (const id of sa) {
      if (sb.has(id)) return true;
    }
    return false;
  }

  const OPTIONAL_ES_SUBJECTS = new Set(["yo", "tu", "usted", "nosotros", "nosotras", "vosotros", "ustedes"]);
  const OPTIONAL_VOCAB_ES = new Set(["el", "la", "los", "las", "un", "una"]);
  const OPTIONAL_VOCAB_EN = new Set(["to", "a", "an", "the"]);

  const CONTRACTIONS_EN = {
    "i'm": "i am", "you're": "you are", "we're": "we are", "they're": "they are",
    "he's": "he is", "she's": "she is", "it's": "it is", "that's": "that is",
    "there's": "there is", "what's": "what is", "where's": "where is", "how's": "how is",
    "let's": "let us", "i've": "i have", "we've": "we have", "i'll": "i will", "we'll": "we will",
    "i'd": "i would", "don't": "do not", "doesn't": "does not", "didn't": "did not",
    "can't": "cannot", "won't": "will not", "isn't": "is not", "aren't": "are not",
    "haven't": "have not", "hasn't": "has not"
  };

  const SPELLING_EN = {
    "colour": "color", "centre": "center", "favourite": "favorite",
    "travelling": "traveling", "cancelled": "canceled", "ok": "okay", "mum": "mom"
  };

  // Errores típicos de quien lleva 1 o 2 años estudiando inglés
  const BEGINNER_EN_RULES = [
    {
      regex: /\b(i|you|he|she|we|they)\s+(have|has)\s+\d+\s+years?\b|\bhave\s+(twenty|thirty|forty|eight|ten|fifteen)\s+years?\b/i,
      title: "Edad en inglés: usa «I am», nunca «I have» 💡",
      fix: "En inglés no 'tienes' años, sino que 'eres' años: di siempre «I am 32 years old» (o «My son is 8»)."
    },
    {
      regex: /\b(i|you|we|they)\s+have\s+(hunger|hungry|thirst|thirsty|cold|hot|sleep|sleepy|fear)\b/i,
      title: "Hambre, sed, frío, calor o sueño van con «I am» 💡",
      fix: "En inglés se dice «I am hungry» (hambre), «I am thirsty» (sed), «I am cold» (frío), «I am hot» (calor) y «I am sleepy» (sueño)."
    },
    {
      regex: /\bpeople\s+is\b/i,
      title: "«People» es siempre plural 💡",
      fix: "'La gente es...' en inglés se dice en plural: «People ARE very kind»."
    },
    {
      regex: /\b(i am|i'm|you are|we are)\s+(not\s+)?(totally\s+|very\s+)?agree\b/i,
      title: "Cuidado con «I am agree» ❌",
      fix: "Quita el 'am': se dice directamente «I agree» o «I totally agree with you»."
    },
    {
      regex: /\b(i|you|we|they)\s+(no|not)\s+(understand|know|speak|have|want|like|can|eat)\b/i,
      title: "Para negar en presente usa «don't» 💡",
      fix: "En lugar de 'I no understand', pon «don't»: «I don't understand», «I don't know»."
    },
    {
      regex: /\bfor\s+(buy|go|eat|see|open|help|ask|pay|get|travel)\b/i,
      title: "«Para + verbo» se dice con «TO», no con «for» 💡",
      fix: "Para decir 'para comprar / para ir' usa siempre «to»: «to buy water», «to go home»."
    },
    {
      regex: /\bdepend(s)?\s+of\b/i,
      title: "«Depender de» es «depend ON» 💡",
      fix: "Cambia 'of' por 'on': «It depends on the weather»."
    },
    {
      regex: /\bexplain\s+me\b/i,
      title: "Recuerda el «to» con «explain» 💡",
      fix: "Siempre se dice «Explain it TO me»."
    }
  ];

  const BEGINNER_ES_TRAPS = [
    {
      enTest: /\bcold\b/i,
      esTrap: /\bconstipad[oa]\b/i,
      checkEnConstipated: /\bconstipated\b/i
    }
  ];

  function stripSpanishAccents(str) {
    return (str || "")
      .replace(/[áàäâ]/g, "a")
      .replace(/[éèëê]/g, "e")
      .replace(/[íìïî]/g, "i")
      .replace(/[óòöô]/g, "o")
      .replace(/[úùüû]/g, "u");
  }

  function normalizeSpanishTokens(text) {
    if (!text) return [];
    const s = stripSpanishAccents(text.toLowerCase())
      .replace(/%/g, " por ciento ")
      .replace(/[^a-z0-9ñ\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!s) return [];
    const out = [];
    for (const w of s.split(" ")) {
      if (w === "al") { out.push("a", "el"); continue; }
      if (w === "del") { out.push("de", "el"); continue; }
      if (SPANISH_NUMBERS[w]) {
        SPANISH_NUMBERS[w].split(" ").forEach(p => out.push(p));
        continue;
      }
      out.push(w);
    }
    return out;
  }

  function normalizeEnglishTokens(text) {
    if (!text) return [];
    const s = text
      .toLowerCase()
      .replace(/[’‘`]/g, "'")
      .replace(/-/g, " ")
      .replace(/%/g, " percent ")
      .replace(/[^a-z0-9'\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!s) return [];
    const out = [];
    for (let w of s.split(" ")) {
      if (CONTRACTIONS_EN[w]) {
        CONTRACTIONS_EN[w].split(" ").forEach(p => out.push(p));
        continue;
      }
      if (EN_NUMBERS[w]) {
        EN_NUMBERS[w].split(" ").forEach(p => out.push(p));
        continue;
      }
      if (SPELLING_EN[w]) w = SPELLING_EN[w];
      out.push(w);
    }
    return out;
  }

  function charSimilarity(a, b) {
    if (a === b) return 1;
    if (!a || !b) return 0;
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return 1 - dp[m][n] / Math.max(m, n);
  }

  function alignWords(userWords, targetWords, isSpanish, isVocabItem) {
    const m = userWords.length;
    const n = targetWords.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    const bt = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(""));

    const isOptionalExtra = w =>
      (isSpanish && OPTIONAL_ES_SUBJECTS.has(w)) ||
      (isVocabItem && isSpanish && OPTIONAL_VOCAB_ES.has(w)) ||
      (isVocabItem && !isSpanish && OPTIONAL_VOCAB_EN.has(w));

    for (let i = 1; i <= m; i++) {
      const extraCost = isOptionalExtra(userWords[i - 1]) ? 0.02 : 1.0;
      dp[i][0] = dp[i - 1][0] + extraCost;
      bt[i][0] = "EXTRA";
    }
    for (let j = 1; j <= n; j++) {
      dp[0][j] = j;
      bt[0][j] = "MISSING";
    }

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const uw = userWords[i - 1];
        const tw = targetWords[j - 1];
        const isSyn = isSpanish && areSpanishSynonyms(uw, tw);
        const sim = isSyn ? 1 : charSimilarity(uw, tw);

        let subCost = 1.1;
        let subType = "WRONG";
        if (sim === 1) {
          subCost = 0;
          subType = isSyn && uw !== tw ? "SYN" : "OK";
        } else if (sim >= 0.72 && tw.length >= 4) {
          subCost = 0.25;
          subType = "CLOSE";
        }

        const extraPenalty = isOptionalExtra(uw) ? 0.02 : 1.0;
        const cSub = dp[i - 1][j - 1] + subCost;
        const cExtra = dp[i - 1][j] + extraPenalty;
        const cMiss = dp[i][j - 1] + 1.0;

        if (cSub <= cExtra && cSub <= cMiss) {
          dp[i][j] = cSub; bt[i][j] = subType;
        } else if (cMiss <= cExtra) {
          dp[i][j] = cMiss; bt[i][j] = "MISSING";
        } else {
          dp[i][j] = cExtra; bt[i][j] = "EXTRA";
        }
      }
    }

    const ops = [];
    let i = m, j = n;
    while (i > 0 || j > 0) {
      const act = bt[i][j];
      if (act === "OK" || act === "SYN" || act === "CLOSE" || act === "WRONG") {
        ops.push({ type: act, user: userWords[i - 1], target: targetWords[j - 1] });
        i--; j--;
      } else if (act === "MISSING") {
        ops.push({ type: "MISSING", user: null, target: targetWords[j - 1] });
        j--;
      } else {
        ops.push({ type: "EXTRA", user: userWords[i - 1], target: null });
        i--;
      }
    }
    ops.reverse();

    const maxLen = Math.max(m, n, 1);
    const rawScore = Math.max(0, Math.round((1 - dp[m][n] / maxLen) * 100));
    return { ops, score: rawScore };
  }

  // ==========================================================================
  // 2. VOZ ADAPTADA A SAMSUNG (ANDROID), IPHONE (SAFARI) Y PC
  // ==========================================================================

  function initVoices() {
    if (!("speechSynthesis" in window)) return;
    const load = () => { state.voices = window.speechSynthesis.getVoices() || []; };
    load();
    window.speechSynthesis.onvoiceschanged = load;

    const unlockOnce = () => {
      if (state.ttsUnlocked) return;
      state.ttsUnlocked = true;
      try {
        const u = new SpeechSynthesisUtterance("");
        u.volume = 0;
        window.speechSynthesis.speak(u);
      } catch (_) {}
      document.removeEventListener("touchstart", unlockOnce, true);
      document.removeEventListener("click", unlockOnce, true);
    };
    document.addEventListener("touchstart", unlockOnce, true);
    document.addEventListener("click", unlockOnce, true);
  }

  function pickBestVoice(langPrefix) {
    if (!state.voices.length && "speechSynthesis" in window) {
      state.voices = window.speechSynthesis.getVoices() || [];
    }
    const norm = (langPrefix || "en-US").replace(/_/g, "-").toLowerCase();
    const exact = state.voices.filter(v => (v.lang || "").replace(/_/g, "-").toLowerCase().startsWith(norm));
    const fallback = state.voices.filter(v => (v.lang || "").replace(/_/g, "-").toLowerCase().startsWith(norm.slice(0, 2)));
    const pool = exact.length ? exact : fallback;
    if (!pool.length) return null;

    const preferred = ["Natural", "Neural", "Samantha", "Daniel", "Karen", "Aria", "Jenny", "Sonia", "Google"];
    for (const k of preferred) {
      const f = pool.find(v => (v.name || "").includes(k));
      if (f) return f;
    }
    return pool[0];
  }

  let speakTimer = null;
  function speakTextLang(text, langCode, rate = 0.92) {
    if (!text || !("speechSynthesis" in window)) return;
    if (state.isListening) stopListening(false);
    if (speakTimer) clearTimeout(speakTimer);

    const run = () => {
      const utter = new SpeechSynthesisUtterance(text);
      const voice = pickBestVoice(langCode);
      if (voice) utter.voice = voice;
      utter.lang = langCode;
      utter.rate = rate;
      window.speechSynthesis.speak(utter);
    };

    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
      if (IS_IOS) {
        speakTimer = setTimeout(run, 55);
        return;
      }
    }
    run();
  }

  function speakEnglish(text, rate = 0.92) {
    speakTextLang(text, "en-US", rate);
  }

  function speakSpanish(text, rate = 0.98) {
    speakTextLang(text, "es-ES", rate);
  }

  function mergeFinalSegment(existing, incoming) {
    const a = (existing || "").trim();
    const b = (incoming || "").trim();
    if (!a) return b;
    if (!b) return a;
    if (b.toLowerCase().startsWith(a.toLowerCase())) return b;
    if (a.toLowerCase().endsWith(b.toLowerCase())) return a;
    return `${a} ${b}`;
  }

  // ==========================================================================
  // 3. INTERFAZ, FILTROS Y EVALUACIÓN
  // ==========================================================================

  const el = {};
  function cacheDom() {
    el.btnDirToggle = document.getElementById("btnDirToggle");
    el.btnFontDown = document.getElementById("btnFontDown");
    el.btnFontUp = document.getElementById("btnFontUp");
    el.catSelect = document.getElementById("catSelect");
    el.levelSelect = document.getElementById("levelSelect");
    el.btnFav = document.getElementById("btnFav");
    el.btnOpenQr = document.getElementById("btnOpenQr");
    el.browserWarning = document.getElementById("browserWarning");

    el.phraseCard = document.getElementById("phraseCard");
    el.promptDirectionLabel = document.getElementById("promptDirectionLabel");
    el.cardCounter = document.getElementById("cardCounter");
    el.btnSpeakPrompt = document.getElementById("btnSpeakPrompt");
    el.btnSpeakPromptSlow = document.getElementById("btnSpeakPromptSlow");
    el.autoSpeakWrap = document.getElementById("autoSpeakWrap");
    el.autoSpeakCheck = document.getElementById("autoSpeakCheck");
    el.promptSentence = document.getElementById("promptSentence");

    el.btnMic = document.getElementById("btnMic");
    el.micLabel = document.getElementById("micLabel");
    el.btnReveal = document.getElementById("btnReveal");
    el.liveStatus = document.getElementById("liveStatus");
    el.manualInput = document.getElementById("manualInput");
    el.btnEvaluateText = document.getElementById("btnEvaluateText");

    el.resultPanel = document.getElementById("resultPanel");
    el.scoreBanner = document.getElementById("scoreBanner");
    el.scoreCircle = document.getElementById("scoreCircle");
    el.scoreValue = document.getElementById("scoreValue");
    el.scoreVerdict = document.getElementById("scoreVerdict");
    el.scoreUserSaid = document.getElementById("scoreUserSaid");
    el.directBanner = document.getElementById("directBanner");
    el.btnMarkKnown = document.getElementById("btnMarkKnown");
    el.btnMarkReview = document.getElementById("btnMarkReview");

    el.diffBlock = document.getElementById("diffBlock");
    el.diffTokens = document.getElementById("diffTokens");
    el.mainSolutionTitle = document.getElementById("mainSolutionTitle");
    el.mainSolutionText = document.getElementById("mainSolutionText");
    el.btnPlaySolNormal = document.getElementById("btnPlaySolNormal");
    el.btnPlaySolSlow = document.getElementById("btnPlaySolSlow");
    el.alertsBlock = document.getElementById("alertsBlock");
    el.explanationBlock = document.getElementById("explanationBlock");
    el.primaryAltsTitle = document.getElementById("primaryAltsTitle");
    el.primaryAltsList = document.getElementById("primaryAltsList");
    el.secondaryAltsWrap = document.getElementById("secondaryAltsWrap");

    el.btnPrev = document.getElementById("btnPrev");
    el.btnRetry = document.getElementById("btnRetry");
    el.btnRandom = document.getElementById("btnRandom");
    el.btnNext = document.getElementById("btnNext");

    el.qrModal = document.getElementById("qrModal");
    el.btnCloseQr = document.getElementById("btnCloseQr");
    el.btnInstallDirect = document.getElementById("btnInstallDirect");
    el.btnShareEasy = document.getElementById("btnShareEasy");

    // Selector de modo y Traductor Libre
    el.btnModePractice = document.getElementById("btnModePractice");
    el.btnModeFree = document.getElementById("btnModeFree");
    el.practiceSection = document.getElementById("practiceSection");
    el.freeTranslatorSection = document.getElementById("freeTranslatorSection");
    el.btnFreeDirToggle = document.getElementById("btnFreeDirToggle");
    el.btnFreeSpeakSrc = document.getElementById("btnFreeSpeakSrc");
    el.btnFreeClear = document.getElementById("btnFreeClear");
    el.freeInput = document.getElementById("freeInput");
    el.btnFreeMic = document.getElementById("btnFreeMic");
    el.freeMicLabel = document.getElementById("freeMicLabel");
    el.btnFreeTranslateNow = document.getElementById("btnFreeTranslateNow");
    el.freeResultTitle = document.getElementById("freeResultTitle");
    el.freeStatusBadge = document.getElementById("freeStatusBadge");
    el.freeOutput = document.getElementById("freeOutput");
    el.freeAltsChips = document.getElementById("freeAltsChips");
    el.freeWordChipsWrap = document.getElementById("freeWordChipsWrap");
    el.freeWordChips = document.getElementById("freeWordChips");
    el.btnFreePlayOut = document.getElementById("btnFreePlayOut");
    el.btnFreePlayOutSlow = document.getElementById("btnFreePlayOutSlow");
    el.btnFreeCopy = document.getElementById("btnFreeCopy");
    el.btnFreeSaveCustom = document.getElementById("btnFreeSaveCustom");
  }

  const CAT_LABELS = {
    repaso_isra: "🔥 REPASO ISRA",
    custom: "⭐ Guardadas",
    greetings: "👋 Saludos",
    daily: "🏠 Rutina",
    food: "🍽️ Comida",
    shopping: "🛍️ Compras",
    travel: "✈️ Viajes",
    time_health: "🕒 Horas/Salud",
    essentials: "💬 Claves"
  };

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && typeof d === "object") {
          state.progress = Object.assign(state.progress, d);
          if (!Array.isArray(state.progress.customExercises)) state.progress.customExercises = [];
        }
      }
      const savedPx = parseInt(localStorage.getItem("traductor_facil_fontsize") || "", 10);
      if (!isNaN(savedPx)) state.fontPx = savedPx;
    } catch (_) {}
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
    } catch (_) {}
  }

  function applyFontScale(px) {
    state.fontPx = Math.max(15, Math.min(26, px));
    document.documentElement.style.fontSize = `${state.fontPx}px`;
    try {
      localStorage.setItem("traductor_facil_fontsize", String(state.fontPx));
    } catch (_) {}
  }

  function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = copy[i]; copy[i] = copy[j]; copy[j] = t;
    }
    return copy;
  }

  function getAllExercises() {
    const base = Array.isArray(window.BASIC_EXERCISES) ? window.BASIC_EXERCISES : [];
    const custom = Array.isArray(state.progress.customExercises) ? state.progress.customExercises : [];
    return [...custom, ...base];
  }

  function applyFilters() {
    const base = getAllExercises();
    const filtered = base.filter(ex => {
      if (state.cat === "review") {
        const sc = state.progress.scores[ex.id];
        const fav = !!state.progress.favorites[ex.id];
        if (!((sc && sc.last < 80) || fav)) return false;
      } else if (state.cat !== "all" && ex.cat !== state.cat) {
        return false;
      }
      if (state.level !== "ALL" && ex.level !== state.level) return false;
      return true;
    });

    // Primero las no practicadas aún para que siempre vean frases frescas
    const unseen = filtered.filter(ex => !state.progress.scores[ex.id]);
    const seen = filtered.filter(ex => !!state.progress.scores[ex.id]);
    state.filteredList = [...shuffle(unseen), ...shuffle(seen)];
    state.currentIndex = 0;
    renderCurrentPhrase();
  }

  function updateDirectionLabels() {
    const isEn2Es = state.direction === "en2es";
    el.btnDirToggle.textContent = isEn2Es
      ? "🇬🇧 Inglés → 🇪🇸 Español ⇄"
      : "🇪🇸 Español → 🇬🇧 Inglés ⇄";
    el.promptDirectionLabel.textContent = isEn2Es
      ? "🇬🇧 TRADUCE ESTA FRASE AL ESPAÑOL:"
      : "🇪🇸 DILA O ESCRÍBELA EN INGLÉS:";
    el.micLabel.textContent = isEn2Es
      ? "🎙️ Hablar en Español"
      : "🎙️ Hablar en Inglés";
    el.manualInput.placeholder = isEn2Es
      ? "O escribe tu traducción en español y pulsa Corregir..."
      : "O escribe tu frase en inglés y pulsa Corregir...";

    el.btnSpeakPrompt.classList.toggle("hidden", !isEn2Es);
    el.btnSpeakPromptSlow.classList.toggle("hidden", !isEn2Es);
    el.autoSpeakWrap.classList.toggle("hidden", !isEn2Es);
  }

  function updateFavUI() {
    if (!state.currentExercise) return;
    const fav = !!state.progress.favorites[state.currentExercise.id];
    el.btnFav.textContent = fav ? "★" : "☆";
    el.btnFav.classList.toggle("fav-active", fav);
    el.btnMarkReview.textContent = fav ? "★ En repaso" : "☆ Repasar luego";
  }

  function renderCurrentPhrase() {
    if (state.isListening) stopListening(false);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();

    el.resultPanel.classList.add("hidden");
    el.liveStatus.classList.add("hidden");
    el.manualInput.value = "";
    updateDirectionLabels();

    if (!state.filteredList.length) {
      state.currentExercise = null;
      el.cardCounter.textContent = "0 / 0";
      el.promptSentence.textContent = state.cat === "review"
        ? "🎉 ¡Genial! No tienes ninguna frase pendiente de repaso."
        : "No hay frases en este filtro.";
      return;
    }

    if (state.currentIndex >= state.filteredList.length) state.currentIndex = 0;
    if (state.currentIndex < 0) state.currentIndex = state.filteredList.length - 1;

    const ex = state.filteredList[state.currentIndex];
    state.currentExercise = ex;
    const tag = CAT_LABELS[ex.cat] || ex.cat;
    const yr = ex.level === "A1" ? "Año 1 (A1)" : "Año 2 (A2)";
    el.cardCounter.textContent = `${state.currentIndex + 1} / ${state.filteredList.length} · ${yr} · ${tag}`;
    updateFavUI();

    if (state.direction === "en2es") {
      el.promptSentence.textContent = `“${ex.en}”`;
      if (state.autoSpeak && state.ttsUnlocked) {
        setTimeout(() => {
          if (state.currentExercise && state.currentExercise.id === ex.id && state.direction === "en2es") {
            speakEnglish(ex.en, 0.9);
          }
        }, 220);
      }
    } else {
      el.promptSentence.textContent = `«${ex.es}»`;
    }
  }

  function startListening(targetMode = "practice") {
    if (targetMode === "practice" && !state.currentExercise) return;
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      el.browserWarning.innerHTML = IS_IOS
        ? "📱 En iPhone abre este enlace en <strong>Safari</strong> para usar el botón Hablar, o pulsa la caja de texto y usa el micro 🎙️ del teclado."
        : "📱 Abre la app en <strong>Chrome / Safari / Edge</strong> o usa el micro 🎙️ del teclado de tu móvil.";
      el.browserWarning.classList.remove("hidden");
      if (targetMode === "practice") el.manualInput.focus();
      else el.freeInput.focus();
      return;
    }

    if (state.isListening) {
      stopListening(true);
      return;
    }

    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (targetMode === "practice") el.resultPanel.classList.add("hidden");

    state.listenTarget = targetMode;
    state.finalTranscript = "";
    state.interimTranscript = "";
    state.altTranscripts = ["", "", "", ""];
    state.isListening = true;

    const listenLang = targetMode === "practice"
      ? (state.direction === "en2es" ? "es-ES" : "en-US")
      : (state.freeDir === "es2en" ? "es-ES" : "en-US");

    if (targetMode === "practice") {
      el.btnMic.classList.add("listening");
      el.micLabel.textContent = "⏹ Detener y Corregir";
      el.liveStatus.textContent = listenLang === "es-ES"
        ? "🎙️ Te escucho en ESPAÑOL..."
        : "🎙️ Te escucho en INGLÉS...";
      el.liveStatus.className = "live-status";
      el.liveStatus.classList.remove("hidden");
    } else {
      el.btnFreeMic.classList.add("listening");
      el.freeMicLabel.textContent = "⏹ Detener dictado";
      el.freeStatusBadge.textContent = "🎙️ Escuchando...";
    }

    const rec = new SpeechRec();
    state.recognition = rec;
    rec.lang = listenLang;
    rec.continuous = !IS_MOBILE;
    rec.interimResults = true;
    rec.maxAlternatives = 4;

    rec.onresult = ev => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const top = (res[0] && res[0].transcript) ? res[0].transcript.trim() : "";
        if (res.isFinal) {
          state.finalTranscript = mergeFinalSegment(state.finalTranscript, top);
          for (let a = 0; a < 4; a++) {
            const altT = res[a + 1] ? res[a + 1].transcript : top;
            state.altTranscripts[a] = mergeFinalSegment(state.altTranscripts[a], altT || "");
          }
        } else {
          interim = mergeFinalSegment(interim, top);
        }
      }
      state.interimTranscript = interim.trim();
      const combined = mergeFinalSegment(state.finalTranscript, state.interimTranscript);
      if (combined) {
        if (state.listenTarget === "practice") {
          el.liveStatus.textContent = combined;
          el.manualInput.value = combined;
        } else {
          el.freeInput.value = combined;
        }
      }

      if (state.silenceTimer) clearTimeout(state.silenceTimer);
      if (state.isListening && combined.length >= 2) {
        state.silenceTimer = setTimeout(() => {
          if (state.isListening) stopListening(true);
        }, IS_MOBILE ? 1900 : 2500);
      }
    };

    rec.onerror = ev => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        if (state.listenTarget === "practice") {
          el.liveStatus.textContent = "🔒 Permite el micrófono en el icono del navegador arriba.";
        } else {
          el.freeStatusBadge.textContent = "🔒 Micrófono bloqueado";
        }
        stopListening(false);
      } else if (ev.error === "no-speech") {
        if (state.listenTarget === "practice") {
          el.liveStatus.textContent = "⚠️ No se oyó nada. Vuelve a pulsar Hablar o escribe abajo.";
        }
        stopListening(false);
      }
    };

    rec.onend = () => {
      if (state.isListening) {
        const txt = state.listenTarget === "practice"
          ? (mergeFinalSegment(state.finalTranscript, state.interimTranscript) || el.manualInput.value.trim())
          : (mergeFinalSegment(state.finalTranscript, state.interimTranscript) || el.freeInput.value.trim());
        stopListening(txt.length > 0);
      }
    };

    try {
      rec.start();
    } catch (_) {
      stopListening(false);
    }
  }

  function stopListening(shouldEval = true) {
    if (state.silenceTimer) {
      clearTimeout(state.silenceTimer);
      state.silenceTimer = null;
    }
    const targetMode = state.listenTarget;
    state.isListening = false;
    el.btnMic.classList.remove("listening");
    el.micLabel.textContent = state.direction === "en2es" ? "🎙️ Hablar en Español" : "🎙️ Hablar en Inglés";
    el.btnFreeMic.classList.remove("listening");
    el.freeMicLabel.textContent = state.freeDir === "es2en" ? "🎙️ Dictar en Español" : "🎙️ Dictar en Inglés";

    if (state.recognition) {
      try {
        state.recognition.onend = null;
        state.recognition.stop();
      } catch (_) {}
      state.recognition = null;
    }

    const rawSpoken = mergeFinalSegment(state.finalTranscript, state.interimTranscript);

    if (targetMode === "practice") {
      const spoken = rawSpoken || el.manualInput.value.trim();
      if (shouldEval && spoken) {
        el.liveStatus.textContent = `🗣️ Has dicho: «${spoken}»`;
        el.liveStatus.className = "live-status done";
        el.liveStatus.classList.remove("hidden");
        el.manualInput.value = spoken;
        evaluateAnswer(spoken, [spoken, ...state.altTranscripts.filter(Boolean)]);
      }
    } else {
      const freeTxt = rawSpoken || el.freeInput.value.trim();
      if (shouldEval && freeTxt) {
        el.freeInput.value = freeTxt;
        translateFreeText(freeTxt);
      } else {
        el.freeStatusBadge.textContent = "Automático al escribir";
      }
    }
  }

  function evaluateAnswer(primaryText, candidates) {
    const ex = state.currentExercise;
    if (!ex) return;
    const isEn2Es = state.direction === "en2es";
    const validTargets = isEn2Es
      ? [ex.es, ...(ex.altsEs || [])]
      : [ex.en, ...(ex.alts || [])];

    let best = null;
    for (const cand of candidates) {
      const uTok = isEn2Es ? normalizeSpanishTokens(cand) : normalizeEnglishTokens(cand);
      for (const tgt of validTargets) {
        const tTok = isEn2Es ? normalizeSpanishTokens(tgt) : normalizeEnglishTokens(tgt);
        const res = alignWords(uTok, tTok, isEn2Es, !!ex.isVocab);
        if (!best || res.score > best.score) best = res;
      }
    }

    let score = best ? best.score : 0;
    const alerts = !isEn2Es ? BEGINNER_EN_RULES.filter(r => r.regex.test(primaryText)) : [];
    if (alerts.length > 0 && score > 82) score = 78;

    state.progress.totalAttempts = (state.progress.totalAttempts || 0) + 1;
    const prev = state.progress.scores[ex.id] || { best: 0, last: 0 };
    state.progress.scores[ex.id] = { best: Math.max(prev.best, score), last: score };
    saveProgress();

    let verdict = "";
    if (score >= 88) verdict = "🌟 ¡Genial! Lo has dicho súper bien";
    else if (score >= 70) verdict = "👍 ¡Muy bien! Casi la tienes entera";
    else if (score >= 45) verdict = "💪 ¡Buen intento! Fíjate en las palabras marcadas";
    else verdict = "🌱 Poco a poco: escúchala y mira la solución";

    renderResult({ mode: "evaluated", score, verdict, userText: primaryText, ops: best ? best.ops : [], alerts, ex });
  }

  function revealDirect() {
    if (!state.currentExercise) return;
    if (state.isListening) stopListening(false);
    renderResult({ mode: "revealed", score: null, verdict: "", userText: "", ops: [], alerts: [], ex: state.currentExercise });
  }

  function renderResult(info) {
    const { mode, score, verdict, userText, ops, alerts, ex } = info;
    const isEn2Es = state.direction === "en2es";

    el.resultPanel.classList.remove("hidden");

    if (mode === "evaluated") {
      el.scoreBanner.classList.remove("hidden");
      el.directBanner.classList.add("hidden");
      el.scoreValue.textContent = `${score}%`;
      el.scoreVerdict.textContent = verdict;
      el.scoreUserSaid.textContent = `Tu respuesta: «${userText}»`;
      el.scoreCircle.className = "score-circle " + (score >= 85 ? "score-high" : score >= 60 ? "score-mid" : "score-low");
    } else {
      el.scoreBanner.classList.add("hidden");
      el.directBanner.classList.remove("hidden");
      el.btnMarkKnown.textContent = "👍 La sabía";
      el.btnMarkKnown.disabled = false;
      updateFavUI();
    }

    el.diffTokens.innerHTML = "";
    if (mode === "evaluated" && ops && ops.length) {
      el.diffBlock.classList.remove("hidden");
      ops.forEach(op => {
        const sp = document.createElement("span");
        if (op.type === "OK" || op.type === "SYN") {
          sp.className = "tok tok-ok";
          sp.textContent = op.type === "SYN" ? `${op.user} ✓` : op.user;
        } else if (op.type === "CLOSE") {
          sp.className = "tok tok-close";
          sp.textContent = `${op.user} → ${op.target}`;
        } else if (op.type === "WRONG") {
          sp.className = "tok tok-wrong";
          sp.textContent = `${op.user} ✗ (${op.target})`;
        } else if (op.type === "MISSING") {
          sp.className = "tok tok-missing";
          sp.textContent = `+ [${op.target}]`;
        } else if (op.type === "EXTRA") {
          const okExtra =
            (isEn2Es && OPTIONAL_ES_SUBJECTS.has(op.user)) ||
            (ex.isVocab && isEn2Es && OPTIONAL_VOCAB_ES.has(op.user)) ||
            (ex.isVocab && !isEn2Es && OPTIONAL_VOCAB_EN.has(op.user));
          sp.className = okExtra ? "tok tok-ok" : "tok tok-extra";
          sp.textContent = op.user;
        }
        el.diffTokens.appendChild(sp);
      });
    } else {
      el.diffBlock.classList.add("hidden");
    }

    el.mainSolutionText.innerHTML = "";
    if (isEn2Es) {
      el.mainSolutionTitle.textContent = "🎯 Traducción en Español";
      el.mainSolutionText.textContent = `«${ex.es}»`;
    } else {
      el.mainSolutionTitle.textContent = "🎯 En Inglés (toca cualquier palabra para escucharla despacio)";
      const wrap = document.createElement("div");
      wrap.className = "tokens-wrap";
      ex.en.split(/\s+/).filter(Boolean).forEach(w => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "word-chip";
        btn.textContent = w;
        const clean = w.replace(/[^a-zA-Z0-9'-]/g, "");
        btn.onclick = () => speakEnglish(clean || w, 0.76);
        wrap.appendChild(btn);
      });
      el.mainSolutionText.appendChild(wrap);
    }

    el.btnPlaySolNormal.onclick = () => speakEnglish(ex.en, 0.92);
    el.btnPlaySolSlow.onclick = () => speakEnglish(ex.en, 0.68);

    el.alertsBlock.innerHTML = "";
    if (alerts && alerts.length) {
      alerts.forEach(a => {
        const d = document.createElement("div");
        d.className = "alert-item";
        d.innerHTML = `<strong>${a.title}</strong><p>${a.fix}</p>`;
        el.alertsBlock.appendChild(d);
      });
      el.alertsBlock.classList.remove("hidden");
    } else {
      el.alertsBlock.classList.add("hidden");
    }

    if (ex.tip) {
      el.explanationBlock.innerHTML = `<strong>💡 Truco fácil:</strong> ${ex.tip}`;
      el.explanationBlock.classList.remove("hidden");
    } else {
      el.explanationBlock.classList.add("hidden");
    }

    el.primaryAltsList.innerHTML = "";
    el.secondaryAltsWrap.innerHTML = "";
    el.secondaryAltsWrap.classList.add("hidden");

    if (isEn2Es) {
      el.primaryAltsTitle.textContent = "✅ Otras formas válidas en Español:";
      (ex.altsEs && ex.altsEs.length ? ex.altsEs : [ex.es]).forEach(alt => {
        const li = document.createElement("li");
        li.textContent = alt;
        el.primaryAltsList.appendChild(li);
      });
      if (ex.alts && ex.alts.length) {
        el.secondaryAltsWrap.classList.remove("hidden");
        const st = document.createElement("strong");
        st.textContent = "🇬🇧 Otras formas sencillas de decirlo en Inglés:";
        el.secondaryAltsWrap.appendChild(st);
        const ul = document.createElement("ul");
        ex.alts.forEach(enAlt => {
          const li = document.createElement("li");
          li.appendChild(document.createTextNode(enAlt));
          const pb = document.createElement("button");
          pb.type = "button";
          pb.className = "btn-inline-play";
          pb.textContent = "🔊";
          pb.onclick = () => speakEnglish(enAlt, 0.9);
          li.appendChild(pb);
          ul.appendChild(li);
        });
        el.secondaryAltsWrap.appendChild(ul);
      }
    } else {
      el.primaryAltsTitle.textContent = "✅ Otras formas válidas en Inglés:";
      (ex.alts && ex.alts.length ? ex.alts : [ex.en]).forEach(enAlt => {
        const li = document.createElement("li");
        li.appendChild(document.createTextNode(enAlt));
        const pb = document.createElement("button");
        pb.type = "button";
        pb.className = "btn-inline-play";
        pb.textContent = "🔊 Oír";
        pb.onclick = () => speakEnglish(enAlt, 0.9);
        li.appendChild(pb);
        el.primaryAltsList.appendChild(li);
      });
    }

    setTimeout(() => {
      el.resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
  }

  // ==========================================================================
  // 4. TRADUCTOR DE TEXTO LIBRE PARA ISRA Y GOIKO
  // ==========================================================================

  function switchMainMode(mode) {
    if (state.isListening) stopListening(false);
    state.viewMode = mode;
    const isPractice = mode === "practice";
    el.practiceSection.classList.toggle("hidden", !isPractice);
    el.freeTranslatorSection.classList.toggle("hidden", isPractice);
    el.btnModePractice.classList.toggle("active", isPractice);
    el.btnModeFree.classList.toggle("active", !isPractice);
  }

  function updateFreeDirUI() {
    const isEs2En = state.freeDir === "es2en";
    el.btnFreeDirToggle.textContent = isEs2En
      ? "🇪🇸 Español → 🇬🇧 Inglés ⇄"
      : "🇬🇧 Inglés → 🇪🇸 Español ⇄";
    el.freeMicLabel.textContent = isEs2En
      ? "🎙️ Dictar en Español"
      : "🎙️ Dictar en Inglés";
    el.freeResultTitle.textContent = isEs2En
      ? "🇬🇧 TRADUCCIÓN AL INGLÉS:"
      : "🇪🇸 TRADUCCIÓN AL ESPAÑOL:";
    el.freeInput.placeholder = isEs2En
      ? "Escribe aquí en español cualquier palabra, frase o ejercicio que quieras traducir al inglés..."
      : "Escribe aquí en inglés cualquier palabra o frase que quieras traducir al español...";
  }

  function renderEnglishWordChipsForFree(englishSentence) {
    el.freeWordChips.innerHTML = "";
    const words = (englishSentence || "").split(/\s+/).filter(Boolean);
    if (!words.length) {
      el.freeWordChipsWrap.classList.add("hidden");
      return;
    }
    el.freeWordChipsWrap.classList.remove("hidden");
    words.forEach(w => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "word-chip";
      btn.textContent = w;
      const clean = w.replace(/[^a-zA-Z0-9'-]/g, "");
      btn.onclick = () => speakEnglish(clean || w, 0.74);
      el.freeWordChips.appendChild(btn);
    });
  }

  async function translateFreeText(rawInput) {
    const text = (rawInput !== undefined ? rawInput : el.freeInput.value).trim();
    if (!text) {
      state.lastFreeSrc = "";
      state.lastFreeOut = "";
      el.freeOutput.textContent = "Escribe arriba cualquier texto y aquí verás la traducción al instante...";
      el.freeOutput.classList.add("free-result-empty");
      el.freeAltsChips.classList.add("hidden");
      el.freeWordChipsWrap.classList.add("hidden");
      el.freeStatusBadge.textContent = "Automático al escribir";
      return;
    }

    const isEs2En = state.freeDir === "es2en";
    const normQ = (isEs2En ? normalizeSpanishTokens(text) : normalizeEnglishTokens(text)).join(" ");

    // 1. Comprobar primero en nuestro banco local de frases de Isra y Goiko (instantáneo y offline)
    const localHit = getAllExercises().find(ex => {
      const list = isEs2En ? [ex.es, ...(ex.altsEs || [])] : [ex.en, ...(ex.alts || [])];
      return list.some(item => (isEs2En ? normalizeSpanishTokens(item) : normalizeEnglishTokens(item)).join(" ") === normQ);
    });

    if (localHit) {
      const out = isEs2En ? localHit.en : localHit.es;
      const alts = isEs2En ? (localHit.alts || []) : (localHit.altsEs || []);
      state.lastFreeSrc = text;
      state.lastFreeOut = out;
      el.freeStatusBadge.textContent = "⚡ Frase del entrenador";
      el.freeOutput.textContent = out;
      el.freeOutput.classList.remove("free-result-empty");
      renderFreeAlts(alts);
      renderEnglishWordChipsForFree(isEs2En ? out : text);
      return;
    }

    // 2. Traducción neuronal automática online
    if (state.freeAbortCtrl) state.freeAbortCtrl.abort();
    const ctrl = new AbortController();
    state.freeAbortCtrl = ctrl;

    el.freeStatusBadge.textContent = "⏳ Traduciendo...";
    const sl = isEs2En ? "es" : "en";
    const tl = isEs2En ? "en" : "es";

    try {
      let translated = "";
      let alts = [];
      try {
        const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&dt=bd&q=${encodeURIComponent(text)}`;
        const res = await fetch(gUrl, { signal: ctrl.signal });
        if (res.ok) {
          const data = await res.json();
          translated = Array.isArray(data[0])
            ? data[0].map(seg => (seg && seg[0]) ? seg[0] : "").join("").trim()
            : "";
          if (Array.isArray(data[1])) {
            data[1].forEach(entry => {
              if (Array.isArray(entry[1])) {
                entry[1].slice(0, 5).forEach(w => {
                  if (w && w.toLowerCase() !== translated.toLowerCase() && !alts.includes(w)) alts.push(w);
                });
              }
            });
          }
        }
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }

      if (!translated) {
        const mmRes = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sl}|${tl}`, { signal: ctrl.signal });
        if (mmRes.ok) {
          const mm = await mmRes.json();
          translated = (mm && mm.responseData && mm.responseData.translatedText || "").trim();
        }
      }

      if (!translated) throw new Error("No translation");

      state.lastFreeSrc = text;
      state.lastFreeOut = translated;
      el.freeStatusBadge.textContent = "✅ Traducido";
      el.freeOutput.textContent = translated;
      el.freeOutput.classList.remove("free-result-empty");
      renderFreeAlts(alts.slice(0, 5));
      renderEnglishWordChipsForFree(isEs2En ? translated : text);
    } catch (err) {
      if (err && err.name === "AbortError") return;
      el.freeStatusBadge.textContent = "⚠️ Sin internet";
      el.freeOutput.textContent = "Necesitas conexión a internet para traducir frases nuevas.";
      el.freeOutput.classList.add("free-result-empty");
    }
  }

  function renderFreeAlts(alts) {
    el.freeAltsChips.innerHTML = "";
    if (!alts || !alts.length) {
      el.freeAltsChips.classList.add("hidden");
      return;
    }
    el.freeAltsChips.classList.remove("hidden");
    alts.forEach(a => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dict-chip";
      btn.textContent = a;
      btn.onclick = () => {
        state.lastFreeOut = a;
        el.freeOutput.textContent = a;
        if (state.freeDir === "es2en") {
          renderEnglishWordChipsForFree(a);
          speakEnglish(a, 0.9);
        } else {
          speakSpanish(a, 0.98);
        }
      };
      el.freeAltsChips.appendChild(btn);
    });
  }

  function bindEvents() {
    el.btnModePractice.onclick = () => switchMainMode("practice");
    el.btnModeFree.onclick = () => switchMainMode("free");

    el.btnFreeDirToggle.onclick = () => {
      if (state.isListening) stopListening(false);
      state.freeDir = state.freeDir === "es2en" ? "en2es" : "es2en";
      updateFreeDirUI();
      if (state.lastFreeOut) {
        el.freeInput.value = state.lastFreeOut;
        translateFreeText(state.lastFreeOut);
      } else if (el.freeInput.value.trim()) {
        translateFreeText(el.freeInput.value);
      }
    };

    el.freeInput.addEventListener("input", () => {
      if (state.freeDebounceTimer) clearTimeout(state.freeDebounceTimer);
      const v = el.freeInput.value.trim();
      if (!v) {
        translateFreeText("");
        return;
      }
      state.freeDebounceTimer = setTimeout(() => translateFreeText(v), 420);
    });

    el.btnFreeTranslateNow.onclick = () => {
      if (state.freeDebounceTimer) clearTimeout(state.freeDebounceTimer);
      translateFreeText(el.freeInput.value);
    };

    el.btnFreeMic.onclick = () => startListening("free");

    el.btnFreeClear.onclick = () => {
      if (state.isListening) stopListening(false);
      el.freeInput.value = "";
      translateFreeText("");
      el.freeInput.focus();
    };

    el.btnFreeSpeakSrc.onclick = () => {
      const src = el.freeInput.value.trim();
      if (!src) return;
      if (state.freeDir === "es2en") speakSpanish(src, 0.98);
      else speakEnglish(src, 0.9);
    };

    el.btnFreePlayOut.onclick = () => {
      if (!state.lastFreeOut) return;
      if (state.freeDir === "es2en") speakEnglish(state.lastFreeOut, 0.9);
      else speakSpanish(state.lastFreeOut, 0.98);
    };

    el.btnFreePlayOutSlow.onclick = () => {
      if (!state.lastFreeOut) return;
      if (state.freeDir === "es2en") speakEnglish(state.lastFreeOut, 0.68);
      else speakSpanish(state.lastFreeOut, 0.78);
    };

    el.btnFreeCopy.onclick = async () => {
      if (!state.lastFreeOut) return;
      try {
        await navigator.clipboard.writeText(state.lastFreeOut);
        el.btnFreeCopy.textContent = "✅ ¡Copiado!";
        setTimeout(() => { el.btnFreeCopy.textContent = "📋 Copiar"; }, 1800);
      } catch (_) {}
    };

    el.btnFreeSaveCustom.onclick = () => {
      const src = (state.lastFreeSrc || el.freeInput.value).trim();
      const out = (state.lastFreeOut || "").trim();
      if (!src || !out) return;
      const es = state.freeDir === "es2en" ? src : out;
      const en = state.freeDir === "es2en" ? out : src;
      if (!Array.isArray(state.progress.customExercises)) state.progress.customExercises = [];
      state.progress.customExercises.unshift({
        id: "cust_" + Date.now(),
        cat: "custom",
        isVocab: false,
        level: "A1",
        type: "translate",
        es,
        en,
        alts: [],
        altsEs: [],
        tip: "⭐ Frase guardada desde vuestro Traductor de Texto."
      });
      saveProgress();
      el.btnFreeSaveCustom.textContent = "✅ ¡Guardada!";
      setTimeout(() => { el.btnFreeSaveCustom.textContent = "⭐ Guardar para practicar"; }, 2000);
    };

    el.btnFontDown.onclick = () => applyFontScale(state.fontPx - 1);
    el.btnFontUp.onclick = () => applyFontScale(state.fontPx + 1);

    el.btnDirToggle.onclick = () => {
      state.direction = state.direction === "en2es" ? "es2en" : "en2es";
      renderCurrentPhrase();
    };

    el.catSelect.onchange = () => {
      state.cat = el.catSelect.value;
      applyFilters();
    };

    el.levelSelect.onchange = () => {
      state.level = el.levelSelect.value;
      applyFilters();
    };

    el.autoSpeakCheck.onchange = () => {
      state.autoSpeak = el.autoSpeakCheck.checked;
    };

    const toggleFav = () => {
      if (!state.currentExercise) return;
      const id = state.currentExercise.id;
      if (state.progress.favorites[id]) delete state.progress.favorites[id];
      else state.progress.favorites[id] = true;
      saveProgress();
      updateFavUI();
    };
    el.btnFav.onclick = toggleFav;
    el.btnMarkReview.onclick = toggleFav;

    el.btnMarkKnown.onclick = () => {
      if (!state.currentExercise) return;
      state.progress.scores[state.currentExercise.id] = { best: 100, last: 100 };
      saveProgress();
      el.btnMarkKnown.textContent = "✅ ¡Guardada!";
      el.btnMarkKnown.disabled = true;
    };

    el.btnSpeakPrompt.onclick = () => {
      if (state.currentExercise) speakEnglish(state.currentExercise.en, 0.9);
    };
    el.btnSpeakPromptSlow.onclick = () => {
      if (state.currentExercise) speakEnglish(state.currentExercise.en, 0.68);
    };

    el.btnMic.onclick = () => startListening("practice");
    el.btnReveal.onclick = () => revealDirect();

    el.btnEvaluateText.onclick = () => {
      if (state.isListening) {
        stopListening(true);
        return;
      }
      const txt = el.manualInput.value.trim();
      if (!txt) {
        revealDirect();
        return;
      }
      el.liveStatus.textContent = `⌨️ Has escrito: «${txt}»`;
      el.liveStatus.className = "live-status done";
      el.liveStatus.classList.remove("hidden");
      evaluateAnswer(txt, [txt]);
    };

    el.manualInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        const txt = el.manualInput.value.trim();
        if (txt) {
          el.btnEvaluateText.click();
          if (IS_MOBILE) el.manualInput.blur();
        } else if (el.resultPanel.classList.contains("hidden")) {
          revealDirect();
        } else {
          el.btnNext.click();
        }
      }
    });

    el.btnPrev.onclick = () => { state.currentIndex--; renderCurrentPhrase(); };
    el.btnNext.onclick = () => { state.currentIndex++; renderCurrentPhrase(); };
    el.btnRetry.onclick = () => renderCurrentPhrase();
    el.btnRandom.onclick = () => {
      if (state.filteredList.length <= 1) return;
      let next = state.currentIndex;
      while (next === state.currentIndex) {
        next = Math.floor(Math.random() * state.filteredList.length);
      }
      state.currentIndex = next;
      renderCurrentPhrase();
    };

    // Deslizar frase con el dedo en móvil
    let sx = 0, sy = 0, swiping = false;
    el.phraseCard.addEventListener("touchstart", e => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "BUTTON" || tag === "SELECT" || tag === "LABEL") {
        swiping = false;
        return;
      }
      if (e.touches && e.touches.length === 1) {
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
        swiping = true;
      }
    }, { passive: true });

    el.phraseCard.addEventListener("touchend", e => {
      if (!swiping || !e.changedTouches || !e.changedTouches.length) return;
      swiping = false;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 58 && Math.abs(dx) > Math.abs(dy) * 1.6) {
        state.currentIndex += dx < 0 ? 1 : -1;
        renderCurrentPhrase();
      }
    }, { passive: true });

    // Teclado en PC
    document.addEventListener("keydown", e => {
      if (state.viewMode !== "practice") return;
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !el.qrModal.classList.contains("hidden")) return;
      if (e.code === "Space") { e.preventDefault(); el.btnMic.click(); }
      else if (e.code === "Enter") {
        e.preventDefault();
        if (el.resultPanel.classList.contains("hidden")) revealDirect();
        else el.btnNext.click();
      } else if (e.code === "ArrowRight") { e.preventDefault(); el.btnNext.click(); }
      else if (e.code === "ArrowLeft") { e.preventDefault(); el.btnPrev.click(); }
    });

    // Modal QR e Instalación PWA
    el.btnOpenQr.onclick = () => el.qrModal.classList.remove("hidden");
    el.btnCloseQr.onclick = () => el.qrModal.classList.add("hidden");
    el.qrModal.addEventListener("click", e => {
      if (e.target === el.qrModal) el.qrModal.classList.add("hidden");
    });

    window.addEventListener("beforeinstallprompt", e => {
      e.preventDefault();
      state.deferredInstallPrompt = e;
      el.btnInstallDirect.classList.remove("hidden");
    });

    el.btnInstallDirect.onclick = async () => {
      if (!state.deferredInstallPrompt) return;
      state.deferredInstallPrompt.prompt();
      try { await state.deferredInstallPrompt.userChoice; } catch (_) {}
      state.deferredInstallPrompt = null;
      el.btnInstallDirect.classList.add("hidden");
    };

    el.btnShareEasy.onclick = async () => {
      if (navigator.share) {
        try {
          await navigator.share({
            title: "Entrenador de Inglés para Isra y Goiko",
            text: "Entrenador de Inglés para Isra y Goiko (Vocabulario + Modo Rápido):",
            url: PUBLIC_URL
          });
          return;
        } catch (_) {}
      }
      try {
        await navigator.clipboard.writeText(PUBLIC_URL);
        el.btnShareEasy.textContent = "✅ ¡Enlace copiado!";
        setTimeout(() => { el.btnShareEasy.textContent = "📤 Compartir / Copiar enlace"; }, 2000);
      } catch (_) {}
    };

    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  }

  function init() {
    cacheDom();
    loadProgress();
    applyFontScale(state.fontPx);
    initVoices();
    updateFreeDirUI();
    bindEvents();
    applyFilters();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
