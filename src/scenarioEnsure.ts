import { defaultScenarioInputs, type ScenarioRow } from "./types";
import { newId } from "./util";

export function ensureScenarioRow(
  r: Partial<ScenarioRow> & { id?: string }
): ScenarioRow {
  const base = defaultScenarioInputs();
  const category = r.category ?? base.category;

  let estimationSnapshot = r.estimationSnapshot;
  if (!estimationSnapshot && (r.beforeEpisode || r.manualGrid)) {
    const mg = r.manualGrid ?? {};
    const be = r.beforeEpisode ?? {};
    estimationSnapshot = {
      hisBank: be.hisBank ?? mg.hisBank,
      hisCash: be.hisCash ?? mg.hisCash,
      myCashBills: mg.myCashBills,
      myOneEuroCoinCount:
        mg.myCashCoins != null && mg.myCashCoins > 0 && mg.myCashCoins <= 30
          ? Math.round(mg.myCashCoins)
          : undefined,
      note: be.note,
    };
  }

  return {
    id: r.id && r.id.length > 0 ? r.id : newId(),
    name: (r.name && r.name.trim()) || "Scenario",
    amount: typeof r.amount === "number" ? r.amount : base.amount,
    method: r.method ?? base.method,
    category,
    notes: r.notes,
    purchaseDate: r.purchaseDate,
    groceryCycleId: r.groceryCycleId,
    linkedTaskDefId: r.linkedTaskDefId,
    taskLabel: r.taskLabel,
    estimationSnapshot,
    bankWalkthrough: r.bankWalkthrough,
    cashWalkthrough: r.cashWalkthrough,
    manualGrid: r.manualGrid,
    beforeEpisode: r.beforeEpisode,
  };
}
