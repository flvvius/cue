import { SignInButton, UserButton, useAuth, useUser } from "@clerk/tanstack-react-start";
import { api } from "@cue/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  const { isLoaded, isSignedIn } = useAuth();
  const privateData = useQuery(api.privateData.get);
  const user = useUser();

  if (!isLoaded) {
    return <div className="px-5 py-10 text-muted-foreground">Loading...</div>;
  }

  if (!isSignedIn) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 items-center px-5 py-10">
        <section className="w-full rounded-4xl border border-border bg-card p-8">
          <p className="text-sm uppercase tracking-[0.28em] text-accent">Dashboard</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground">
            Sign in to see your private focus state.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            This area will hold session summaries, AI nudges, and habit patterns once the product modules land.
          </p>
          <div className="mt-8">
            <SignInButton />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 px-5 py-10">
      <div className="grid w-full gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-4xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/10 p-8">
          <p className="text-sm uppercase tracking-[0.28em] text-accent">Dashboard</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground">
            Welcome back{user.user?.firstName ? `, ${user.user.firstName}` : ""}.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            The roadmap’s calmer design system is now the default baseline for new surfaces in Cue.
          </p>
          <div className="mt-8 rounded-3xl border border-border bg-background/60 p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Private status</p>
            <p className="mt-3 text-lg font-medium text-foreground">
              {privateData?.message ?? "Loading private data..."}
            </p>
          </div>
        </section>
        <section className="rounded-4xl border border-border bg-card p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Session</p>
              <p className="mt-3 text-xl font-semibold text-foreground">
                {user.user?.primaryEmailAddress?.emailAddress ?? "Signed in"}
              </p>
            </div>
            <UserButton />
          </div>
          <div className="mt-8 space-y-3">
            <div className="rounded-2xl border border-border bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">Visual tone</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Slate 950 base, indigo action states, amber for positive nudges, and softer 16px card radii.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">Typography</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Inter across web and native, with larger numerals and calmer spacing for timers and status cards.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
