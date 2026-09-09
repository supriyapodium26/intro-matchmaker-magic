import { z } from "zod";

import type { IcpKey } from "@/lib/intake-tree";
import { BUSINESS_TYPE_ICPS, ICP_CARD_LABELS } from "@/lib/intake-tree";
import {
  findMatches,
  findWildcards,
  identityKey,
  type Candidate,
  type Match,
  type SharedTag,
  type Seeker,
} from "@/lib/matching/engine";

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
  sharedTags: SharedTag[];
  breakdown: { label: string; score: number; weight: number }[];
};

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
  lifeContext: ["new_mom", "sg_returning", "recently_married", "burnout"],
  interests: ["Yoga & Pilates", "Art & Museums", "Running"],
  childStatus: "parent_young",
};

function firstNameAndInitial(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? "Member";
  const last = parts.length > 1 ? parts.at(-1) ?? "" : "";
  return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
}

/**
 * Frontend-only demo: no Supabase, no network calls. This stands in for the
 * `members` pool with a small hardcoded roster (three per ICP, with stage
 * and business-type answers filled in) so every branch of the intake tree
 * has plausible, fully-scored people to match against. Swap this out for a
 * real data source when the backend comes back online.
 */
const DEMO_CANDIDATES: Candidate[] = [
  {
    id: "demo-1",
    name: "Asha Menon",
    route: "B",
    icp: "career_crossroads",
    age: 36,
    roleLabel: "Senior manager",
    roleLevel: 4,
    companyType: "Large company / Corporate",
    companySize: "251-2,500 employees",
    companySizeBand: 4,
    childStatus: "exploring",
    expertise: "Operations & Strategy",
    countries: ["SG", "AU"],
    lifeContext: [],
    interests: ["Yoga & Pilates", "Running"],
    stageIndex: 1,
    stageLabel:
      "I know I want to keep growing in corporate — I just haven't found the direction that feels right yet",
    businessType: null,
    email: "asha.menon@example.com",
    phone: null,
    linkedin: "asha-menon",
  },
  {
    id: "demo-2",
    name: "Farah Osman",
    route: "B",
    icp: "career_crossroads",
    age: 32,
    roleLabel: "Manager",
    roleLevel: 3,
    companyType: "Large company / Corporate",
    companySize: "Over 2,500 employees",
    companySizeBand: 5,
    childStatus: "childfree",
    expertise: "People/HR",
    countries: ["SG", "AE"],
    lifeContext: ["pet_parent"],
    interests: ["Mindfulness & Meditation", "Art & Museums"],
    stageIndex: 2,
    stageLabel:
      "I don't think corporate is it for me anymore, and I'm leaning toward building something of my own, even if I'm still unsure",
    businessType: null,
    email: "farah.osman@example.com",
    phone: null,
    linkedin: "farah-osman",
  },
  {
    id: "demo-3",
    name: "Layla Haddad",
    route: "B",
    icp: "career_crossroads",
    age: 35,
    roleLabel: "Senior individual contributor",
    roleLevel: 2,
    companyType: "Large company / Corporate",
    companySize: "251-2,500 employees",
    companySizeBand: 4,
    childStatus: "parent_young",
    expertise: "Legal & Compliance",
    countries: ["SG", "US"],
    lifeContext: ["new_mom", "sg_returning"],
    interests: ["Film & Theatre", "Yoga & Pilates"],
    stageIndex: 0,
    stageLabel: "I'm still figuring out if corporate is really where I belong",
    businessType: null,
    email: "layla.haddad@example.com",
    phone: null,
    linkedin: "layla-haddad",
  },
  {
    id: "demo-4",
    name: "Renu Iyer",
    route: "B",
    icp: "side_hustler",
    age: 33,
    roleLabel: "Individual contributor",
    roleLevel: 1,
    companyType: "Large company / Corporate",
    companySize: "51-250 employees",
    companySizeBand: 3,
    childStatus: "parent_young",
    expertise: "Marketing & Brand",
    countries: ["SG", "IN"],
    lifeContext: ["new_mom"],
    interests: ["Dance", "Running"],
    stageIndex: 1,
    stageLabel: "I've started, but it's still early days",
    businessType: "A consumer tech product or physical goods business",
    email: "renu.iyer@example.com",
    phone: null,
    linkedin: "renu-iyer",
  },
  {
    id: "demo-5",
    name: "Chloe Tan",
    route: "B",
    icp: "side_hustler",
    age: 35,
    roleLabel: "Senior individual contributor",
    roleLevel: 2,
    companyType: "Small or mid-size business (SME)",
    companySize: "11-50 employees",
    companySizeBand: 2,
    childStatus: "parent_young",
    expertise: "Content Creation/Writing",
    countries: ["SG", "GB"],
    lifeContext: ["moved_sg", "new_mom"],
    interests: ["Art & Museums", "Film & Theatre"],
    stageIndex: 2,
    stageLabel: "Things are growing and gaining real momentum",
    businessType: "Wellness, coaching, or personal services",
    email: "chloe.tan@example.com",
    phone: null,
    linkedin: "chloe-tan",
  },
  {
    id: "demo-6",
    name: "Michelle Ong",
    route: "B",
    icp: "side_hustler",
    age: 30,
    roleLabel: "Manager",
    roleLevel: 3,
    companyType: "Large company / Corporate",
    companySize: "Over 2,500 employees",
    companySizeBand: 5,
    childStatus: "childfree",
    expertise: "Sales & Business Development",
    countries: ["SG", "CA"],
    lifeContext: ["recently_married"],
    interests: ["Tennis", "Concerts & Festivals"],
    stageIndex: 0,
    stageLabel: "I've got one or a few ideas, but haven't started building yet",
    businessType: "Professional services — consulting, advisory, or creative work",
    email: "michelle.ong@example.com",
    phone: null,
    linkedin: "michelle-ong",
  },
  {
    id: "demo-7",
    name: "Priya Bala",
    route: "B",
    icp: "early_stage_founder",
    age: 31,
    roleLabel: "Founder",
    roleLevel: 6,
    companyType: "Self-employed / Freelance",
    companySize: "1-10 employees",
    companySizeBand: 1,
    childStatus: "childfree",
    expertise: "Entrepreneur",
    countries: ["SG"],
    lifeContext: ["digital_nomad"],
    interests: ["Pickleball", "Weightlifting"],
    stageIndex: 0,
    stageLabel: "Pre-launch — testing demand, lining up suppliers, building the backend",
    businessType: "A consumer tech product or physical goods business",
    email: "priya.bala@example.com",
    phone: null,
    linkedin: "priya-bala",
  },
  {
    id: "demo-8",
    name: "Ingrid Wong",
    route: "B",
    icp: "early_stage_founder",
    age: 37,
    roleLabel: "Founder",
    roleLevel: 6,
    companyType: "Self-employed / Freelance",
    companySize: "1-10 employees",
    companySizeBand: 1,
    childStatus: "parent_young",
    expertise: "Product Design & Management",
    countries: ["SG", "US"],
    lifeContext: ["entrepreneur_mom"],
    interests: ["Tennis", "Concerts & Festivals"],
    stageIndex: 1,
    stageLabel: "Launched — the product is out in the world, still finding footing",
    businessType: "Professional services — consulting, advisory, or creative work",
    email: "ingrid.wong@example.com",
    phone: null,
    linkedin: "ingrid-wong",
  },
  {
    id: "demo-9",
    name: "Zara Lee",
    route: "B",
    icp: "early_stage_founder",
    age: 33,
    roleLabel: "Founder",
    roleLevel: 6,
    companyType: "Self-employed / Freelance",
    companySize: "1-10 employees",
    companySizeBand: 1,
    childStatus: "exploring",
    expertise: "Consulting",
    countries: ["SG", "NZ"],
    lifeContext: [],
    interests: ["Mindfulness & Meditation", "Pickleball"],
    stageIndex: 2,
    stageLabel: "Stabilizing — recurring revenue or customers, now building on that base",
    businessType: "Wellness, coaching, or personal services",
    email: "zara.lee@example.com",
    phone: null,
    linkedin: "zara-lee",
  },
  {
    id: "demo-10",
    name: "Devi Krishnan",
    route: "B",
    icp: "late_stage_founder",
    age: 41,
    roleLabel: "Founder",
    roleLevel: 6,
    companyType: "Small or mid-size business (SME)",
    companySize: "11-50 employees",
    companySizeBand: 2,
    childStatus: "parent_school",
    expertise: "General Management",
    countries: ["SG", "MY"],
    lifeContext: ["entrepreneur_mom"],
    interests: ["Running", "Badminton"],
    stageIndex: 0,
    stageLabel:
      "Actively growing what I've built — team or market expansion, navigating more complex day-to-day ops",
    businessType: "A consumer tech product or physical goods business",
    email: "devi.krishnan@example.com",
    phone: null,
    linkedin: "devi-krishnan",
  },
  {
    id: "demo-11",
    name: "Sophie Lambert",
    route: "B",
    icp: "late_stage_founder",
    age: 39,
    roleLabel: "Founder",
    roleLevel: 6,
    companyType: "Small or mid-size business (SME)",
    companySize: "51-250 employees",
    companySizeBand: 3,
    childStatus: "childfree",
    expertise: "Sales & Business Development",
    countries: ["SG", "FR"],
    lifeContext: ["third_culture"],
    interests: ["Art & Museums", "Concerts & Festivals"],
    stageIndex: 2,
    stageLabel: "Feeling steady in what I've built, starting to think about the future for me and the business",
    businessType: "Professional services — consulting, advisory, or creative work",
    email: "sophie.lambert@example.com",
    phone: null,
    linkedin: "sophie-lambert",
  },
  {
    id: "demo-12",
    name: "Hana Fujimoto",
    route: "B",
    icp: "late_stage_founder",
    age: 38,
    roleLabel: "Founder",
    roleLevel: 6,
    companyType: "Small or mid-size business (SME)",
    companySize: "11-50 employees",
    companySizeBand: 2,
    childStatus: "parent_teen",
    expertise: "Creative/Arts",
    countries: ["SG", "JP"],
    lifeContext: ["sg_returning", "entrepreneur_mom"],
    interests: ["Dance", "Art & Museums"],
    stageIndex: 1,
    stageLabel: "Rethinking or reworking the business itself — new direction, new brand, new industry, a different model",
    businessType: "Wellness, coaching, or personal services",
    email: "hana.fujimoto@example.com",
    phone: null,
    linkedin: "hana-fujimoto",
  },
  {
    id: "demo-13",
    name: "Nadia Hassan",
    route: "B",
    icp: "portfolio_independent",
    age: 38,
    roleLabel: "Between roles",
    roleLevel: null,
    companyType: "Self-employed / Freelance",
    companySize: "1-10 employees",
    companySizeBand: 1,
    childStatus: "parent_teen",
    expertise: "Consulting",
    countries: ["SG", "AE"],
    lifeContext: ["sg_returning", "working_mom"],
    interests: ["Mindfulness & Meditation", "Yoga & Pilates"],
    stageIndex: 1,
    stageLabel: "A few steady clients or income streams, but still building real stability",
    businessType: null,
    email: "nadia.hassan@example.com",
    phone: null,
    linkedin: "nadia-hassan",
  },
  {
    id: "demo-14",
    name: "Karen Ng",
    route: "B",
    icp: "portfolio_independent",
    age: 34,
    roleLabel: "C-suite",
    roleLevel: 6,
    companyType: "Self-employed / Freelance",
    companySize: "1-10 employees",
    companySizeBand: 1,
    childStatus: "exploring",
    expertise: "Finance & Accounting",
    countries: ["SG", "HK"],
    lifeContext: ["digital_nomad"],
    interests: ["Padel", "Running"],
    stageIndex: 2,
    stageLabel: "Feeling stable and established, now thinking about how to grow or evolve my operating model",
    businessType: null,
    email: "karen.ng@example.com",
    phone: null,
    linkedin: "karen-ng",
  },
  {
    id: "demo-15",
    name: "Isabel Cruz",
    route: "B",
    icp: "portfolio_independent",
    age: 29,
    roleLabel: "C-suite",
    roleLevel: 6,
    companyType: "Self-employed / Freelance",
    companySize: "1-10 employees",
    companySizeBand: 1,
    childStatus: "childfree",
    expertise: "Operations & Strategy",
    countries: ["SG", "PH"],
    lifeContext: ["digital_nomad"],
    interests: ["Badminton", "Weightlifting"],
    stageIndex: 0,
    stageLabel: "Just made the shift to working for myself, still finding my footing",
    businessType: null,
    email: "isabel.cruz@example.com",
    phone: null,
    linkedin: "isabel-cruz",
  },
  {
    id: "demo-16",
    name: "Bianca Ferreira",
    route: "B",
    icp: "established_career",
    age: 35,
    roleLabel: "Director / VP",
    roleLevel: 5,
    companyType: "Large company / Corporate",
    companySize: "Over 2,500 employees",
    companySizeBand: 5,
    childStatus: "parent_young",
    expertise: "Data & Analytics",
    countries: ["SG", "BR"],
    lifeContext: ["new_mom"],
    interests: ["Yoga & Pilates", "Art & Museums"],
    stageIndex: 0,
    stageLabel:
      "Building a life outside of work — health, relationships, or interests I want to grow alongside a career that's already steady",
    businessType: null,
    email: "bianca.ferreira@example.com",
    phone: null,
    linkedin: "bianca-ferreira",
  },
  {
    id: "demo-17",
    name: "Grace Lim",
    route: "B",
    icp: "established_career",
    age: 33,
    roleLabel: "Senior manager",
    roleLevel: 4,
    companyType: "Large company / Corporate",
    companySize: "251-2,500 employees",
    companySizeBand: 4,
    childStatus: "childfree",
    expertise: "Marketing & Brand",
    countries: ["SG", "GB"],
    lifeContext: ["burnout"],
    interests: ["Running", "Weightlifting", "Concerts & Festivals"],
    stageIndex: 1,
    stageLabel: "Working toward more visibility & influence and want to compare notes with peers",
    businessType: null,
    email: "grace.lim@example.com",
    phone: null,
    linkedin: "grace-lim",
  },
  {
    id: "demo-18",
    name: "Olivia Fischer",
    route: "B",
    icp: "established_career",
    age: 37,
    roleLabel: "C-suite",
    roleLevel: 6,
    companyType: "Large company / Corporate",
    companySize: "Over 2,500 employees",
    companySizeBand: 5,
    childStatus: "parent_school",
    expertise: "General Management",
    countries: ["SG", "DE"],
    lifeContext: ["working_mom"],
    interests: ["Tennis", "Film & Theatre"],
    stageIndex: 2,
    stageLabel:
      "Finding a way to grow / continue to be ambitious in my career without compromising other aspects of my life",
    businessType: null,
    email: "olivia.fischer@example.com",
    phone: null,
    linkedin: "olivia-fischer",
  },
];

export function payloadInputValidator(data: unknown) {
  return payloadSchema.parse(data);
}

export async function handleGetDemoPersona() {
  return { firstName: DEMO_PERSONA.name.split(/\s+/)[0] || "there" };
}

export async function handleSubmitIntake(data: Payload) {
  const profile = DEMO_PERSONA;

  // Frontend-only demo: no live respondent pool, just the hardcoded roster.
  const routeA: Candidate[] = [];
  const routeB = DEMO_CANDIDATES;

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
    onboardingLifeContext: profile.lifeContext,
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
    stageLabel: ICP_CARD_LABELS[match.candidate.icp],
    businessType: match.candidate.businessType,
    countries: match.candidate.countries,
    lifeContext: match.candidate.lifeContext,
    interests: match.candidate.interests,
    email: match.candidate.email,
    linkedin: match.candidate.linkedin,
    sharedTags: match.sharedTags,
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