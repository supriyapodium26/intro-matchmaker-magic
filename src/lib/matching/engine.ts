// Pure matching engine: hard-filter cascade + weighted scoring, per the algorithm doc.

import type { IcpKey } from "@/lib/intake-tree";
import { HOME_COUNTRY, ICP_WARM_PHRASE, LIFE_CONTEXT_TAG_LABELS } from "@/lib/intake-tree";
import { countryName } from "@/lib/countries";
import {
  CHILDFREE_STATUSES,
  COUNTRY_FALLBACK_CAP,
  COUNTRY_TIERS,
  DIMENSION_LABELS,
  FILTER_STEPS,
  PARENT_STATUSES,
  ROUTE_B_WEIGHTS,
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

/** One "Why You Two" bullet — the value is kept separate so the client can
 * bold it and pick an icon without generating any text itself. */
export type ReasonType = "lifeContext" | "interests" | "countries";
export type MatchReason = { type: ReasonType; prefix: string; value: string; suffix: string };

export type Match = {
  candidate: Candidate;
  score: number;
  band: string;
  route: "A" | "B";
  filterStep: string;
  breakdown: MatchBreakdown[];
  headline: string;
  reasons: MatchReason[];
  hobbyOnly: boolean;
};

/** "Entrepreneur" as an area of expertise says nothing meaningful, so we never
 * phrase it as a shared field or a role descriptor. */
const VAGUE_EXPERTISE = ["entrepreneur", "entrepreneurship", "founder", "business owner"];

type ChildGroup = "parent" | "childfree" | "exploring";

function meaningfulExpertise(value: string | null) {
  if (!value) return null;
  return VAGUE_EXPERTISE.includes(value.trim().toLowerCase()) ? null : value;
}

function jaccard(a: string[], b: string[]) {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return null;
  const shared = [...setA].filter((item) => setB.has(item));
  const union = new Set([...setA, ...setB]);
  return { score: shared.length / union.size, shared };
}

function breadth(countries: string[]) {
  const relevant = countries.filter((code) => code !== HOME_COUNTRY);
  if (relevant.length === 0) return null;
  return Math.max(...relevant.map((code) => COUNTRY_TIERS[code] ?? 0.6));
}

// Podium is Singapore-based, so a shared Singapore says nothing about either
// person — it is excluded from the countries signal entirely.
function countryScore(rawA: string[], rawB: string[]) {
  const a = rawA.filter((code) => code !== HOME_COUNTRY);
  const b = rawB.filter((code) => code !== HOME_COUNTRY);
  const shared = a.filter((code) => b.includes(code));
  if (shared.length > 0) return { score: 1, shared };
  const breadthA = breadth(a);
  const breadthB = breadth(b);
  if (breadthA === null || breadthB === null) return null;
  const raw = 1 - Math.abs(breadthA - breadthB);
  return { score: Math.min(raw, COUNTRY_FALLBACK_CAP), shared: [] as string[] };
}

function childGroup(value: string | null): ChildGroup | null {
  if (!value) return null;
  if (PARENT_STATUSES.includes(value)) return "parent";
  if (CHILDFREE_STATUSES.includes(value)) return "childfree";
  if (value === "exploring") return "exploring";
  return null;
}

function childCompatible(a: string | null, b: string | null) {
  const groupA = childGroup(a);
  if (groupA === null) return true;
  const groupB = childGroup(b);
  if (groupB === null) return false;
  return groupA === groupB;
}

function childStatusScore(seeker: Seeker, candidate: Candidate) {
  const seekerGroup = childGroup(seeker.childStatus);
  const candidateGroup = childGroup(candidate.childStatus);
  if (seekerGroup === null || candidateGroup === null) return null;
  if (seekerGroup !== candidateGroup) return 0;
  if (seeker.childStatus === candidate.childStatus) return 1;
  return seekerGroup === "parent" ? 0.8 : 0.9;
}

function ageSimilarityScore(seeker: Seeker, candidate: Candidate) {
  if (seeker.age === null || candidate.age === null) return null;
  const gap = Math.abs(seeker.age - candidate.age);
  if (gap <= 2) return 1;
  if (gap <= 5) return 0.8;
  if (gap <= 8) return 0.35;
  return 0;
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

/** Stage 1 — hard filters, loosened one step at a time until enough candidates survive. */
export function applyHardFilters(seeker: Seeker, pool: Candidate[], minimum = 3) {
  const sameIcp = pool.filter((candidate) => candidate.icp === seeker.icp);
  const childMatched = sameIcp.filter((candidate) => childCompatible(seeker.childStatus, candidate.childStatus));
  const childStatusIsKnown = childGroup(seeker.childStatus) !== null;
  const basePool = childStatusIsKnown && childMatched.length > 0 ? childMatched : sameIcp;
  let survivors = basePool;
  let stepLabel = childStatusIsKnown && childMatched.length > 0 ? "ICP + parenting season" : "ICP only";

  for (const step of FILTER_STEPS) {
    const filtered = basePool.filter((candidate) => {
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
    if (filtered.length >= minimum) {
      survivors = filtered;
      stepLabel = childStatusIsKnown && childMatched.length > 0 ? `${step.label} · parenting season` : step.label;
      break;
    }
    if (filtered.length > 0) {
      survivors = filtered;
      stepLabel = childStatusIsKnown && childMatched.length > 0 ? `${step.label} · parenting season` : step.label;
    } else if (basePool.length > 0) {
      survivors = basePool;
      stepLabel =
        childStatusIsKnown && childMatched.length > 0
          ? "ICP + parenting season (age/role/company filters relaxed)"
          : "ICP only (age/role/company filters relaxed)";
    }
  }

  if (survivors.length >= minimum) return { survivors, stepLabel, hobbyOnly: false };

  // Hobby-only mode: drop ICP, keep age ±5, rank on life context + interests.
  // If the seeker has a known parenting season, keep that as a non-negotiable
  // compatibility constraint so non-parents don't outrank parent-to-parent fits.
  const hobbyBase = childStatusIsKnown ? pool.filter((candidate) => childCompatible(seeker.childStatus, candidate.childStatus)) : pool;
  const hobby = hobbyBase.filter((candidate) => withinAge(seeker, candidate, 5));
  if (hobby.length > survivors.length)
    return { survivors: hobby, stepLabel: "Hobby-only mode (life-stage dropped, age ±5)", hobbyOnly: true };
  return { survivors, stepLabel, hobbyOnly: false };
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

  const stage = options.hobbyOnly ? null : stageScore(seeker, candidate);
  if (stage !== null) {
    parts.push({ dimension: "stage", score: stage });
  }

  const child = options.hobbyOnly ? null : childStatusScore(seeker, candidate);
  if (child !== null) {
    parts.push({ dimension: "childStatus", score: child });
  }

  const age = options.hobbyOnly ? null : ageSimilarityScore(seeker, candidate);
  if (age !== null) {
    parts.push({ dimension: "ageSimilarity", score: age });
  }

  if (!options.hobbyOnly && options.collectsBusinessType && seeker.businessType && candidate.businessType) {
    const same = seeker.businessType === candidate.businessType ? 1 : 0;
    parts.push({ dimension: "businessType", score: same });
  }

  const expertiseMatches =
    !options.hobbyOnly && Boolean(seeker.expertise) && seeker.expertise === candidate.expertise;
  if (!options.hobbyOnly && seeker.expertise && candidate.expertise) {
    parts.push({ dimension: "expertise", score: expertiseMatches ? 1 : 0 });
  }

  const life = jaccard(seeker.lifeContext, candidate.lifeContext);
  if (life !== null) {
    parts.push({ dimension: "lifeContext", score: life.score });
  }

  const interests = jaccard(seeker.interests, candidate.interests);
  if (interests !== null) {
    parts.push({ dimension: "interests", score: interests.score });
  }

  const countries = countryScore(seeker.countries, candidate.countries);
  if (countries !== null) {
    parts.push({ dimension: "countries", score: countries.score });
  }

  // Route B members carry no stage/business-type answers, so they are scored on
  // the fallback weight table instead of having the stage weight redistributed.
  const table: Record<Dimension, number> =
    stage === null ? { ...ROUTE_B_WEIGHTS } : { ...WEIGHTS };

  const totalWeight = parts.reduce((sum, part) => sum + table[part.dimension], 0);
  const weighted = parts.reduce((sum, part) => sum + part.score * table[part.dimension], 0);
  const score = totalWeight === 0 ? 0 : Math.round((weighted / totalWeight) * 100);

  const breakdown: MatchBreakdown[] = parts.map((part) => ({
    dimension: part.dimension,
    label: DIMENSION_LABELS[part.dimension],
    score: Number(part.score.toFixed(2)),
    weight: totalWeight === 0 ? 0 : Math.round((table[part.dimension] / totalWeight) * 100),
  }));

  // Reasons are deterministic templates over real overlap data only — never
  // invented prose. Priority: shared life-context tags first (highest
  // emotional resonance for an introductions feature), then shared
  // interests, then shared countries. Expertise is shown as its own chip
  // already, so it isn't repeated here. Capped at 2 bullets.
  const sharedLifeContext = life?.shared ?? [];
  // The headline (clause 3) always claims the first shared tag, so the
  // bullet picks the next-best remaining one instead of repeating it.
  const headlineLifeContextTag = sharedLifeContext[0] ?? null;
  const bulletLifeContextTag =
    sharedLifeContext.find((tag) => tag !== headlineLifeContextTag) ?? null;
  const reasonCandidates: MatchReason[] = [];
  if (bulletLifeContextTag) {
    const label = LIFE_CONTEXT_TAG_LABELS[bulletLifeContextTag] ?? bulletLifeContextTag;
    reasonCandidates.push({
      type: "lifeContext",
      prefix: "You're both ",
      value: label,
      suffix: " — she'll get it without you explaining",
    });
  }
  if (interests !== null && interests.shared.length > 0) {
    reasonCandidates.push({
      type: "interests",
      prefix: "She's into ",
      value: interests.shared[0]!,
      suffix: " too",
    });
  }
  if (countries !== null && countries.shared.length > 0) {
    reasonCandidates.push({
      type: "countries",
      prefix: "You've both lived in ",
      value: countryName(countries.shared[0]!),
      suffix: "",
    });
  }
  const reasons = reasonCandidates.slice(0, 2);

  return { score, breakdown, reasons, headline: headlineFor(seeker, candidate, sharedLifeContext) };
}

function listOf(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  const final = items.at(-1) ?? "";
  return `${items.slice(0, -1).join(", ")} and ${final}`;
}

/** One warm sentence introducing the match, e.g. "Jovita leads at director
 * level in Consulting, is close to your age, is also a working mom, and is
 * also at a career crossroads too." */
function headlineFor(seeker: Seeker, candidate: Candidate, sharedLifeContext: string[]) {
  const first = candidate.name.trim().split(/\s+/)[0] ?? "She";
  const bits: string[] = [];
  const role = roleDescriptor(candidate.roleLabel, meaningfulExpertise(candidate.expertise));
  if (role) bits.push(role);
  if (seeker.age !== null && candidate.age !== null) {
    const gap = Math.abs(seeker.age - candidate.age);
    if (gap <= 2) bits.push("is right around your age");
    else if (gap <= 5) bits.push("is close to your age");
  }
  if (sharedLifeContext.length > 0) {
    const topTag = sharedLifeContext[0]!;
    bits.push(`is also ${LIFE_CONTEXT_TAG_LABELS[topTag] ?? topTag}`);
  }
  bits.push(`is ${ICP_WARM_PHRASE[candidate.icp]}`);
  return `${first} ${listOf(bits)}.`;
}

/** Reads naturally in a sentence: "Jovita is a manager in Consulting, ...". */
function roleDescriptor(roleLabel: string | null, expertise: string | null) {
  const field = expertise ? ` in ${expertise}` : "";
  if (!roleLabel) return expertise ? `works in ${expertise}` : "";
  const role = roleLabel.toLowerCase();
  if (role.includes("founder")) return `runs her own business${field}`;
  if (role.includes("c-suite")) return `sits in the C-suite${field}`;
  if (role.includes("between roles"))
    return expertise ? `is between roles with a background in ${expertise}` : "is between roles right now";
  if (role.includes("director") || role.includes("vp")) return `leads at director level${field}`;
  if (role.includes("individual contributor")) {
    return `is ${role.startsWith("senior") ? "a senior specialist" : "a specialist"}${field}`;
  }
  return `is a ${role}${field}`;
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
      const { score, breakdown, reasons, headline } = scoreCandidate(seeker, candidate, {
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
        headline,
        reasons,
        hobbyOnly,
      } satisfies Match;
    })
    .sort((a, b) => b.score - a.score);
}

/** Identity key so the same person can never appear twice (duplicate form
 * submissions create separate rows with different ids). */
export function identityKey(candidate: Candidate) {
  const email = candidate.email?.trim().toLowerCase();
  if (email) return `e:${email}`;
  return `n:${candidate.name.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

function pushUnique(target: Match[], source: Match[], seen: Set<string>, limit: number) {
  for (const match of source) {
    if (target.length >= limit) return;
    const key = identityKey(match.candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    target.push(match);
  }
}

/**
 * Same-ICP matches always come first (Route A respondents ahead of Route B
 * members). Loose "hobby-only" results are a last resort — they must never
 * outrank a genuine life-stage match from the membership pool.
 */
export function findMatches(
  seeker: Seeker,
  routeA: Candidate[],
  routeB: Candidate[],
  collectsBusinessType: boolean,
  limit = 3,
): Match[] {
  const primary = rank(seeker, routeA, collectsBusinessType);
  const fallback = rank(seeker, routeB, collectsBusinessType);

  const primaryStrict = primary.filter((match) => !match.hobbyOnly && match.score >= 40);
  const fallbackStrict = fallback.filter((match) => !match.hobbyOnly);
  const loose = [...primary, ...fallback]
    .filter((match) => match.hobbyOnly || match.score < 40)
    .sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const combined: Match[] = [];
  pushUnique(combined, primaryStrict, seen, limit);
  pushUnique(combined, fallbackStrict, seen, limit);
  pushUnique(combined, loose, seen, limit);
  return combined.slice(0, limit);
}


/**
 * "Interesting profiles" — a deliberately loose, curiosity-driven list used when
 * someone isn't taken with their three introductions. Life-stage filters are
 * dropped entirely and ranking is purely on shared interests, life context and
 * countries lived.
 */
export function findWildcards(
  seeker: Seeker,
  pool: Candidate[],
  excludeIds: Set<string>,
  limit = 3,
): Match[] {
  const unseen = pool.filter((candidate) => !excludeIds.has(candidate.id) && !excludeIds.has(identityKey(candidate)));
  const deduped: Candidate[] = [];
  const seenKeys = new Set<string>();
  for (const candidate of unseen) {
    const key = identityKey(candidate);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    deduped.push(candidate);
  }
  const compatible = deduped.filter((candidate) => childCompatible(seeker.childStatus, candidate.childStatus));
  const wildcardPool = childGroup(seeker.childStatus) !== null && compatible.length > 0 ? compatible : deduped;


  return wildcardPool
    .map((candidate) => {
      const { score, breakdown, reasons, headline } = scoreCandidate(seeker, candidate, {
        hobbyOnly: true,
        collectsBusinessType: false,
      });
      return {
        candidate,
        score,
        band: bandOf(score),
        route: candidate.route,
        filterStep: "Interesting profiles (shared interests and life context)",
        breakdown,
        headline,
        reasons,
        hobbyOnly: true,
      } satisfies Match;
    })
    .filter((match) => match.reasons.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
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
