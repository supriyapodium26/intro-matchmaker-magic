import { z } from "zod";

import type { IcpKey } from "@/lib/intake-tree";
import { BUSINESS_TYPE_ICPS } from "@/lib/intake-tree";
import { ageFromDob, findMatches, findWildcards, identityKey, type Candidate, type Match, type Seeker } from "@/lib/matching/engine";

const payloadSchema = z.object({
  icp: z.string().min(1).max(60),
  gateAnswer: z.string().max(20).nullable(),
  rerouteAnswer: z.string().max(400).nullable(),
  founderTenure: z.string().max(120).nullable(),
  stageIndex: z.number().int().min(0).max(9).nullable(),
  stageLabel: z.string().max(400).nullable(),
  businessType: z.string().max(200).nullable(),
  openText: z.string().max(2000).nullable(),
  lifeContext: z.array(z.string().max(40)).max(24),
});

type Payload = z.infer<typeof payloadSchema>;

/** Profile facts we read out of the membership database instead of asking for them. */
type MemberProfile = {
  memberId: string | null;
  age: number | null;
  roleLabel: string | null;
  roleLevel: number | null;
  companyType: string | null;
  companySize: string | null;
  companySizeBand: number | null;
  expertise: string | null;
  countries: string[];
  lifeContext: string[];
  interests: string[];
  childStatus: string | null;
};

/** Public-facing match shape — deliberately excludes member contact details beyond requested contact links. */
export type PublicMatch = {
  id: string;
  displayName: string;
  route: "A" | "B";
  score: number;
  band: string;
  filterStep: string;
  hobbyOnly: boolean;
  icp: IcpKey;
  age: number | null;
  roleLabel: string | null;
  companyType: string | null;
  companySize: string | null;
  expertise: string | null;
  stageLabel: string | null;
  businessType: string | null;
  countries: string[];
  lifeContext: string[];
  interests: string[];
  email: string | null;
  linkedin: string | null;
  headline: string;
  reasons: string[];
  breakdown: { label: string; score: number; weight: number }[];
};

const MEMBER_COLUMNS =
  "id, name, email, linkedin, icp, dob, role_label, role_level, company_type, company_size, company_size_band, child_status, expertise, countries, life_context, interests";

/**
 * Prototype stand-in for OAuth-provided identity: a fixed, fully synthetic
 * profile baked into the code, never a row read out of `members`. Production
 * will get identity from OAuth passed in by the main app; until then this is
 * the same "seeker" for every visitor, with no picker and no database
 * dependency, so the demo can't break if the members table is ever empty or
 * changes shape.
 */
const DEMO_PERSONA: MemberProfile & { name: string; email: string } = {
  memberId: null,
  name: "Maya Lim",
  email: "demo.persona@podium.internal",
  age: 34,
  roleLabel: "Director / VP",
  roleLevel: 5,
  companyType: "Small or mid-size business (SME)",
  companySize: "51-250 employees",
  companySizeBand: 3,
  expertise: "Marketing & Brand",
  countries: ["SG", "GB"],
  lifeContext: [],
  interests: ["Yoga & Pilates", "Art & Museums", "Running"],
  childStatus: "parent_young",
};

function firstNameAndInitial(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? "Member";
  const last = parts.length > 1 ? parts.at(-1) ?? "" : "";
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}

type MemberRow = Record<string, unknown>;

function toCandidate(row: MemberRow, route: "A" | "B"): Candidate {
  const age =
    route === "B"
      ? ageFromDob((row["dob"] as string | null) ?? null)
      : row["birth_year"]
        ? new Date().getFullYear() - Number(row["birth_year"])
        : null;
  return {
    id: String(row["id"]),
    name: String(row["name"] ?? "A Podium member"),
    route,
    icp: row["icp"] as IcpKey,
    age,
    roleLabel: (row["role_label"] as string | null) ?? null,
    roleLevel: (row["role_level"] as number | null) ?? null,
    companyType: (row["company_type"] as string | null) ?? null,
    companySize: (row["company_size"] as string | null) ?? null,
    companySizeBand: (row["company_size_band"] as number | null) ?? null,
    childStatus: (row["child_status"] as string | null) ?? null,
    expertise: (row["expertise"] as string | null) ?? null,
    countries: (row["countries"] as string[] | null) ?? [],
    lifeContext: (row["life_context"] as string[] | null) ?? [],
    interests: (row["interests"] as string[] | null) ?? [],
    stageIndex: route === "A" ? ((row["stage_index"] as number | null) ?? null) : null,
    stageLabel: route === "A" ? ((row["stage_label"] as string | null) ?? null) : null,
    businessType: route === "A" ? ((row["business_type"] as string | null) ?? null) : null,
    email: (row["email"] as string | null) ?? null,
    phone: null,
    linkedin: (row["linkedin"] as string | null) ?? null,
  };
}

export function payloadInputValidator(data: unknown) {
  return payloadSchema.parse(data);
}

export async function handleGetDemoPersona() {
  return { firstName: DEMO_PERSONA.name.split(/\s+/)[0] || "there" };
}

export async function handleSubmitIntake(data: Payload) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const profile = DEMO_PERSONA;
  const demoEmail = profile.email.trim().toLowerCase();
  const demoName = profile.name.trim().toLowerCase();

  const [routeAResult, routeBResult] = await Promise.all([
    supabaseAdmin
      .from("respondents")
      .select(
        "id, name, email, icp, birth_year, role_label, role_level, company_type, company_size, company_size_band, child_status, expertise, countries, life_context, interests, stage_index, stage_label, business_type",
      )
      .eq("completed", true)
      .order("created_at", { ascending: false }),

    supabaseAdmin.from("members").select(MEMBER_COLUMNS),
  ]);

  if (routeBResult.error) {
    console.error("member pool read failed", routeBResult.error.message);
    throw new Error("We couldn't reach the membership database. Please try again.");
  }

  // Repeat form submissions create one row per attempt, so keep only the most
  // recent row per person before they ever reach the ranking.
  const seenRespondents = new Set<string>();
  const routeA = (routeAResult.data ?? [])
    .filter((row) => String(row.email ?? "").toLowerCase() !== demoEmail)
    .filter((row) => String(row.name ?? "").trim().toLowerCase() !== demoName)
    .filter((row) => {
      const key =
        String(row.email ?? "").trim().toLowerCase() ||
        `n:${String(row.name ?? "").trim().toLowerCase()}`;
      if (seenRespondents.has(key)) return false;
      seenRespondents.add(key);
      return true;
    })
    .map((row) => toCandidate(row, "A"));
  const routeB = (routeBResult.data ?? [])
    .filter((row) => String(row.id) !== profile.memberId)
    .map((row) => toCandidate(row, "B"));


  const seeker: Seeker = {
    icp: data.icp as IcpKey,
    age: profile.age,
    roleLabel: profile.roleLabel,
    roleLevel: profile.roleLevel,
    companyType: profile.companyType,
    companySize: profile.companySize,
    companySizeBand: profile.companySizeBand,
    childStatus: profile.childStatus,
    expertise: profile.expertise,
    countries: profile.countries,
    lifeContext: [...new Set([...profile.lifeContext, ...data.lifeContext])],
    interests: profile.interests,
    stageIndex: data.stageIndex,
    stageLabel: data.stageLabel,
    businessType: data.businessType,
  };

  const ranked = findMatches(
    seeker,
    routeA,
    routeB,
    BUSINESS_TYPE_ICPS.includes(seeker.icp),
    6,
  );
  const matches = ranked.slice(0, 3);
  const looseMatches = ranked.slice(3, 6);
  const excludeIds = new Set(ranked.flatMap((match) => [match.candidate.id, identityKey(match.candidate)]));
  const wildcards = findWildcards(seeker, [...routeA, ...routeB], excludeIds, 3);

  const toPublic = (match: Match): PublicMatch => ({
    id: match.candidate.id,
    displayName: firstNameAndInitial(match.candidate.name),
    route: match.route,
    score: match.score,
    band: match.band,
    filterStep: match.filterStep,
    hobbyOnly: match.hobbyOnly,
    icp: match.candidate.icp,
    age: match.candidate.age,
    roleLabel: match.candidate.roleLabel,
    companyType: match.candidate.companyType,
    companySize: match.candidate.companySize,
    expertise: match.candidate.expertise,
    stageLabel: match.candidate.stageLabel,
    businessType: match.candidate.businessType,
    countries: match.candidate.countries,
    lifeContext: match.candidate.lifeContext,
    interests: match.candidate.interests,
    email: match.candidate.email,
    linkedin: match.candidate.linkedin,
    headline: match.headline,
    reasons: match.reasons,
    breakdown: match.breakdown.map((part) => ({
      label: part.label,
      score: part.score,
      weight: part.weight,
    })),
  });

  return {
    matches: matches.map(toPublic),
    looseMatches: looseMatches.map(toPublic),
    wildcards: wildcards.map(toPublic),
    profileFound: true,
    poolSizes: { routeA: routeA.length, routeB: routeB.length },
  };
}