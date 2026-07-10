# PWS Book — TODO

## Part IV — Rule Deep Dive (`part-4-rules-semantics.html`)

### R5 — Guards: the selectors
- [x] ~~**Two initial states with disjoint guards.**~~ Reinstated as the "Micro-example" with **Figure 4** (`r5-initial-partition.png`): two initial transitions into `Idle` / `Ready` guarded by `[(cover.Open)]` / `[(cover.Closed)]`. Kept as a worked *positive* partition example.
- [ ] **Open question — one screenshot per example.** Decide whether every example should carry its own state-diagram screenshot, and whether Figures 2–3 (`Idle → Work / Fail`) and Figure 4 (initial-states partition) are both wanted or one is redundant.

### R1 — Consistency (`Acc` ⊆ `Sem`)
- [ ] **Recall Figure 5.** When developing the rule that checks the coherence of `Acc` with `Sem`, add a cross-reference back to **Figure 5** (R6, `r6-actions-valid-orphan.png`). Its right panel shows `Work` flagged red precisely because `Acc` no longer reaches the declared `Sem = (Closed, On)` — the same `Acc`-vs-`Sem` check. Use it as a callback so the reader connects the orphan-action fault to the consistency rule.

---
_Figures in R5 (external optimized PNGs, see `CLAUDE.md`): `assembly-cover-laser.png` (Fig 1), `r5-guard-incomplete.png` (Fig 2, orange guard, 57.5%), `r5-guard-partition.png` (Fig 3), `r5-initial-partition.png` (Fig 4, 66.3%). State-circle sizes matched across Figs 2–4._
