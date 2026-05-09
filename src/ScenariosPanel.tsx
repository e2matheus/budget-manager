import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { sumFoodSpendForCycle } from "./derive";
import { getLastRemainingForGroceryCycle } from "./ledgerOrder";
import { MovementsLedgerTable } from "./MovementsLedger";
import { ensureScenarioRow } from "./scenarioEnsure";
import type { AppState, ScenarioRow } from "./types";
import { composeGroceryTaskLabel, formatAmountField, formatMoney, newId, parseNumber } from "./util";

export function ScenariosPanel({
  state,
  setState,
}: {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState | null>>;
}) {
  const patchScenario = (id: string, patch: Partial<ScenarioRow>) => {
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        scenarios: s.scenarios.map((row) =>
          row.id === id ? ensureScenarioRow({ ...row, ...patch }) : row
        ),
      };
    });
  };

  const addScenario = () => {
    setState((s) => {
      if (!s) return s;
      const n = s.scenarios.length + 1;
      const row = ensureScenarioRow({
        id: newId(),
        name: `Scenario ${n}`,
      });
      return { ...s, scenarios: [...s.scenarios, row] };
    });
  };

  const removeScenario = (id: string) => {
    setState((s) => {
      if (!s || s.scenarios.length <= 1) return s;
      return {
        ...s,
        scenarios: s.scenarios.filter((row) => row.id !== id),
      };
    });
  };

  /** `false` = collapsed; missing key = expanded */
  const [estimationOpen, setEstimationOpen] = useState<Record<string, boolean>>({});

  const isEstimationOpen = (id: string) => estimationOpen[id] !== false;

  const toggleEstimation = (id: string) => {
    setEstimationOpen((prev) => {
      const open = prev[id] !== false;
      return { ...prev, [id]: !open };
    });
  };

  const scenarioIds = useMemo(
    () => state.scenarios.map((s) => s.id),
    [state.scenarios]
  );

  const collapseAllEstimations = () => {
    setEstimationOpen(Object.fromEntries(scenarioIds.map((id) => [id, false])));
  };

  const expandAllEstimations = () => setEstimationOpen({});

  const currency = state.meta.currency;

  return (
    <div className="sheet-block sheet-block--scenarios">
      <div className="sheet-block-header">Scenarios</div>
      <p className="muted" style={{ padding: "0.35rem 0.5rem 0" }}>
        Each scenario starts with a <strong>snapshot</strong> of balances at the point you
        made an estimation, then shows the same <strong>Movements</strong> layout filtered
        to that task (edits apply to the global ledger).
      </p>
      <div className="scenario-toolbar">
        <span className="scenario-toolbar-label">Estimation snapshots</span>
        <button type="button" className="btn" onClick={collapseAllEstimations}>
          Collapse all
        </button>
        <button type="button" className="btn" onClick={expandAllEstimations}>
          Expand all
        </button>
      </div>
      <div className="scenario-stack">
        {state.scenarios.map((sc) => {
          const es = sc.estimationSnapshot ?? {};
          const mergeEs = (
            p: Partial<NonNullable<ScenarioRow["estimationSnapshot"]>>
          ) =>
            patchScenario(sc.id, {
              estimationSnapshot: { ...es, ...p },
            });

          const linkedSpend = sc.groceryCycleId
            ? sumFoodSpendForCycle(state, sc.groceryCycleId)
            : null;
          const lastRemainingOnRun =
            sc.groceryCycleId != null
              ? getLastRemainingForGroceryCycle(state, sc.groceryCycleId)
              : undefined;

          const taskSelectValue = sc.linkedTaskDefId
            ? `named:${sc.linkedTaskDefId}`
            : sc.groceryCycleId
              ? `groc:${sc.groceryCycleId}`
              : "";

          return (
            <div key={sc.id} className="scenario-card">
              <div className="scenario-card-head">
                <input
                  className="scenario-name-input"
                  value={sc.name}
                  aria-label="Scenario name"
                  onChange={(e) =>
                    patchScenario(sc.id, { name: e.target.value })
                  }
                />
                <button
                  type="button"
                  className="btn"
                  disabled={state.scenarios.length <= 1}
                  onClick={() => removeScenario(sc.id)}
                >
                  Remove
                </button>
              </div>

              <div className="scenario-estimation">
                <button
                  type="button"
                  className="scenario-estimation-toggle"
                  onClick={() => toggleEstimation(sc.id)}
                  aria-expanded={isEstimationOpen(sc.id)}
                >
                  <span className="scenario-estimation-chevron" aria-hidden>
                    {isEstimationOpen(sc.id) ? "▼" : "▶"}
                  </span>
                  <span className="scenario-estimation-title">
                    Snapshot — state when you made this estimation
                  </span>
                </button>
                {isEstimationOpen(sc.id) ? (
                  <>
                    <p className="muted scenario-estimation-hint">
                      e.g. he had 17,30 on his bank, 21,55 cash; you had two 1 € coins and
                      40,00 in bills.
                    </p>
                    <div className="scenario-estimation-grid">
                      <label htmlFor={`es-bank-${sc.id}`}>His bank</label>
                      <input
                        id={`es-bank-${sc.id}`}
                        inputMode="decimal"
                        className="scenario-excel-input"
                        value={
                          es.hisBank != null && Number.isFinite(es.hisBank)
                            ? formatAmountField(es.hisBank)
                            : ""
                        }
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          mergeEs({ hisBank: raw === "" ? undefined : parseNumber(raw) });
                        }}
                      />
                      <label htmlFor={`es-hcash-${sc.id}`}>His cash</label>
                      <input
                        id={`es-hcash-${sc.id}`}
                        inputMode="decimal"
                        className="scenario-excel-input"
                        value={
                          es.hisCash != null && Number.isFinite(es.hisCash)
                            ? formatAmountField(es.hisCash)
                            : ""
                        }
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          mergeEs({ hisCash: raw === "" ? undefined : parseNumber(raw) });
                        }}
                      />
                      <label htmlFor={`es-1e-${sc.id}`}>My 1,00 € coins (count)</label>
                      <input
                        id={`es-1e-${sc.id}`}
                        inputMode="numeric"
                        value={
                          es.myOneEuroCoinCount != null
                            ? String(es.myOneEuroCoinCount)
                            : ""
                        }
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          mergeEs({
                            myOneEuroCoinCount:
                              raw === "" ? undefined : Math.max(0, parseInt(raw, 10) || 0),
                          });
                        }}
                      />
                      <label htmlFor={`es-bills-${sc.id}`}>My bills (EUR)</label>
                      <input
                        id={`es-bills-${sc.id}`}
                        inputMode="decimal"
                        className="scenario-excel-input"
                        value={
                          es.myCashBills != null && Number.isFinite(es.myCashBills)
                            ? formatAmountField(es.myCashBills)
                            : ""
                        }
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          mergeEs({
                            myCashBills: raw === "" ? undefined : parseNumber(raw),
                          });
                        }}
                      />
                    </div>
                    <label htmlFor={`es-note-${sc.id}`} className="muted">
                      Note
                    </label>
                    <textarea
                      id={`es-note-${sc.id}`}
                      className="scenario-notes"
                      rows={2}
                      value={es.note ?? ""}
                      onChange={(e) =>
                        mergeEs({ note: e.target.value || undefined })
                      }
                    />
                  </>
                ) : null}
              </div>

              <div className="scenario-scope-row">
                <label htmlFor={`sc-task-${sc.id}`}>Task (filters Movements below)</label>
                <div className="scenario-scope-controls">
                  <select
                    id={`sc-task-${sc.id}`}
                    value={taskSelectValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) {
                        patchScenario(sc.id, {
                          groceryCycleId: undefined,
                          linkedTaskDefId: undefined,
                          taskLabel: undefined,
                        });
                        return;
                      }
                      if (v.startsWith("named:")) {
                        const id = v.slice(6);
                        const td = state.tasks.find((x) => x.id === id);
                        patchScenario(sc.id, {
                          groceryCycleId: undefined,
                          linkedTaskDefId: id,
                          taskLabel: td?.name,
                        });
                        return;
                      }
                      if (v.startsWith("groc:")) {
                        const id = v.slice(5);
                        const c = state.groceryCycles.find((x) => x.id === id);
                        patchScenario(sc.id, {
                          linkedTaskDefId: undefined,
                          groceryCycleId: id,
                          taskLabel: c
                            ? composeGroceryTaskLabel(c)
                            : undefined,
                        });
                      }
                    }}
                  >
                    <option value="">— Choose task —</option>
                    {state.tasks.length > 0 ? (
                      <optgroup label="Named tasks">
                        {state.tasks.map((td) => (
                          <option key={td.id} value={`named:${td.id}`}>
                            {td.name}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                    <optgroup label="Grocery runs">
                      {state.groceryCycles.map((c) => (
                        <option key={c.id} value={`groc:${c.id}`}>
                          {composeGroceryTaskLabel(c)}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              {sc.groceryCycleId && linkedSpend !== null ? (
                <p className="muted scenario-linked-hint">
                  {lastRemainingOnRun != null &&
                  Number.isFinite(lastRemainingOnRun) ? (
                    <>
                      Last “remaining on task” on ledger for this run:{" "}
                      <strong>
                        {formatMoney(lastRemainingOnRun, currency)}
                      </strong>
                      .{" "}
                    </>
                  ) : null}
                  Σ food (linked movements):{" "}
                  {formatMoney(linkedSpend, currency)}
                </p>
              ) : null}

              <MovementsLedgerTable
                state={state}
                setState={setState}
                embedScenario={sc}
              />

              <textarea
                className="scenario-notes"
                placeholder="Scenario notes (optional)"
                value={sc.notes ?? ""}
                rows={2}
                onChange={(e) =>
                  patchScenario(sc.id, { notes: e.target.value })
                }
              />
            </div>
          );
        })}
      </div>
      <div className="sheet-block-footer">
        <button type="button" className="btn" onClick={addScenario}>
          Add scenario
        </button>
      </div>
    </div>
  );
}
