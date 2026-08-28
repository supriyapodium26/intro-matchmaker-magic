import { z } from "zod";

import type { IcpKey } from "@/lib/intake-tree";
import { BUSINESS_TYPE_ICPS } from "@/lib/intake-tree";
import { ageFromDob, findMatches, findWildcards, identityKey, type Candidate, type Match, type Seeker } from "@/lib/matching/engine";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(4).max(40),
});

const payloadSchema = contactSchema.extend({
  visitorId: z.string().min(3).max(80),
  icp: z.string().min(1).max(60),
  gateAnswer: z.string().max(20).nullable(),
  rerouteAnswer: z.string().max(400).nullable(),
  founderTenure: z.string().max(120).nullable(),
  stageIndex: z.number().int().min(0).max(9).nullable(),
  stageLabel: z.string().max(400).nullable(),
  businessType: z.string().max(200).nullable(),
  openText: z.string().max(2000).nullable(),
  lifeContext: z.array(z.string().max(40)).max(24),
  transcript: z
    .array(z.object({ role: z.enum(["bot", "user"]), text: z.string().max(2000) }))
    .max(120),
});

type Contact = z.infer<typeof contactSchema>;
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

const EMPTY_PROFILE: MemberProfile = {
  memberId: null,
  age: null,
  roleLabel: null,
  roleLevel: null,
  companyType: null,
  companySize: null,
  companySizeBand: null,
  expertise: null,
  countries: [],
  lifeContext: [],
  interests: [],
  childStatus: null,
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

function firstNameAndInitial(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? "Member";
  const last = parts.length > 1 ? parts.at(-1) ?? "" : "";
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

type MemberRow = Record<string, unknown>;

function profileFrom(row: MemberRow): MemberProfile {
  return {
    memberId: String(row["id"]),
    age: ageFromDob((row["dob"] as string | null) ?? null),
    roleLabel: (row["role_label"] as string | null) ?? null,
    roleLevel: (row["role_level"] as number | null) ?? null,
    companyType: (row["company_type"] as string | null) ?? null,
    companySize: (row["company_size"] as string | null) ?? null,
    companySizeBand: (row["company_size_band"] as number | null) ?? null,
    expertise: (row["expertise"] as string | null) ?? null,
    countries: (row["countries"] as string[] | null) ?? [],
    lifeContext: (row["life_context"] as string[] | null) ?? [],
    interests: (row["interests"] as string[] | null) ?? [],
    childStatus: (row["child_status"] as string | null) ?? null,
  };
}

/**
 * Finds the member record behind the contact details the visitor typed, so the
 * chat never has to ask for age, role, company, expertise, countries or interests.
 */
type QueryLike = {
  select: (columns: string) => {
    ilike: (column: string, value: string) => PromiseLike<{ data: MemberRow[] | null }>;
  };
};
type AdminLike = { from: (table: string) => QueryLike };

async function findMemberRow(
  supabaseAdmin: AdminLike,
  contact: { name: string; email: string; phone: string },
) {
  const byEmail = await supabaseAdmin.from("members").select(MEMBER_COLUMNS).ilike("email", contact.email);
  const emailHit = (byEmail.data ?? [])[0];
  if (emailHit) return { row: emailHit, matchedOn: "email" as const };

  const byName = await supabaseAdmin.from("members").select(MEMBER_COLUMNS).ilike("name", contact.name);
  const nameHit = (byName.data ?? [])[0];
  if (nameHit) return { row: nameHit, matchedOn: "name" as const };

  const wanted = digits(contact.phone).slice(-8);
  if (wanted.length >= 6) {
    const byPhone = await supabaseAdmin.from("members").select(`${MEMBER_COLUMNS}, phone`).ilike("phone", `%${wanted}%`);
    const phoneHit = (byPhone.data ?? [])[0];
    if (phoneHit) return { row: phoneHit, matchedOn: "phone" as const };
  }
  return { row: null, matchedOn: null };
}

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

export function contactInputValidator(data: unknown) {
  return contactSchema.parse(data);
}

export function payloadInputValidator(data: unknown) {
  return payloadSchema.parse(data);
}

export async function handleLookupMember(data: Contact) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { row, matchedOn } = await findMemberRow(supabaseAdmin as unknown as AdminLike, data);
  if (!row) return { found: false as const };
  const profile = profileFrom(row);
  return {
    found: true as const,
    matchedOn,
    firstName: String(row["name"] ?? "").split(/\s+/)[0] ?? "",
    roleLabel: profile.roleLabel,
    expertise: profile.expertise,
    companyType: profile.companyType,
    interestCount: profile.interests.length,
    countryCount: profile.countries.length,
  };
}

export async function handleSubmitIntake(data: Payload) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { row: memberRow } = await findMemberRow(supabaseAdmin as unknown as AdminLike, data);
  const profile = memberRow ? profileFrom(memberRow) : EMPTY_PROFILE;
  const birthYear = profile.age ? new Date().getFullYear() - profile.age : null;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("respondents")
    .insert({
      visitor_id: data.visitorId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      birth_year: birthYear,
      icp: data.icp,
      gate_answer: data.gateAnswer,
      reroute_answer: data.rerouteAnswer,
      founder_tenure: data.founderTenure,
      stage_index: data.stageIndex,
      stage_label: data.stageLabel,
      business_type: data.businessType,
      open_text: data.openText,
      life_context: data.lifeContext,
      role_label: profile.roleLabel,
      role_level: profile.roleLevel,
      company_type: profile.companyType,
      company_size: profile.companySize,
      company_size_band: profile.companySizeBand,
      expertise: profile.expertise,
      countries: profile.countries,
      child_status: profile.childStatus,
      interests: profile.interests,
      completed: true,
      last_step: "results",
      transcript: data.transcript,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("intake insert failed", insertError.message);
    throw new Error("We couldn't save your answers. Please try again.");
  }

  const [routeAResult, routeBResult] = await Promise.all([
    supabaseAdmin
      .from("respondents")
      .select(
        "id, name, email, icp, birth_year, role_label, role_level, company_type, company_size, company_size_band, child_status, expertise, countries, life_context, interests, stage_index, stage_label, business_type",
      )
      .eq("completed", true)
      .neq("id", inserted.id)
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
    .filter((row) => String(row.email ?? "").toLowerCase() !== data.email.toLowerCase())
    .filter((row) => String(row.name ?? "").trim().toLowerCase() !== data.name.trim().toLowerCase())
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

  await supabaseAdmin
    .from("respondents")
    .update({ match_count: matches.length, updated_at: new Date().toISOString() })
    .eq("id", inserted.id);

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
    profileFound: Boolean(memberRow),
    poolSizes: { routeA: routeA.length, routeB: routeB.length },
  };
}