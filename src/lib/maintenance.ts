/**
 * Maintenance mode flag — set MAINTENANCE_MODE=1 to lock down consumer
 * pages. Admin routes (/admin/*) and /api/health stay accessible so you
 * can verify health and finish admin work during maintenance.
 *
 * Pages that should respect this call `requireConsumerOpen()` early.
 * The maintenance check is environment-driven, evaluated per-request.
 */
export function isMaintenanceMode(): boolean {
  return process.env.MAINTENANCE_MODE === "1";
}
