import { useEffect, useState, type FormEvent } from "react";
import {
  challengeAttemptSchema,
  challengeSchema,
  type Challenge,
  type ChallengeAttempt
} from "@platform/shared";

async function readResponse(response: Response): Promise<unknown> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("A API está indisponível ou retornou uma resposta inválida.");
  }
  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
      ? body.error
      : "Não foi possível atualizar seus desafios.";
    throw new Error(message);
  }
  return body;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readItems<T>(body: unknown, key: string, parse: (item: unknown) => T): T[] {
  if (!isRecord(body) || !Array.isArray(body[key])) {
    throw new Error("A API retornou uma lista inválida.");
  }
  return body[key].map(parse);
}

function ChallengesPanel() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [attempts, setAttempts] = useState<ChallengeAttempt[]>([]);
  const [selected, setSelected] = useState<ChallengeAttempt | null>(null);
  const [approach, setApproach] = useState("");
  const [submissionUrl, setSubmissionUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/v1/challenges").then(readResponse)
        .then((body) => readItems(body, "challenges", (item) => challengeSchema.parse(item))),
      fetch("/api/v1/my/challenge-attempts", { credentials: "include" }).then(readResponse)
        .then((body) => readItems(body, "attempts", (item) => challengeAttemptSchema.parse(item)))
    ])
      .then(([available, current]) => {
        if (!cancelled) {
          setChallenges(available);
          setAttempts(current);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Não foi possível carregar os desafios.");
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

  function selectAttempt(attempt: ChallengeAttempt): void {
    setSelected(attempt);
    setApproach(attempt.approach ?? "");
    setSubmissionUrl(attempt.submissionUrl ?? "");
    setError("");
    setNotice("");
  }

  async function startChallenge(challengeId: string): Promise<void> {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body = await readResponse(await fetch(
        `/api/v1/challenges/${encodeURIComponent(challengeId)}/attempts`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: "{}"
        }
      ));
      if (typeof body !== "object" || body === null || !("attempt" in body)) {
        throw new Error("A API retornou uma tentativa inválida.");
      }
      const attempt = challengeAttemptSchema.parse(body.attempt);
      setAttempts((current) => [attempt, ...current.filter((item) => item.id !== attempt.id)]);
      selectAttempt(attempt);
      setNotice("Desafio iniciado. Os critérios ficam disponíveis antes da entrega.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível iniciar o desafio.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selected) {
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/v1/my/challenge-attempts/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approach, submissionUrl: submissionUrl.trim() || null })
      });
      const body = await readResponse(response);
      if (typeof body !== "object" || body === null || !("attempt" in body)) {
        throw new Error("A API retornou uma tentativa inválida.");
      }
      const attempt = challengeAttemptSchema.parse(body.attempt);
      setSelected(attempt);
      setAttempts((current) => current.map((item) => item.id === attempt.id ? attempt : item));
      setNotice("Rascunho salvo. Ele permanece privado.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o rascunho.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAttempt(): Promise<void> {
    if (!selected) {
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const draftResponse = await fetch(`/api/v1/my/challenge-attempts/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approach, submissionUrl: submissionUrl.trim() || null })
      });
      await readResponse(draftResponse);
      const response = await fetch(`/api/v1/my/challenge-attempts/${encodeURIComponent(selected.id)}/submit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      const body = await readResponse(response);
      if (typeof body !== "object" || body === null || !("attempt" in body)) {
        throw new Error("A API retornou uma tentativa inválida.");
      }
      const attempt = challengeAttemptSchema.parse(body.attempt);
      setSelected(attempt);
      setAttempts((current) => current.map((item) => item.id === attempt.id ? attempt : item));
      setNotice("Entrega enviada. A avaliação por um avaliador ainda não está disponível.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar a entrega.");
    } finally {
      setBusy(false);
    }
  }

  const selectedChallenge = challenges.find((challenge) => challenge.id === selected?.challengeId);

  return (
    <section className="challenge-panel" aria-labelledby="challenge-panel-title">
      <div className="portfolio-heading">
        <div>
          <p className="eyebrow">PRÁTICA ORIENTADA</p>
          <h3 id="challenge-panel-title">Desafios disponíveis</h3>
          <p>Consulte os critérios antes de começar. Rascunhos e entregas ficam privados nesta versão.</p>
        </div>
        <span className="portfolio-count">{attempts.length} {attempts.length === 1 ? "tentativa" : "tentativas"}</span>
      </div>

      {loading ? (
        <p className="learning-empty">Carregando desafios...</p>
      ) : challenges.length === 0 ? (
        <p className="learning-empty">Ainda não há desafios publicados.</p>
      ) : (
        <ul className="challenge-list">
          {challenges.map((challenge) => {
            const attempt = attempts.find((item) => item.challengeId === challenge.id);
            return (
              <li className="challenge-item" key={challenge.id}>
                <div>
                  <span className="evidence-status">{challenge.difficulty} · versão {challenge.version}</span>
                  <h4>{challenge.title}</h4>
                  <p>{challenge.context}</p>
                  <p>{challenge.description}</p>
                  <p className="challenge-estimate">Estimativa: {challenge.estimatedMinutes} minutos</p>
                  <h5>Critérios de aceitação</h5>
                  <ul>{challenge.acceptanceCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
                  <h5>Critérios de avaliação previstos</h5>
                  <ul>{challenge.rubricCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
                </div>
                <button
                  className="primary-link"
                  type="button"
                  onClick={() => attempt ? selectAttempt(attempt) : void startChallenge(challenge.id)}
                  disabled={busy}
                >
                  {attempt ? attempt.status === "submitted" ? "Ver entrega enviada" : "Continuar rascunho" : "Iniciar desafio"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <div className="challenge-submission">
          <h4>{selected.challengeTitle} — {selected.status === "submitted" ? "Enviado" : "Sua entrega"}</h4>
          {selectedChallenge && <p>Critérios vinculados à versão {selected.challengeVersion}; a rubrica desta tentativa não muda retroativamente.</p>}
          {selected.status === "in_progress" ? (
            <form className="profile-form evidence-form" onSubmit={(event) => void saveDraft(event)}>
              <label>
                Abordagem, decisões e limitações
                <textarea
                  value={approach}
                  onChange={(event) => setApproach(event.target.value)}
                  required
                  minLength={20}
                  maxLength={6000}
                  rows={5}
                />
              </label>
              <label>
                Link público opcional
                <input
                  type="url"
                  value={submissionUrl}
                  onChange={(event) => setSubmissionUrl(event.target.value)}
                  maxLength={2048}
                  placeholder="https://"
                />
              </label>
              <div className="challenge-actions">
                <button className="primary-link" type="submit" disabled={busy}>
                  {busy ? "Salvando..." : "Salvar rascunho"}
                </button>
                <button className="text-button" type="button" onClick={() => void submitAttempt()} disabled={busy || approach.trim().length < 20}>
                  Enviar entrega
                </button>
              </div>
            </form>
          ) : (
            <>
              <p>{selected.approach}</p>
              {selected.submissionUrl && <a href={selected.submissionUrl} target="_blank" rel="noreferrer">Abrir link enviado</a>}
              <p>Esta entrega ainda não foi avaliada.</p>
            </>
          )}
        </div>
      )}

      {error && <p className="learning-feedback learning-feedback-error" role="alert">{error}</p>}
      {notice && <p className="learning-feedback" role="status">{notice}</p>}
    </section>
  );
}

export default ChallengesPanel;
