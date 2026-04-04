import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 px-5 py-10">
      <div className="grid w-full gap-6 lg:grid-cols-[1.35fr_0.85fr]">
        <section className="rounded-4xl border border-primary/25 bg-gradient-to-br from-primary/18 via-card to-background p-8 shadow-[0_30px_100px_-40px_rgba(99,102,241,0.55)]">
          <p className="text-sm uppercase tracking-[0.28em] text-accent">Cue Companion</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight text-foreground">
            A calmer interface for reducing screen time without guilt.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            Dark-first, protective by default, and designed to make limits feel like guidance instead of punishment.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <div className="rounded-full border border-primary/30 bg-primary/15 px-4 py-2 text-sm text-foreground">
              Indigo for active focus
            </div>
            <div className="rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-sm text-foreground">
              Amber for positive choices
            </div>
            <div className="rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
              Slate surfaces, low eye strain
            </div>
          </div>
        </section>
        <section className="flex flex-col gap-4">
          <div className="rounded-3xl border border-border bg-card p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              Product stance
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-foreground">
              Limit first. Exclude intentionally.
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              The core experience stays simple: everything is limited by default, and users only choose the apps that should remain untouched.
            </p>
          </div>
          <div className="rounded-3xl border border-accent/25 bg-accent/8 p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-accent">Design baseline</p>
            <p className="mt-3 text-lg font-medium text-foreground">
              Soft radii, cool dark surfaces, warm highlights, and typography that reads clearly under pressure.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
