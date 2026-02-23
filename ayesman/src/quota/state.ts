import type { QuotaEntry, CreditsInfo } from "../types/index.js";

let _latestQuota: QuotaEntry[] = [];
let _latestCredits: CreditsInfo | undefined;

export function getLatestQuota(): QuotaEntry[] {
  return _latestQuota;
}

export function setLatestQuota(quota: QuotaEntry[]): void {
  _latestQuota = quota;
}

export function getLatestCredits(): CreditsInfo | undefined {
  return _latestCredits;
}

export function setLatestCredits(credits: CreditsInfo | undefined): void {
  _latestCredits = credits;
}
