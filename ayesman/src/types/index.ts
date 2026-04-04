export interface QuotaEntry {
  label: string;
  modelId: string;
  remainingFraction: number;
  resetTime?: string;
}

export interface CreditsInfo {
  availablePromptCredits: number;
  availableFlowCredits: number;
  monthlyPromptCredits: number;
  monthlyFlowCredits: number;
  planName: string;
}

export interface ServerInfo {
  port: number;
  csrfToken: string;
  httpPort?: number;
  extensionServerPort?: number;
  extensionServerCsrfToken?: string;
}

export interface ProcessInfo {
  pid: number;
  cmdline: string;
  parentPid?: number;
}
