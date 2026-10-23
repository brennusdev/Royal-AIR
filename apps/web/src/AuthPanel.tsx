import { useEffect, useState, type FormEvent } from "react";
import { accountSummarySchema, type AccountSummary } from "@platform/shared";

type FormMode = "login" | "register" | "forgot" | "reset";

async function request(
  path: string,
  payload?: Record<string, unknown>
): Promise<unknown> {
  const init: RequestInit = {
    method: payload ? "POST" : "GET",
    credentials: "include"
  };
  if (payload) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(payload);
  }
  const response = await fetch(path, init);
  const result = await readJson(response);
  if (!response.ok) {
    if (typeof result === "object" && result !== null && "error" in result && typeof result.error === "string") {
      throw new Error(result.error);
    }
    throw new Error("Não foi possível concluir a solicitação.");
  }
  return result;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(`A API está indisponível (HTTP ${response.status}).`);
    }
    throw new Error("A API retornou uma resposta inválida.");
  }
}

function getUser(result: unknown): AccountSummary {
  if (typeof result !== "object" || result === null || !("user" in result)) {
    throw new Error("A resposta da API não contém o perfil esperado.");
  }
  return accountSummarySchema.parse(result.user);
}

function getMessage(result: unknown): string {
  if (typeof result === "object" && result !== null && "message" in result && typeof result.message === "string") {
    return result.message;
  }
  return "Solicitação concluída.";
}

function AuthPanel() {
  const [mode, setMode] = useState<FormMode>("login");
  const [user, setUser] = useState<AccountSummary | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [headline, setHeadline] = useState("");
  const [region, setRegion] = useState("");

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const action = parameters.get("action");
    const token = parameters.get("token");
    if (action === "verify" && token) {
      window.history.replaceState({}, "", window.location.pathname);
      setBusy(true);
      request("/api/v1/auth/verify-email", { token })
        .then((result) => setMessage(getMessage(result)))
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Não foi possível confirmar o e-mail."))
        .finally(() => setBusy(false));
    } else if (action === "reset-password" && token) {
      setMode("reset");
      setResetToken(token);
      window.history.replaceState({}, "", window.location.pathname);
    }

    request("/api/v1/auth/me")
      .then((result) => setUser(getUser(result)))
      .catch((error: unknown) => {
        if (error instanceof Error && error.message !== "Authentication required.") {
          setMessage(error.message);
        }
      });
  }, []);

  useEffect(() => {
    setHeadline(user?.profile?.headline ?? "");
    setRegion(user?.profile?.region ?? "");
  }, [user]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "");
    const password = String(values.get("password") ?? "");

    try {
      if (mode === "register") {
        const result = await request("/api/v1/auth/register", {
          email,
          displayName: String(values.get("displayName") ?? ""),
          password,
          acceptedTerms: values.get("acceptedTerms") === "on",
          acceptedPrivacy: values.get("acceptedPrivacy") === "on"
        });
        setMessage(getMessage(result));
      } else if (mode === "login") {
        const result = await request("/api/v1/auth/login", { email, password });
        setUser(getUser(result));
        setMessage("Login realizado.");
      } else if (mode === "forgot") {
        const result = await request("/api/v1/auth/password/forgot", { email });
        setMessage(getMessage(result));
      } else {
        const result = await request("/api/v1/auth/password/reset", {
          token: resetToken,
          password
        });
        setMessage(getMessage(result));
        setMode("login");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível concluir a solicitação.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await fetch("/api/v1/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: headline || null,
          region: region || null
        })
      });
      const body = await readJson(result);
      if (!result.ok) {
        if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
          throw new Error(body.error);
        }
        throw new Error("Não foi possível salvar o perfil.");
      }
      setUser(getUser(body));
      setMessage("Perfil atualizado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar o perfil.");
    } finally {
      setBusy(false);
    }
  }

  async function logout(): Promise<void> {
    setBusy(true);
    try {
      const response = await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Não foi possível encerrar a sessão.");
      }
      setUser(null);
      setMode("login");
      setMessage("Sessão encerrada.");
    } catch {
      setMessage("Não foi possível encerrar a sessão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="account-section" id="conta">
      <div className="account-intro">
        <p className="eyebrow">SUA CONTA</p>
        <h2>Um espaço pessoal, com privacidade por padrão.</h2>
        <p>
          O perfil começa privado. Nesta etapa, a conta registra apenas dados
          básicos e suas preferências; trilhas, desafios e avaliações ainda
          serão adicionados nas próximas fases.
        </p>
      </div>

      <div className="account-card">
        {user ? (
          <>
            <div className="account-card-heading">
              <div>
                <span className="card-label">CONTA ATIVA</span>
                <h3>Olá, {user.displayName}</h3>
              </div>
              <button className="text-button" type="button" onClick={() => void logout()} disabled={busy}>
                Sair
              </button>
            </div>
            <p className="account-email">{user.email} · {user.roles.join(", ")}</p>
            <form className="profile-form" onSubmit={(event) => void saveProfile(event)}>
              <label>
                Resumo profissional
                <input value={headline} onChange={(event) => setHeadline(event.target.value)} maxLength={240} />
              </label>
              <label>
                Região ampla (opcional)
                <input value={region} onChange={(event) => setRegion(event.target.value)} maxLength={100} />
              </label>
              <button className="primary-link" type="submit" disabled={busy}>Salvar perfil</button>
            </form>
          </>
        ) : (
          <>
            <div className="auth-tabs" role="tablist" aria-label="Acesso à conta">
              <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")}>
                Entrar
              </button>
              <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => setMode("register")}>
                Criar conta
              </button>
            </div>
            <h3>
              {mode === "login" && "Acesse seu espaço"}
              {mode === "register" && "Comece pelo seu perfil"}
              {mode === "forgot" && "Recupere o acesso"}
              {mode === "reset" && "Defina uma nova senha"}
            </h3>
            <form className="profile-form" onSubmit={(event) => void submit(event)}>
              {mode !== "reset" && (
                <label>
                  E-mail
                  <input name="email" type="email" autoComplete="email" required maxLength={254} />
                </label>
              )}
              {mode === "register" && (
                <label>
                  Nome de exibição
                  <input name="displayName" autoComplete="name" required minLength={2} maxLength={80} />
                </label>
              )}
              {mode !== "forgot" && (
                <label>
                  {mode === "reset" ? "Nova senha" : "Senha"}
                  <input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={12} maxLength={128} />
                </label>
              )}
              {mode === "register" && (
                <div className="consent-fields">
                  <label className="checkbox-label">
                    <input name="acceptedTerms" type="checkbox" required />
                    <span>Confirmo que li os <a href="/terms-draft-v1.html" target="_blank" rel="noreferrer">termos em elaboração</a>.</span>
                  </label>
                  <label className="checkbox-label">
                    <input name="acceptedPrivacy" type="checkbox" required />
                    <span>Confirmo que li o <a href="/privacy-draft-v1.html" target="_blank" rel="noreferrer">aviso de privacidade em elaboração</a>.</span>
                  </label>
                  <p>Os textos legais finais ainda precisam de revisão antes de qualquer uso real.</p>
                </div>
              )}
              <button className="primary-link" type="submit" disabled={busy}>
                {busy ? "Aguarde..." : mode === "register" ? "Criar conta" : mode === "login" ? "Entrar" : mode === "forgot" ? "Enviar instruções" : "Atualizar senha"}
              </button>
            </form>
            {mode === "login" && (
              <button className="text-button recovery-link" type="button" onClick={() => setMode("forgot")}>
                Esqueci minha senha
              </button>
            )}
            {(mode === "forgot" || mode === "reset") && (
              <button className="text-button recovery-link" type="button" onClick={() => setMode("login")}>
                Voltar para entrar
              </button>
            )}
          </>
        )}
        <p className="auth-message" aria-live="polite">{message}</p>
      </div>
    </section>
  );
}

export default AuthPanel;
