import { Mail, Linkedin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { countryName } from "@/lib/countries";
import { HOME_COUNTRY, ICP_LABELS, LIFE_CONTEXT_TAG_LABELS } from "@/lib/intake-tree";
import type { PublicMatch } from "@/lib/intake.functions";

const VAGUE_EXPERTISE = ["entrepreneur", "entrepreneurship", "founder", "business owner"];

function expertiseLabel(value: string | null) {
  if (!value) return null;
  return VAGUE_EXPERTISE.includes(value.trim().toLowerCase()) ? null : value;
}

function linkedinHref(value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("linkedin.com") || trimmed.startsWith("www.")) return `https://${trimmed}`;
  return `https://www.linkedin.com/in/${trimmed.replace(/^\/+|^in\//g, "")}`;
}

export function MatchCard({ match, rank }: { match: PublicMatch; rank: number }) {
  const countries = match.countries.filter((code) => code !== HOME_COUNTRY);

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Introduction {rank}
        </p>
        <h3 className="font-display text-2xl leading-tight text-foreground">
          {match.displayName}
        </h3>
        <p className="text-sm text-muted-foreground">
          {[match.roleLabel, expertiseLabel(match.expertise), ICP_LABELS[match.icp] ?? match.icp]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      <p className="mt-3 text-sm text-foreground">{match.headline}</p>

      {match.reasons.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm text-foreground">
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
        {match.interests.slice(0, 4).map((interest) => (
          <Badge key={interest} variant="outline">
            {interest}
          </Badge>
        ))}
        {match.lifeContext.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="outline">
            {LIFE_CONTEXT_TAG_LABELS[tag] ?? tag}
          </Badge>
        ))}
        {countries.slice(0, 3).map((code) => (
          <Badge key={code} variant="outline">
            {countryName(code)}
          </Badge>
        ))}
      </div>

      {(match.email || match.linkedin) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {match.email && (
            <a
              href={`mailto:${match.email}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Mail aria-hidden className="size-3.5" />
              {match.email}
            </a>
          )}
          {match.linkedin && (
            <a
              href={linkedinHref(match.linkedin)}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Linkedin aria-hidden className="size-3.5" />
              LinkedIn
            </a>
          )}
        </div>
      )}
    </article>
  );
}
