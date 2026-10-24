import { useEffect, useState } from "react";
import AuthPanel from "./AuthPanel.js";

type ApiStatus = "checking" | "available" | "unavailable";

const stages = [
  {
    number: "01",
    title: "Construa evidências",
    description: "Desafios e entregas práticas dão contexto às competências demonstradas."
  },
  {
    number: "02",
    title: "Receba uma revisão clara",
    description: "Rubricas e feedback explicam o que foi observado e o que pode evoluir."
  },
  {
    number: "03",
    title: "Compartilhe com consentimento",
    description: "Candidatos controlam quais evidências querem apresentar às organizações."
  }
];

function App() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/v1/health", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }
        setApiStatus("available");
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        setApiStatus("unavailable");
      });

    return () => controller.abort();
  }, []);

  const statusLabel = {
    checking: "Verificando conexão",
    available: "API conectada",
    unavailable: "API indisponível"
  }[apiStatus];

  return (
    <div className="page-shell">
      <header className="topbar">
        <a className="wordmark" href="#inicio" aria-label="Início">
          <span className="wordmark-icon" aria-hidden="true">P</span>
          <span>Plataforma<span className="wordmark-light"> de evidências</span></span>
        </a>
        <nav aria-label="Navegação principal">
          <a href="#como-funciona">Como funciona</a>
          <a href="#conta">Sua conta</a>
          <a href="#principios">Princípios</a>
        </nav>
        <span className={`api-status api-status-${apiStatus}`} role="status">
          <span aria-hidden="true" />
          {statusLabel}
        </span>
      </header>

      <main id="inicio">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow"><span /> PLATAFORMA EM CONSTRUÇÃO</p>
            <h1>Competências reais.<br /><span>Evidências claras.</span></h1>
            <p className="hero-description">
              Um espaço para demonstrar o que você sabe fazer, receber feedback
              estruturado e compartilhar seu progresso com autonomia.
            </p>
            <a className="primary-link" href="#conta">
              Acessar minha conta <span aria-hidden="true">→</span>
            </a>
            <p className="honest-note">
              Cadastro, trilhas e desafios práticos têm uma versão inicial.
              Avaliações profissionais e oportunidades ainda não estão disponíveis.
            </p>
          </div>
          <aside className="evidence-card" aria-label="Exemplo ilustrativo de evidência">
            <div className="card-topline">
              <span className="card-label">VISÃO DE COMPETÊNCIAS</span>
              <span className="card-dots" aria-hidden="true">•••</span>
            </div>
            <p className="card-title">Exemplo ilustrativo</p>
            <div className="skill-row">
              <span className="skill-icon skill-icon-green" aria-hidden="true">{"</>"}</span>
              <div><strong>APIs REST</strong><small>Evidência revisada</small></div>
              <span className="skill-level">Demonstrada</span>
            </div>
            <div className="skill-row">
              <span className="skill-icon skill-icon-purple" aria-hidden="true">DB</span>
              <div><strong>Modelagem de dados</strong><small>Em desenvolvimento</small></div>
              <span className="skill-level skill-level-muted">Em progresso</span>
            </div>
            <div className="card-footnote">
              <span aria-hidden="true">↗</span>
              Competências contextualizadas por evidências
            </div>
          </aside>
        </section>

        <AuthPanel />

        <section className="how-section" id="como-funciona">
          <div className="section-heading">
            <p className="eyebrow">DA PRÁTICA AO PROGRESSO</p>
            <h2>Um processo que dá contexto às habilidades.</h2>
          </div>
          <div className="stage-grid">
            {stages.map((stage) => (
              <article className="stage-card" key={stage.number}>
                <span className="stage-number">{stage.number}</span>
                <h3>{stage.title}</h3>
                <p>{stage.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="principles-section" id="principios">
          <div>
            <p className="eyebrow">O QUE GUIA O PRODUTO</p>
            <h2>Transparência antes de promessas.</h2>
          </div>
          <p>
            Uma competência registrada representa evidências em um contexto
            específico — não uma medida universal de capacidade nem garantia de
            contratação. Dados e avaliações devem respeitar privacidade,
            consentimento e revisão humana.
          </p>
        </section>
      </main>

      <footer>
        <a className="wordmark footer-wordmark" href="#inicio">
          <span className="wordmark-icon" aria-hidden="true">P</span>
          <span>Plataforma<span className="wordmark-light"> de evidências</span></span>
        </a>
        <span>Fundação inicial · Conteúdo de demonstração</span>
      </footer>
    </div>
  );
}

export default App;
