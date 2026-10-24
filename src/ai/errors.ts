/**
 * Thrown by a flow when its input fails validation. The message is written
 * for the DM ("This issue has no recap to draw from yet"), so `gated()` in
 * actions.ts returns it as-is instead of the generic failure line.
 */
export class FlowInputError extends Error {}
