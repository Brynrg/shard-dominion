# Ship-Quality Plan — realize Shard Dominion to its full depth

> Operator goal (2026-07-11, clarified): **an execution/polish-level bar, NOT a WC3 feature
> clone.** "How polished the game should be, the storyline build-out, the character and team
> builds, all of it." WarCraft III is the *fit-and-finish and depth* benchmark — the target
> is Shard Dominion fully realized **in its own identity**: a built-out story with real
> characters, factions/teams that feel distinct and deep to play, builds that matter, and
> polish everywhere. Executed the proven way: design → `pnpm run verify` + `pnpm run
> test:live` green → deploy → operator plays. One slice at a time; determinism stays green.

## The world & cast we're building on (already good — deepen it)
- **The Warden** — player-character commander (silent). Loyal, then a defector.
- **Marshal Corr** — Concord officer; principled, tired; refuses Cauterize and turns renegade (M12).
- **Sera Vane** — Emberhand warlord; Act I antagonist → Act II ally you fight *for*.
- **Director Halex** — Directorate corporate cold-war villain; orders "Cauterize" (burn the continent).
- **Broker Yssel** — Syndicate information broker; leases the relay economy to the highest bidder.
- **The Chorus** — the shard-touched planetary hive (the Shardborn); "the vein is us."
- **Arc:** Act I (M1–M6) Concord vs Emberhand for Shard → the planet stirs. Act II (M8–M14)
  you fight *as* the Emberhand as the Directorate tries to sterilize Aether Prime, Corr defects,
  and it ends on the SEAL/HARNESS Choice at the First Vein.

## Priorities (operator's emphasis: story → characters/teams → polish)

### S1 — Story build-out (lead)
- **M7 "The Turn"** — author the missing pivot: dramatize *why* the Warden abandons the
  Concord for the Emberhand (the truth table flags it absent; the Act I→II switch is currently
  unexplained). The keystone fix.
- **Act III** — the game currently ends at M14. Build the **fallout of the Choice**: a branching
  post-finale act (Seal-path vs Harness-path missions) that gives a real ending and "much
  longer story of play." Target a 3-act, ~20-mission campaign.
- **Character presence** — more than briefing text: mid-mission beats, reactions to what the
  player does, debrief consequences that carry forward, per-speaker portraits (already painted).

### S2 — Faction & team build depth
- Make the **3 factions play distinctly** with meaningful build orders, rosters, and tech
  identity (Concord shields/order, Emberhand salvage/stealth/aggression, **Shardborn = a real
  mechanical faction**, not stat+palette). Add the **Directorate** as a flavor/enemy identity.
- **Character/unit builds that matter** — the hero(es) become build-defining (a real kit +
  progression), and units have role clarity so army composition is a choice, not a blob.

### S3 — Economy depth (serves builds, in the game's own terms)
- Deepen the Shard→Cells→Resonance economy with researched upgrades and a meaningful
  efficiency/sink layer, so teching and eco decisions shape a build. (Not a WC3 upkeep clone —
  fit it to Resonance/the living planet.)

### S4 — Execution polish (throughout + final)
- UX/controls fit-and-finish, readable feedback, balance sweep, AI competence, accessibility,
  MP field test, in-engine verification of every new system + the art. No rough edges.

## Invariants (never regress)
- `src/sim/**` stays pure/deterministic (no DOM/Date/Math.random); ADD components. Every new
  sim field enters `stateHash` (state.ts) or determinism breaks.
- Every feature gets a COMPOSED-path test (drive the real trigger/button), not just a layer test.
- Deploy is operator-gated: full manifest (buildHash), verify Netlify deploy-STATE.
