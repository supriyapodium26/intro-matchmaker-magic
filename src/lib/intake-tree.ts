// Podium Introductions — intake question tree (from the decision-tree source).
// Wording changes live here; the chat flow reads this data.

export type IcpKey =
  | "career_crossroads"
  | "side_hustler"
  | "early_stage_founder"
  | "late_stage_founder"
  | "portfolio_independent"
  | "established_career";

export type RerouteTarget = IcpKey | "founder_length" | "stay";

export const ICP_OPTIONS: {
  key: IcpKey;
  short: string;
  label: string;
}[] = [
  {
    key: "career_crossroads",
    short: "Career crossroads",
    label:
      "I've built a solid corporate career, but part of me is rethinking whether this is the path I want to stay on",
  },
  {
    key: "side_hustler",
    short: "Side hustler",
    label: "I'm building a business alongside my full-time job",
  },
  {
    key: "early_stage_founder",
    short: "Early-stage founder",
    label:
      "I've recently gone all-in on my own business and I'm still figuring it out as I go",
  },
  {
    key: "late_stage_founder",
    short: "Established founder",
    label: "I've been running my business full-time for more than three years",
  },
  {
    key: "portfolio_independent",
    short: "Portfolio / independent",
    label:
      "I work for myself through consulting, freelancing, fractional roles, or multiple income streams",
  },
  {
    key: "established_career",
    short: "Established career",
    label:
      "I'm years into a corporate career that I intend to keep growing in, and I want to meet peers who can broaden my perspective",
  },
];

export const ICP_LABELS: Record<IcpKey, string> = {
  career_crossroads: "Career Crossroads",
  side_hustler: "Side Hustler",
  early_stage_founder: "Early-Stage Founder",
  late_stage_founder: "Established Founder",
  portfolio_independent: "Portfolio / Independent",
  established_career: "Established Career",
};

export const GATES: Partial<Record<IcpKey, string>> = {
  career_crossroads:
    "Is your career background mainly in corporate or traditional employment — whether you're still in it now or recently stepped away?",
  side_hustler:
    "Do you currently hold a full-time paid job, with your own business as something you're building on the side?",
  early_stage_founder:
    "Is your own business your full-time focus right now, without a corporate or other primary job?",
  late_stage_founder:
    "Is your own business your full-time focus right now, without a corporate or other primary job?",
  portfolio_independent:
    "Is it accurate that you don't hold a salaried job with full-time responsibility — your income comes from freelance, fractional work, or multiple streams?",
};

// Founder chips confirm tenure before landing on a stage question.
export const GATE_YES_TARGET: Partial<Record<IcpKey, RerouteTarget>> = {
  early_stage_founder: "founder_length",
  late_stage_founder: "founder_length",
};

export const REROUTES: Partial<
  Record<IcpKey, { prompt: string; options: { label: string; target: RerouteTarget }[] }>
> = {
  career_crossroads: {
    prompt: "What does your day-to-day recently look like?",
    options: [
      { label: "I'm running my own business full-time", target: "founder_length" },
      {
        label: "I'm doing freelance / consulting / multiple income streams",
        target: "portfolio_independent",
      },
    ],
  },
  side_hustler: {
    prompt: "What best describes your main focus right now?",
    options: [
      { label: "My own business is my main focus, full-time", target: "founder_length" },
      {
        label:
          "I work for myself through freelance / consulting / multiple streams, no salaried job",
        target: "portfolio_independent",
      },
      {
        label:
          "My full-time focus is caregiving, motherhood, or something outside traditional paid work, and I'm exploring income on the side",
        target: "stay",
      },
    ],
  },
  early_stage_founder: {
    prompt: "What does your main time actually go toward?",
    options: [
      {
        label: "I have a full-time paid job, and this business is something on the side",
        target: "side_hustler",
      },
      {
        label:
          "I work for myself in other ways — freelance, consulting, multiple streams — not one specific business",
        target: "portfolio_independent",
      },
    ],
  },
  late_stage_founder: {
    prompt: "What does your main time actually go toward?",
    options: [
      {
        label: "I have a full-time paid job, and this business is something on the side",
        target: "side_hustler",
      },
      {
        label:
          "I work for myself in other ways — freelance, consulting, multiple streams — not one specific business",
        target: "portfolio_independent",
      },
    ],
  },
  portfolio_independent: {
    prompt: "What does the rest of your work situation look like?",
    options: [
      {
        label:
          "I actually have a full-time salaried job, and these other income streams are on the side",
        target: "side_hustler",
      },
      { label: "My own single business is actually my full-time focus", target: "founder_length" },
    ],
  },
};

export const FOUNDER_LENGTH = {
  prompt: "How long have you been building this?",
  options: [
    { label: "3 years or less", target: "early_stage_founder" as IcpKey },
    { label: "More than 3 years", target: "late_stage_founder" as IcpKey },
  ],
};

export const STAGES: Record<IcpKey, { prompt: string; options: string[] }> = {
  career_crossroads: {
    prompt: "Where are you in your journey?",
    options: [
      "I'm still figuring out if corporate is really where I belong",
      "I know I want to keep growing in corporate — I just haven't found the direction that feels right yet",
      "I don't think corporate is it for me anymore, and I'm leaning toward building something of my own, even if I'm still unsure",
      "I've made peace with it — I'm ready to leave and build my own thing",
    ],
  },
  side_hustler: {
    prompt: "Where are you in your journey?",
    options: [
      "I've got one or a few ideas, but haven't started building yet",
      "I've started, but it's still early days",
      "Things are growing and gaining real momentum",
      "I'm getting ready to leave my full-time job and go all in",
    ],
  },
  early_stage_founder: {
    prompt: "Where are you in your journey?",
    options: [
      "Pre-launch — testing demand, lining up suppliers, building the backend",
      "Launched — the product is out in the world, still finding footing",
      "Stabilizing — recurring revenue or customers, now building on that base",
    ],
  },
  late_stage_founder: {
    prompt: "Where are you in your journey?",
    options: [
      "Actively growing what I've built — team or market expansion, navigating more complex day-to-day ops",
      "Rethinking or reworking the business itself — new direction, new brand, new industry, a different model",
      "Feeling steady in what I've built, starting to think about the future for me and the business",
      "Stepping back from the business — day-to-day runs on its own, or already moving to a new idea",
    ],
  },
  portfolio_independent: {
    prompt: "Where are you in your journey?",
    options: [
      "Just made the shift to working for myself, still finding my footing",
      "A few steady clients or income streams, but still building real stability",
      "Feeling stable and established, now thinking about how to grow or evolve my operating model",
      "Long-settled in this way of working, thinking about what's next",
    ],
  },
  established_career: {
    prompt: "What best describes your season?",
    options: [
      "Building a life outside of work — health, relationships, or interests I want to grow alongside a career that's already steady",
      "Working toward more visibility & influence and want to compare notes with peers",
      "Finding a way to grow / continue to be ambitious in my career without compromising other aspects of my life",
      "Not seeking anything specific — I'd just like to connect with other ambitious, curious/growth-minded women who want to build intentional lives and careers",
    ],
  },
};

export const BUSINESS_TYPE_ICPS: IcpKey[] = [
  "side_hustler",
  "early_stage_founder",
  "late_stage_founder",
];

export const BUSINESS_TYPE = {
  prompt: "What best describes what you're building?",
  options: [
    "Professional services — consulting, advisory, or creative work",
    "A consumer tech product or physical goods business",
    "Wellness, coaching, or personal services",
  ],
};

export const OPEN_TEXT_PROMPT =
  "What would you want someone to just understand in this journey, without having to explain it?";

export const LIFE_CONTEXT_OPTIONS: { label: string; tags: string[] }[] = [
  { label: "I'm recently married", tags: ["recently_married"] },
  { label: "I'm planning for parenthood", tags: ["planning_parenthood"] },
  { label: "I'm returning to work after maternity leave", tags: ["returning_maternity", "mom"] },
  { label: "I'm a new mom with young children", tags: ["new_mom", "mom"] },
  { label: "I'm a mom with older children", tags: ["older_kids", "mom"] },
  { label: "I'm an expat in Singapore", tags: ["expat_sg", "third_culture"] },
  { label: "I recently moved to Singapore", tags: ["moved_sg"] },
  {
    label: "I'm a Singaporean who's returning to Singapore after spending time abroad",
    tags: ["sg_returning"],
  },
  { label: "I'm currently on a career break or sabbatical", tags: ["career_break"] },
  { label: "I'm recovering from burnout or intentionally slowing down", tags: ["burnout"] },
];

export const LIFE_CONTEXT_PROMPT = "Anything else that's shaping where you are right now?";

export const LIFE_CONTEXT_TAG_LABELS: Record<string, string> = {
  recently_married: "recently married",
  planning_parenthood: "planning for parenthood",
  returning_maternity: "back from maternity leave",
  mom: "a mom",
  new_mom: "a new mom",
  older_kids: "a mom with older children",
  expat_sg: "an expat in Singapore",
  third_culture: "a third culture kid",
  moved_sg: "recently settled in Singapore",
  sg_returning: "a Singaporean back from abroad",
  career_break: "on a career break",
  burnout: "recovering from burnout",
  pet_parent: "a pet parent",
  digital_nomad: "remote / nomadic",
  entrepreneur_mom: "an entrepreneur mom",
  single_mom: "a single mom",
};

// ---- Profile facts the algorithm's hard filters need (not in the drawn tree) ----

export const ROLE_OPTIONS: { label: string; level: number | null }[] = [
  { label: "Individual contributor", level: 1 },
  { label: "Senior individual contributor", level: 2 },
  { label: "Manager", level: 3 },
  { label: "Senior manager", level: 4 },
  { label: "Director / VP", level: 5 },
  { label: "C-suite", level: 6 },
  { label: "Founder", level: 6 },
  { label: "Between roles", level: null },
];

export const COMPANY_TYPE_OPTIONS = [
  "Large company / Corporate",
  "Small or mid-size business (SME)",
  "Self-employed / Freelance",
  "Non-profit / NGO",
  "Government / Public sector",
];

export const COMPANY_SIZE_OPTIONS: { label: string; band: number }[] = [
  { label: "1-10 employees", band: 1 },
  { label: "11-50 employees", band: 2 },
  { label: "51-250 employees", band: 3 },
  { label: "251-2,500 employees", band: 4 },
  { label: "Over 2,500 employees", band: 5 },
];

export const EXPERTISE_OPTIONS = [
  "Marketing & Brand",
  "Sales & Business Development",
  "Product Design & Management",
  "Engineering & Technical",
  "Data & Analytics",
  "Finance & Accounting",
  "People/HR",
  "Operations & Strategy",
  "Legal & Compliance",
  "General Management",
  "Consulting",
  "Entrepreneur",
  "Content Creation/Writing",
  "Creative/Arts",
  "Education/Learning",
  "Healthcare/Medical",
  "Research",
  "Other",
];

export const CHILD_STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: "Child-free", value: "childfree" },
  { label: "Exploring parenthood (trying, expecting, or planning)", value: "exploring" },
  { label: "Parent of infants or young children (0-5)", value: "parent_young" },
  { label: "Parent of school-age children (6-12)", value: "parent_school" },
  { label: "Parent of teenagers or young adults (13+)", value: "parent_teen" },
  { label: "Prefer not to say", value: "other" },
];

export const INTEREST_OPTIONS = [
  "Yoga & Pilates",
  "Running",
  "Weightlifting",
  "Tennis",
  "Badminton",
  "Pickleball",
  "Padel",
  "Dance",
  "Mindfulness & Meditation",
  "Art & Museums",
  "Concerts & Festivals",
  "Film & Theatre",
];

export const COUNTRY_OPTIONS: { label: string; code: string }[] = [
  { label: "Singapore", code: "SG" },
  { label: "Malaysia", code: "MY" },
  { label: "Indonesia", code: "ID" },
  { label: "Thailand", code: "TH" },
  { label: "Vietnam", code: "VN" },
  { label: "Philippines", code: "PH" },
  { label: "China", code: "CN" },
  { label: "Hong Kong", code: "HK" },
  { label: "Taiwan", code: "TW" },
  { label: "Japan", code: "JP" },
  { label: "South Korea", code: "KR" },
  { label: "India", code: "IN" },
  { label: "United Arab Emirates", code: "AE" },
  { label: "Australia", code: "AU" },
  { label: "New Zealand", code: "NZ" },
  { label: "United Kingdom", code: "GB" },
  { label: "Ireland", code: "IE" },
  { label: "France", code: "FR" },
  { label: "Germany", code: "DE" },
  { label: "Netherlands", code: "NL" },
  { label: "Switzerland", code: "CH" },
  { label: "Spain", code: "ES" },
  { label: "Italy", code: "IT" },
  { label: "United States", code: "US" },
  { label: "Canada", code: "CA" },
  { label: "Brazil", code: "BR" },
  { label: "South Africa", code: "ZA" },
];

export const SHARED_PROFILE_HEADING = "A little more about you";
export const JOURNEY_HEADING = "Where you are right now";
export const CONTACT_HEADING = "First, the basics";
