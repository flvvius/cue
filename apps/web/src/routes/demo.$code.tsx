import { env } from "@cue/env/web";
import { createFileRoute } from "@tanstack/react-router";
import React from "react";

const QUESTIONS = [
  {
    key: "time_waster",
    label: "Which app eats the most of your attention?",
    options: ["Instagram", "TikTok", "YouTube", "Reddit", "X", "WhatsApp"],
  },
  {
    key: "screen_time",
    label: "How much screen time do you think you average per day?",
    options: ["Under 2h", "2-4h", "4-6h", "6-8h", "8h+"],
  },
  {
    key: "what_tried",
    label: "What have you already tried?",
    options: ["App timers", "Focus mode", "Deleting apps", "Gray scale", "Nothing yet"],
  },
  {
    key: "wish_instead",
    label: "What do you wish you did instead?",
    options: ["Read", "Workout", "Sleep", "Study", "Call friends", "Go outside"],
  },
] as const;

export const Route = createFileRoute("/demo/$code")({
  component: DemoAudienceRoute,
});

function DemoAudienceRoute() {
  const { code } = Route.useParams();
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const canSubmit = QUESTIONS.every((question) => answers[question.key]);

  const handleSubmit = React.useCallback(async () => {
    if (!canSubmit || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`${env.VITE_CONVEX_SITE_URL}/demo/respond`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          code,
          answers: QUESTIONS.map((question) => ({
            question: question.label,
            answer: answers[question.key],
          })),
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Unable to submit response");
      }

      setIsSubmitted(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to submit response");
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, canSubmit, code, isSubmitting]);

  if (isSubmitted) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 px-5 py-10">
        <section className="w-full rounded-4xl border border-primary/25 bg-gradient-to-br from-primary/18 via-card to-background p-8 text-center shadow-[0_30px_100px_-40px_rgba(99,102,241,0.55)]">
          <p className="text-sm uppercase tracking-[0.28em] text-accent">Cue Demo</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground">
            Thanks for sharing.
          </h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">
            Your response is in. The presenter dashboard can pick it up in real time once the live aggregate view is wired.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 px-5 py-10">
      <section className="w-full rounded-4xl border border-border bg-card p-8">
        <p className="text-sm uppercase tracking-[0.28em] text-accent">Cue Demo</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground">
          Tell us about your screen time habits.
        </h1>
        <p className="mt-3 text-base leading-8 text-muted-foreground">
          Session code: <span className="font-semibold tracking-[0.2em] text-foreground">{code}</span>
        </p>

        <div className="mt-8 space-y-6">
          {QUESTIONS.map((question) => (
            <div
              key={question.key}
              className="rounded-3xl border border-border bg-background p-5"
            >
              <p className="text-base font-medium text-foreground">{question.label}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {question.options.map((option) => {
                  const isSelected = answers[question.key] === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() =>
                        setAnswers((current) => ({
                          ...current,
                          [question.key]: option,
                        }))
                      }
                      className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {errorMessage ? (
          <p className="mt-5 text-sm text-destructive">{errorMessage}</p>
        ) : null}

        <div className="mt-8">
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || isSubmitting}
            className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Submitting..." : "Submit response"}
          </button>
        </div>
      </section>
    </main>
  );
}
