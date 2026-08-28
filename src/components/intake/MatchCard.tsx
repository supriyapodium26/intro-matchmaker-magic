import { ArrowUpRight, Linkedin, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground">
      {children}
    </span>
  );
}

export function MatchCard({
  match,
  rank,
  tier = "primary",
}: {
  match: PublicMatch;
  rank: number;
  tier?: "primary" | "loose" | "wildcard";
}) {
  const countries = match.countries.filter((code) => code !== HOME_COUNTRY);
  const expertise = expertiseLabel(match.expertise);

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <header>
        <p className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          {tier === "primary" ? `Profile ${rank}` : tier === "loose" ? `Tier 2 · looser match` : `Interesting profile`}
          {tier !== "primary" && (
            <Badge variant="secondary" className="normal-case tracking-normal">
              {tier === "loose" ? "Wider net" : "Just for curiosity"}
            </Badge>
          )}
        </p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h3 className="font-display text-2xl leading-tight text-foreground">
            {match.displayName}
          </h3>
          {match.linkedin && (
            <a
              href={linkedinHref(match.linkedin)}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={`${match.displayName} on LinkedIn`}
              className="text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowUpRight aria-hidden className="size-5" />
            </a>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {[match.roleLabel, match.companyType, ICP_LABELS[match.icp] ?? match.icp]
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

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        {match.stageLabel && (
          <FieldRow label="What she's navigating">
            <div className="flex flex-wrap gap-1.5">
              <Chip>{match.stageLabel}</Chip>
            </div>
          </FieldRow>
        )}
        {expertise && (
          <FieldRow label="Area of expertise">
            <div className="flex flex-wrap gap-1.5">
              <Chip>{expertise}</Chip>
            </div>
          </FieldRow>
        )}
        {(match.lifeContext.length > 0 || countries.length > 0) && (
          <FieldRow label="Other parts of her">
            <div className="flex flex-wrap gap-1.5">
              {match.lifeContext.slice(0, 4).map((tag) => (
                <Chip key={tag}>{LIFE_CONTEXT_TAG_LABELS[tag] ?? tag}</Chip>
              ))}
              {countries.slice(0, 3).map((code) => (
                <Chip key={code}>Lived in {countryName(code)}</Chip>
              ))}
            </div>
          </FieldRow>
        )}
        {match.interests.length > 0 && (
          <FieldRow label="What she's into">
            <div className="flex flex-wrap gap-1.5">
              {match.interests.slice(0, 5).map((interest) => (
                <Chip key={interest}>{interest}</Chip>
              ))}
            </div>
          </FieldRow>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        {match.email && (
          <Button asChild size="sm" className="rounded-full">
            <a href={`mailto:${match.email}`}>
              <Send aria-hidden className="size-3.5" />
              Connect with her
            </a>
          </Button>
        )}
        {match.linkedin && (
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <a href={linkedinHref(match.linkedin)} target="_blank" rel="noreferrer noopener">
              <Linkedin aria-hidden className="size-3.5" />
              LinkedIn
            </a>
          </Button>
        )}
      </div>
    </article>
  );
}
