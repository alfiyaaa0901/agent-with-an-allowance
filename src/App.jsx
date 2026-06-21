import React, { useState, useMemo, useEffect, useRef } from "react";


function toMinutes(timeStr) {
  const [time, meridiem] = timeStr.trim().split(" ");
  let [h, m] = time.split(":").map(Number);
  if (meridiem) {
    if (meridiem.toUpperCase() === "PM" && h !== 12) h += 12;
    if (meridiem.toUpperCase() === "AM" && h === 12) h = 0;
  }
  return h * 60 + m;
}

function canSpend(payment, rules, spentToday) {
  // payment = { merchant, amount, time }  — time as "H:MM AM/PM"
  // rules   = { dailyCap, whitelist, startHour, endHour }
  const now = toMinutes(payment.time);
  const startHour = toMinutes(rules.startHour);
  const endHour = toMinutes(rules.endHour);

  // 1. Daily cap — spentToday is approved spend BEFORE this attempt
  if (spentToday + payment.amount > rules.dailyCap) {
    return { allowed: false, reason: "Exceeds daily cap" };
  }
  // 2. Whitelisted merchant
  if (!rules.whitelist.includes(payment.merchant)) {
    return { allowed: false, reason: "Merchant not approved" };
  }
  // 3. Time window
  if (now < startHour || now > endHour) {
    return { allowed: false, reason: "Outside allowed hours" };
  }
  return { allowed: true, reason: "Approved" };
}

// Candidate merchants the simulated agent might try. Mixed on purpose:
// some are normally on the whitelist, one never is, so the whitelist
// rule actually gets exercised over time instead of always passing.
const MERCHANT_POOL = [
  "Spotify",
  "Steam",
  "Amazon Books",
  "DoorDash",
  "RandomCryptoSite.io", // intentionally never whitelisted by default
];

function randomAmount() {
  // Small amounts, occasionally large enough to blow the cap on its own.
  const blowsCap = Math.random() < 0.15;
  return blowsCap
    ? Math.round((Math.random() * 30 + 10) * 100) / 100
    : Math.round((Math.random() * 3 + 0.2) * 100) / 100;
}

function formatNow(date) {
  let h = date.getHours();
  const m = date.getMinutes();
  const meridiem = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${meridiem}`;
}

// Uses the real current time, not a simulated one — so whether this
// passes the time-window rule depends on when you're actually looking
// at the screen.
function generatePaymentAttempt() {
  const merchant =
    MERCHANT_POOL[Math.floor(Math.random() * MERCHANT_POOL.length)];
  return {
    merchant,
    amount: randomAmount(),
    time: formatNow(new Date()),
  };
}

// ---------- Seed data ----------

const SEED_AGENT = {
  name: "Pixel",
  avatar: "🤖",
  dailyCap: 5,
  whitelist: ["Spotify", "Steam", "Amazon Books", "DoorDash"],
  windowStart: "09:00",
  windowEnd: "18:00",
};

const AGENT_ID = "agt_8f3a1c_pixel";

const SEED_TRANSACTIONS = [
  {
    id: 1,
    merchant: "Spotify",
    amount: 1.0,
    time: "9:14 AM",
    status: "allowed",
    reason: "Within cap, whitelisted, in window",
  },
  {
    id: 2,
    merchant: "Steam",
    amount: 2.5,
    time: "11:02 AM",
    status: "allowed",
    reason: "Within cap, whitelisted, in window",
  },
  {
    id: 3,
    merchant: "RandomCryptoSite.io",
    amount: 40.0,
    time: "11:47 AM",
    status: "blocked",
    reason: "Merchant not on whitelist",
  },
  {
    id: 4,
    merchant: "Amazon Books",
    amount: 1.2,
    time: "1:30 PM",
    status: "allowed",
    reason: "Within cap, whitelisted, in window",
  },
  {
    id: 5,
    merchant: "DoorDash",
    amount: 0.3,
    time: "11:58 PM",
    status: "blocked",
    reason: "Outside allowed time window",
  },
  {
    id: 6,
    merchant: "Steam",
    amount: 6.0,
    time: "5:51 PM",
    status: "blocked",
    reason: "Would exceed daily cap",
  },
];

// ---------- Small presentational helpers ----------

function StatusTag({ status }) {
  const isAllowed = status === "allowed";
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium " +
        (isAllowed
          ? "bg-[#2D6A4F]/10 text-[#1f4d39]"
          : "bg-[#B5483D]/10 text-[#8a3328]")
      }
    >
      <span aria-hidden="true">{isAllowed ? "✅" : "❌"}</span>
      {isAllowed ? "Allowed" : "Blocked"}
    </span>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8a8478]">
      {children}
    </p>
  );
}

function Card({ children, className = "" }) {
  return (
    <div
      className={
        "rounded-2xl border border-[#E4DDD0] bg-white/70 shadow-[0_1px_2px_rgba(31,42,36,0.04)] " +
        className
      }
    >
      {children}
    </div>
  );
}

// ---------- Main App ----------

export default function App() {
  // Agent configuration (Setup section)
  const [agentName, setAgentName] = useState(SEED_AGENT.name);
  const [avatar, setAvatar] = useState(SEED_AGENT.avatar);
  const [dailyCap, setDailyCap] = useState(SEED_AGENT.dailyCap);
  const [whitelist, setWhitelist] = useState(SEED_AGENT.whitelist);
  const [newMerchant, setNewMerchant] = useState("");
  const [windowStart, setWindowStart] = useState(SEED_AGENT.windowStart);
  const [windowEnd, setWindowEnd] = useState(SEED_AGENT.windowEnd);
  const [isActivated, setIsActivated] = useState(true);

  // Live state (Dashboard section)
  const [isActive, setIsActive] = useState(true);
  const [transactions, setTransactions] = useState(SEED_TRANSACTIONS);
  const [lastVerdict, setLastVerdict] = useState(null);
  const nextIdRef = useRef(SEED_TRANSACTIONS.length + 1);

  const AVATAR_OPTIONS = ["🤖", "🦊", "🐝", "🐙", "🦉", "🐢"];

  const todaySpend = useMemo(
    () =>
      transactions
        .filter((t) => t.status === "allowed")
        .reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  const capPercent = Math.min(100, Math.round((todaySpend / dailyCap) * 100));
  const isNearCap = capPercent >= 80;

  function addMerchant() {
    const trimmed = newMerchant.trim();
    if (!trimmed) return;
    if (whitelist.some((m) => m.toLowerCase() === trimmed.toLowerCase())) {
      setNewMerchant("");
      return;
    }
    setWhitelist([...whitelist, trimmed]);
    setNewMerchant("");
  }

  function removeMerchant(merchant) {
    setWhitelist(whitelist.filter((m) => m !== merchant));
  }

  // M2: the simulated agent. Every few seconds, while the agent is
  // active, it tries a random payment and canSpend() decides what
  // happens to it.
  //
  // Two refs keep this correct without restarting the timer on every
  // render:
  // - rulesRef always holds the latest dailyCap/whitelist/window, so
  //   changing a rule takes effect on the next tick without tearing
  //   down and restarting the interval (which would otherwise reset
  //   the few-second cadence on every keystroke in the cap input).
  // - transactionsRef mirrors the transactions list so the interval
  //   callback can read "spent so far" synchronously and compute the
  //   verdict *before* calling any setState, instead of reaching for
  //   setTransactions's functional-updater form to do that work. That
  //   keeps the updater itself a plain, pure append — no second
  //   setState call nested inside it, which React may otherwise
  //   invoke more than once (e.g. under StrictMode) and which isn't
  //   guaranteed to be side-effect-safe.
  const rulesRef = useRef();
  rulesRef.current = { dailyCap, whitelist, windowStart, windowEnd };

  const transactionsRef = useRef(transactions);
  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  useEffect(() => {
    if (!isActive || !isActivated) return;

    const interval = setInterval(() => {
      const payment = generatePaymentAttempt();
      const rules = {
        dailyCap: rulesRef.current.dailyCap,
        whitelist: rulesRef.current.whitelist,
        startHour: rulesRef.current.windowStart,
        endHour: rulesRef.current.windowEnd,
      };

      const spentSoFar = transactionsRef.current
        .filter((t) => t.status === "allowed")
        .reduce((sum, t) => sum + t.amount, 0);
      const verdict = canSpend(payment, rules, spentSoFar);

      const newId = nextIdRef.current;
      nextIdRef.current += 1;

      const newTransaction = {
        id: newId,
        ...payment,
        status: verdict.allowed ? "allowed" : "blocked",
        reason: verdict.reason,
      };

      // transactionsRef is updated synchronously too, so a second
      // tick firing before React re-renders still sees this payment
      // already counted toward spentSoFar.
      transactionsRef.current = [...transactionsRef.current, newTransaction];
      setTransactions(transactionsRef.current);
      setLastVerdict({ ...payment, ...verdict });
    }, 3500);

    return () => clearInterval(interval);
  }, [isActive, isActivated]);

  function activateAgent() {
    setIsActivated(true);
    setIsActive(true);
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#1F2A24]">
      <div className="mx-auto max-w-5xl px-6 py-10 sm:px-8">
        {/* ---------- Header ---------- */}
        <header className="mb-10 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#1F2A24]">
              Agent with an Allowance
            </h1>
            <p className="mt-1 text-sm text-[#757065]">
              Give an AI agent money, and a fence it can't cross.
            </p>
          </div>
          <div className="rounded-full border border-[#E4DDD0] bg-white/60 px-3 py-1.5 text-xs font-medium text-[#8a8478]">
            Mock mode — no real money moves
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.15fr]">
          {/* ================= LEFT COLUMN ================= */}
          <div className="flex flex-col gap-8">
            {/* ---------- 1. Agent Setup ---------- */}
            <Card className="p-6">
              <SectionLabel>Agent setup</SectionLabel>
              <h2 className="mb-5 mt-1 text-lg font-semibold">
                Define the fence
              </h2>

              {/* Name + avatar */}
              <div className="mb-5 flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FAF8F4] text-2xl ring-1 ring-[#E4DDD0]">
                  {avatar}
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-[#8a8478]">
                    Agent name
                  </label>
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    className="w-full rounded-xl border border-[#E4DDD0] bg-white px-3 py-2 text-sm outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15"
                  />
                </div>
              </div>

              {/* Avatar picker */}
              <div className="mb-6 flex gap-2">
                {AVATAR_OPTIONS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAvatar(a)}
                    aria-label={`Choose avatar ${a}`}
                    className={
                      "flex h-9 w-9 items-center justify-center rounded-lg text-lg transition " +
                      (avatar === a
                        ? "bg-[#2D6A4F]/10 ring-2 ring-[#2D6A4F]/40"
                        : "ring-1 ring-[#E4DDD0] hover:bg-[#FAF8F4]")
                    }
                  >
                    {a}
                  </button>
                ))}
              </div>

              {/* Daily cap */}
              <div className="mb-6">
                <label className="mb-1 block text-xs font-medium text-[#8a8478]">
                  Daily spending cap
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-[#C9A05C]/40 bg-[#C9A05C]/[0.06] px-3 py-2">
                  <span className="text-sm font-medium text-[#9a7430]">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={dailyCap}
                    onChange={(e) =>
                      setDailyCap(parseFloat(e.target.value) || 0)
                    }
                    className="w-full bg-transparent text-sm font-medium outline-none"
                  />
                  <span className="whitespace-nowrap text-xs text-[#9a7430]">
                    per day
                  </span>
                </div>
              </div>

              {/* Whitelist */}
              <div className="mb-6">
                <label className="mb-2 block text-xs font-medium text-[#8a8478]">
                  Approved merchants
                </label>
                <div className="mb-2 flex flex-wrap gap-2">
                  {whitelist.map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#C9A05C]/40 bg-[#C9A05C]/[0.08] px-3 py-1 text-xs font-medium text-[#7a5a22]"
                    >
                      {m}
                      <button
                        onClick={() => removeMerchant(m)}
                        aria-label={`Remove ${m} from whitelist`}
                        className="text-[#7a5a22]/60 hover:text-[#7a5a22]"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {whitelist.length === 0 && (
                    <span className="text-xs text-[#8a8478]">
                      No merchants approved yet — the agent can't spend
                      anywhere.
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMerchant}
                    onChange={(e) => setNewMerchant(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addMerchant()}
                    placeholder="Add a merchant, e.g. Netflix"
                    className="flex-1 rounded-xl border border-[#E4DDD0] bg-white px-3 py-2 text-sm outline-none focus:border-[#2D6A4F] focus:ring-2 focus:ring-[#2D6A4F]/15"
                  />
                  <button
                    onClick={addMerchant}
                    className="rounded-xl border border-[#E4DDD0] bg-white px-3 py-2 text-sm font-medium text-[#1F2A24] hover:bg-[#FAF8F4]"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Time window */}
              <div className="mb-7">
                <label className="mb-2 block text-xs font-medium text-[#8a8478]">
                  Allowed time window
                </label>
                <div className="flex items-center gap-3 rounded-xl border border-[#C9A05C]/40 bg-[#C9A05C]/[0.06] px-3 py-2">
                  <input
                    type="time"
                    value={windowStart}
                    onChange={(e) => setWindowStart(e.target.value)}
                    className="rounded-lg border border-[#E4DDD0] bg-white px-2 py-1.5 text-sm outline-none focus:border-[#2D6A4F]"
                  />
                  <span className="text-xs text-[#9a7430]">to</span>
                  <input
                    type="time"
                    value={windowEnd}
                    onChange={(e) => setWindowEnd(e.target.value)}
                    className="rounded-lg border border-[#E4DDD0] bg-white px-2 py-1.5 text-sm outline-none focus:border-[#2D6A4F]"
                  />
                </div>
              </div>

              {/* Activate button */}
              <button
                onClick={activateAgent}
                className={
                  "w-full rounded-xl py-2.5 text-sm font-semibold transition " +
                  (isActivated
                    ? "bg-[#2D6A4F]/10 text-[#1f4d39] cursor-default"
                    : "bg-[#2D6A4F] text-white hover:bg-[#255a42]")
                }
              >
                {isActivated ? "Agent is active ✓" : "Activate agent"}
              </button>
              <p className="mt-2 text-center text-[11px] text-[#8a8478]">
                This sets the rules below. No money moves in this preview.
              </p>
            </Card>
          </div>

          {/* ================= RIGHT COLUMN ================= */}
          <div className="flex flex-col gap-8">
            {/* ---------- Identity badge ---------- */}
            <Card className="flex items-center justify-between gap-4 border-[#1F2A24]/10 bg-gradient-to-br from-white to-[#FAF8F4] p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FAF8F4] text-xl ring-1 ring-[#E4DDD0]">
                  {avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1F2A24]">
                    {agentName}
                  </p>
                  <p className="font-mono text-[11px] tracking-tight text-[#8a8478]">
                    {AGENT_ID}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span
                  className={
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold " +
                    (isActive
                      ? "bg-[#2D6A4F]/10 text-[#1f4d39]"
                      : "bg-[#B5483D]/10 text-[#8a3328]")
                  }
                >
                  <span
                    className={
                      "h-1.5 w-1.5 rounded-full " +
                      (isActive ? "bg-[#2D6A4F]" : "bg-[#B5483D]")
                    }
                  />
                  {isActive ? "Active" : "Paused"}
                </span>
                <button
                  onClick={() => setIsActive(!isActive)}
                  className="text-[11px] font-medium text-[#8a8478] underline-offset-2 hover:underline"
                >
                  {isActive ? "Pause agent" : "Resume agent"}
                </button>
              </div>
            </Card>

            {/* ---------- 2. Live Dashboard ---------- */}
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <SectionLabel>Live dashboard</SectionLabel>
                    {isActive && isActivated && (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-[#2D6A4F]">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#2D6A4F]" />
                        agent running
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1 text-lg font-semibold">Today's spend</h2>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold tabular-nums">
                    ${todaySpend.toFixed(2)}
                    <span className="text-sm font-normal text-[#8a8478]">
                      {" "}
                      / ${dailyCap.toFixed(2)}
                    </span>
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-1 h-2.5 w-full overflow-hidden rounded-full bg-[#E4DDD0]">
                <div
                  className={
                    "h-full rounded-full transition-all duration-500 " +
                    (isNearCap ? "bg-[#B5483D]" : "bg-[#2D6A4F]")
                  }
                  style={{ width: `${capPercent}%` }}
                />
              </div>
              <p className="mb-4 text-xs text-[#8a8478]">
                {capPercent}% of daily cap used
                {isNearCap && capPercent < 100 ? " — getting close" : ""}
              </p>

              {!isActive || !isActivated ? (
                <p className="mb-5 rounded-xl border border-[#E4DDD0] bg-[#FAF8F4] px-3.5 py-2.5 text-xs text-[#8a8478]">
                  {!isActivated
                    ? "Activate the agent to let it start spending."
                    : "Agent is paused — it isn't attempting any payments right now."}
                </p>
              ) : (
                lastVerdict && (
                  <div
                    className={
                      "mb-5 rounded-xl border px-3.5 py-2.5 text-xs " +
                      (lastVerdict.allowed
                        ? "border-[#2D6A4F]/25 bg-[#2D6A4F]/[0.06] text-[#1f4d39]"
                        : "border-[#B5483D]/25 bg-[#B5483D]/[0.06] text-[#8a3328]")
                    }
                  >
                    <span className="font-semibold">
                      {lastVerdict.merchant} · $
                      {lastVerdict.amount.toFixed(2)} · {lastVerdict.time}
                    </span>
                    <span className="mx-1.5">—</span>
                    <span aria-hidden="true">
                      {lastVerdict.allowed ? "✅" : "❌"}
                    </span>{" "}
                    {lastVerdict.reason}
                  </div>
                )
              )}

              {/* Transaction feed */}
              <SectionLabel>Transaction feed</SectionLabel>
              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                {transactions
                  .slice()
                  .reverse()
                  .map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#E4DDD0] bg-white px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#1F2A24]">
                          {t.merchant}
                        </p>
                        <p className="truncate text-[11px] text-[#8a8478]">
                          {t.reason} · {t.time}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="font-mono text-sm tabular-nums text-[#1F2A24]">
                          ${t.amount.toFixed(2)}
                        </span>
                        <StatusTag status={t.status} />
                      </div>
                    </div>
                  ))}
              </div>
            </Card>

            {/* ---------- 3. Guardrails Summary ---------- */}
            <Card className="border-[#C9A05C]/30 bg-[#C9A05C]/[0.04] p-6">
              <SectionLabel>Guardrails summary</SectionLabel>
              <h2 className="mb-4 mt-1 text-lg font-semibold">
                What {agentName} is allowed to do
              </h2>
              <dl className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-4 border-b border-[#C9A05C]/20 pb-3">
                  <dt className="text-[#7a5a22]">Daily cap</dt>
                  <dd className="font-mono font-medium text-[#1F2A24]">
                    ${dailyCap.toFixed(2)} / day
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-[#C9A05C]/20 pb-3">
                  <dt className="text-[#7a5a22]">Approved merchants</dt>
                  <dd className="max-w-[60%] text-right font-medium text-[#1F2A24]">
                    {whitelist.length > 0
                      ? whitelist.join(", ")
                      : "None set"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4 border-b border-[#C9A05C]/20 pb-3">
                  <dt className="text-[#7a5a22]">Allowed hours</dt>
                  <dd className="font-mono font-medium text-[#1F2A24]">
                    {windowStart} – {windowEnd}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-[#7a5a22]">Status</dt>
                  <dd
                    className={
                      "font-medium " +
                      (isActive ? "text-[#1f4d39]" : "text-[#8a3328]")
                    }
                  >
                    {isActive ? "Active — spending allowed" : "Paused — all spending blocked"}
                  </dd>
                </div>
              </dl>
            </Card>
          </div>
        </div>

        <footer className="mt-10 text-center text-xs text-[#8a8478]">
          Simulated agent — a new payment attempt is checked against your
          rules every few seconds. No backend, no blockchain, all client-side.
        </footer>
      </div>
    </div>
  );
}