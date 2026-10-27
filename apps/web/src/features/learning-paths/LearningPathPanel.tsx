import { useEffect, useState, type FormEvent } from "react";
import {
  learningPathSchema,
  learningPlanSchema,
  type LearningPath,
  type LearningPlan
} from "@platform/shared";

async function parseResponse(response: Response): Promise<unknown> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("A API está indisponível ou retornou uma resposta inválida.");
  }
  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
      ? body.error
      : "Não foi possível atualizar sua trilha.";
    throw new Error(message);
  }
  return body;
}

async function listPaths(): Promise<LearningPath[]> {
  const body = await parseResponse(await fetch("/api/v1/learning-paths"));
  if (typeof body !== "object" || body === null || !("paths" in body) || !Array.isArray(body.paths)) {
    throw new Error("A API retornou uma lista de trilhas inválida.");
  }
  return body.paths.map((path: unknown) => learningPathSchema.parse(path));
}

async function getPlan(): Promise<LearningPlan | null> {
  const response = await fetch("/api/v1/my-learning-plan", { credentials: "include" });
  const body = await parseResponse(response);
  if (typeof body !== "object" || body === null || !("plan" in body)) {
    throw new Error("A API retornou um plano inválido.");
  }
  return body.plan === null ? null : learningPlanSchema.parse(body.plan);
}

function LearningPathPanel() {
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [selectedPathId, setSelectedPathId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listPaths(), getPlan()])
      .then(([availablePaths, currentPlan]) => {
        if (cancelled) {
          return;
        }
        setPaths(availablePaths);
        setPlan(currentPlan);
        setSelectedPathId(currentPlan?.path.id ?? availablePaths[0]?.id ?? "");
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Não foi possível carregar as trilhas.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function choosePath(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body = await parseResponse(await fetch("/api/v1/my-learning-plan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathId: selectedPathId })
      }));
      if (typeof body !== "object" || body === null || !("plan" in body)) {
        throw new Error("A API retornou um plano inválido.");
      }
      setPlan(learningPlanSchema.parse(body.plan));
      setNotice("Objetivo definido. Você pode pausar ou trocar de trilha quando quiser.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível selecionar esta trilha.");
    } finally {
      setBusy(false);
    }
  }

  async function updateStage(stageId: string, status: "in_progress" | "studied"): Promise<void> {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body = await parseResponse(await fetch(
        `/api/v1/my-learning-plan/stages/${encodeURIComponent(stageId)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status })
        }
      ));
      if (typeof body !== "object" || body === null || !("plan" in body)) {
        throw new Error("A API retornou um plano inválido.");
      }
      setPlan(learningPlanSchema.parse(body.plan));
      setNotice(status === "studied"
        ? "Etapa registrada como estudada. Isso ainda não é uma avaliação de competência."
        : "Etapa iniciada. A próxima recomendação será atualizada conforme seu progresso.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar seu progresso.");
    } finally {
      setBusy(false);
    }
  }

  const activePathIsSelected = plan?.path.id === selectedPathId && plan.status !== "paused";

  return (
    <section className="learning-path-panel" aria-labelledby="learning-path-title">
      <div className="learning-path-heading">
        <div>
          <p className="eyebrow">DIREÇÃO PERSONALIZADA</p>
          <h3 id="learning-path-title">Sua trilha recomendada</h3>
          <p>
            Escolha um objetivo. A sequência mostra o que vem a seguir, por que
            essa etapa importa e qual prática pode ajudar a aprender.
          </p>
        </div>
        {plan && (
          <div className="progress-ring" aria-label={`${plan.progressPercent}% das etapas marcadas como estudadas`}>
            <strong>{plan.progressPercent}%</strong>
            <span>estudado</span>
          </div>
        )}
      </div>

      {loading ? (
        <p className="learning-empty">Carregando trilhas...</p>
      ) : paths.length === 0 ? (
        <p className="learning-empty">Ainda não há trilhas publicadas.</p>
      ) : (
        <>
          <form className="path-selector" onSubmit={(event) => void choosePath(event)}>
            <label htmlFor="learning-path-choice">Objetivo de estudo</label>
            <select
              id="learning-path-choice"
              value={selectedPathId}
              onChange={(event) => setSelectedPathId(event.target.value)}
              disabled={busy}
            >
              {paths.map((path) => (
                <option key={path.id} value={path.id}>{path.targetRole} — {path.title}</option>
              ))}
            </select>
            <button className="primary-link" type="submit" disabled={busy || activePathIsSelected}>
              {busy ? "Salvando..." : activePathIsSelected ? "Objetivo atual" : "Seguir esta trilha"}
            </button>
          </form>

          {plan ? (
            <div className="active-learning-plan">
              <div className="plan-summary">
                <div>
                  <span className="card-label">OBJETIVO</span>
                  <h4>{plan.path.title}</h4>
                  <p>{plan.path.outcome}</p>
                </div>
                <span className={`plan-status plan-status-${plan.status}`}>
                  {plan.status === "completed" ? "Etapas concluídas" : plan.status === "paused" ? "Pausada" : "Em andamento"}
                </span>
              </div>

              <div className="progress-track" aria-label={`${plan.completedStages} de ${plan.totalStages} etapas marcadas como estudadas`}>
                <span style={{ width: `${plan.progressPercent}%` }} />
              </div>
              <p className="progress-caption">
                {plan.completedStages} de {plan.totalStages} etapas marcadas como estudadas
                <span> · estimativa total: {Math.ceil(plan.path.estimatedMinutes / 60)} h</span>
              </p>

              <div className="next-recommendation">
                <span className="recommendation-kicker">
                  {plan.nextStageId ? "PRÓXIMO PASSO RECOMENDADO" : "TRILHA CONCLUÍDA"}
                </span>
                <p>{plan.recommendationReason}</p>
              </div>

              <ol className="learning-stages">
                {plan.path.stages.map((stage) => {
                  const isNext = plan.nextStageId === stage.id;
                  return (
                    <li className={`learning-stage learning-stage-${stage.status}${isNext ? " learning-stage-next" : ""}`} key={stage.id}>
                      <div className="stage-marker" aria-hidden="true">
                        {stage.status === "studied" ? "✓" : String(stage.position).padStart(2, "0")}
                      </div>
                      <div className="stage-content">
                        <div className="stage-title-row">
                          <h5>{stage.competency.title}</h5>
                          <span>{stage.status === "studied" ? "Estudada por você" : stage.status === "in_progress" ? "Em andamento" : "Próxima etapa"}</span>
                        </div>
                        <p>{stage.whyThisStep}</p>
                        <div className="practice-task">
                          <strong>Prática sugerida</strong>
                          <span>{stage.practiceTask}</span>
                        </div>
                        <div className="stage-actions">
                          <span>~{Math.max(1, Math.round(stage.estimatedMinutes / 60))} h</span>
                          {stage.resourceTitle && stage.resourceUrl && (
                            <a href={stage.resourceUrl} target="_blank" rel="noreferrer">{stage.resourceTitle}</a>
                          )}
                          {isNext && stage.status === "not_started" && (
                            <button type="button" onClick={() => void updateStage(stage.id, "in_progress")} disabled={busy}>
                              Começar etapa
                            </button>
                          )}
                          {isNext && stage.status === "in_progress" && (
                            <button type="button" onClick={() => void updateStage(stage.id, "studied")} disabled={busy}>
                              Marcar como estudada
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>

              <p className="learning-disclaimer">
                Progresso baseado nas etapas que você marcou como estudadas. Isso
                não comprova domínio da competência, não mede qualidade só por
                horas e não garante emprego ou resultado profissional.
              </p>
            </div>
          ) : (
            <p className="learning-empty">
              Selecione um objetivo para ver a sequência recomendada, as práticas
              sugeridas e a estimativa de dedicação.
            </p>
          )}
        </>
      )}

      {error && <p className="learning-feedback learning-feedback-error" role="alert">{error}</p>}
      {notice && <p className="learning-feedback" role="status">{notice}</p>}
    </section>
  );
}

export default LearningPathPanel;
