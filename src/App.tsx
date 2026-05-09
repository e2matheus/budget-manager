import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { navigateToRoute, useAppRoute } from "./useAppRoute";
import "./App.css";
import { fetchState, saveState } from "./api";
import {
  countFoodMovementsForCycle,
  deriveBalances,
  sumFoodSpendForCycle,
} from "./derive";
import { migrateMovementRow, migrateTransferRow } from "./ledgerMigrate";
import {
  getLastRemainingForGroceryCycle,
  reconcileLedgerOrder,
} from "./ledgerOrder";
import { MovementsLedgerTable } from "./MovementsLedger";
import { ensureScenarioRow } from "./scenarioEnsure";
import { ScenariosPanel } from "./ScenariosPanel";
import {
  type AppState,
  type AppStateLoaded,
  type GroceryCycle,
  type Movement,
  type ScenarioRow,
  type TaskDef,
  type Transfer,
} from "./types";
import {
  formatAmountField,
  formatMoney,
  newId,
  parseNumber,
} from "./util";


function normalizeState(raw: AppStateLoaded): AppState {
  const legacy = raw.scenario;
  const groceryCycles: GroceryCycle[] = (raw.groceryCycles ?? []).map((c) => ({
    id: c.id && c.id.length > 0 ? c.id : newId(),
    label: c.label ?? "",
    anchorDate:
      c.anchorDate ?? new Date().toISOString().slice(0, 10),
    memo: c.memo,
  }));

  const rawScenarios = raw.scenarios ?? [];

  let scenarios: ScenarioRow[];
  if (rawScenarios.length > 0) {
    scenarios = rawScenarios.map((s) => ensureScenarioRow(s));
  } else if (legacy) {
    scenarios = [
      ensureScenarioRow({
        id: "migrated-scenario",
        name: "Scenario 1",
        ...legacy,
      }),
    ];
  } else {
    scenarios = [ensureScenarioRow({ id: newId(), name: "Scenario 1" })];
  }

  const movements = (raw.movements ?? []).map((m) => {
    const next = migrateMovementRow(
      m as Movement & { myCash?: number; hisCash?: number; hisBank?: number }
    );
    if (next.category !== "food") {
      next.foodSubcategory = undefined;
    }
    return next;
  });

  const transfers = (raw.transfers ?? []).map((t) =>
    migrateTransferRow(
      t as Transfer & { myCash?: number; hisCash?: number; hisBank?: number }
    )
  );

  const ledgerOrder = reconcileLedgerOrder(
    transfers,
    movements,
    raw.ledgerOrder
  );

  const tasks: TaskDef[] = (raw.tasks ?? []).map((t) => ({
    id: t.id && t.id.length > 0 ? t.id : newId(),
    name: t.name ?? "",
    memo: t.memo,
  }));

  const m = raw.meta;
  return {
    meta: {
      currency: m?.currency ?? "EUR",
      openingBank: m?.openingBank ?? 0,
      openingCash: m?.openingCash ?? 0,
    },
    transfers,
    movements,
    groceryCycles,
    tasks,
    scenarios,
    ledgerOrder,
  };
}

const emptyState = (): AppState => ({
  meta: { currency: "EUR", openingBank: 0, openingCash: 0 },
  transfers: [],
  movements: [],
  groceryCycles: [],
  tasks: [],
  scenarios: [ensureScenarioRow({ id: newId(), name: "Scenario 1" })],
  ledgerOrder: [],
});

export function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchState();
        if (!cancelled) {
          setState(normalizeState(s as AppStateLoaded));
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Failed to load";
          setLoadError(
            `${msg} — tip: run yarn dev so the API can read data/state.json`
          );
          setState(emptyState());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const derived = useMemo(
    () => (state ? deriveBalances(state) : null),
    [state]
  );

  const onSave = useCallback(async () => {
    if (!state) return;
    setSaving(true);
    setSaveStatus("");
    try {
      await saveState(state);
      setSaveStatus(`Saved ${new Date().toLocaleString()}`);
    } catch (e) {
      setSaveStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [state]);

  if (!state || !derived) {
    return (
      <div className="app-shell">
        <div className="sheet-window">
          <div className="sheet-titlebar">
            <span className="sheet-titlebar-brand">Budget Manager</span>
          </div>
          <div className="sheet-body">
            <p className="muted">Loading…</p>
            {loadError && (
              <p className="muted" style={{ color: "#8a1c1c" }}>
                {loadError}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppChrome
      state={state}
      derived={derived}
      setState={setState}
      loadError={loadError}
      saveStatus={saveStatus}
      saving={saving}
      onSave={onSave}
    />
  );
}

function AppChrome({
  state,
  derived,
  setState,
  loadError,
  saveStatus,
  saving,
  onSave,
}: {
  state: AppState;
  derived: NonNullable<ReturnType<typeof deriveBalances>>;
  setState: Dispatch<SetStateAction<AppState | null>>;
  loadError: string | null;
  saveStatus: string;
  saving: boolean;
  onSave: () => void;
}) {
  const route = useAppRoute();

  return (
    <div className="app-shell">
      <div className="sheet-window">
        <div className="sheet-titlebar">
          <div className="sheet-titlebar-left">
            <span className="sheet-titlebar-brand">Budget Manager</span>
            <nav className="sheet-titlebar-nav" aria-label="Main pages">
              <button
                type="button"
                className={`titlebar-nav-btn${route === "ledger" ? " is-active" : ""}`}
                onClick={() => navigateToRoute("ledger")}
              >
                Ledger
              </button>
              <button
                type="button"
                className={`titlebar-nav-btn${route === "scenarios" ? " is-active" : ""}`}
                onClick={() => navigateToRoute("scenarios")}
              >
                Scenarios
              </button>
            </nav>
          </div>
          <div className="sheet-titlebar-actions">
            <span
              className={
                saveStatus === "" || saveStatus.startsWith("Saved")
                  ? "status-pill"
                  : "status-pill error"
              }
            >
              {saveStatus || (loadError ? `Load: ${loadError}` : "")}
            </span>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving}
              onClick={() => void onSave()}
            >
              {saving ? "Saving…" : "Save to JSON"}
            </button>
          </div>
        </div>

        <div className="sheet-body">
          {route === "ledger" ? (
            <>
              <MetaSection state={state} setState={setState} />

              <div className="sheet-block">
                <div className="sheet-block-header">Balances &amp; allocation remainder</div>
                <div className="summary-grid">
                  <div className="summary-card">
                    <div className="label">Bank (account)</div>
                    <div className="value">
                      {formatMoney(derived.bank, state.meta.currency)}
                    </div>
                  </div>
                  <div className="summary-card">
                    <div className="label">Cash</div>
                    <div className="value">
                      {formatMoney(derived.cash, state.meta.currency)}
                    </div>
                  </div>
                  <div className="summary-card">
                    <div className="label">Food / groceries (remaining)</div>
                    <div className="value">
                      {formatMoney(derived.foodRemaining, state.meta.currency)}
                    </div>
                  </div>
                  <div className="summary-card">
                    <div className="label">Utilities / services (remaining)</div>
                    <div className="value">
                      {formatMoney(derived.utilitiesRemaining, state.meta.currency)}
                    </div>
                  </div>
                  <div className="summary-card">
                    <div className="label">General / other (remaining)</div>
                    <div className="value">
                      {formatMoney(derived.generalRemaining, state.meta.currency)}
                    </div>
                  </div>
                </div>
              </div>

              <GroceryCyclesSection state={state} setState={setState} />

              <TasksSection state={state} setState={setState} />

              <MovementsLedgerTable state={state} setState={setState} />
            </>
          ) : (
            <ScenariosPanel state={state} setState={setState} />
          )}
        </div>
      </div>
    </div>
  );
}


function MetaSection({
  state,
  setState,
}: {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState | null>>;
}) {
  return (
    <div className="sheet-block">
      <div className="sheet-block-header">Opening balances &amp; currency</div>
      <div className="meta-grid">
        <div className="meta-field">
          <label htmlFor="currency">Currency (ISO code)</label>
          <input
            id="currency"
            value={state.meta.currency}
            onChange={(e) =>
              setState((s) =>
                s
                  ? {
                      ...s,
                      meta: { ...s.meta, currency: e.target.value.toUpperCase() },
                    }
                  : s
              )
            }
          />
        </div>
        <div className="meta-field">
          <label htmlFor="open-bank">Opening bank</label>
          <input
            id="open-bank"
            inputMode="decimal"
            value={formatAmountField(state.meta.openingBank)}
            onChange={(e) =>
              setState((s) =>
                s
                  ? {
                      ...s,
                      meta: {
                        ...s.meta,
                        openingBank: parseNumber(e.target.value),
                      },
                    }
                  : s
              )
            }
          />
        </div>
        <div className="meta-field">
          <label htmlFor="open-cash">Opening cash</label>
          <input
            id="open-cash"
            inputMode="decimal"
            value={formatAmountField(state.meta.openingCash)}
            onChange={(e) =>
              setState((s) =>
                s
                  ? {
                      ...s,
                      meta: {
                        ...s.meta,
                        openingCash: parseNumber(e.target.value),
                      },
                    }
                  : s
              )
            }
          />
        </div>
      </div>
      <p className="muted" style={{ padding: "0 0.5rem 0.5rem" }}>
        Transfers increase bank/cash (optional split). Movements record spending. Food
        remainder = food-tagged transfers minus food movements. Grocery runs group
        multiple food lines (e.g. each ~2 weeks from first in-person shop).
      </p>
    </div>
  );
}

function TasksSection({
  state,
  setState,
}: {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState | null>>;
}) {
  const add = () => {
    const t: TaskDef = { id: newId(), name: "" };
    setState((s) => (s ? { ...s, tasks: [t, ...s.tasks] } : s));
  };

  const update = (id: string, patch: Partial<TaskDef>) => {
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        tasks: s.tasks.map((x) => (x.id === id ? { ...x, ...patch } : x)),
      };
    });
  };

  const remove = (id: string) => {
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        tasks: s.tasks.filter((t) => t.id !== id),
        transfers: s.transfers.map((t) =>
          t.taskDefId === id ? { ...t, taskDefId: undefined } : t
        ),
        movements: s.movements.map((m) =>
          m.taskDefId === id ? { ...m, taskDefId: undefined } : m
        ),
        scenarios: s.scenarios.map((sc) =>
          sc.linkedTaskDefId === id
            ? { ...sc, linkedTaskDefId: undefined }
            : sc
        ),
      };
    });
  };

  return (
    <div className="sheet-block sheet-block--tasks">
      <div className="sheet-block-header">Tasks</div>
      <p className="muted" style={{ padding: "0.35rem 0.5rem 0" }}>
        Named tasks for water, church collection, etc. Link them from Movements (Task
        column) or from a scenario below. Grocery runs stay in “Food / grocery runs”.
      </p>
      <div className="sheet-table-wrap">
        <table className="sheet-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Memo</th>
              <th className="cell-actions"> </th>
            </tr>
          </thead>
          <tbody>
            {state.tasks.map((t) => (
              <tr key={t.id}>
                <td>
                  <input
                    value={t.name}
                    placeholder="e.g. Aquaservice Marzo 2026"
                    onChange={(e) => update(t.id, { name: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    value={t.memo ?? ""}
                    placeholder="Optional"
                    onChange={(e) => update(t.id, { memo: e.target.value || undefined })}
                  />
                </td>
                <td className="cell-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => remove(t.id)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "0.45rem", borderTop: "1px solid #e3e3e3" }}>
        <button type="button" className="btn" onClick={add}>
          Add task
        </button>
      </div>
    </div>
  );
}

function GroceryCyclesSection({
  state,
  setState,
}: {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState | null>>;
}) {
  const add = () => {
    const c: GroceryCycle = {
      id: newId(),
      label: "",
      anchorDate: new Date().toISOString().slice(0, 10),
      memo: "",
    };
    setState((s) =>
      s ? { ...s, groceryCycles: [c, ...s.groceryCycles] } : s
    );
  };

  const update = (id: string, patch: Partial<GroceryCycle>) => {
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        groceryCycles: s.groceryCycles.map((c) =>
          c.id === id ? { ...c, ...patch } : c
        ),
      };
    });
  };

  const remove = (id: string) => {
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        groceryCycles: s.groceryCycles.filter((c) => c.id !== id),
        movements: s.movements.map((m) =>
          m.groceryCycleId === id ? { ...m, groceryCycleId: undefined } : m
        ),
        transfers: s.transfers.map((t) =>
          t.groceryCycleId === id ? { ...t, groceryCycleId: undefined } : t
        ),
      };
    });
  };

  return (
    <div className="sheet-block sheet-block--grocery">
      <div className="sheet-block-header">
        Food / grocery runs (anchor = first in-person purchase day)
      </div>
      <p className="muted" style={{ padding: "0.35rem 0.5rem 0" }}>
        Create one row per shopping period. Link food movements below so several
        purchases (Mercadona, Dia, transport, etc.) roll up to the same run.
      </p>
      <div className="sheet-table-wrap">
        <table className="sheet-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>First in-person day</th>
              <th>Memo</th>
              <th className="cell-num">Last remaining / Σ food (linked)</th>
              <th className="cell-actions"> </th>
            </tr>
          </thead>
          <tbody>
            {state.groceryCycles.map((c) => (
              <tr key={c.id}>
                <td>
                  <input
                    value={c.label}
                    placeholder="e.g. Compra del 30 de Marzo"
                    onChange={(e) => update(c.id, { label: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="date"
                    value={c.anchorDate}
                    onChange={(e) =>
                      update(c.id, { anchorDate: e.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    value={c.memo ?? ""}
                    onChange={(e) => update(c.id, { memo: e.target.value })}
                  />
                </td>
                <td className="cell-num">
                  <div className="grocery-cycle-stats">
                    {(() => {
                      const lastRem = getLastRemainingForGroceryCycle(
                        state,
                        c.id
                      );
                      const sum = sumFoodSpendForCycle(state, c.id);
                      const n = countFoodMovementsForCycle(state, c.id);
                      return (
                        <>
                          {lastRem != null && Number.isFinite(lastRem) ? (
                            <div>
                              <strong>
                                {formatMoney(lastRem, state.meta.currency)}
                              </strong>
                              <span className="muted"> remaining (last line)</span>
                            </div>
                          ) : null}
                          <div className="muted grocery-cycle-roll">
                            Σ food linked{" "}
                            {formatMoney(sum, state.meta.currency)} · {n} line
                            {n !== 1 ? "s" : ""}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </td>
                <td className="cell-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => remove(c.id)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "0.45rem", borderTop: "1px solid #e3e3e3" }}>
        <button type="button" className="btn" onClick={add}>
          Add grocery run
        </button>
      </div>
    </div>
  );
}

