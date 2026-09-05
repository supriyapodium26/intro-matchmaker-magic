import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import confetti from "canvas-confetti";
import { Check, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import podiumLogo from "@/assets/podium-logo.png.asset.json";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { MatchCard } from "@/components/intake/MatchCard";
import {
  BUSINESS_TYPE,
  BUSINESS_TYPE_ICPS,
  FOUNDER_LENGTH,
  GATES,
  GATE_YES_TARGET,
  ICP_OPTIONS,
  LIFE_CONTEXT_OPTIONS,
  LIFE_CONTEXT_PROMPT,
  OPEN_TEXT_PROMPT,
  REROUTES,
  STAGES,
  type IcpKey,
} from "@/lib/intake-tree";
import { getDemoPersona, submitIntake, type PublicMatch } from "@/lib/intake.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Podium Introductions — Find your three matches" },
      {
        name: "description",
        content:
          "Answer a short set of questions about where you are in your career and life, and see the three Podium members you'd be introduced to.",
      },
      { property: "og:title", content: "Podium Introductions — Find your three matches" },
      {
        property: "og:description",
        content:
          "A live demo of Podium's introductions engine: a short conversation, then three real member matches.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type StepId =
  | "icp"
  | "gate"
  | "reroute"
  | "founderLength"
  | "stage"
  | "businessType"
  | "openText"
  | "lifeContext"
  | "results";

const ORDER: StepId[] = [
  "icp",
  "gate",
  "reroute",
  "founderLength",
  "stage",
  "businessType",
  "openText",
  "lifeContext",
  "results",
];

type Answers = {
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
};

const EMPTY: Answers = {
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
};

type Bubble = { role: "bot" | "user"; text: string; id: string };

function Index() {
  const [sessionKey, setSessionKey] = useState(0);

  return (
    <main className="mx-auto flex h-dvh w-full max-w-3xl flex-col overflow-hidden px-4 sm:px-8">
      <header className="-mx-4 flex shrink-0 items-center justify-between gap-3 border-b border-foreground/10 bg-foreground px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:-mx-8 sm:px-8 sm:py-5">
        <div className="flex items-center gap-2.5">
          <img
            src={podiumLogo.url}
            alt=""
            className="size-8 rounded-full object-cover"
          />
          <span className="font-display text-lg leading-none text-background">
            Your Podium Curator
          </span>
        </div>
        <button
          type="button"
          onClick={() => setSessionKey((current) => current + 1)}
          className="shrink-0 text-xs text-background/70 underline-offset-4 transition-colors hover:text-background hover:underline"
        >
          Start over
        </button>
      </header>
      <IntakeChat key={sessionKey} />
    </main>
  );
}

function IntakeChat() {
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [step, setStep] = useState<StepId>("icp");
  const [pendingTarget, setPendingTarget] = useState<"founder_length" | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [multi, setMulti] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [dockVisible, setDockVisible] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoFirstName, setDemoFirstName] = useState("there");
  const [result, setResult] = useState<{
    matches: PublicMatch[];
    looseMatches: PublicMatch[];
    wildcards: PublicMatch[];
    profileFound: boolean;
    poolSizes: { routeA: number; routeB: number };
  } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockKey, setDockKey] = useState(0);
  const run = useServerFn(submitIntake);
  const fetchDemoPersona = useServerFn(getDemoPersona);

  const prompt = useMemo(() => promptFor(step, answers), [step, answers]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  useEffect(() => {
    if (!dockVisible) return;
    setDockKey((current) => current + 1);
    dockRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [dockVisible, step]);

  const say = useCallback((role: Bubble["role"], text: string) => {
    setBubbles((current) => [
      ...current,
      { role, text, id: `${role}-${current.length}-${Date.now()}` },
    ]);
  }, []);

  const botSay = useCallback(
    (text: string, next?: () => void, delay = 550) => {
      setTyping(true);
      const timer = setTimeout(() => {
        setTyping(false);
        say("bot", text);
        next?.();
      }, delay);
      timers.current.push(timer);
    },
    [say],
  );

  const start = async () => {
    setHasStarted(true);
    setTyping(true);
    let firstName = "there";
    try {
      const persona = await fetchDemoPersona();
      if (persona.firstName) firstName = persona.firstName;
    } catch {
      // keep the fallback greeting if the persona lookup fails
    }
    setDemoFirstName(firstName);
    setTyping(false);
    botSay(
      `Hi ${firstName}! I'm Lam, Podium's curator. You shouldn't have to scroll through hundreds of profiles hoping to recognise yourself in one. We've spent a year learning what makes an introduction land, and it's seldom the work itself. It's the relief of meeting someone weighing the same things you are. Answer a few questions, and I'll show you three people I think you'll enjoy meeting.`,
      () => {
        const icpPrompt = promptFor("icp", EMPTY);
        if (icpPrompt) botSay(icpPrompt.question, () => setDockVisible(true));
        else setDockVisible(true);
      },
      350,
    );
  };

  const progressTotal =
    (answers.icp ? 1 : 1) + 3 + (answers.icp && BUSINESS_TYPE_ICPS.includes(answers.icp) ? 1 : 0);
  const answered = bubbles.filter((bubble) => bubble.role === "user").length;

  function nextStep(from: StepId, next: Answers, target: "founder_length" | null) {
    let index = ORDER.indexOf(from) + 1;
    while (index < ORDER.length) {
      const candidate = ORDER[index]!;
      if (candidate === "gate" && (!next.initialIcp || !GATES[next.initialIcp])) {
        index += 1;
        continue;
      }
      if (
        candidate === "reroute" &&
        !(next.gateAnswer === "no" && next.initialIcp && REROUTES[next.initialIcp])
      ) {
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
    setDockVisible(false);
    say("user", echo);
    setMulti([]);
    setError(null);
    const upcoming = nextStep(step, next, target ?? pendingTarget);
    setStep(upcoming);
    if (upcoming === "results") {
      void submit(next);
      return;
    }
    const nextPrompt = promptFor(upcoming, next);
    if (nextPrompt) botSay(nextPrompt.question, () => setDockVisible(true));
    else setDockVisible(true);
  }

  async function submit(final: Answers) {
    setLoading(true);
    setError(null);
    try {
      const response = await run({
        data: {
          icp: final.icp ?? "established_career",
          gateAnswer: final.gateAnswer,
          rerouteAnswer: final.rerouteAnswer,
          founderTenure: final.founderTenure,
          stageIndex: final.stageIndex,
          stageLabel: final.stageLabel,
          businessType: final.businessType,
          openText: final.openText,
          lifeContext: final.lifeContext,
        },
      });
      say(
        "bot",
        response.matches.length > 0
          ? `Hey ${demoFirstName}, these are three members I think you should connect with. Each of them shares something with you - where you are right now, or what you're drawn to outside of work. Read through their profiles and reach out to whoever you find yourself in.`
          : "I couldn't find a compatible match in the current pool right now.",
      );
      setResult(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleText(value: string) {
    if (step === "openText") return advance({ openText: value || null }, value || "(skipped)");
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
      default:
        return undefined;
    }
  }

  function submitMulti(selected: string[]) {
    if (step !== "lifeContext") return;
    const tags = selected.flatMap(
      (label) => LIFE_CONTEXT_OPTIONS.find((entry) => entry.label === label)?.tags ?? [],
    );
    advance(
      { lifeContext: [...new Set(tags)] },
      selected.length ? selected.join(" · ") : "None of these",
    );
  }

  const isMulti = step === "lifeContext";
  const isText = step === "openText";
  const showDock = dockVisible && !typing && !loading && !result && Boolean(prompt);

  return (
    <>
      {hasStarted ? (
        <ProgressBar answered={answered} total={progressTotal} done={Boolean(result)} />
      ) : null}

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-5 px-0 py-8" aria-live="polite">
          {!hasStarted ? (
            <div className="flex flex-1 flex-col items-center justify-center py-16 text-center duration-500 animate-in fade-in">
              <img
                src={podiumLogo.url}
                alt=""
                className="mb-7 size-16 rounded-full object-cover shadow-sm"
              />
              <p className="max-w-xs font-display text-3xl leading-tight text-foreground">
                Meet the women in Podium who are where you are
              </p>
              <button
                type="button"
                onClick={start}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 hover:opacity-90 active:translate-y-0"
              >
                Start here
                <ChevronRight className="size-4" />
              </button>
            </div>
          ) : null}

          {bubbles.map((bubble, index) => {
            if (bubble.role === "bot") {
              const continues = bubbles[index - 1]?.role === "bot";
              return (
                <div
                  key={bubble.id}
                  className={`flex max-w-[88%] items-end gap-2 duration-500 animate-in fade-in slide-in-from-bottom-2 ${
                    continues ? "-mt-3" : ""
                  }`}
                >
                  {continues ? (
                    <span aria-hidden="true" className="size-7 shrink-0" />
                  ) : (
                    <img
                      src={podiumLogo.url}
                      alt="Podium"
                      className="size-7 shrink-0 rounded-full object-cover"
                    />
                  )}
                  <p className="whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-card px-4 py-3 text-sm leading-relaxed text-foreground shadow-sm">
                    {bubble.text}
                  </p>
                </div>
              );
            }
            return (
              <div
                key={bubble.id}
                className="ml-auto flex max-w-[88%] flex-wrap justify-end gap-2 duration-500 animate-in fade-in slide-in-from-bottom-2"
              >
                <span className="rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground shadow-sm">
                  {bubble.text}
                </span>
              </div>
            );
          })}

          {typing || loading ? <TypingBubble /> : null}

          {result ? <ResultsPanel result={result} /> : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div
        ref={dockRef}
        hidden={!showDock && !error}
        className={`-mx-4 flex max-h-[56dvh] shrink-0 flex-col rounded-t-3xl border-t border-border bg-card/85 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md transition-shadow sm:-mx-8 sm:px-8 ${
          showDock ? "shadow-[0_-14px_40px_-26px_rgba(50,48,46,0.7)]" : ""
        }`}
      >
        {showDock ? (
          <span
            aria-hidden="true"
            className="mx-auto mb-1 h-1 w-10 shrink-0 rounded-full bg-border"
          />
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col pb-1 pt-2">
          {error ? <p className="pb-2 text-sm text-destructive">{error}</p> : null}

          {showDock && isText && prompt ? (
            <TextAnswer
              key={dockKey}
              step={step}
              placeholder={prompt.placeholder ?? "Type your answer"}
              onSubmit={handleText}
              onError={setError}
            />
          ) : null}

          {showDock && !isText && !isMulti && prompt ? (
            <SingleSelect key={dockKey} options={prompt.options} onSelect={chooseOption} />
          ) : null}

          {showDock && isMulti && prompt ? (
            <MultiSelect
              key={dockKey}
              options={prompt.options.map((option) => option.label)}
              selected={multi}
              onChange={setMulti}
              onSubmit={submitMulti}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}

function validateText(_step: StepId, _value: string): string | null {
  return null;
}

function TextAnswer({
  step,
  placeholder,
  onSubmit,
  onError,
}: {
  step: StepId;
  placeholder: string;
  onSubmit: (value: string) => void;
  onError: (message: string | null) => void;
}) {
  const [value, setValue] = useState("");

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const problem = validateText(step, value);
        if (problem) {
          onError(problem);
          return;
        }
        onError(null);
        onSubmit(value.trim());
      }}
      className="flex flex-col gap-2"
    >
      <DockHint>Say as much or as little as you like</DockHint>
      <div className="flex items-center gap-2">
        <textarea
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            onError(null);
          }}
          rows={3}
          placeholder={placeholder}
          autoFocus
          className="w-full flex-1 resize-none rounded-2xl border border-border bg-card px-4 py-3 text-base text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
        />
        <button
          type="submit"
          aria-label="Send"
          className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 active:translate-y-0"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </form>
  );
}

function SingleSelect({
  options,
  onSelect,
}: {
  options: { label: string; value: string }[];
  onSelect: (option: { label: string; value: string }) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);

  const pick = (option: { label: string; value: string }) => {
    if (chosen) return;
    setChosen(option.value);
    setTimeout(() => onSelect(option), 220);
  };

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <DockHint>Tap the one that fits</DockHint>
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-1 pb-1 [mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]">
        {options.map((option, index) => {
          const active = chosen === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => pick(option)}
              style={{ animationDelay: `${index * 45}ms` }}
              className={`group flex min-h-14 shrink-0 items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left shadow-sm transition-all duration-200 fill-mode-backwards animate-in fade-in slide-in-from-bottom-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 active:scale-[0.99] ${
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:-translate-y-0.5 hover:border-primary"
              } ${chosen && !active ? "opacity-40" : ""}`}
            >
              <span className="min-w-0 text-sm text-foreground group-hover:text-primary">
                {option.label}
              </span>
              <span
                aria-hidden="true"
                className={`grid size-8 shrink-0 place-items-center rounded-full transition-all duration-200 ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                }`}
              >
                {active ? <Check className="size-4" /> : <ChevronRight className="size-4" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MultiSelect({
  options,
  selected,
  onChange,
  onSubmit,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  onSubmit: (selected: string[]) => void;
}) {
  const toggle = (option: string) =>
    onChange(
      selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option],
    );

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <DockHint>
        Pick as many as fit{selected.length ? ` — ${selected.length} chosen` : ""}
      </DockHint>
      <div className="-mx-1 flex min-h-0 flex-1 flex-wrap content-start gap-2 overflow-y-auto overscroll-contain px-1 pb-1 [mask-image:linear-gradient(to_bottom,black_calc(100%-24px),transparent)]">
        {options.map((option, index) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              aria-pressed={active}
              style={{ animationDelay: `${index * 25}ms` }}
              className={`min-h-12 rounded-full border px-4 py-2.5 text-sm shadow-sm transition-all duration-200 fill-mode-backwards animate-in fade-in zoom-in-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 active:scale-[0.97] ${
                active
                  ? "scale-[1.02] border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:-translate-y-0.5 hover:border-primary hover:text-primary"
              }`}
            >
              {active ? "✓ " : ""}
              {option}
            </button>
          );
        })}
      </div>
      <div className="shrink-0 border-t border-border/60 pt-3">
        <button
          type="button"
          onClick={() => onSubmit(selected)}
          className="min-h-13 w-full rounded-full bg-primary px-6 py-3.5 text-sm text-primary-foreground shadow-sm transition-all duration-300 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 active:scale-[0.99]"
        >
          {selected.length ? `Continue with ${selected.length} selected` : "None of these"}
        </button>
      </div>
    </div>
  );
}

function DockHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{children}</p>
  );
}

function ProgressBar({
  answered,
  total,
  done,
}: {
  answered: number;
  total: number;
  done: boolean;
}) {
  const steps = Math.max(total, 1);
  const filled = done ? steps : Math.min(answered, steps);
  return (
    <div className="flex items-center gap-3 pt-3">
      <div className="flex flex-1 gap-1" role="presentation">
        {Array.from({ length: steps }, (_, index) => (
          <span
            key={index}
            className={`h-1 flex-1 rounded-full transition-all duration-500 ease-out ${
              index < filled ? "bg-primary" : "bg-muted"
            } ${index === filled - 1 ? "scale-y-[2]" : ""}`}
          />
        ))}
      </div>
      <span className="shrink-0 text-[11px] tabular-nums tracking-[0.08em] text-muted-foreground">
        {done ? `${steps} / ${steps}` : `${Math.min(filled + 1, steps)} / ${steps}`}
      </span>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex items-end gap-2 duration-300 animate-in fade-in">
      <img
        src={podiumLogo.url}
        alt="Podium"
        className="size-7 shrink-0 rounded-full object-cover"
      />
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-card px-4 py-3.5 shadow-sm">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            style={{ animationDelay: `${dot * 160}ms` }}
            className="size-1.5 animate-bounce rounded-full bg-primary/60"
          />
        ))}
      </div>
    </div>
  );
}

function ResultsPanel({
  result,
}: {
  result: {
    matches: PublicMatch[];
    looseMatches: PublicMatch[];
    wildcards: PublicMatch[];
    poolSizes: { routeA: number; routeB: number };
  };
}) {
  const [revealed, setRevealed] = useState(false);
  const [showLoose, setShowLoose] = useState(false);
  const [showWildcards, setShowWildcards] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 700);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (result.matches.length === 0) return;
    const fire = (ratio: number, options: confetti.Options) =>
      confetti({
        ...options,
        origin: { y: 0.7 },
        particleCount: Math.floor(160 * ratio),
        colors: ["#CC4900", "#E8A87C", "#32302E", "#FDFDF7"],
        disableForReducedMotion: true,
      });
    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.35, { spread: 60 });
    fire(0.2, { spread: 120, decay: 0.91, scalar: 0.8 });
  }, [result.matches.length]);

  return (
    <div className="space-y-4 duration-500 animate-in fade-in">
      {revealed ? (
        result.matches.map((match, index) => (
          <div
            key={match.id}
            style={{ animationDelay: `${index * 80}ms` }}
            className="duration-500 fill-mode-backwards animate-in fade-in slide-in-from-bottom-2"
          >
            <MatchCard match={match} rank={index + 1} />
          </div>
        ))
      ) : (
        <div className="flex flex-col gap-3" aria-hidden="true">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-32 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      )}
      {revealed && showLoose && result.looseMatches.length > 0 ? (
        <div className="space-y-4">
          <p className="text-center text-xs text-muted-foreground">
            Tier 2 — looser matches. Fewer things line up, but they could still be worth a coffee.
          </p>
          {result.looseMatches.map((match, index) => (
            <MatchCard key={match.id} match={match} rank={index + 4} tier="loose" />
          ))}
        </div>
      ) : null}

      {revealed && showWildcards && result.wildcards.length > 0 ? (
        <div className="space-y-4">
          <p className="text-center text-xs text-muted-foreground">
            Different chapters of life, but a lot in common outside of work.
          </p>
          {result.wildcards.map((match, index) => (
            <MatchCard key={match.id} match={match} rank={index + 1} tier="wildcard" />
          ))}
        </div>
      ) : null}

    </div>
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
            options: reroute.options.map((option) => ({
              label: option.label,
              value: option.label,
            })),
          }
        : null;
    }
    case "founderLength":
      return {
        question: FOUNDER_LENGTH.prompt,
        options: asOptions(FOUNDER_LENGTH.options.map((option) => option.label)),
      };
    case "stage":
      return answers.icp
        ? { question: STAGES[answers.icp].prompt, options: asOptions(STAGES[answers.icp].options) }
        : null;
    case "businessType":
      return { question: BUSINESS_TYPE.prompt, options: asOptions(BUSINESS_TYPE.options) };
    case "openText":
      return { question: OPEN_TEXT_PROMPT, placeholder: "Anything you'd like to add", options: [] };
    case "lifeContext":
      return {
        question: LIFE_CONTEXT_PROMPT,
        options: asOptions(LIFE_CONTEXT_OPTIONS.map((option) => option.label)),
      };
    default:
      return null;
  }
}
