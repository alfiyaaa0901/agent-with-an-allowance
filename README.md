# Agent With an Allowance

An AI agent gets a spending allowance — a daily cap, a list of approved merchants, and a time window it's allowed to spend in. Like a parent giving a kid a debit card with rules.

## What this does

You set the rules. A simulated agent then tries random payments every few seconds and a rule engine (`canSpend()`) checks each one:

1. Does it exceed the daily cap?
2. Is the merchant on the whitelist?
3. Is it inside the allowed time window?

Approved payments go green and count toward the cap. Blocked ones go red with the reason. The progress bar updates live.

**Everything runs client-side in React state.** No backend, no blockchain, no real money — this is (UI) + (mock rule logic) only.

## Features

- Set agent name, avatar, daily cap, merchant whitelist, and time window
- Live progress bar of today's spend vs. cap
- Scrolling transaction feed with ✅/❌ tags and the reason for each decision
- Active/Paused toggle — paused agent stops attempting payments
- Guardrails summary card showing all current rules

## Run it

```bash
git clone https://github.com/alfiyaaa0901/agent-with-an-allowance.git
cd agent-with-an-allowance
npm install
npm run dev
```

Open the local URL printed in the terminal (usually `http://localhost:5173`).

## Stack

React + Vite + Tailwind CSS v3. No dependencies beyond that.

---

Built for [Speedrun hackathon] · [Alfiya Sultana]
