import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import "./App.css";
import { fetchState, saveState } from "./api";
import { deriveBalances, projectAfterExpense } from "./derive";
import {
  defaultScenarioInputs,
  type Allocation,
  type AppState,
  type FoodSubcategory,
  type Movement,
  type ScenarioInputs,
  type Transfer,
} from "./types";
import { formatMoney, newId, parseNumber } from "./util";

function normalizeState(raw: AppState): AppState {
  return {
    ...raw,
    scenario: { ...defaultScenarioInputs(), ...raw.scenario },
  };
}

const emptyState = (): AppState => ({
  meta: { currency: "EUR", openingBank: 0, openingCash: 0 },
  transfers: [],
  movements: [],
  scenario: defaultScenarioInputs(),
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
          setState(normalizeState(s));
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "Failed to load");
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
            <span>Budget Manager</span>
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
    <div className="app-shell">
      <div className="sheet-window">
        <div className="sheet-titlebar">
          <span>Budget Manager</span>
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

          <TransfersTable state={state} setState={setState} />

          <MovementsTable state={state} setState={setState} />

          <ScenarioPanel state={state} setState={setState} />
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
            value={String(state.meta.openingBank)}
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
            value={String(state.meta.openingCash)}
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
        remainder = food-tagged transfers minus food movements.
      </p>
    </div>
  );
}

function TransfersTable({
  state,
  setState,
}: {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState | null>>;
}) {
  const update = (id: string, patch: Partial<Transfer>) => {
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        transfers: s.transfers.map((t) =>
          t.id === id ? { ...t, ...patch } : t
        ),
      };
    });
  };

  const remove = (id: string) => {
    setState((s) =>
      s ? { ...s, transfers: s.transfers.filter((t) => t.id !== id) } : s
    );
  };

  const add = () => {
    const t: Transfer = {
      id: newId(),
      date: new Date().toISOString().slice(0, 10),
      amount: 0,
      concept: "",
      allocation: "food",
    };
    setState((s) => (s ? { ...s, transfers: [t, ...s.transfers] } : s));
  };

  return (
    <div className="sheet-block">
      <div className="sheet-block-header">Transfers (in)</div>
      <div className="sheet-table-wrap">
        <table className="sheet-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Concept</th>
              <th>Allocation</th>
              <th>Bank (split)</th>
              <th>Cash (split)</th>
              <th className="cell-actions"> </th>
            </tr>
          </thead>
          <tbody>
            {state.transfers.map((t) => {
              return (
                <tr key={t.id}>
                  <td>
                    <input
                      type="date"
                      value={t.date}
                      onChange={(e) => update(t.id, { date: e.target.value })}
                    />
                  </td>
                  <td className="cell-num">
                    <input
                      inputMode="decimal"
                      value={String(t.amount)}
                      onChange={(e) =>
                        update(t.id, { amount: parseNumber(e.target.value) })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={t.concept}
                      onChange={(e) =>
                        update(t.id, { concept: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <select
                      value={t.allocation}
                      onChange={(e) =>
                        update(t.id, {
                          allocation: e.target.value as Allocation,
                        })
                      }
                    >
                      <option value="food">Food / groceries</option>
                      <option value="utilities">Utilities / services</option>
                      <option value="general">General / other</option>
                    </select>
                  </td>
                  <td className="cell-num">
                    <input
                      inputMode="decimal"
                      value={
                        t.split ? String(t.split.bank) : ""
                      }
                      placeholder="(all bank)"
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        if (!raw) {
                          update(t.id, { split: undefined });
                          return;
                        }
                        const bank = parseNumber(raw);
                        const cash = t.split?.cash ?? 0;
                        update(t.id, { split: { bank, cash } });
                      }}
                    />
                  </td>
                  <td className="cell-num">
                    <input
                      inputMode="decimal"
                      value={
                        t.split ? String(t.split.cash) : ""
                      }
                      placeholder="—"
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        if (!raw && !t.split) return;
                        if (!raw) {
                          update(t.id, { split: undefined });
                          return;
                        }
                        const cash = parseNumber(raw);
                        const bank = t.split?.bank ?? t.amount;
                        update(t.id, { split: { bank, cash } });
                      }}
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
              );
            })}
          </tbody>
        </table>
      </div>
      {state.transfers.some((t) => {
        if (!t.split) return false;
        return Math.abs(t.split.bank + t.split.cash - t.amount) > 0.009;
      }) && (
        <div className="hint-warn">
          Warning: some rows have bank+cash split that does not match the transfer
          amount.
        </div>
      )}
      <div style={{ padding: "0.45rem", borderTop: "1px solid #e3e3e3" }}>
        <button type="button" className="btn" onClick={add}>
          Add transfer
        </button>
      </div>
    </div>
  );
}

function MovementsTable({
  state,
  setState,
}: {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState | null>>;
}) {
  const update = (id: string, patch: Partial<Movement>) => {
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        movements: s.movements.map((m) =>
          m.id === id ? { ...m, ...patch } : m
        ),
      };
    });
  };

  const remove = (id: string) => {
    setState((s) =>
      s ? { ...s, movements: s.movements.filter((m) => m.id !== id) } : s
    );
  };

  const add = () => {
    const m: Movement = {
      id: newId(),
      date: new Date().toISOString().slice(0, 10),
      amount: 0,
      method: "bank",
      category: "food",
      foodSubcategory: "other",
      memo: "",
    };
    setState((s) => (s ? { ...s, movements: [m, ...s.movements] } : s));
  };

  return (
    <div className="sheet-block">
      <div className="sheet-block-header">Movements (out)</div>
      <div className="sheet-table-wrap">
        <table className="sheet-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Category</th>
              <th>Food detail</th>
              <th>Memo</th>
              <th className="cell-actions"> </th>
            </tr>
          </thead>
          <tbody>
            {state.movements.map((m) => (
              <tr key={m.id}>
                <td>
                  <input
                    type="date"
                    value={m.date}
                    onChange={(e) => update(m.id, { date: e.target.value })}
                  />
                </td>
                <td className="cell-num">
                  <input
                    inputMode="decimal"
                    value={String(m.amount)}
                    onChange={(e) =>
                      update(m.id, { amount: parseNumber(e.target.value) })
                    }
                  />
                </td>
                <td>
                  <select
                    value={m.method}
                    onChange={(e) =>
                      update(m.id, {
                        method: e.target.value as Movement["method"],
                      })
                    }
                  >
                    <option value="bank">Bank</option>
                    <option value="cash">Cash</option>
                  </select>
                </td>
                <td>
                  <select
                    value={m.category}
                    onChange={(e) => {
                      const category = e.target.value as Movement["category"];
                      update(m.id, {
                        category,
                        foodSubcategory:
                          category === "food" ? m.foodSubcategory ?? "other" : undefined,
                      });
                    }}
                  >
                    <option value="food">Food / groceries</option>
                    <option value="utilities">Utilities / services</option>
                    <option value="other">Other</option>
                  </select>
                </td>
                <td>
                  {m.category === "food" ? (
                    <select
                      value={m.foodSubcategory ?? "other"}
                      onChange={(e) =>
                        update(m.id, {
                          foodSubcategory: e.target.value as FoodSubcategory,
                        })
                      }
                    >
                      <option value="online">Supermarket online</option>
                      <option value="mercadona">Mercadona</option>
                      <option value="carrefour">Carrefour</option>
                      <option value="dia">Dia</option>
                      <option value="other">Other</option>
                    </select>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <input
                    value={m.memo}
                    onChange={(e) => update(m.id, { memo: e.target.value })}
                  />
                </td>
                <td className="cell-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => remove(m.id)}
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
          Add movement
        </button>
      </div>
    </div>
  );
}

function ScenarioPanel({
  state,
  setState,
}: {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState | null>>;
}) {
  const sc: ScenarioInputs = {
    ...defaultScenarioInputs(),
    ...state.scenario,
  };

  const patchScenario = (patch: Partial<ScenarioInputs>) => {
    setState((s) =>
      s
        ? {
            ...s,
            scenario: { ...defaultScenarioInputs(), ...s.scenario, ...patch },
          }
        : s
    );
  };

  const projected = useMemo(
    () =>
      projectAfterExpense(state, {
        amount: sc.amount,
        method: sc.method,
        category: sc.category,
      }),
    [state, sc.amount, sc.method, sc.category]
  );
  const base = useMemo(() => deriveBalances(state), [state]);

  const taskRemaining =
    sc.category === "food"
      ? projected.foodRemaining
      : sc.category === "utilities"
        ? projected.utilitiesRemaining
        : projected.generalRemaining;

  return (
    <div className="sheet-block">
      <div className="sheet-block-header">
        Scenario — if they spend this next (saved with your backup file)
      </div>
      <div className="scenario-grid">
        <div className="scenario-field">
          <label htmlFor="sc-amt">Purchase amount</label>
          <input
            id="sc-amt"
            inputMode="decimal"
            value={String(sc.amount)}
            onChange={(e) =>
              patchScenario({ amount: parseNumber(e.target.value) })
            }
          />
        </div>
        <div className="scenario-field">
          <label htmlFor="sc-method">Paid from</label>
          <select
            id="sc-method"
            value={sc.method}
            onChange={(e) =>
              patchScenario({
                method: e.target.value as Movement["method"],
              })
            }
          >
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
          </select>
        </div>
        <div className="scenario-field">
          <label htmlFor="sc-cat">Counts against</label>
          <select
            id="sc-cat"
            value={sc.category}
            onChange={(e) =>
              patchScenario({
                category: e.target.value as Movement["category"],
              })
            }
          >
            <option value="food">Food / groceries</option>
            <option value="utilities">Utilities / services</option>
            <option value="other">Other / general</option>
          </select>
        </div>
      </div>
      <div className="scenario-out">
        <div>
          <span className="muted">Projected bank: </span>
          <strong>{formatMoney(projected.bank, state.meta.currency)}</strong>
          <span className="muted">
            {" "}
            (Δ {formatMoney(projected.bank - base.bank, state.meta.currency)})
          </span>
        </div>
        <div>
          <span className="muted">Projected cash: </span>
          <strong>{formatMoney(projected.cash, state.meta.currency)}</strong>
          <span className="muted">
            {" "}
            (Δ {formatMoney(projected.cash - base.cash, state.meta.currency)})
          </span>
        </div>
        <div>
          <span className="muted">Remaining for chosen task: </span>
          <strong>{formatMoney(taskRemaining, state.meta.currency)}</strong>
        </div>
      </div>
    </div>
  );
}
