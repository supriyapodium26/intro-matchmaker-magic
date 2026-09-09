import { Check, Linkedin, MapPin, Send, Sparkles, Users } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { countryName } from "@/lib/countries";
import { HOME_COUNTRY, LIFE_CONTEXT_CHIP_LABELS } from "@/lib/intake-tree";
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

/** One consistent icon per shared-tag type across every card. */
function TagIcon({ type }: { type: PublicMatch["sharedTags"][number]["type"] }) {
  const className = "size-3.5 shrink-0";
  if (type === "lifeContext") return <Users aria-hidden className={className} />;
  if (type === "interests") return <Sparkles aria-hidden className={className} />;
  return <MapPin aria-hidden className={className} />;
}

function sharedTagLabel(tag: PublicMatch["sharedTags"][number]) {
  if (tag.type === "lifeContext") return LIFE_CONTEXT_CHIP_LABELS[tag.value] ?? tag.value;
  if (tag.type === "countries") return countryName(tag.value);
  return tag.value;
}

export function MatchCard({
  match,
  rank,
  tier = "primary",
  expanded = true,
}: {
  match: PublicMatch;
  rank: number;
  tier?: "primary" | "loose" | "wildcard";
  expanded?: boolean;
}) {
  const countries = match.countries.filter((code) => code !== HOME_COUNTRY);
  const expertise = expertiseLabel(match.expertise);
  const firstName = match.displayName.split(" ")[0] ?? match.displayName;
  const [connected, setConnected] = useState(false);

  const sharedLifeContext = new Set(
    match.sharedTags.filter((tag) => tag.type === "lifeContext").map((tag) => tag.value),
  );
  const sharedInterests = new Set(
    match.sharedTags.filter((tag) => tag.type === "interests").map((tag) => tag.value),
  );
  const sharedCountries = new Set(
    match.sharedTags.filter((tag) => tag.type === "countries").map((tag) => tag.value),
  );
  const otherLifeContext = match.lifeContext
    .filter((tag) => !sharedLifeContext.has(tag))
    .slice(0, 4);
  const otherInterests = match.interests
    .filter((interest) => !sharedInterests.has(interest))
    .slice(0, 5);
  const otherCountries = countries.filter((code) => !sharedCountries.has(code)).slice(0, 3);

  if (!expanded) {
    return (
      <article className="rounded-2xl border border-border bg-card p-5 opacity-50 shadow-sm">
        <h3 className="font-display text-2xl leading-tight text-foreground">{match.displayName}</h3>
        <p className="text-sm text-muted-foreground">
          {[expertise, match.companyType].filter(Boolean).join(" · ")}
        </p>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm duration-500 animate-in fade-in">
      <header>
        <h3 className="font-display text-2xl leading-tight text-foreground">{match.displayName}</h3>
        <p className="text-sm text-muted-foreground">
          {[expertise, match.companyType].filter(Boolean).join(" · ")}
        </p>
      </header>

      {match.sharedTags.length > 0 && (
        <div className="mt-3">
          <p className="text-sm text-foreground">
            You have <strong className="font-semibold">{match.sharedTags.length}</strong> things in
            common,
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {match.sharedTags.map((tag, index) => (
              <span
                key={`${tag.type}-${index}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-foreground"
              >
                <TagIcon type={tag.type} />
                {sharedTagLabel(tag)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        {match.stageLabel && (
          <FieldRow label="What she's navigating">
            <div className="flex flex-wrap gap-1.5">
              <Chip>{match.stageLabel}</Chip>
            </div>
          </FieldRow>
        )}
        {otherLifeContext.length > 0 && (
          <FieldRow label="Other parts of her">
            <div className="flex flex-wrap gap-1.5">
              {otherLifeContext.map((tag) => (
                <Chip key={tag}>{LIFE_CONTEXT_CHIP_LABELS[tag] ?? tag}</Chip>
              ))}
            </div>
          </FieldRow>
        )}
        {otherInterests.length > 0 && (
          <FieldRow label="What she's into">
            <div className="flex flex-wrap gap-1.5">
              {otherInterests.map((interest) => (
                <Chip key={interest}>{interest}</Chip>
              ))}
            </div>
          </FieldRow>
        )}
        {otherCountries.length > 0 && (
          <FieldRow label="Countries lived">
            <div className="flex flex-wrap gap-1.5">
              {otherCountries.map((code) => (
                <Chip key={code}>Lived in {countryName(code)}</Chip>
              ))}
            </div>
          </FieldRow>
        )}
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {match.email &&
            (connected ? (
              <span
                aria-disabled="true"
                className="inline-flex h-8 items-center justify-center gap-2 rounded-full bg-primary/85 px-3 text-xs font-medium text-primary-foreground pointer-events-none"
              >
                <Check aria-hidden className="size-3.5" />
                Connected
              </span>
            ) : (
              <Button size="sm" className="rounded-full" onClick={() => setConnected(true)}>
                <Send aria-hidden className="size-3.5" />
                Connect with {firstName}
              </Button>
            ))}
          {match.linkedin && (
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <a href={linkedinHref(match.linkedin)} target="_blank" rel="noreferrer noopener">
                <Linkedin aria-hidden className="size-3.5" />
                LinkedIn
              </a>
            </Button>
          )}
        </div>
        {connected && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            We've connected you both over email. Reply to the thread to keep the conversation going.
          </p>
        )}
      </div>
    </article>
  );
}
