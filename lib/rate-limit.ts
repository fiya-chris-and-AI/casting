/**
 * Live-run budget guard, backed by YouCam's own real account balance
 * (GET /s2s/v1.0/client/credit) rather than a counter we'd have to trust —
 * the account balance is genuinely shared, server-side truth, which is a
 * stronger guarantee than any in-memory or per-instance counter could be.
 *
 * MEASURED COST: on 2026-08-13, a full 8-person fan-out was measured at
 * 670 -> 654 units on Account B (the only funded account — Account A sits
 * at 0 and is not used in production). That is 16 units for 8 calls = 2
 * units per Apparel VTO call, not the naively assumed 1:1. All budget math
 * below is derived from this measured number, not an assumption.
 */

import { getYoucamCreditBalance } from "./youcam/client";

export const MEASURED_UNITS_PER_RUN = 16;

/**
 * Three fixed tranches, carved out of the ~654-unit balance measured
 * 2026-08-13. Each tranche is a RESERVE for everything after it — a run is
 * only allowed if the balance minus the reserve for later tranches still
 * covers one run.
 *
 *   Tranche 1 — now through Feature-Freeze (Sun 2026-08-16 12:00 CEST):
 *     rest-of-build testing, Examiner Round 2, demo rehearsals.
 *   Tranche 2 — the video recording morning (Mon 2026-08-17, until the
 *     12:00 submission deadline): untouchable reserve for retakes.
 *   Tranche 3 — the 14-day judging window (2026-08-18 through 2026-08-31):
 *     unattended, must not run dry, gets the largest reserve.
 *
 * Allocation (documented, not just asserted):
 *   Tranche 3: 14 days x 2 runs/day  = 28 runs = 448 units (the floor that
 *     must survive the entire judging window without any intervention).
 *   Tranche 2: 6 runs = 96 units (generous retake margin for one morning).
 *   Tranche 1: remainder (~654 - 448 - 96 = 110 units, ~6 runs) for
 *     everything between now and Feature-Freeze.
 */
export const TRANCHE_3_JUDGING_RUNS_PER_DAY = 2;
export const TRANCHE_3_JUDGING_DAYS = 14;
export const TRANCHE_3_RESERVE_UNITS = TRANCHE_3_JUDGING_RUNS_PER_DAY * TRANCHE_3_JUDGING_DAYS * MEASURED_UNITS_PER_RUN; // 448
export const TRANCHE_2_VIDEO_DAY_RUNS = 6;
export const TRANCHE_2_RESERVE_UNITS = TRANCHE_2_VIDEO_DAY_RUNS * MEASURED_UNITS_PER_RUN; // 96

const FEATURE_FREEZE = new Date("2026-08-16T12:00:00+02:00");
const SUBMISSION_DEADLINE = new Date("2026-08-17T12:00:00+02:00");
const JUDGING_END = new Date("2026-08-31T23:59:59+02:00");

type Tranche = "pre-freeze" | "video-day" | "judging" | "past-judging";

function currentTranche(now: Date): Tranche {
  if (now < FEATURE_FREEZE) return "pre-freeze";
  if (now < SUBMISSION_DEADLINE) return "video-day";
  if (now <= JUDGING_END) return "judging";
  return "past-judging";
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TRANCHE_3_DAILY_UNITS = TRANCHE_3_JUDGING_RUNS_PER_DAY * MEASURED_UNITS_PER_RUN; // 32

/**
 * Units that must stay untouched for everything AFTER right now — including
 * the REST of the judging tranche, not just the tranches after it.
 *
 * This is what actually makes the judging-window cap durable across
 * serverless cold starts (Round 2 adversarial finding): rather than relying
 * on a per-instance counter that resets whenever Vercel spins up a fresh
 * instance, every check re-derives "how many judging days are left as of
 * THIS real balance read" and reserves for all of them except today. A
 * concurrent request racing this one can, at worst, spend one extra day's
 * allowance before the next request sees the now-lower real balance and
 * tightens accordingly — the error is bounded to ~1 day's budget and
 * self-corrects on the very next check, rather than being able to drain the
 * whole 448-unit tranche unnoticed.
 */
function reserveForLaterTranches(tranche: Tranche, now: Date): number {
  switch (tranche) {
    case "pre-freeze":
      return TRANCHE_2_RESERVE_UNITS + TRANCHE_3_RESERVE_UNITS;
    case "video-day":
      return TRANCHE_3_RESERVE_UNITS;
    case "judging": {
      const daysRemainingInclusiveOfToday = Math.max(1, Math.ceil((JUDGING_END.getTime() - now.getTime()) / DAY_MS));
      const futureDays = daysRemainingInclusiveOfToday - 1;
      return futureDays * TRANCHE_3_DAILY_UNITS;
    }
    case "past-judging":
      return 0;
  }
}

// Fast, cheap first-line check (module-scope, per-instance, resets daily) —
// avoids hitting the real balance endpoint on every single request. The
// authoritative check is still the real balance below; this only bounds
// request volume, per-instance, as the "fraction" safety margin requested.
let instanceRunsToday = 0;
let instanceDayStamp = "";
function instanceCapForTranche(tranche: Tranche): number {
  // A fraction of the daily judging allowance, so that even if Vercel runs
  // several concurrent instances, no single one can burn through more than
  // a fraction of a day's budget on its own before the real balance check
  // (below) catches the rest.
  if (tranche === "judging") return 1;
  return 3;
}
function resetInstanceCounterIfNewDay() {
  const stamp = new Date().toISOString().slice(0, 10);
  if (stamp !== instanceDayStamp) {
    instanceDayStamp = stamp;
    instanceRunsToday = 0;
  }
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  remainingUnits?: number;
}

export async function checkLiveRunBudget(): Promise<BudgetCheckResult> {
  const now = new Date();
  const tranche = currentTranche(now);

  resetInstanceCounterIfNewDay();
  if (instanceRunsToday >= instanceCapForTranche(tranche)) {
    return { allowed: false, reason: "This instance has reached its per-day run cap." };
  }

  let remainingUnits: number;
  try {
    remainingUnits = await getYoucamCreditBalance();
  } catch {
    // If we can't even check the balance, don't risk a live call — fall
    // back to the seed run rather than find out the hard way.
    return { allowed: false, reason: "Could not verify live API budget." };
  }

  const reserve = reserveForLaterTranches(tranche, now);
  const spendable = remainingUnits - reserve;

  if (spendable < MEASURED_UNITS_PER_RUN) {
    return {
      allowed: false,
      reason: `Live API budget for today is exhausted (${remainingUnits} units left, ${reserve} reserved for later). Showing a precomputed run instead.`,
      remainingUnits,
    };
  }

  return { allowed: true, remainingUnits };
}

export function recordLiveRun(): void {
  resetInstanceCounterIfNewDay();
  instanceRunsToday += 1;
}
