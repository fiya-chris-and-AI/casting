/**
 * Best-effort call-budget guard for live visitor-triggered fan-outs.
 *
 * HONEST LIMITATION: this is an in-memory, per-serverless-instance counter.
 * It is NOT a distributed hard cap — Vercel may run multiple instances
 * concurrently, and every cold start resets it to zero. A true hard global
 * cap needs shared state (Vercel KV/Upstash), which was not provisioned
 * here (that's new billed infrastructure, a bigger decision than this fix
 * warrants on its own). What this DOES guarantee, together with the
 * reactive fallback in the fan-out route: a visitor is never shown a
 * broken or empty page, because any real API failure (including real
 * credit exhaustion) is caught and converted into the seed-run fallback —
 * this soft counter just reduces how often that fallback has to trigger.
 */

let liveRunsToday = 0;
let dayStamp = "";

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function resetIfNewDay() {
  const stamp = todayStamp();
  if (stamp !== dayStamp) {
    dayStamp = stamp;
    liveRunsToday = 0;
  }
}

export function dailyCap(): number {
  const perRun = Number(process.env.YOUCAM_MAX_CALLS_PER_RUN ?? 8);
  const perDay = Number(process.env.YOUCAM_MAX_CALLS_PER_DAY ?? 120);
  return Math.floor(perDay / perRun);
}

export function isOverDailyCap(): boolean {
  resetIfNewDay();
  return liveRunsToday >= dailyCap();
}

export function recordLiveRun(): void {
  resetIfNewDay();
  liveRunsToday += 1;
}

export function liveRunsRemaining(): number {
  resetIfNewDay();
  return Math.max(0, dailyCap() - liveRunsToday);
}
