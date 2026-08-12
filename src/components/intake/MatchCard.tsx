import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ICP_LABELS, LIFE_CONTEXT_TAG_LABELS, COUNTRY_OPTIONS } from "@/lib/intake-tree";
import type { PublicMatch } from "@/lib/intake.functions";

const COUNTRY_NAMES = new Map(COUNTRY_OPTIONS.map((entry) => [entry.code, entry.label]));

export function MatchCard({ match, rank }: { match: PublicMatch; rank: number }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Match {rank}
          </p>
          <h3 className="font-display text-2xl leading-tight text-foreground">
            {match.displayName}
          </h3>
          <p className="text-sm text-muted-foreground">
            {ICP_LABELS[match.icp] ?? match.icp}
            {match.roleLabel ? ` · ${match.roleLabel}` : ""}
            {match.age ? ` · ${match.age}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl leading-none text-primary">{match.score}</p>
          <p className="text-xs text-muted-foreground">{match.band}</p>
        </div>
      </header>

      {match.reasons.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm text-foreground">
          {match.reasons.slice(0, 4).map((reason) => (
            <li key={reason} className="flex gap-2">
              <span aria-hidden className="text-primary">
                •
              </span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {match.expertise && <Badge variant="secondary">{match.expertise}</Badge>}
        {match.interests.slice(0, 3).map((interest) => (
          <Badge key={interest} variant="outline">
            {interest}
          </Badge>
        ))}
        {match.lifeContext.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="outline">
            {LIFE_CONTEXT_TAG_LABELS[tag] ?? tag}
          </Badge>
        ))}
        {match.countries.slice(0, 3).map((code) => (
          <Badge key={code} variant="outline">
            {COUNTRY_NAMES.get(code) ?? code}
          </Badge>
        ))}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="mt-3 -ml-2 text-xs"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {open ? "Hide scoring" : "How this was scored"}
      </Button>

      {open && (
        <div className="mt-2 space-y-3 rounded-xl bg-secondary/60 p-4 text-xs">
          <p className="text-muted-foreground">
            {match.route === "A"
              ? "Full-profile pool (includes stage answers)."
              : "Membership database pool — no stage answer on file, so that weight is redistributed."}
            {" "}
            Filters used: {match.filterStep}.
            {match.hobbyOnly ? " Life-stage category was dropped to find anyone compatible." : ""}
          </p>
          {match.breakdown.map((part) => (
            <div key={part.label}>
              <div className="mb-1 flex justify-between">
                <span>{part.label}</span>
                <span className="text-muted-foreground">
                  {Math.round(part.score * 100)}% · weight {part.weight}%
                </span>
              </div>
              <Progress value={part.score * 100} className="h-1.5" />
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
