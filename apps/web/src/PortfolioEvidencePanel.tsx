import { useEffect, useState, type FormEvent } from "react";
import {
  portfolioEvidenceSchema,
  type PortfolioEvidence
} from "@platform/shared";

async function readResponse(response: Response): Promise<unknown> {
  let body: unknown;
  try {
    body = response.status === 204 ? null : await response.json();
  } catch {
    throw new Error("A API está indisponível ou retornou uma resposta inválida.");
  }
  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
      ? body.error
      : "Não foi possível atualizar seu portfólio.";
    throw new Error(message);
  }
  return body;
}

function parseEvidenceList(body: unknown): PortfolioEvidence[] {
  if (typeof body !== "object" || body === null || !("evidence" in body) || !Array.isArray(body.evidence)) {
    throw new Error("A API retornou uma lista de evidências inválida.");
  }
  return body.evidence.map((item: unknown) => portfolioEvidenceSchema.parse(item));
}

function PortfolioEvidencePanel() {
  const [evidence, setEvidence] = useState<PortfolioEvidence[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/my/evidence", { credentials: "include" })
      .then(readResponse)
      .then(parseEvidenceList)
      .then((items) => {
        if (!cancelled) {
          setEvidence(items);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Não foi possível carregar seu portfólio.");
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

  async function addEvidence(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body = await readResponse(await fetch("/api/v1/my/evidence", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          url: url.trim() || null
        })
      }));
      if (typeof body !== "object" || body === null || !("evidence" in body)) {
        throw new Error("A API retornou uma evidência inválida.");
      }
      const created = portfolioEvidenceSchema.parse(body.evidence);
      setEvidence((current) => [created, ...current]);
      setTitle("");
      setDescription("");
      setUrl("");
      setNotice("Evidência adicionada ao seu portfólio privado.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a evidência.");
    } finally {
      setBusy(false);
    }
  }

  async function removeEvidence(id: string): Promise<void> {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await readResponse(await fetch(`/api/v1/my/evidence/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include"
      }));
      setEvidence((current) => current.filter((item) => item.id !== id));
      setNotice("Evidência removida do seu portfólio.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível remover a evidência.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="portfolio-panel" aria-labelledby="portfolio-title">
      <div className="portfolio-heading">
        <div>
          <p className="eyebrow">PORTFÓLIO PRIVADO</p>
          <h3 id="portfolio-title">Minhas evidências</h3>
          <p>Registre práticas e projetos que você quer documentar. Você controla o que mantém aqui.</p>
        </div>
        <span className="portfolio-count">{evidence.length} {evidence.length === 1 ? "registro" : "registros"}</span>
      </div>

      <form className="profile-form evidence-form" onSubmit={(event) => void addEvidence(event)}>
        <label>
          Título
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            minLength={3}
            maxLength={120}
            autoComplete="off"
          />
        </label>
        <label>
          O que você fez e o que aprendeu?
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            minLength={20}
            maxLength={4000}
            rows={4}
          />
        </label>
        <label>
          Link público (opcional)
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            maxLength={2048}
            placeholder="https://"
          />
        </label>
        <p className="evidence-privacy-note">
          Não inclua senhas, tokens, dados pessoais sensíveis, código confidencial
          ou materiais de terceiros. O registro é autorrelatado, não revisado.
        </p>
        <button className="primary-link" type="submit" disabled={busy}>
          {busy ? "Salvando..." : "Adicionar evidência"}
        </button>
      </form>

      {loading ? (
        <p className="learning-empty">Carregando seu portfólio...</p>
      ) : evidence.length === 0 ? (
        <p className="learning-empty">Seus registros privados aparecerão aqui.</p>
      ) : (
        <ul className="evidence-list">
          {evidence.map((item) => (
            <li key={item.id} className="evidence-item">
              <div>
                <span className="evidence-status">AUTORRELATADA</span>
                <h4>{item.title}</h4>
                <p>{item.description}</p>
                <time dateTime={item.createdAt}>
                  {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(item.createdAt))}
                </time>
                {item.url && (
                  <a href={item.url} target="_blank" rel="noreferrer">
                    Abrir material vinculado
                  </a>
                )}
              </div>
              <button
                type="button"
                className="text-button"
                onClick={() => void removeEvidence(item.id)}
                disabled={busy}
                aria-label={`Remover ${item.title}`}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="learning-feedback learning-feedback-error" role="alert">{error}</p>}
      {notice && <p className="learning-feedback" role="status">{notice}</p>}
    </section>
  );
}

export default PortfolioEvidencePanel;
