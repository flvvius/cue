import { Link } from "@tanstack/react-router";

export default function Header() {
  const links = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
  ] as const;

  return (
    <header className="border-b border-border/70 bg-card/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-accent">Cue</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Protective limits, calmer nudges.
          </p>
        </div>
        <nav className="flex gap-2 rounded-full border border-border bg-background/80 p-1 text-sm">
          {links.map(({ to, label }) => {
            return (
              <Link
                key={to}
                to={to}
                className="rounded-full px-4 py-2 text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{
                  className: "rounded-full bg-primary text-primary-foreground",
                }}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
