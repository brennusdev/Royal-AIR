"use strict";

const STORAGE_KEY = "royal-air-meu-drop-v1";
const DEFAULT_STATE = { topics: [], githubUsername: "", githubRepositories: [], studyByDay: {}, totalStudySeconds: 0, commitMetrics: null };
const LANGUAGE_ROADMAPS = {
  javascript: ["Revise variáveis, funções e estruturas de dados.", "Pratique DOM, eventos e consumo de APIs.", "Construa um projeto pequeno e escreva testes."],
  typescript: ["Estude tipos, interfaces e inferência.", "Pratique generics e integração com JavaScript.", "Tipifique um projeto real e adicione testes."],
  python: ["Revise sintaxe, coleções e funções.", "Pratique módulos, APIs e tratamento de erros.", "Construa uma aplicação pequena com testes."],
  java: ["Estude orientação a objetos e coleções.", "Pratique exceções, interfaces e testes.", "Construa uma API simples com persistência."],
  html: ["Aprenda semântica HTML e acessibilidade.", "Combine HTML com CSS responsivo.", "Adicione interatividade com JavaScript."],
  css: ["Pratique box model, flexbox e grid.", "Estude responsividade e acessibilidade visual.", "Recrie uma interface como projeto prático."],
  go: ["Estude sintaxe, structs e interfaces.", "Pratique concorrência e tratamento de erros.", "Crie uma API e cubra os casos com testes."],
  rust: ["Pratique ownership, borrowing e tipos.", "Estude enums, traits e tratamento de erros.", "Construa um utilitário pequeno com testes."]
};
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const elements = {
  appStatus: document.querySelector("#app-status"),
  metricTopics: document.querySelector("#metric-topics"),
  metricLessons: document.querySelector("#metric-lessons"),
  metricTime: document.querySelector("#metric-time"),
  metricWeekTime: document.querySelector("#metric-week-time"),
  metricCommits: document.querySelector("#metric-commits"),
  profileBadge: document.querySelector("#profile-badge"),
  guidanceTitle: document.querySelector("#guidance-title"),
  guidanceCopy: document.querySelector("#guidance-copy"),
  guidanceRoadmap: document.querySelector("#guidance-roadmap"),
  githubForm: document.querySelector("#github-form"),
  githubUsername: document.querySelector("#github-username"),
  githubSubmit: document.querySelector("#github-submit"),
  githubStatus: document.querySelector("#github-status"),
  repositoryList: document.querySelector("#repository-list"),
  projectTitle: document.querySelector("#project-title"),
  projectCopy: document.querySelector("#project-copy"),
  projectLink: document.querySelector("#project-link"),
  videoSearchForm: document.querySelector("#video-search-form"),
  videoSearchResult: document.querySelector("#video-search-result"),
  topicForm: document.querySelector("#topic-form"),
  topicName: document.querySelector("#topic-name"),
  lessonForm: document.querySelector("#lesson-form"),
  lessonTopic: document.querySelector("#lesson-topic"),
  lessonTitle: document.querySelector("#lesson-title"),
  lessonUrl: document.querySelector("#lesson-url"),
  lessonStatus: document.querySelector("#lesson-status"),
  topicList: document.querySelector("#topic-list"),
  emptyState: document.querySelector("#empty-state")
};

let state = loadState();
let selectedRepository = null;
let currentRepositories = state.githubRepositories;
let youtubeApiPromise;
const players = new Map();
const playerIntervals = new Map();
const lastPlayerTimes = new Map();

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("is-error", isError);
  element.classList.toggle("is-visible", Boolean(message));
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { ...DEFAULT_STATE };

    const parsed = JSON.parse(saved);
    if (!parsed || !Array.isArray(parsed.topics)) {
      throw new Error("O formato salvo não é válido.");
    }

    parsed.topics = parsed.topics
      .filter((topic) => topic && typeof topic.id === "string" && typeof topic.title === "string")
      .map((topic) => ({
        id: topic.id,
        title: topic.title,
        createdAt: Number(topic.createdAt) || Date.now(),
        lessons: Array.isArray(topic.lessons)
          ? topic.lessons
            .filter((lesson) => lesson && typeof lesson.id === "string" && typeof lesson.title === "string" && YOUTUBE_ID_PATTERN.test(lesson.videoId))
            .map((lesson) => ({
              id: lesson.id,
              title: lesson.title,
              videoId: lesson.videoId,
              url: `https://www.youtube.com/watch?v=${lesson.videoId}`,
              watchedSeconds: Math.max(0, Number(lesson.watchedSeconds) || 0),
              durationSeconds: Math.max(0, Number(lesson.durationSeconds) || 0)
            }))
          : []
      }));
    parsed.githubUsername = typeof parsed.githubUsername === "string" ? parsed.githubUsername : "";
    parsed.githubRepositories = Array.isArray(parsed.githubRepositories)
      ? parsed.githubRepositories.filter((repo) => repo && typeof repo.name === "string" && typeof repo.full_name === "string" && typeof repo.html_url === "string" && repo.html_url.startsWith("https://github.com/"))
        .map((repo) => ({
          name: repo.name,
          full_name: repo.full_name,
          html_url: repo.html_url,
          description: typeof repo.description === "string" ? repo.description : "",
          language: typeof repo.language === "string" ? repo.language : "",
          updated_at: typeof repo.updated_at === "string" ? repo.updated_at : "",
          pushed_at: typeof repo.pushed_at === "string" ? repo.pushed_at : "",
          topics: Array.isArray(repo.topics) ? repo.topics.filter((topic) => typeof topic === "string") : []
        }))
      : [];
    parsed.studyByDay = parsed.studyByDay && typeof parsed.studyByDay === "object" && !Array.isArray(parsed.studyByDay)
      ? Object.fromEntries(Object.entries(parsed.studyByDay).filter(([date, seconds]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Number(seconds))).map(([date, seconds]) => [date, Math.max(0, Number(seconds))]))
      : {};
    parsed.totalStudySeconds = Number.isFinite(Number(parsed.totalStudySeconds))
      ? Math.max(0, Number(parsed.totalStudySeconds))
      : parsed.topics.reduce((total, topic) => total + topic.lessons.reduce((sum, lesson) => sum + lesson.watchedSeconds, 0), 0);
    parsed.commitMetrics = parsed.commitMetrics && Number.isFinite(Number(parsed.commitMetrics.count))
      ? {
        count: Math.max(0, Number(parsed.commitMetrics.count)),
        updatedAt: Number(parsed.commitMetrics.updatedAt) || 0,
        repoCount: Math.max(0, Number(parsed.commitMetrics.repoCount) || 0),
        truncated: Boolean(parsed.commitMetrics.truncated),
        byRepo: parsed.commitMetrics.byRepo && typeof parsed.commitMetrics.byRepo === "object" && !Array.isArray(parsed.commitMetrics.byRepo)
          ? Object.fromEntries(Object.entries(parsed.commitMetrics.byRepo).filter(([name, count]) => typeof name === "string" && Number.isFinite(Number(count))).map(([name, count]) => [name, Math.max(0, Number(count))]))
          : {}
      }
      : null;
    return parsed;
  } catch (error) {
    setStatus(elements.appStatus, `Não foi possível carregar seus estudos salvos: ${error.message} Seus dados anteriores não foram apagados.`, true);
    return { ...DEFAULT_STATE };
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    setStatus(elements.appStatus, `Não foi possível salvar as alterações neste dispositivo: ${error.message}`, true);
    return false;
  }
}

function getLessons() {
  return state.topics.flatMap((topic) => topic.lessons.map((lesson) => ({ ...lesson, topicTitle: topic.title })));
}

function isLessonComplete(lesson) {
  return lesson.durationSeconds > 0 && lesson.watchedSeconds >= lesson.durationSeconds * 0.8;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatStudyHours(seconds) {
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(seconds / 3600)} h`;
}

function updateMetrics() {
  const lessons = getLessons();
  const completed = lessons.filter(isLessonComplete).length;
  const watchedSeconds = state.totalStudySeconds;
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 6);
  const weeklySeconds = Object.entries(state.studyByDay).reduce((total, [date, seconds]) => {
    return date >= localDateKey(weekStart) && date <= localDateKey() ? total + seconds : total;
  }, 0);
  elements.metricTopics.textContent = String(state.topics.length);
  elements.metricLessons.textContent = String(completed);
  elements.metricTime.textContent = formatStudyHours(watchedSeconds);
  elements.metricWeekTime.textContent = formatStudyHours(weeklySeconds);
  elements.metricCommits.textContent = state.commitMetrics
    && state.commitMetrics.repoCount > 0
    ? `${state.commitMetrics.count}${state.commitMetrics.truncated ? "+" : ""}`
    : "—";
  elements.profileBadge.textContent = state.githubUsername
    ? `@${state.githubUsername} · neste dispositivo`
    : "Perfil neste dispositivo";
  renderProjectRecommendation();
}

const STUDY_STOP_WORDS = new Set(["a", "as", "o", "os", "de", "do", "da", "dos", "das", "e", "em", "para", "com", "por", "um", "uma", "the", "and", "of", "to", "in", "for"]);

function normalizeForSearch(value) {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function studyTerms() {
  const text = state.topics.flatMap((topic) => [topic.title, ...topic.lessons.map((lesson) => lesson.title)]).join(" ");
  return new Set(normalizeForSearch(text).split(/[^a-z0-9+#.]+/).filter((word) => word.length > 1 && !STUDY_STOP_WORDS.has(word)));
}

function getRepositoryStudyMatch(repo, terms) {
  const repositoryText = normalizeForSearch(`${repo.name} ${repo.description || ""} ${repo.language || ""} ${(repo.topics || []).join(" ")}`);
  const repositoryWords = new Set(repositoryText.split(/[^a-z0-9+#.]+/).filter(Boolean));
  const matches = [...terms].filter((term) => repositoryWords.has(term));
  const languageMatches = Boolean(repo.language && terms.has(normalizeForSearch(repo.language)));
  if (languageMatches && !matches.includes(normalizeForSearch(repo.language))) {
    matches.push(normalizeForSearch(repo.language));
  }
  if (!matches.length) return null;

  const daysSinceUpdate = repo.pushed_at
    ? Math.max(0, (Date.now() - Date.parse(repo.pushed_at)) / 86_400_000)
    : 0;
  const score = matches.length + (languageMatches ? 2 : 0) + Math.min(daysSinceUpdate / 365, 0.25);
  return { repo, matches, score, daysSinceUpdate };
}

function getRecommendedRepositories(repositories = currentRepositories) {
  const terms = studyTerms();
  if (!terms.size) return [];
  return repositories
    .map((repo) => getRepositoryStudyMatch(repo, terms))
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
}

function renderProjectRecommendation() {
  const ranked = getRecommendedRepositories();
  const recommendation = ranked[0];
  if (!recommendation) {
    elements.projectTitle.textContent = state.topics.length
      ? "Ainda não encontrei um projeto relacionado"
      : "Adicione seus estudos e consulte seu GitHub";
    elements.projectCopy.textContent = state.topics.length
      ? "Nenhum repositório público consultado corresponde aos assuntos e títulos das suas aulas. Adicione repositórios relacionados ou registre outros estudos."
      : "A sugestão vai considerar somente os assuntos e títulos das aulas que você registrou e as linguagens/descrições dos seus repositórios públicos.";
    elements.projectLink.hidden = true;
    elements.metricCommits.textContent = state.commitMetrics?.repoCount
      ? `${state.commitMetrics.count}${state.commitMetrics.truncated ? "+" : ""}`
      : "—";
    return;
  }

  const { repo, matches } = recommendation;
  const matchedTopics = state.topics
    .filter((topic) => matches.some((match) => normalizeForSearch(topic.title).includes(match)))
    .map((topic) => topic.title);
  const studyFocus = matchedTopics.length ? matchedTopics.join(", ") : matches.join(", ");
  const lastUpdate = repo.pushed_at
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(repo.pushed_at))
    : "data não informada";
  elements.projectTitle.textContent = `Pratique seus estudos em ${repo.name}`;
  elements.projectCopy.textContent = `Este é o projeto público com maior relação com "${studyFocus}". Linguagem principal: ${repo.language || "não informada"}. Último push público: ${lastUpdate}. Use o que estudou para propor uma melhoria; a página não analisa o código nem sabe quais tarefas estão pendentes.`;
  elements.projectLink.href = repo.html_url;
  elements.projectLink.textContent = `Abrir ${repo.full_name} no GitHub →`;
  elements.projectLink.hidden = false;
  const commitCount = state.commitMetrics?.repoCount
    ? `${state.commitMetrics.count}${state.commitMetrics.truncated ? "+" : ""}`
    : "—";
  elements.metricCommits.textContent = commitCount;
  if (state.commitMetrics?.updatedAt) {
    const refreshedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(state.commitMetrics.updatedAt);
    elements.metricCommits.title = `Atualizado em ${refreshedAt} para ${state.commitMetrics.repoCount} repositório(s) relacionado(s)`;
  } else {
    elements.metricCommits.removeAttribute("title");
  }
}

function renderGuidance(language, repoName) {
  const topics = state.topics;
  const lessons = getLessons();
  const completed = lessons.filter(isLessonComplete).length;
  const watchedMinutes = Math.floor(lessons.reduce((total, lesson) => total + lesson.watchedSeconds, 0) / 60);
  let title;
  let copy;
  let roadmap = [];

  if (language) {
    const normalizedLanguage = language.toLowerCase();
    roadmap = LANGUAGE_ROADMAPS[normalizedLanguage] || [
      `Revise os fundamentos de ${language} usados no projeto.`,
      "Identifique uma parte do repositório para entender em profundidade.",
      "Implemente uma melhoria pequena e documente o que aprendeu."
    ];
    title = `Trilha sugerida${repoName ? ` para ${repoName}` : ""}`;
    copy = `Este repositório usa ${language}. Use estes passos como ponto de partida para estudar a tecnologia na prática.`;
  } else if (!topics.length) {
    title = "Comece escolhendo um assunto";
    copy = "Adicione um tema ao Meu Drop ou consulte seus repositórios públicos. Com esses dados, posso sugerir próximos passos.";
  } else {
    const nextLesson = lessons.find((lesson) => !isLessonComplete(lesson));
    const topicWithoutLessons = topics.find((topic) => topic.lessons.length === 0);
    if (nextLesson) {
      title = `Continue: ${nextLesson.topicTitle}`;
      copy = `Você já assistiu ${watchedMinutes} minuto(s) e concluiu ${completed} aula(s). Termine a aula "${nextLesson.title}" para manter sua trilha em movimento.`;
      roadmap = ["Continue assistindo à aula adicionada ao seu Drop.", "Anote uma dúvida ou conceito importante.", "Adicione a próxima aula sobre o mesmo assunto."];
    } else if (topicWithoutLessons) {
      title = `Sua próxima trilha: ${topicWithoutLessons.title}`;
      copy = "Você já escolheu o que estudar. Adicione uma aula do YouTube ao assunto para acompanhar seu progresso enquanto assiste.";
      roadmap = ["Escolha uma aula introdutória.", "Adicione o link do vídeo ao Meu Drop.", "Assista por aqui para registrar seu tempo de estudo."];
    } else {
      title = "Ótimo ritmo: escolha o próximo desafio";
      copy = `Você concluiu ${completed} aula(s). Adicione um novo assunto ou escolha um projeto para avançar para o próximo nível.`;
      roadmap = ["Revise o que aprendeu nas aulas concluídas.", "Aplique o conteúdo em um projeto próprio.", "Adicione um novo assunto ao seu Drop."];
    }
  }

  elements.guidanceTitle.textContent = title;
  elements.guidanceCopy.textContent = copy;
  elements.guidanceRoadmap.replaceChildren(...roadmap.map((step) => {
    const item = document.createElement("li");
    item.textContent = step;
    return item;
  }));
}

function updateProgressDisplay(lesson) {
  const card = document.querySelector(`[data-lesson-id="${CSS.escape(lesson.id)}"]`);
  if (!card) return;
  const progress = lesson.durationSeconds
    ? Math.min(100, Math.floor((lesson.watchedSeconds / lesson.durationSeconds) * 100))
    : 0;
  const bar = card.querySelector(".progress-bar span");
  const label = card.querySelector(".lesson-progress-label");
  const completeLabel = card.querySelector(".lesson-complete-label");
  if (bar) bar.style.width = `${progress}%`;
  if (label) label.textContent = lesson.durationSeconds ? `${progress}% assistido` : "Carregando duração...";
  if (completeLabel) completeLabel.textContent = isLessonComplete(lesson) ? "Aula concluída" : "";
}

function renderTopics() {
  const selectedTopic = elements.lessonTopic.value;
  elements.topicList.replaceChildren();
  elements.lessonTopic.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = state.topics.length ? "Selecione um assunto" : "Adicione um assunto primeiro";
  elements.lessonTopic.append(placeholder);

  state.topics.forEach((topic) => {
    const option = document.createElement("option");
    option.value = topic.id;
    option.textContent = topic.title;
    elements.lessonTopic.append(option);
  });
  if (state.topics.some((topic) => topic.id === selectedTopic)) {
    elements.lessonTopic.value = selectedTopic;
  }

  state.topics.forEach((topic) => {
    const card = document.createElement("article");
    card.className = "topic-card";
    const heading = document.createElement("div");
    heading.className = "topic-heading";
    const title = document.createElement("h3");
    title.textContent = topic.title;
    const removeTopic = document.createElement("button");
    removeTopic.className = "text-button";
    removeTopic.type = "button";
    removeTopic.textContent = "Remover assunto";
    removeTopic.setAttribute("aria-label", `Remover assunto ${topic.title}`);
    removeTopic.addEventListener("click", () => {
      const lessonCount = topic.lessons.length;
      const confirmation = lessonCount
        ? `Remover "${topic.title}" e suas ${lessonCount} aula(s)?`
        : `Remover o assunto "${topic.title}"?`;
      if (!window.confirm(confirmation)) return;
      topic.lessons.forEach((lesson) => destroyPlayer(lesson.id));
      state.topics = state.topics.filter((item) => item.id !== topic.id);
      saveState();
      renderAll();
    });
    heading.append(title, removeTopic);
    card.append(heading);

    if (!topic.lessons.length) {
      const empty = document.createElement("p");
      empty.className = "topic-empty";
      empty.textContent = "Nenhuma aula adicionada. Escolha uma aula do YouTube e inclua o link no formulário acima.";
      card.append(empty);
    }

    topic.lessons.forEach((lesson) => card.append(createLessonCard(lesson)));
    elements.topicList.append(card);
  });
  elements.emptyState.hidden = state.topics.length > 0;
  updateMetrics();
  renderGuidance(selectedRepository?.language, selectedRepository?.name);
}

function createLessonCard(lesson) {
  const card = document.createElement("article");
  card.className = "lesson-card";
  card.dataset.lessonId = lesson.id;

  const heading = document.createElement("div");
  heading.className = "lesson-heading";
  const title = document.createElement("h4");
  title.textContent = lesson.title;
  const remove = document.createElement("button");
  remove.className = "text-button";
  remove.type = "button";
  remove.textContent = "Remover";
  remove.setAttribute("aria-label", `Remover aula ${lesson.title}`);
  remove.addEventListener("click", () => {
    destroyPlayer(lesson.id);
    state.topics.forEach((topic) => {
      topic.lessons = topic.lessons.filter((item) => item.id !== lesson.id);
    });
    saveState();
    renderAll();
  });
  heading.append(title, remove);

  const playerContainer = document.createElement("div");
  playerContainer.className = "video-player";
  playerContainer.id = `player-${lesson.id}`;
  playerContainer.setAttribute("aria-label", `Vídeo da aula ${lesson.title}`);

  const progress = document.createElement("div");
  progress.className = "lesson-progress";
  const bar = document.createElement("div");
  bar.className = "progress-bar";
  const fill = document.createElement("span");
  bar.append(fill);
  const label = document.createElement("span");
  label.className = "lesson-progress-label";
  const completeLabel = document.createElement("strong");
  completeLabel.className = "lesson-complete-label";
  progress.append(bar, label, completeLabel);

  const fallback = document.createElement("a");
  fallback.className = "inline-link lesson-fallback";
  fallback.href = lesson.url;
  fallback.target = "_blank";
  fallback.rel = "noopener noreferrer";
  fallback.textContent = "Abrir vídeo no YouTube";

  card.append(heading, playerContainer, progress, fallback);
  updateProgressDisplay(lesson);
  return card;
}

function renderAll() {
  Array.from(players.keys()).forEach((lessonId) => destroyPlayer(lessonId, true));
  renderTopics();
  loadYoutubeApi();
}

function getVideoId(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  const isYoutubeHost = hostname === "youtube.com"
    || hostname.endsWith(".youtube.com")
    || hostname === "youtu.be";
  if (!isYoutubeHost || (url.protocol !== "https:" && url.protocol !== "http:")) return null;

  let videoId;
  if (hostname === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0];
  } else if (url.pathname === "/watch") {
    videoId = url.searchParams.get("v");
  } else {
    const parts = url.pathname.split("/").filter(Boolean);
    videoId = ["embed", "shorts", "live"].includes(parts[0]) ? parts[1] : null;
  }
  return videoId && YOUTUBE_ID_PATTERN.test(videoId) ? videoId : null;
}

function loadYoutubeApi() {
  if (!getLessons().length || window.YT?.Player) {
    if (window.YT?.Player) createPlayers();
    return;
  }
  if (youtubeApiPromise) return;

  youtubeApiPromise = new Promise((resolve, reject) => {
    window.onYouTubeIframeAPIReady = resolve;
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("Não foi possível carregar o player do YouTube."));
    document.head.append(script);
  });

  youtubeApiPromise.then(createPlayers).catch((error) => {
    setStatus(elements.lessonStatus, `${error.message} Ainda é possível abrir as aulas diretamente no YouTube.`, true);
  });
}

function createPlayers() {
  if (!window.YT?.Player) return;

  getLessons().forEach((lesson) => {
    if (players.has(lesson.id)) return;
    const target = document.getElementById(`player-${lesson.id}`);
    if (!target) return;
    const playerOptions = {
      videoId: lesson.videoId,
      playerVars: { enablejsapi: 1, playsinline: 1, rel: 0 },
      events: {
        onReady: (event) => {
          const duration = Math.floor(event.target.getDuration());
          if (duration > 0 && duration !== lesson.durationSeconds) {
            updateLesson(lesson.id, (storedLesson) => {
              storedLesson.durationSeconds = duration;
            });
            updateProgressDisplay(findLesson(lesson.id));
            updateMetrics();
          }
        },
        onStateChange: (event) => handlePlayerState(lesson.id, event),
        onError: () => {
          const card = document.querySelector(`[data-lesson-id="${CSS.escape(lesson.id)}"]`);
          const notice = document.createElement("p");
          notice.className = "status-message is-visible is-error";
          notice.textContent = "Este vídeo não permite reprodução incorporada. Abra-o pelo link abaixo.";
          card?.append(notice);
        }
      }
    };
    if (location.protocol === "https:" || location.protocol === "http:") {
      playerOptions.playerVars.origin = location.origin;
    }
    players.set(lesson.id, new window.YT.Player(target, playerOptions));
  });
}

function handlePlayerState(lessonId, event) {
  if (event.data === window.YT.PlayerState.PLAYING) {
    lastPlayerTimes.set(lessonId, { position: event.target.getCurrentTime(), at: Date.now() });
    if (!playerIntervals.has(lessonId)) {
      playerIntervals.set(lessonId, window.setInterval(() => recordPlayback(lessonId, event.target), 1000));
    }
    return;
  }

  if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.ENDED) {
    recordPlayback(lessonId, event.target, true);
    clearInterval(playerIntervals.get(lessonId));
    playerIntervals.delete(lessonId);
    lastPlayerTimes.delete(lessonId);
  }
}

function recordPlayback(lessonId, player, forceSave = false) {
  const currentTime = player.getCurrentTime();
  const previousTime = lastPlayerTimes.get(lessonId);
  const now = Date.now();
  lastPlayerTimes.set(lessonId, { position: currentTime, at: now });
  if (previousTime === undefined) return;

  const videoElapsed = currentTime - previousTime.position;
  const elapsed = Math.min((now - previousTime.at) / 1000, 2.5);
  if (videoElapsed <= 0 || videoElapsed > 2.5 || elapsed <= 0) return;

  const lesson = updateLesson(lessonId, (storedLesson) => {
    storedLesson.watchedSeconds += videoElapsed;
  });
  if (!lesson) return;
  const today = localDateKey();
  state.totalStudySeconds += elapsed;
  state.studyByDay[today] = (state.studyByDay[today] || 0) + elapsed;
  updateProgressDisplay(lesson);
  if (forceSave || Math.floor(lesson.watchedSeconds) % 5 === 0 || isLessonComplete(lesson)) {
    saveState();
    updateMetrics();
    renderGuidance(selectedRepository?.language, selectedRepository?.name);
  }
}

function updateLesson(lessonId, change) {
  for (const topic of state.topics) {
    const lesson = topic.lessons.find((item) => item.id === lessonId);
    if (lesson) {
      change(lesson);
      return lesson;
    }
  }
  return null;
}

function findLesson(lessonId) {
  return state.topics.flatMap((topic) => topic.lessons).find((lesson) => lesson.id === lessonId) || null;
}

function destroyPlayer(lessonId, flush = false) {
  const player = players.get(lessonId);
  if (flush && player?.getPlayerState() === window.YT?.PlayerState.PLAYING) {
    recordPlayback(lessonId, player, true);
  }
  clearInterval(playerIntervals.get(lessonId));
  playerIntervals.delete(lessonId);
  lastPlayerTimes.delete(lessonId);
  player?.destroy();
  players.delete(lessonId);
}

function renderRepositories(repositories) {
  elements.repositoryList.replaceChildren();
  repositories.forEach((repo) => {
    const card = document.createElement("article");
    card.className = "repository-card";
    const title = document.createElement("h3");
    const link = document.createElement("a");
    link.href = repo.html_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = repo.name;
    title.append(link);
    const description = document.createElement("p");
    description.textContent = repo.description || "Este repositório não tem descrição.";
    const meta = document.createElement("span");
    meta.className = "repository-language";
    meta.textContent = repo.language || "Linguagem não informada";
    const recentCommits = state.commitMetrics?.byRepo?.[repo.full_name];
    if (recentCommits !== undefined) {
      const commitSummary = document.createElement("p");
      commitSummary.className = "repository-commit-summary";
      commitSummary.textContent = `${recentCommits} commit(s) público(s) nos últimos 30 dias`;
      card.append(title, description, meta, commitSummary);
    }
    const roadmapButton = document.createElement("button");
    roadmapButton.className = "text-button";
    roadmapButton.type = "button";
    roadmapButton.textContent = "Ver trilha desta linguagem";
    roadmapButton.disabled = !repo.language;
    if (!repo.language) roadmapButton.title = "Este repositório não informa uma linguagem principal.";
    roadmapButton.addEventListener("click", () => {
      selectedRepository = { language: repo.language, name: repo.name };
      renderGuidance(repo.language, repo.name);
      document.querySelector("#aprender").scrollIntoView({ behavior: "smooth" });
    });
    if (recentCommits === undefined) card.append(title, description, meta);
    card.append(roadmapButton);
    elements.repositoryList.append(card);
  });
}

async function fetchRecentCommits(repo, username, since) {
  const [owner, name] = repo.full_name.split("/");
  if (!owner || !name) throw new Error(`Nome de repositório inválido: ${repo.full_name}`);

  let count = 0;
  let truncated = false;
  for (let page = 1; page <= 3; page += 1) {
    const url = new URL(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/commits`);
    url.searchParams.set("author", username);
    url.searchParams.set("since", since);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    const response = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    if (response.status === 403) throw new Error("Limite de consultas do GitHub atingido.");
    if (!response.ok) throw new Error(`Falha ao consultar ${repo.full_name} (HTTP ${response.status}).`);
    const commits = await response.json();
    if (!Array.isArray(commits)) throw new Error(`Resposta inválida ao consultar ${repo.full_name}.`);
    count += commits.length;
    const hasNextPage = /rel="next"/.test(response.headers.get("Link") || "");
    if (!hasNextPage) break;
    if (page === 3) truncated = true;
  }
  return { repo: repo.full_name, count, truncated };
}

async function refreshCommitMetrics(username) {
  const recommended = getRecommendedRepositories(currentRepositories);
  if (!recommended.length) {
    state.commitMetrics = null;
    saveState();
    updateMetrics();
    setStatus(elements.githubStatus, "Não encontrei repositórios que correspondam aos assuntos e às aulas registrados. Os commits serão calculados quando houver projetos relacionados.", false);
    return;
  }

  const trackedRepositories = recommended.map((match) => match.repo);
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - 30);
  const results = await Promise.allSettled(
    trackedRepositories.map(({ repo }) => fetchRecentCommits(repo, username, sinceDate.toISOString()))
  );
  const successes = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
  const failures = results.filter((result) => result.status === "rejected");
  if (!successes.length) {
    state.commitMetrics = null;
    updateMetrics();
    const firstError = failures[0]?.reason;
    throw new Error(firstError instanceof Error ? firstError.message : "Não foi possível consultar commits públicos.");
  }

  state.commitMetrics = {
    count: successes.reduce((total, result) => total + result.count, 0),
    updatedAt: Date.now(),
    repoCount: successes.length,
    truncated: successes.some((result) => result.truncated),
    byRepo: Object.fromEntries(successes.map((result) => [result.repo, result.count]))
  };
  currentRepositories = state.githubRepositories;
  saveState();
  renderRepositories(currentRepositories);
  updateMetrics();

  const partialMessage = failures.length
    ? ` Não foi possível consultar ${failures.length} projeto(s); o total pode estar incompleto.`
    : "";
  const limitMessage = state.commitMetrics.truncated
    ? " Pelo menos 300 commits foram encontrados em um dos repositórios; o total pode ser maior."
    : "";
  setStatus(
    elements.githubStatus,
    `${state.commitMetrics.count} commit(s) público(s) encontrados nos últimos 30 dias em ${successes.length} projeto(s) relacionado(s) aos seus estudos.${partialMessage}${limitMessage}`,
    failures.length > 0
  );
}

elements.githubForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = elements.githubUsername.value.trim();
  elements.githubSubmit.disabled = true;
  setStatus(elements.githubStatus, "Buscando repositórios públicos e projetos relacionados aos seus estudos...");
  elements.repositoryList.replaceChildren();

  try {
    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=100`, {
      headers: { Accept: "application/vnd.github+json" }
    });
    if (response.status === 404) throw new Error("Usuário do GitHub não encontrado.");
    if (response.status === 403) throw new Error("Limite de consultas do GitHub atingido. Tente novamente mais tarde.");
    if (!response.ok) throw new Error(`O GitHub respondeu com o erro ${response.status}.`);
    const repositories = await response.json();
    if (!Array.isArray(repositories)) throw new Error("A resposta do GitHub não trouxe uma lista de repositórios.");
    if (!repositories.length) {
      currentRepositories = [];
      state.githubUsername = username;
      state.githubRepositories = [];
      state.commitMetrics = null;
      saveState();
      updateMetrics();
      setStatus(elements.githubStatus, "Esse usuário ainda não tem repositórios públicos.");
      return;
    }
    state.githubUsername = username;
    state.githubRepositories = repositories.map((repo) => ({
      name: repo.name,
      full_name: repo.full_name,
      html_url: repo.html_url,
      description: repo.description || "",
      language: repo.language || "",
      updated_at: repo.updated_at || "",
      pushed_at: repo.pushed_at || "",
      topics: Array.isArray(repo.topics) ? repo.topics : []
    }));
    state.commitMetrics = null;
    currentRepositories = state.githubRepositories;
    saveState();
    renderRepositories(currentRepositories);
    updateMetrics();
    await refreshCommitMetrics(username);
  } catch (error) {
    setStatus(elements.githubStatus, `${error.message} Verifique sua conexão e tente novamente.`, true);
  } finally {
    elements.githubSubmit.disabled = false;
  }
});

elements.videoSearchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = new FormData(elements.videoSearchForm).get("query").toString().trim();
  const searchUrl = new URL("https://www.youtube.com/results");
  searchUrl.searchParams.set("search_query", query);
  const resultLink = document.createElement("a");
  resultLink.className = "inline-link video-search-link";
  resultLink.href = searchUrl.href;
  resultLink.target = "_blank";
  resultLink.rel = "noopener noreferrer";
  resultLink.textContent = `Ver resultados de "${query}" no YouTube`;
  elements.videoSearchResult.replaceChildren(resultLink);
  window.open(searchUrl.href, "_blank", "noopener,noreferrer");
});

elements.topicForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = elements.topicName.value.trim();
  if (!title) return;
  state.topics.push({ id: createId(), title, createdAt: Date.now(), lessons: [] });
  saveState();
  elements.topicForm.reset();
  renderAll();
  elements.lessonTopic.value = state.topics[state.topics.length - 1].id;
  setStatus(elements.appStatus, `Assunto "${title}" adicionado ao seu Drop.`);
});

elements.lessonForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const topic = state.topics.find((item) => item.id === elements.lessonTopic.value);
  const title = elements.lessonTitle.value.trim();
  const url = elements.lessonUrl.value.trim();
  const videoId = getVideoId(url);
  if (!topic) {
    setStatus(elements.lessonStatus, "Selecione um assunto para esta aula.", true);
    return;
  }
  if (!videoId) {
    setStatus(elements.lessonStatus, "Informe um link válido de vídeo do YouTube.", true);
    return;
  }

  topic.lessons.push({ id: createId(), title, url: `https://www.youtube.com/watch?v=${videoId}`, videoId, watchedSeconds: 0, durationSeconds: 0 });
  saveState();
  elements.lessonForm.reset();
  renderAll();
  setStatus(elements.lessonStatus, `Aula "${title}" adicionada. Assista ao vídeo aqui para registrar seu progresso.`);
});

document.querySelector("#refresh-guidance").addEventListener("click", () => {
  renderGuidance(selectedRepository?.language, selectedRepository?.name);
});

elements.githubUsername.value = state.githubUsername;
if (currentRepositories.length) renderRepositories(currentRepositories);
renderAll();
