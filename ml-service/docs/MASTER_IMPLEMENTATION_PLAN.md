# Master Implementation Plan — ML Service V2 (Orchestrator)

> **Current Model**: Ensemble Robust Average v1.1.0 — MAPE 12.78%, R²=0.888, Within±15%=76.6%  
> **Goal**: Improve MAPE to <10%, Coverage to >90%, add CQR, automate retraining  

This is the **orchestrator document**. It defines the execution order and references detailed sub-plans for each major area.

---

## Available Models & Budget Strategy

| Model | Best For | Cost |
|-------|----------|------|
| **Opus 4.6** | Critical data logic, complex architecture, CQR math, model training | High |
| **GPT 5.5** | Notebook experiments, evaluation code, medium analysis | High |
| **Sonnet 4.6** | Feature engineering, pipeline scripts, moderate complexity code | Medium |
| **GPT 5.4** | Simple scripts, config changes, test writing, bug fixes | Medium |
| **GPT 5.2** | Repetitive edits, formatting, simple fixes, docs | Lowest |
| **GLM 5.1** | Documentation, comments, simple lookups | Lowest |

**Budget strategy**: Reserve Opus for the 3-4 tasks that can make or break the model. Use Sonnet for integration work. GPT 5.4/5.5 for everything else.

---

## Sub-Plans Reference

Each sub-plan contains: challenges, root causes, detailed approaches, verification steps, and model recommendations.

| # | Plan | File | Status |
|---|------|------|--------|
| 1 | Data Cleaning & Quality | [`plans/01-DATA-CLEANING-PLAN.md`](plans/01-DATA-CLEANING-PLAN.md) | Pending |
| 2 | Feature Engineering V2 | [`plans/02-FEATURE-ENGINEERING-PLAN.md`](plans/02-FEATURE-ENGINEERING-PLAN.md) | Pending |
| 3 | Model V2 Training | [`plans/03-MODEL-V2-TRAINING-PLAN.md`](plans/03-MODEL-V2-TRAINING-PLAN.md) | Pending |
| 4 | CQR & Prediction Intervals | [`plans/04-CQR-CALIBRATION-PLAN.md`](plans/04-CQR-CALIBRATION-PLAN.md) | Pending |
| 5 | Automated Retraining Pipeline | [`plans/05-AUTOMATED-RETRAINING-PLAN.md`](plans/05-AUTOMATED-RETRAINING-PLAN.md) | Pending |
| 6 | API & Service Updates | [`plans/06-API-SERVICE-UPDATES-PLAN.md`](plans/06-API-SERVICE-UPDATES-PLAN.md) | Pending |
| 7 | Evaluation & Metrics | [`plans/07-EVALUATION-METRICS-PLAN.md`](plans/07-EVALUATION-METRICS-PLAN.md) | Pending |
| 8 | Testing & Hardening | [`plans/08-TESTING-HARDENING-PLAN.md`](plans/08-TESTING-HARDENING-PLAN.md) | Pending |

---

## Execution Order

| Step | Plan | Recommended Model | Dependencies |
|------|------|-------------------|--------------|
| 1 | **Plan 1** — Data Cleaning & Quality | GPT 5.4 + Sonnet 4.6 | None |
| 2 | **Plan 2** — Feature Engineering V2 | **Opus 4.6** | Plan 1 complete |
| 3 | **Plan 3** — Model V2 Training | **Opus 4.6** | Plan 2 complete |
| 4 | **Plan 4** — CQR Calibration | **Opus 4.6** | Plan 3 complete |
| 5 | **Plan 5** — Automated Retraining | Sonnet 4.6 | Plans 3 & 4 complete |
| 6 | **Plan 6** — API & Service Updates | Sonnet 4.6 + GPT 5.4 | Plans 2, 3, 4 complete |
| 7 | **Plan 7** — Evaluation & Metrics | GPT 5.5 | Plan 3 complete |
| 8 | **Plan 8** — Testing & Hardening | GPT 5.4 | Plans 2, 6 complete |

> **Note**: Plans 5, 6, 7, 8 can partially overlap once Plan 3 is complete.

---

## Critical Path (Must Complete for GP Defense)

1. **Plan 1** → Clean data foundation
2. **Plan 2** → New features
3. **Plan 3** → V2 model with improved metrics
4. **Plan 6** (partial) → Update API to serve V2
5. **Plan 7** → Evaluation report with comparison numbers for presentation

Everything else improves quality and robustness but isn't blocking the defense.

---

## How to Use This Plan

1. Start with **Plan 1** (Data Cleaning)
2. Tell me which plan you want to implement next
3. I will execute that plan's steps one by one
4. After each plan completes, mark it as "Done" in the table above
5. Move to the next plan in order

---

## Current Progress

- [ ] Plan 1 — Data Cleaning & Quality
- [ ] Plan 2 — Feature Engineering V2
- [ ] Plan 3 — Model V2 Training
- [ ] Plan 4 — CQR & Prediction Intervals
- [ ] Plan 5 — Automated Retraining Pipeline
- [ ] Plan 6 — API & Service Updates
- [ ] Plan 7 — Evaluation & Metrics
- [ ] Plan 8 — Testing & Hardening

---

**START WITH: Plan 1 — Data Cleaning & Quality**

When you're ready, tell me to implement Plan 1 and I'll execute it step by step.
