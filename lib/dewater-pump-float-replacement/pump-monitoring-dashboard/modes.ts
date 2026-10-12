/**
 * Which set of column thresholds is in service. The names are the situations
 * they stand for; nothing about a mode changes how the dashboard draws.
 */
export const operationModes = ["normal", "winter", "flush"] as const;
export type OperationMode = (typeof operationModes)[number];

export const OPERATION_MODE_LABELS: Record<OperationMode, string> = {
  normal: "Normal",
  winter: "Winter",
  flush: "Flush",
};

/**
 * How demand is shared across the enabled pumps. Off, a column is simply its
 * own pump; on either alteration setting, a column is a role and the device
 * decides which pump fills it (see ColumnStatus.pumpId).
 */
export const alterationModes = ["off", "starts", "runtime"] as const;
export type AlterationMode = (typeof alterationModes)[number];

export const ALTERATION_MODE_LABELS: Record<AlterationMode, string> = {
  off: "No Alteration",
  starts: "Based on Starts",
  runtime: "Based on Run Time",
};

/**
 * Options a host can't offer right now, each with the reason shown on it — a
 * mode the firmware doesn't support yet, say. They are drawn but can't be
 * selected.
 */
export type UnavailableOptions<T extends string> = Partial<Record<T, string>>;
