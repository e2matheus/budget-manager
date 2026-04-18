import type { AppState, Movement, ScenarioRow, Transfer } from "./types";
import { composeGroceryTaskLabel } from "./util";

export function ledgerRowInScenario(
  state: AppState,
  r: Transfer | Movement,
  sc: ScenarioRow
): boolean {
  if (sc.groceryCycleId && r.groceryCycleId === sc.groceryCycleId) {
    return true;
  }
  if (sc.linkedTaskDefId && r.taskDefId === sc.linkedTaskDefId) {
    return true;
  }
  const want = sc.taskLabel?.trim();
  if (want) {
    if ((r.taskLabel ?? "").trim() === want) return true;
    if (r.taskDefId) {
      const td = state.tasks.find((t) => t.id === r.taskDefId);
      if (td && td.name.trim() === want) return true;
    }
    if (r.groceryCycleId) {
      const c = state.groceryCycles.find((g) => g.id === r.groceryCycleId);
      if (c && composeGroceryTaskLabel(c) === want) return true;
    }
  }
  return false;
}
