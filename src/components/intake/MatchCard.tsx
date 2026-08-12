import { Badge } from "@/components/ui/badge";
import { countryName } from "@/lib/countries";
import { HOME_COUNTRY, ICP_LABELS, LIFE_CONTEXT_TAG_LABELS } from "@/lib/intake-tree";
import type { PublicMatch } from "@/lib/intake.functions";

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
          {[match.roleLabel, match.expertise, ICP_LABELS[match.icp] ?? match.icp]
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
    </article>
  );
}
