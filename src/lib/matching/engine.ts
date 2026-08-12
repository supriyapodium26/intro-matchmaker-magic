// Pure matching engine: hard-filter cascade + weighted scoring, per the algorithm doc.

import type { IcpKey } from "@/lib/intake-tree";
import { LIFE_CONTEXT_TAG_LABELS } from "@/lib/intake-tree";
import {
  CHILDFREE_STATUSES,
  COUNTRY_FALLBACK_CAP,
  COUNTRY_TIERS,
  DIMENSION_LABELS,
  FILTER_STEPS,
  PARENT_STATUSES,
  STAGE_MATRIX,
  THRESHOLDS,
  WEIGHTS,
  type Dimension,
} from "./config";

export type Candidate = {
  id: string;
  name: string;
  route: "A" | "B";
  icp: IcpKey;
  age: number | null;
  roleLabel: string | null;
  roleLevel: number | null;
  companyType: string | null;
  companySize: string | null;
  companySizeBand: number | null;
  childStatus: string | null;
  expertise: string | null;
  countries: string[];
  lifeContext: string[];
  interests: string[];
  stageIndex: number | null;
  stageLabel: string | null;
  businessType: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
};

export type Seeker = Omit<Candidate, "id" | "name" | "route" | "email" | "phone" | "linkedin">;

export type MatchBreakdown = {
  dimension: Dimension;
  label: string;
  score: number;
  weight: number;
};

export type Match = {
  candidate: Candidate;
  score: number;
  band: string;
  route: "A" | "B";
  filterStep: string;
  breakdown: MatchBreakdown[];
  reasons: string[];
  hobbyOnly: boolean;
};

function jaccard(a: string[], b: string[]) {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return { score: 0, shared: [] as string[] };
  const shared = [...setA].filter((item) => setB.has(item));
  const union = new Set([...setA, ...setB]);
  return { score: shared.length / union.size, shared };
}

function breadth(countries: string[]) {
  if (countries.length === 0) return null;
  return Math.max(...countries.map((code) => COUNTRY_TIERS[code] ?? 0.6));
}

function countryScore(a: string[], b: string[]) {
  const shared = a.filter((code) => b.includes(code));
  if (shared.length > 0) return { score: 1, shared };
  const breadthA = breadth(a);
  const breadthB = breadth(b);
  if (breadthA === null || breadthB === null) return { score: 0, shared: [] as string[] };
  const raw = 1 - Math.abs(breadthA - breadthB);
  return { score: Math.min(raw, COUNTRY_FALLBACK_CAP), shared: [] as string[] };
}

function childCompatible(a: string | null, b: string | null) {
  if (!a || !b) return true;
  const groupOf = (value: string) =>
    PARENT_STATUSES.includes(value) ? "parent" : CHILDFREE_STATUSES.includes(value) ? "childfree" : null;
  const groupA = groupOf(a);
  const groupB = groupOf(b);
  if (groupA === null || groupB === null) return true;
  return groupA === groupB;
}

function withinAge(seeker: Seeker, candidate: Candidate, tolerance: number) {
  if (seeker.age === null || candidate.age === null) return true;
  return Math.abs(seeker.age - candidate.age) <= tolerance;
}

function withinRole(seeker: Seeker, candidate: Candidate) {
  if (seeker.roleLevel === null || candidate.roleLevel === null) return true;
  return Math.abs(seeker.roleLevel - candidate.roleLevel) <= 1;
}

function bandOf(score: number) {
  return THRESHOLDS.find((entry) => score >= entry.min)?.band ?? "Weak";
}

/** Stage 1 — hard filters, loosened one step at a time until 2+ candidates survive. */
export function applyHardFilters(seeker: Seeker, pool: Candidate[]) {
  const sameIcp = pool.filter((candidate) => candidate.icp === seeker.icp);
  let survivors = sameIcp;
  let stepLabel = "ICP only";

  for (const step of FILTER_STEPS) {
    const filtered = sameIcp.filter((candidate) => {
      if (!withinAge(seeker, candidate, step.age)) return false;
      if (step.role && !withinRole(seeker, candidate)) return false;
      if (
        step.companyType &&
        seeker.companyType &&
        candidate.companyType &&
        seeker.companyType !== candidate.companyType
      )
        return false;
      if (
        step.sizeBand &&
        seeker.companySizeBand !== null &&
        candidate.companySizeBand !== null &&
        Math.abs(seeker.companySizeBand - candidate.companySizeBand) > 1
      )
        return false;
      return true;
    });
    if (filtered.length >= 2) {
      survivors = filtered;
      stepLabel = step.label;
      break;
    }
    survivors = sameIcp;
    stepLabel = "ICP only (age/role/company filters relaxed)";
  }

  const childFiltered = survivors.filter((candidate) =>
    childCompatible(seeker.childStatus, candidate.childStatus),
  );
  if (childFiltered.length >= 2) {
    return { survivors: childFiltered, stepLabel: `${stepLabel} · child status matched`, hobbyOnly: false };
  }

  if (survivors.length >= 2) return { survivors, stepLabel, hobbyOnly: false };

  // Hobby-only mode: drop ICP, keep age ±5, rank on life context + interests.
  const hobby = pool.filter((candidate) => withinAge(seeker, candidate, 5));
  return { survivors: hobby, stepLabel: "Hobby-only mode (ICP dropped, age ±5)", hobbyOnly: true };
}

function stageScore(seeker: Seeker, candidate: Candidate) {
  if (seeker.stageIndex === null || candidate.stageIndex === null) return null;
  const matrix = STAGE_MATRIX[seeker.icp];
  const row = matrix[seeker.stageIndex];
  if (!row) return null;
  const value = row[candidate.stageIndex];
  return typeof value === "number" ? value : null;
}

/** Stage 2 — weighted score out of 100, with unavailable dimensions redistributed. */
export function scoreCandidate(
  seeker: Seeker,
  candidate: Candidate,
  options: { hobbyOnly: boolean; collectsBusinessType: boolean },
) {
  const parts: { dimension: Dimension; score: number }[] = [];
  const reasons: string[] = [];

  const stage = options.hobbyOnly ? null : stageScore(seeker, candidate);
  if (stage !== null) {
    parts.push({ dimension: "stage", score: stage });
    if (stage >= 0.9 && candidate.stageLabel) {
      reasons.push(`Both at the same point: ${candidate.stageLabel.toLowerCase()}`);
    } else if (stage >= 0.5 && candidate.stageLabel) {
      reasons.push(`Adjacent stage — she's ${candidate.stageLabel.toLowerCase()}`);
    }
  }

  if (!options.hobbyOnly && options.collectsBusinessType && seeker.businessType && candidate.businessType) {
    const same = seeker.businessType === candidate.businessType ? 1 : 0;
    parts.push({ dimension: "businessType", score: same });
    if (same) reasons.push(`Building the same kind of business — ${candidate.businessType.split("—")[0]!.trim()}`);
  }

  if (!options.hobbyOnly && seeker.expertise && candidate.expertise) {
    const same = seeker.expertise === candidate.expertise ? 1 : 0;
    parts.push({ dimension: "expertise", score: same });
    if (same) reasons.push(`Shared expertise in ${candidate.expertise}`);
  }

  const life = jaccard(seeker.lifeContext, candidate.lifeContext);
  parts.push({ dimension: "lifeContext", score: life.score });
  if (life.shared.length > 0) {
    const labels = life.shared.map((tag) => LIFE_CONTEXT_TAG_LABELS[tag] ?? tag);
    reasons.push(`You're both ${labels.slice(0, 2).join(" and ")}`);
  }

  const interests = jaccard(seeker.interests, candidate.interests);
  parts.push({ dimension: "interests", score: interests.score });
  if (interests.shared.length > 0) {
    reasons.push(`Shared interests: ${interests.shared.slice(0, 3).join(", ")}`);
  }

  const countries = countryScore(seeker.countries, candidate.countries);
  parts.push({ dimension: "countries", score: countries.score });
  if (countries.shared.length > 0) {
    reasons.push(`You've both lived in ${countries.shared.slice(0, 2).join(", ")}`);
  }

  const totalWeight = parts.reduce((sum, part) => sum + WEIGHTS[part.dimension], 0);
  const weighted = parts.reduce((sum, part) => sum + part.score * WEIGHTS[part.dimension], 0);
  const score = totalWeight === 0 ? 0 : Math.round((weighted / totalWeight) * 100);

  const breakdown: MatchBreakdown[] = parts.map((part) => ({
    dimension: part.dimension,
    label: DIMENSION_LABELS[part.dimension],
    score: Number(part.score.toFixed(2)),
    weight: Math.round((WEIGHTS[part.dimension] / totalWeight) * 100),
  }));

  return { score, breakdown, reasons };
}

function rank(
  seeker: Seeker,
  pool: Candidate[],
  collectsBusinessType: boolean,
): Match[] {
  if (pool.length === 0) return [];
  const { survivors, stepLabel, hobbyOnly } = applyHardFilters(seeker, pool);
  return survivors
    .map((candidate) => {
      const { score, breakdown, reasons } = scoreCandidate(seeker, candidate, {
        hobbyOnly,
        collectsBusinessType,
      });
      return {
        candidate,
        score,
        band: bandOf(score),
        route: candidate.route,
        filterStep: stepLabel,
        breakdown,
        reasons,
        hobbyOnly,
      } satisfies Match;
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Route A (form respondents, full profiles incl. stage) is tried first; Route B
 * (imported membership pool, no stage data) tops the list up to three.
 */
export function findMatches(
  seeker: Seeker,
  routeA: Candidate[],
  routeB: Candidate[],
  collectsBusinessType: boolean,
  limit = 3,
): Match[] {
  const primary = rank(seeker, routeA, collectsBusinessType);
  const strong = primary.filter((match) => match.score >= 40);
  if (strong.length >= limit) return strong.slice(0, limit);
  const fallback = rank(seeker, routeB, collectsBusinessType);
  const seen = new Set(strong.map((match) => match.candidate.id));
  const combined = [...strong];
  for (const match of fallback) {
    if (combined.length >= limit) break;
    if (seen.has(match.candidate.id)) continue;
    combined.push(match);
  }
  if (combined.length < limit) {
    for (const match of primary) {
      if (combined.length >= limit) break;
      if (combined.some((item) => item.candidate.id === match.candidate.id)) continue;
      combined.push(match);
    }
  }
  return combined.slice(0, limit);
}

export function ageFromDob(dob: string | null) {
  if (!dob) return null;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const monthDiff = now.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) age -= 1;
  return age;
}
