import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";

import podiumMark from "@/assets/podium-mark.png";
import { MatchCard } from "@/components/intake/MatchCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  BUSINESS_TYPE,
  BUSINESS_TYPE_ICPS,
  CHILD_STATUS_OPTIONS,
  COMPANY_SIZE_OPTIONS,
  COMPANY_TYPE_OPTIONS,
  COUNTRY_OPTIONS,
  EXPERTISE_OPTIONS,
  FOUNDER_LENGTH,
  GATES,
  GATE_YES_TARGET,
  ICP_LABELS,
  ICP_OPTIONS,
  INTEREST_OPTIONS,
  LIFE_CONTEXT_OPTIONS,
  LIFE_CONTEXT_PROMPT,
  OPEN_TEXT_PROMPT,
  REROUTES,
  ROLE_OPTIONS,
  STAGES,
  type IcpKey,
} from "@/lib/intake-tree";
import { submitIntake, type PublicMatch } from "@/lib/intake.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Podium Introductions — Find your three matches" },
      {
        name: "description",
        content:
          "Answer a short set of questions about where you are in your career and life, and see the three Podium members you'd be introduced to — with the reasoning behind each match.",
      },
      { property: "og:title", content: "Podium Introductions — Find your three matches" },
      {
        property: "og:description",
        content:
          "A live demo of Podium's introductions engine: a short intake conversation, then three real member matches with scoring shown.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type StepId =
  | "name"
  | "email"
  | "phone"
  | "birthYear"
  | "icp"
  | "gate"
  | "reroute"
  | "founderLength"
  | "stage"
  | "businessType"
  | "openText"
  | "lifeContext"
  | "role"
  | "companyType"
  | "companySize"
  | "expertise"
  | "countries"
  | "childStatus"
  | "interests"
  | "results";

const ORDER: StepId[] = [
  "name",
  "email",
  "phone",
  "birthYear",
  "icp",
  "gate",
  "reroute",
  "founderLength",
  "stage",
  "businessType",
  "openText",
  "lifeContext",
  "role",
  "companyType",
  "companySize",
  "expertise",
  "countries",
  "childStatus",
  "interests",
  "results",
];

type Answers = {
  name: string;
  email: string;
  phone: string;
  birthYear: number | null;
  initialIcp: IcpKey | null;
  icp: IcpKey | null;
  gateAnswer: "yes" | "no" | null;
  rerouteAnswer: string | null;
  founderTenure: string | null;
  stageIndex: number | null;
  stageLabel: string | null;
  businessType: string | null;
  openText: string | null;
  lifeContext: string[];
  roleLabel: string | null;
  roleLevel: number | null;
  companyType: string | null;
  companySize: string | null;
  companySizeBand: number | null;
  expertise: string | null;
  countries: string[];
  childStatus: string | null;
  interests: string[];
};

const EMPTY: Answers = {
  name: "",
  email: "",
  phone: "",
  birthYear: null,
  initialIcp: null,
  icp: null,
  gateAnswer: null,
  rerouteAnswer: null,
  founderTenure: null,
  stageIndex: null,
  stageLabel: null,
  businessType: null,
  openText: null,
  lifeContext: [],
  roleLabel: null,
  roleLevel: null,
  companyType: null,
  companySize: null,
  companySizeBand: null,
  expertise: null,
  countries: [],
  childStatus: null,
  interests: [],
};

type Bubble = { role: "bot" | "user"; text: string; id: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function visitorId() {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem("podium-visitor");
  if (existing) return existing;
  const fresh = `v_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  window.localStorage.setItem("podium-visitor", fresh);
  return fresh;
}

function Index() {
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [step, setStep] = useState<StepId>("name");
  const [pendingTarget, setPendingTarget] = useState<"founder_length" | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [multi, setMulti] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    matches: PublicMatch[];
    poolSizes: { routeA: number; routeB: number };
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const run = useServerFn(submitIntake);

  const prompt = useMemo(() => promptFor(step, answers), [step, answers]);

  useEffect(() => {
    setBubbles([
      {
        role: "bot",
        id: "intro",
        text: "Hi — I'm the Podium introductions assistant. A few questions about where you are in your career and life, and I'll show you the three members we'd introduce you to.",
      },
      { role: "bot", id: "first-question", text: "First — what's your name?" },
    ]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [bubbles, result, loading]);

  const progress = (ORDER.indexOf(step) / (ORDER.length - 1)) * 100;

  function say(role: Bubble["role"], text: string) {
    setBubbles((current) => [...current, { role, text, id: `${role}-${current.length}-${text.slice(0, 12)}` }]);
  }

  function nextStep(from: StepId, next: Answers, target: "founder_length" | null) {
    let index = ORDER.indexOf(from) + 1;
    while (index < ORDER.length) {
      const candidate = ORDER[index]!;
      if (candidate === "gate" && (!next.initialIcp || !GATES[next.initialIcp])) {
        index += 1;
        continue;
      }
      if (candidate === "reroute" && !(next.gateAnswer === "no" && next.initialIcp && REROUTES[next.initialIcp])) {
        index += 1;
        continue;
      }
      if (candidate === "founderLength" && target !== "founder_length") {
        index += 1;
        continue;
      }
      if (candidate === "businessType" && !(next.icp && BUSINESS_TYPE_ICPS.includes(next.icp))) {
        index += 1;
        continue;
      }
      return candidate;
    }
    return "results" as StepId;
  }

  function advance(update: Partial<Answers>, echo: string, target: "founder_length" | null = null) {
    const next = { ...answers, ...update };
    setAnswers(next);
    setPendingTarget(target);
    say("user", echo);
    setDraft("");
    setMulti([]);
    setError(null);
    const upcoming = nextStep(step, next, target ?? pendingTarget);
    setStep(upcoming);
    if (upcoming === "results") void submit(next);
    else {
      const nextPrompt = promptFor(upcoming, next);
      if (nextPrompt) say("bot", nextPrompt.question);
    }
  }

  async function submit(final: Answers) {
    setLoading(true);
    setError(null);
    try {
      const transcript = [...bubbles].map(({ role, text }) => ({ role, text }));
      const response = await run({
        data: {
          visitorId: visitorId(),
          name: final.name,
          email: final.email,
          phone: final.phone,
          birthYear: final.birthYear ?? 1990,
          icp: final.icp ?? "established_career",
          gateAnswer: final.gateAnswer,
          rerouteAnswer: final.rerouteAnswer,
          founderTenure: final.founderTenure,
          stageIndex: final.stageIndex,
          stageLabel: final.stageLabel,
          businessType: final.businessType,
          openText: final.openText,
          lifeContext: final.lifeContext,
          roleLabel: final.roleLabel,
          roleLevel: final.roleLevel,
          companyType: final.companyType,
          companySize: final.companySize,
          companySizeBand: final.companySizeBand,
          expertise: final.expertise,
          countries: final.countries,
          childStatus: final.childStatus,
          interests: final.interests,
          transcript: transcript.slice(-100),
        },
      });
      setResult(response);
      say(
        "bot",
        response.matches.length > 0
          ? `Here are your ${response.matches.length} closest matches, ${final.name.split(" ")[0]}.`
          : "I couldn't find a compatible match in the current pool yet — your profile is saved, and we'll match you as the pool grows.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function submitText() {
    const value = draft.trim();
    if (step === "name") {
      if (value.length < 2) return setError("Please tell me your name.");
      return advance({ name: value }, value);
    }
    if (step === "email") {
      if (!EMAIL_RE.test(value)) return setError("That email doesn't look right.");
      return advance({ email: value }, value);
    }
    if (step === "phone") {
      if (value.replace(/\D/g, "").length < 6) return setError("Please enter a reachable phone number.");
      return advance({ phone: value }, value);
    }
    if (step === "birthYear") {
      const year = Number(value);
      if (!Number.isInteger(year) || year < 1940 || year > 2012)
        return setError("Please enter your birth year, e.g. 1988.");
      return advance({ birthYear: year }, value);
    }
    if (step === "openText") {
      return advance({ openText: value || null }, value || "(skipped)");
    }
    return undefined;
  }

  function chooseOption(option: { label: string; value: string }) {
    switch (step) {
      case "icp": {
        const icp = option.value as IcpKey;
        return advance({ initialIcp: icp, icp }, option.label);
      }
      case "gate": {
        const yes = option.value === "yes";
        const icp = answers.initialIcp!;
        if (yes) {
          const target = GATE_YES_TARGET[icp] === "founder_length" ? "founder_length" : null;
          return advance({ gateAnswer: "yes", icp }, option.label, target);
        }
        return advance({ gateAnswer: "no" }, option.label);
      }
      case "reroute": {
        const reroute = REROUTES[answers.initialIcp!]!;
        const chosen = reroute.options.find((entry) => entry.label === option.value)!;
        if (chosen.target === "founder_length")
          return advance({ rerouteAnswer: chosen.label }, option.label, "founder_length");
        if (chosen.target === "stay")
          return advance({ rerouteAnswer: chosen.label, icp: answers.initialIcp }, option.label);
        return advance({ rerouteAnswer: chosen.label, icp: chosen.target as IcpKey }, option.label);
      }
      case "founderLength": {
        const chosen = FOUNDER_LENGTH.options.find((entry) => entry.label === option.value)!;
        return advance({ founderTenure: chosen.label, icp: chosen.target }, option.label);
      }
      case "stage": {
        const options = STAGES[answers.icp!].options;
        const index = options.indexOf(option.value);
        return advance({ stageIndex: index, stageLabel: option.value }, option.label);
      }
      case "businessType":
        return advance({ businessType: option.value }, option.label);
      case "role": {
        const chosen = ROLE_OPTIONS.find((entry) => entry.label === option.value)!;
        return advance({ roleLabel: chosen.label, roleLevel: chosen.level }, option.label);
      }
      case "companyType":
        return advance({ companyType: option.value }, option.label);
      case "companySize": {
        const chosen = COMPANY_SIZE_OPTIONS.find((entry) => entry.label === option.value)!;
        return advance({ companySize: chosen.label, companySizeBand: chosen.band }, option.label);
      }
      case "expertise":
        return advance({ expertise: option.value }, option.label);
      case "childStatus":
        return advance({ childStatus: option.value }, option.label);
      default:
        return undefined;
    }
  }

  function submitMulti() {
    if (step === "lifeContext") {
      const tags = multi.flatMap(
        (label) => LIFE_CONTEXT_OPTIONS.find((entry) => entry.label === label)?.tags ?? [],
      );
      return advance({ lifeContext: [...new Set(tags)] }, multi.length ? multi.join(" · ") : "None of these");
    }
    if (step === "countries") {
      if (multi.length === 0) return setError("Pick at least one country you've lived in.");
      const codes = multi.map((label) => COUNTRY_OPTIONS.find((entry) => entry.label === label)!.code);
      return advance({ countries: codes }, multi.join(" · "));
    }
    if (step === "interests") {
      return advance({ interests: multi }, multi.length ? multi.join(" · ") : "None of these");
    }
    return undefined;
  }

  const isMulti = step === "lifeContext" || step === "countries" || step === "interests";
  const isText = ["name", "email", "phone", "birthYear", "openText"].includes(step);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-6">
        <header className="flex items-center gap-3 pb-4">
          <img src={podiumMark} alt="Podium" className="h-9 w-9 rounded-full object-cover" />
          <div className="flex-1">
            <h1 className="font-display text-xl leading-none text-foreground">
              Podium Introductions
            </h1>
            <p className="text-xs text-muted-foreground">
              Intake demo · matched against the live membership database
            </p>
          </div>
          {answers.icp && (
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {ICP_LABELS[answers.icp]}
            </Badge>
          )}
        </header>

        <Progress value={result ? 100 : progress} className="h-1" />

        <section className="flex-1 space-y-4 py-6" aria-live="polite">
          {bubbles.map((bubble) => (
            <div
              key={bubble.id}
              className={bubble.role === "bot" ? "flex justify-start" : "flex justify-end"}
            >
              <p
                className={
                  bubble.role === "bot"
                    ? "max-w-[85%] rounded-2xl rounded-bl-sm bg-card px-4 py-3 text-sm text-card-foreground"
                    : "max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm text-primary-foreground"
                }
              >
                {bubble.text}
              </p>
            </div>
          ))}

          {loading && (
            <p className="text-sm text-muted-foreground">Running the matching cascade…</p>
          )}

          {result && (
            <div className="space-y-4 pt-2">
              {result.matches.map((match, index) => (
                <MatchCard key={match.id} match={match} rank={index + 1} />
              ))}
              <p className="text-center text-xs text-muted-foreground">
                Scored against {result.poolSizes.routeB} members in the membership database and{" "}
                {result.poolSizes.routeA} completed intake profiles.
              </p>
            </div>
          )}
          <div ref={bottomRef} />
        </section>

        {!result && !loading && (
          <div className="sticky bottom-0 space-y-3 border-t border-border bg-background pt-4 pb-4">
            {error && <p className="text-sm text-destructive">{error}</p>}

            {isText && prompt && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submitText();
                }}
                className="flex gap-2"
              >
                {step === "openText" ? (
                  <Textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Say as much or as little as you like"
                    rows={3}
                    autoFocus
                  />
                ) : (
                  <Input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={prompt.placeholder}
                    type={step === "email" ? "email" : step === "phone" ? "tel" : "text"}
                    inputMode={step === "birthYear" ? "numeric" : undefined}
                    autoFocus
                  />
                )}
                <Button type="submit">Send</Button>
              </form>
            )}

            {!isText && prompt && !isMulti && (
              <div className="flex flex-col gap-2">
                {prompt.options.map((option) => (
                  <Button
                    key={option.value}
                    variant="outline"
                    className="h-auto justify-start whitespace-normal py-3 text-left text-sm"
                    onClick={() => chooseOption(option)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            )}

            {isMulti && prompt && (
              <div className="space-y-3">
                <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
                  {prompt.options.map((option) => {
                    const selected = multi.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setMulti((current) =>
                            selected
                              ? current.filter((item) => item !== option.value)
                              : [...current, option.value],
                          )
                        }
                        aria-pressed={selected}
                        className={
                          selected
                            ? "rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground"
                            : "rounded-full border border-border px-3 py-1.5 text-xs text-foreground hover:bg-secondary"
                        }
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <Button onClick={submitMulti} className="w-full">
                  {multi.length > 0 ? `Continue with ${multi.length} selected` : "Continue"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

type Prompt = {
  question: string;
  placeholder?: string;
  options: { label: string; value: string }[];
};

function promptFor(step: StepId, answers: Answers): Prompt | null {
  const asOptions = (labels: string[]) => labels.map((label) => ({ label, value: label }));
  switch (step) {
    case "name":
      return { question: "First — what's your name?", placeholder: "Your full name", options: [] };
    case "email":
      return { question: "What email should we use for your introductions?", placeholder: "you@example.com", options: [] };
    case "phone":
      return { question: "And a phone number, in case we need to reach you?", placeholder: "+65 9123 4567", options: [] };
    case "birthYear":
      return { question: "What year were you born?", placeholder: "1988", options: [] };
    case "icp":
      return {
        question: "Which of these sounds most like you right now?",
        options: ICP_OPTIONS.map((option) => ({ label: option.label, value: option.key })),
      };
    case "gate":
      return answers.initialIcp && GATES[answers.initialIcp]
        ? {
            question: GATES[answers.initialIcp]!,
            options: [
              { label: "Yes, that's right", value: "yes" },
              { label: "Not quite", value: "no" },
            ],
          }
        : null;
    case "reroute": {
      const reroute = answers.initialIcp ? REROUTES[answers.initialIcp] : undefined;
      return reroute
        ? {
            question: reroute.prompt,
            options: reroute.options.map((option) => ({ label: option.label, value: option.label })),
          }
        : null;
    }
    case "founderLength":
      return { question: FOUNDER_LENGTH.prompt, options: asOptions(FOUNDER_LENGTH.options.map((o) => o.label)) };
    case "stage":
      return answers.icp
        ? { question: STAGES[answers.icp].prompt, options: asOptions(STAGES[answers.icp].options) }
        : null;
    case "businessType":
      return { question: BUSINESS_TYPE.prompt, options: asOptions(BUSINESS_TYPE.options) };
    case "openText":
      return { question: OPEN_TEXT_PROMPT, options: [] };
    case "lifeContext":
      return {
        question: LIFE_CONTEXT_PROMPT,
        options: asOptions(LIFE_CONTEXT_OPTIONS.map((option) => option.label)),
      };
    case "role":
      return { question: "What's your current level?", options: asOptions(ROLE_OPTIONS.map((o) => o.label)) };
    case "companyType":
      return { question: "What kind of organisation do you work in?", options: asOptions(COMPANY_TYPE_OPTIONS) };
    case "companySize":
      return { question: "Roughly how big is it?", options: asOptions(COMPANY_SIZE_OPTIONS.map((o) => o.label)) };
    case "expertise":
      return { question: "Where does your expertise sit?", options: asOptions(EXPERTISE_OPTIONS) };
    case "countries":
      return {
        question: "Which countries have you lived in?",
        options: asOptions(COUNTRY_OPTIONS.map((option) => option.label)),
      };
    case "childStatus":
      return {
        question: "And where are you when it comes to children?",
        options: CHILD_STATUS_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
      };
    case "interests":
      return { question: "Last one — what do you do for yourself outside work?", options: asOptions(INTEREST_OPTIONS) };
    default:
      return null;
  }
}
