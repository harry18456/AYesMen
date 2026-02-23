import type { ServerInfo } from "../types/index.js";
import { callGrpc } from "../server/grpc.js";

// Track step indices we've already accepted (cascadeId → Set<stepIndex>).
// Prevents re-accepting the same step while it's still transitioning to DONE.
const acceptedStepIndices = new Map<string, Set<number>>();

let _getAutoAcceptEnabled: () => boolean;

export function initAcceptStep(getAutoAcceptEnabled: () => boolean): void {
  _getAutoAcceptEnabled = getAutoAcceptEnabled;
}

const DONE_STATUSES = new Set([
  "CORTEX_STEP_STATUS_DONE",
  "CORTEX_STEP_STATUS_CANCELLED",
  "CORTEX_STEP_STATUS_CANCELED",
  "CORTEX_STEP_STATUS_ERROR",
]);

// Try to accept the current pending step via direct gRPC call.
//
// Flow:
//   GetAllCascadeTrajectories {}
//     → prefer non-IDLE, sort by lastModifiedTime desc, take top 3
//   GetCascadeTrajectorySteps (last 50 steps)
//     → find pending runCommand (not DONE/CANCELLED)
//   HandleCascadeUserInteraction { confirm: true }
//     → using cascade's own trajectoryId (NOT user-level trajectory)
export async function tryAutoAcceptStep(server: ServerInfo): Promise<void> {
  const allTrajs = await callGrpc(server, "GetAllCascadeTrajectories", {}) as Record<string, unknown>;
  const summaries = (allTrajs?.trajectorySummaries as Record<string, unknown>) ?? {};

  const candidates = Object.entries(summaries)
    .map(([cascadeId, s]) => ({
      cascadeId,
      trajectoryId: ((s as Record<string, unknown>)?.trajectoryId as string) ?? "",
      stepCount: ((s as Record<string, unknown>)?.stepCount as number) ?? 0,
      idle: (s as Record<string, unknown>)?.status === "CASCADE_RUN_STATUS_IDLE",
      lastModified: new Date(((s as Record<string, unknown>)?.lastModifiedTime as string | number) ?? 0),
    }))
    .sort((a, b) => {
      if (a.idle !== b.idle) return a.idle ? 1 : -1;
      return b.lastModified.getTime() - a.lastModified.getTime();
    });

  for (const { cascadeId, trajectoryId, stepCount } of candidates) {
    if (stepCount === 0) continue;

    const stepOffset = Math.max(0, stepCount - 50);

    const stepsResult = await callGrpc(server, "GetCascadeTrajectorySteps", {
      cascadeId,
      stepOffset,
    }) as Record<string, unknown>;
    const steps = (stepsResult?.steps as Record<string, unknown>[]) ?? [];

    // Clear tracking for steps that are now DONE or CANCELLED.
    const alreadyAccepted = acceptedStepIndices.get(cascadeId);
    if (alreadyAccepted) {
      for (const absIdx of [...alreadyAccepted]) {
        if (absIdx < stepOffset) continue;
        const localIdx = absIdx - stepOffset;
        const s = steps[localIdx] as Record<string, string> | undefined;
        if (!s || DONE_STATUSES.has(s.status)) {
          alreadyAccepted.delete(absIdx);
        }
      }
    }

    for (let i = steps.length - 1; i >= 0; i--) {
      const step = steps[i] as Record<string, unknown>;
      if (!step?.runCommand) continue;

      const absoluteIdx = stepOffset + i;

      if (DONE_STATUSES.has(step.status as string)) continue;

      if (acceptedStepIndices.get(cascadeId)?.has(absoluteIdx)) continue;

      const runCmd = step.runCommand as Record<string, string>;
      const proposedCmd: string =
        runCmd.proposedCommandLine ?? runCmd.commandLine ?? "";

      console.log(
        `[AYesMan] Attempting to accept step ${absoluteIdx} (local: ${i}, total: ${stepCount}): ${proposedCmd.substring(0, 50)}`,
      );

      // Final safety check: if user turned it off during the async discovery process, stop here.
      if (!_getAutoAcceptEnabled()) {
        console.log(
          `[AYesMan] Auto-Accept was disabled while processing step ${absoluteIdx}. Aborting.`,
        );
        return;
      }

      // Use cascade's own trajectoryId (not user-level trajectory)
      await callGrpc(server, "HandleCascadeUserInteraction", {
        cascadeId,
        interaction: {
          trajectoryId,
          stepIndex: absoluteIdx,
          runCommand: {
            confirm: true,
            proposedCommandLine: proposedCmd,
            submittedCommandLine: proposedCmd,
          },
        },
      });

      if (!acceptedStepIndices.has(cascadeId)) {
        acceptedStepIndices.set(cascadeId, new Set());
      }
      acceptedStepIndices.get(cascadeId)!.add(absoluteIdx);
      console.log(
        `[AYesMan] Auto-accepted step ${absoluteIdx}: ${proposedCmd.substring(0, 80)}`,
      );
      return;
    }
  }
}
