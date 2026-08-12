import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { IcpKey } from "@/lib/intake-tree";
import { BUSINESS_TYPE_ICPS } from "@/lib/intake-tree";
import { ageFromDob, findMatches, type Candidate, type Seeker } from "@/lib/matching/engine";

const payloadSchema = z.object({
  visitorId: z.string().min(3).max(80),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(4).max(40),
  birthYear: z.number().int().min(1940).max(2012),
  icp: z.string().min(1).max(60),
  gateAnswer: z.string().max(20).nullable(),
  rerouteAnswer: z.string().max(400).nullable(),
  founderTenure: z.string().max(120).nullable(),
  stageIndex: z.number().int().min(0).max(9).nullable(),
  stageLabel: z.string().max(400).nullable(),
  businessType: z.string().max(200).nullable(),
  openText: z.string().max(2000).nullable(),
  lifeContext: z.array(z.string().max(40)).max(24),
  roleLabel: z.string().max(120).nullable(),
  roleLevel: z.number().int().min(1).max(6).nullable(),
  companyType: z.string().max(120).nullable(),
  companySize: z.string().max(60).nullable(),
  companySizeBand: z.number().int().min(1).max(5).nullable(),
  expertise: z.string().max(120).nullable(),
  countries: z.array(z.string().length(2)).max(12),
  childStatus: z.string().max(40).nullable(),
  interests: z.array(z.string().max(60)).max(20),
  transcript: z
    .array(z.object({ role: z.enum(["bot", "user"]), text: z.string().max(2000) }))
    .max(120),
});

type Payload = z.infer<typeof payloadSchema>;

/** Public-facing match shape — deliberately excludes member contact details. */
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
  reasons: string[];
  breakdown: { label: string; score: number; weight: number }[];
};

function firstNameAndInitial(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? "Member";
  const last = parts.length > 1 ? parts[parts.length - 1]! : "";
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}

function toCandidate(row: Record<string, unknown>, route: "A" | "B"): Candidate {
  const age =
    route === "B"
      ? ageFromDob((row['dob'] as string | null) ?? null)
      : row['birth_year']
        ? new Date().getFullYear() - Number(row['birth_year'])
        : null;
  return {
    id: String(row['id']),
    name: String(row['name'] ?? "A Podium member"),
    route,
    icp: row['icp'] as IcpKey,
    age,
    roleLabel: (row['role_label'] as string | null) ?? null,
    roleLevel: (row['role_level'] as number | null) ?? null,
    companyType: (row['company_type'] as string | null) ?? null,
    companySize: (row['company_size'] as string | null) ?? null,
    companySizeBand: (row['company_size_band'] as number | null) ?? null,
    childStatus: (row['child_status'] as string | null) ?? null,
    expertise: (row['expertise'] as string | null) ?? null,
    countries: (row['countries'] as string[] | null) ?? [],
    lifeContext: (row['life_context'] as string[] | null) ?? [],
    interests: (row['interests'] as string[] | null) ?? [],
    stageIndex: route === "A" ? ((row['stage_index'] as number | null) ?? null) : null,
    stageLabel: route === "A" ? ((row['stage_label'] as string | null) ?? null) : null,
    businessType: route === "A" ? ((row['business_type'] as string | null) ?? null) : null,
    email: null,
    phone: null,
    linkedin: null,
  };
}

function seekerFrom(data: Payload): Seeker {
  return {
    icp: data.icp as IcpKey,
    age: new Date().getFullYear() - data.birthYear,
    roleLabel: data.roleLabel,
    roleLevel: data.roleLevel,
    companyType: data.companyType,
    companySize: data.companySize,
    companySizeBand: data.companySizeBand,
    childStatus: data.childStatus,
    expertise: data.expertise,
    countries: data.countries,
    lifeContext: data.lifeContext,
    interests: data.interests,
    stageIndex: data.stageIndex,
    stageLabel: data.stageLabel,
    businessType: data.businessType,
  };
}

export const submitIntake = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => payloadSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("respondents")
      .insert({
        visitor_id: data.visitorId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        birth_year: data.birthYear,
        icp: data.icp,
        gate_answer: data.gateAnswer,
        reroute_answer: data.rerouteAnswer,
        founder_tenure: data.founderTenure,
        stage_index: data.stageIndex,
        stage_label: data.stageLabel,
        business_type: data.businessType,
        open_text: data.openText,
        life_context: data.lifeContext,
        role_label: data.roleLabel,
        role_level: data.roleLevel,
        company_type: data.companyType,
        company_size: data.companySize,
        company_size_band: data.companySizeBand,
        expertise: data.expertise,
        countries: data.countries,
        child_status: data.childStatus,
        interests: data.interests,
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
          "id, name, icp, birth_year, role_label, role_level, company_type, company_size, company_size_band, child_status, expertise, countries, life_context, interests, stage_index, stage_label, business_type",
        )
        .eq("completed", true)
        .neq("id", inserted.id),
      supabaseAdmin
        .from("members")
        .select(
          "id, name, icp, dob, role_label, role_level, company_type, company_size, company_size_band, child_status, expertise, countries, life_context, interests",
        ),
    ]);

    if (routeBResult.error) {
      console.error("member pool read failed", routeBResult.error.message);
      throw new Error("We couldn't reach the membership database. Please try again.");
    }

    const routeA = (routeAResult.data ?? []).map((row) => toCandidate(row, "A"));
    const routeB = (routeBResult.data ?? []).map((row) => toCandidate(row, "B"));

    const seeker = seekerFrom(data);
    const matches = findMatches(
      seeker,
      routeA,
      routeB,
      BUSINESS_TYPE_ICPS.includes(seeker.icp),
      3,
    );

    await supabaseAdmin
      .from("respondents")
      .update({ match_count: matches.length, updated_at: new Date().toISOString() })
      .eq("id", inserted.id);

    const publicMatches: PublicMatch[] = matches.map((match) => ({
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
      reasons: match.reasons,
      breakdown: match.breakdown.map((part) => ({
        label: part.label,
        score: part.score,
        weight: part.weight,
      })),
    }));

    return {
      matches: publicMatches,
      poolSizes: { routeA: routeA.length, routeB: routeB.length },
    };
  });
