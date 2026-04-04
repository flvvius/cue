import { env } from "@cue/env/web";
import { createFileRoute } from "@tanstack/react-router";
import React from "react";

export const Route = createFileRoute("/demo/")({
  component: DemoIndexRoute,
});

function DemoIndexRoute() {
  const [isCreating, setIsCreating] = React.useState(false);
  const [sessionCode, setSessionCode] = React.useState<string | null>(null);
  const [sessionUrl, setSessionUrl] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleCreateSession = React.useCallback(async () => {
    if (isCreating) {
      return;
    }

    setIsCreating(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${env.VITE_CONVEX_SITE_URL}/demo/session/create`, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Unable to create demo session");
      }

      const nextUrl = `${window.location.origin}/demo/${payload.code}`;
      setSessionCode(payload.code);
      setSessionUrl(nextUrl);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to create demo session");
    } finally {
      setIsCreating(false);
    }
  }, [isCreating]);

  const qrUrl = sessionUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(sessionUrl)}`
    : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 px-5 py-10">
      <div className="grid w-full gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-4xl border border-primary/25 bg-gradient-to-br from-primary/18 via-card to-background p-8 shadow-[0_30px_100px_-40px_rgba(99,102,241,0.55)]">
          <p className="text-sm uppercase tracking-[0.28em] text-accent">Live Demo</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight text-foreground">
            Start a web companion session for your audience.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            Generate a short code and QR link that people can scan from their phones to answer a few quick questions.
          </p>
          <div className="mt-8">
            <button
              type="button"
              onClick={() => void handleCreateSession()}
              disabled={isCreating}
              className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isCreating ? "Creating session..." : "Create demo session"}
            </button>
          </div>
          {errorMessage ? (
            <p className="mt-4 text-sm text-destructive">{errorMessage}</p>
          ) : null}
        </section>

        <section className="rounded-4xl border border-border bg-card p-8">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Session output
          </p>
          {sessionCode && sessionUrl ? (
            <>
              <div className="mt-5 rounded-3xl border border-primary/20 bg-primary/10 p-6">
                <p className="text-sm text-muted-foreground">Audience code</p>
                <p className="mt-3 text-5xl font-semibold tracking-[0.24em] text-foreground">
                  {sessionCode}
                </p>
              </div>
              <div className="mt-5 flex flex-col items-center rounded-3xl border border-border bg-background px-6 py-6">
                {qrUrl ? (
                  <img
                    src={qrUrl}
                    alt={`QR code for demo session ${sessionCode}`}
                    className="h-[220px] w-[220px] rounded-2xl border border-border bg-white p-3"
                  />
                ) : null}
                <a
                  href={sessionUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 break-all text-center text-sm text-primary underline-offset-4 hover:underline"
                >
                  {sessionUrl}
                </a>
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-3xl border border-dashed border-border bg-background p-6">
              <p className="text-sm leading-7 text-muted-foreground">
                No session yet. Create one and this panel will show the audience code, QR, and direct link.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
