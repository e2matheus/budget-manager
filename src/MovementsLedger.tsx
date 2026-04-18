import {
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  getOrderedLedgerRows,
  reconcileLedgerOrder,
  sortLedgerRefsByDate,
  swapLedgerRefs,
} from "./ledgerOrder";
import { ledgerRowInScenario } from "./scenarioScope";
import type {
  Allocation,
  AppState,
  FoodSubcategory,
  LedgerRowRef,
  Movement,
  ScenarioRow,
  Transfer,
} from "./types";
import { composeGroceryTaskLabel, formatAmountField, newId, parseNumber } from "./util";

export type MovementsLedgerProps = {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState | null>>;
  /** Only rows for this scenario’s task; hides global chrome when set. */
  embedScenario?: ScenarioRow;
  title?: string;
};

type RowKindFilter = "all" | "transfers" | "expenses";

function ledgerTaskDisplay(state: AppState, row: Transfer | Movement): string {
  if (row.taskLabel?.trim()) return row.taskLabel.trim();
  if (row.taskDefId) {
    const td = state.tasks.find((t) => t.id === row.taskDefId);
    if (td?.name.trim()) return td.name.trim();
  }
  if (row.groceryCycleId) {
    const c = state.groceryCycles.find((g) => g.id === row.groceryCycleId);
    if (c) return composeGroceryTaskLabel(c);
  }
  return "";
}

function OptMoney({
  value,
  onCommit,
}: {
  value: number | undefined;
  onCommit: (n: number | undefined) => void;
}) {
  return (
    <input
      inputMode="decimal"
      className="ledger-opt-num"
      value={value != null && Number.isFinite(value) ? formatAmountField(value) : ""}
      onChange={(e) => {
        const raw = e.target.value.trim();
        onCommit(raw === "" ? undefined : parseNumber(raw));
      }}
    />
  );
}

function OrderButtons({
  disabledUp,
  disabledDown,
  onUp,
  onDown,
}: {
  disabledUp: boolean;
  disabledDown: boolean;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <div className="ledger-order-col">
      <button
        type="button"
        className="btn btn-order"
        disabled={disabledUp}
        aria-label="Move up"
        onClick={onUp}
      >
        ▴
      </button>
      <button
        type="button"
        className="btn btn-order"
        disabled={disabledDown}
        aria-label="Move down"
        onClick={onDown}
      >
        ▾
      </button>
    </div>
  );
}

function TaskPicker({
  state,
  groceryCycleId,
  taskDefId,
  onApply,
}: {
  state: AppState;
  groceryCycleId: string | undefined;
  taskDefId: string | undefined;
  onApply: (patch: {
    groceryCycleId?: string;
    taskDefId?: string;
    taskLabel?: string;
  }) => void;
}) {
  const selectValue = taskDefId
    ? `named:${taskDefId}`
    : groceryCycleId
      ? `groc:${groceryCycleId}`
      : "";

  return (
    <div className="ledger-task-picker">
      <select
        className="ledger-task-select"
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            onApply({
              taskDefId: undefined,
              groceryCycleId: undefined,
              taskLabel: undefined,
            });
            return;
          }
          if (v.startsWith("named:")) {
            const id = v.slice(6);
            const td = state.tasks.find((x) => x.id === id);
            onApply({
              taskDefId: id,
              groceryCycleId: undefined,
              taskLabel: td?.name,
            });
            return;
          }
          if (v.startsWith("groc:")) {
            const id = v.slice(5);
            const c = state.groceryCycles.find((x) => x.id === id);
            onApply({
              taskDefId: undefined,
              groceryCycleId: id,
              taskLabel: c ? composeGroceryTaskLabel(c) : undefined,
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
  );
}

export function MovementsLedgerTable({
  state,
  setState,
  embedScenario,
  title,
}: MovementsLedgerProps) {
  const [taskFilter, setTaskFilter] = useState("");
  const [rowKind, setRowKind] = useState<RowKindFilter>("all");
  const [ledgerOrderMode, setLedgerOrderMode] = useState<
    "manual" | "dateDesc" | "dateAsc"
  >("manual");

  const applyLedgerDateSort = (dir: "asc" | "desc") => {
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        ledgerOrder: sortLedgerRefsByDate(s.transfers, s.movements, dir),
      };
    });
  };

  const taskLabels = useMemo(() => {
    const set = new Set<string>();
    for (const td of state.tasks) {
      if (td.name.trim()) set.add(td.name.trim());
    }
    for (const t of state.transfers) {
      const d = ledgerTaskDisplay(state, t);
      if (d) set.add(d);
    }
    for (const m of state.movements) {
      const d = ledgerTaskDisplay(state, m);
      if (d) set.add(d);
    }
    return Array.from(set).sort();
  }, [state]);

  const orderedRows = useMemo(() => getOrderedLedgerRows(state), [state]);

  const visibleRows = useMemo(() => {
    let rows = orderedRows;
    if (embedScenario) {
      rows = rows.filter((row) => {
        const r = row.kind === "transfer" ? row.transfer : row.movement;
        return ledgerRowInScenario(state, r, embedScenario);
      });
    }
    if (rowKind === "transfers") {
      rows = rows.filter((row) => row.kind === "transfer");
    } else if (rowKind === "expenses") {
      rows = rows.filter((row) => row.kind === "movement");
    }
    const q = taskFilter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const label =
        row.kind === "transfer"
          ? ledgerTaskDisplay(state, row.transfer)
          : ledgerTaskDisplay(state, row.movement);
      return label.toLowerCase().includes(q);
    });
  }, [orderedRows, taskFilter, state, rowKind, embedScenario]);

  const fullOrder = useMemo(
    () => reconcileLedgerOrder(state.transfers, state.movements, state.ledgerOrder),
    [state.transfers, state.movements, state.ledgerOrder]
  );

  const datalistId = embedScenario
    ? `ledger-task-dl-${embedScenario.id}`
    : "ledger-task-datalist";

  const moveRow = (ref: LedgerRowRef, delta: number) => {
    setState((s) => {
      if (!s) return s;
      const o = reconcileLedgerOrder(s.transfers, s.movements, s.ledgerOrder);
      const i = o.findIndex((r) => r.kind === ref.kind && r.id === ref.id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= o.length) return s;
      return { ...s, ledgerOrder: swapLedgerRefs(o, i, j) };
    });
  };

  const updateTransfer = (id: string, patch: Partial<Transfer>) => {
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        transfers: s.transfers.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      };
    });
  };

  const removeTransfer = (id: string) => {
    setState((s) => {
      if (!s) return s;
      const transfers = s.transfers.filter((t) => t.id !== id);
      return {
        ...s,
        transfers,
        ledgerOrder: reconcileLedgerOrder(transfers, s.movements, s.ledgerOrder),
      };
    });
  };

  const addTransfer = () => {
    const t: Transfer = {
      id: newId(),
      date: new Date().toISOString().slice(0, 10),
      amount: 0,
      concept: "",
      allocation: "food",
    };
    setState((s) => {
      if (!s) return s;
      const transfers = [t, ...s.transfers];
      const ledgerOrder = [
        { kind: "transfer" as const, id: t.id },
        ...reconcileLedgerOrder(s.transfers, s.movements, s.ledgerOrder),
      ];
      return { ...s, transfers, ledgerOrder };
    });
  };

  const updateMovement = (id: string, patch: Partial<Movement>) => {
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        movements: s.movements.map((m) => {
          if (m.id !== id) return m;
          const next: Movement = { ...m, ...patch };
          if (next.category !== "food") {
            next.foodSubcategory = undefined;
          }
          return next;
        }),
      };
    });
  };

  const removeMovement = (id: string) => {
    setState((s) => {
      if (!s) return s;
      const movements = s.movements.filter((m) => m.id !== id);
      return {
        ...s,
        movements,
        ledgerOrder: reconcileLedgerOrder(s.transfers, movements, s.ledgerOrder),
      };
    });
  };

  const addMovement = () => {
    const m: Movement = {
      id: newId(),
      date: new Date().toISOString().slice(0, 10),
      amount: 0,
      method: "bank",
      category: "food",
      foodSubcategory: "other",
      memo: "",
    };
    setState((s) => {
      if (!s) return s;
      const movements = [m, ...s.movements];
      const ledgerOrder = [
        { kind: "movement" as const, id: m.id },
        ...reconcileLedgerOrder(s.transfers, s.movements, s.ledgerOrder),
      ];
      return { ...s, movements, ledgerOrder };
    });
  };

  const splitMismatch = state.transfers.some((t) => {
    if (!t.split) return false;
    return Math.abs(t.split.bank + t.split.cash - t.amount) > 0.009;
  });

  const blockTitle =
    title ?? (embedScenario ? "Movements (this scenario)" : "Movements");

  return (
    <div
      className={
        "sheet-block sheet-block--ledger" +
        (embedScenario ? " sheet-block--ledger-embed" : "")
      }
    >
      <div className="sheet-block-header">{blockTitle}</div>
      {!embedScenario ? (
        <p className="muted" style={{ padding: "0.35rem 0.5rem 0" }}>
          <strong className="ledger-hint-in">Green</strong> = transfers (in);{" "}
          <strong className="ledger-hint-out">Orange</strong> = expenses (out).{" "}
          <strong>Remaining on task</strong> is the budget left for that task after each line
          (you update as you go). The “after” columns are optional history detail. Ledger
          totals above still come from amounts and splits.
        </p>
      ) : (
        <p className="muted" style={{ padding: "0.35rem 0.5rem 0" }}>
          Same ledger as above, filtered to this scenario’s task. Edits apply globally.
        </p>
      )}
      {!embedScenario ? (
        <div className="ledger-toolbar">
          <label className="ledger-filter">
            Filter by task
            <input
              type="search"
              value={taskFilter}
              placeholder="Type or pick a task"
              onChange={(e) => setTaskFilter(e.target.value)}
              list={datalistId}
            />
            <datalist id={datalistId}>
              {taskLabels.map((x) => (
                <option key={x} value={x} />
              ))}
            </datalist>
          </label>
          <label className="ledger-filter-rowkind">
            Show
            <select
              value={rowKind}
              onChange={(e) => setRowKind(e.target.value as RowKindFilter)}
            >
              <option value="all">All rows</option>
              <option value="transfers">Transfers only</option>
              <option value="expenses">Expenses only</option>
            </select>
          </label>
          <label className="ledger-filter-rowkind">
            Ledger order
            <select
              value={ledgerOrderMode}
              onChange={(e) => {
                const v = e.target.value as "manual" | "dateDesc" | "dateAsc";
                setLedgerOrderMode(v);
                if (v === "dateDesc") applyLedgerDateSort("desc");
                if (v === "dateAsc") applyLedgerDateSort("asc");
              }}
            >
              <option value="manual">Manual (▴▾)</option>
              <option value="dateDesc">By date (newest first)</option>
              <option value="dateAsc">By date (oldest first)</option>
            </select>
          </label>
        </div>
      ) : null}
      <div className="sheet-table-wrap sheet-table-wrap--ledger">
        <table className="sheet-table sheet-table--ledger">
          <thead>
            <tr>
              <th className="cell-actions th-order"> </th>
              <th> </th>
              <th>Date</th>
              <th className="cell-num">Amount</th>
              <th>Concept / memo</th>
              <th>Allocation / category</th>
              <th>Method</th>
              <th>Food detail</th>
              <th>Task</th>
              <th className="cell-num">Remaining on task</th>
              <th className="cell-num">His bank after</th>
              <th className="cell-num">His cash after</th>
              <th className="cell-num">My cash after</th>
              <th className="cell-num">My cash bills after</th>
              <th className="cell-num">My cash coins after</th>
              <th>Billed &gt; sent</th>
              <th className="cell-num">Bank (split)</th>
              <th className="cell-num">Cash (split)</th>
              <th className="cell-actions"> </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const ref = row.ref;
              const idx = fullOrder.findIndex(
                (r) => r.kind === ref.kind && r.id === ref.id
              );
              if (row.kind === "transfer") {
                const t = row.transfer;
                return (
                  <tr key={`t-${t.id}`} className="ledger-row ledger-row--in">
                    <td className="cell-actions">
                      <OrderButtons
                        disabledUp={idx <= 0}
                        disabledDown={idx < 0 || idx >= fullOrder.length - 1}
                        onUp={() => moveRow(ref, -1)}
                        onDown={() => moveRow(ref, 1)}
                      />
                    </td>
                    <td>
                      <span className="ledger-dir ledger-dir--in">In</span>
                    </td>
                    <td>
                      <input
                        type="date"
                        value={t.date}
                        onChange={(e) => updateTransfer(t.id, { date: e.target.value })}
                      />
                    </td>
                    <td className="cell-num">
                      <input
                        inputMode="decimal"
                        value={formatAmountField(t.amount)}
                        onChange={(e) =>
                          updateTransfer(t.id, { amount: parseNumber(e.target.value) })
                        }
                      />
                    </td>
                    <td>
                      <input
                        value={t.concept}
                        onChange={(e) =>
                          updateTransfer(t.id, { concept: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <select
                        value={t.allocation}
                        onChange={(e) =>
                          updateTransfer(t.id, {
                            allocation: e.target.value as Allocation,
                          })
                        }
                      >
                        <option value="food">Food / groceries</option>
                        <option value="utilities">Utilities / services</option>
                        <option value="general">General / other</option>
                      </select>
                    </td>
                    <td>
                      <span className="muted">—</span>
                    </td>
                    <td>
                      <span className="muted">—</span>
                    </td>
                    <td>
                      <TaskPicker
                        state={state}
                        groceryCycleId={t.groceryCycleId}
                        taskDefId={t.taskDefId}
                        onApply={(patch) => updateTransfer(t.id, patch)}
                      />
                    </td>
                    <td className="cell-num">
                      <OptMoney
                        value={t.remainingOnTask}
                        onCommit={(n) =>
                          updateTransfer(t.id, { remainingOnTask: n })
                        }
                      />
                    </td>
                    <td className="cell-num">
                      <OptMoney
                        value={t.afterHisBank}
                        onCommit={(n) => updateTransfer(t.id, { afterHisBank: n })}
                      />
                    </td>
                    <td className="cell-num">
                      <OptMoney
                        value={t.afterHisCash}
                        onCommit={(n) => updateTransfer(t.id, { afterHisCash: n })}
                      />
                    </td>
                    <td className="cell-num">
                      <OptMoney
                        value={t.afterMyCash}
                        onCommit={(n) => updateTransfer(t.id, { afterMyCash: n })}
                      />
                    </td>
                    <td className="cell-num">
                      <OptMoney
                        value={t.afterMyCashBills}
                        onCommit={(n) => updateTransfer(t.id, { afterMyCashBills: n })}
                      />
                    </td>
                    <td className="cell-num">
                      <OptMoney
                        value={t.afterMyCashCoins}
                        onCommit={(n) => updateTransfer(t.id, { afterMyCashCoins: n })}
                      />
                    </td>
                    <td className="cell-center">
                      <input
                        type="checkbox"
                        checked={!!t.billedOverSent}
                        title="Charge exceeded amount sent (e.g. water)"
                        onChange={(e) =>
                          updateTransfer(t.id, { billedOverSent: e.target.checked })
                        }
                      />
                    </td>
                    <td className="cell-num">
                      <input
                        inputMode="decimal"
                        value={t.split ? formatAmountField(t.split.bank) : ""}
                        placeholder="(all bank)"
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          if (!raw) {
                            updateTransfer(t.id, { split: undefined });
                            return;
                          }
                          const bank = parseNumber(raw);
                          const cash = t.split?.cash ?? 0;
                          updateTransfer(t.id, { split: { bank, cash } });
                        }}
                      />
                    </td>
                    <td className="cell-num">
                      <input
                        inputMode="decimal"
                        value={t.split ? formatAmountField(t.split.cash) : ""}
                        placeholder="—"
                        onChange={(e) => {
                          const raw = e.target.value.trim();
                          if (!raw && !t.split) return;
                          if (!raw) {
                            updateTransfer(t.id, { split: undefined });
                            return;
                          }
                          const cash = parseNumber(raw);
                          const bank = t.split?.bank ?? t.amount;
                          updateTransfer(t.id, { split: { bank, cash } });
                        }}
                      />
                    </td>
                    <td className="cell-actions">
                      <button
                        type="button"
                        className="btn"
                        onClick={() => removeTransfer(t.id)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              }
              const m = row.movement;
              return (
                <tr
                  key={`m-${m.id}`}
                  className={
                    "ledger-row ledger-row--out" +
                    (m.billedOverSent ? " ledger-row--variance" : "")
                  }
                >
                  <td className="cell-actions">
                    <OrderButtons
                      disabledUp={idx <= 0}
                      disabledDown={idx < 0 || idx >= fullOrder.length - 1}
                      onUp={() => moveRow(ref, -1)}
                      onDown={() => moveRow(ref, 1)}
                    />
                  </td>
                  <td>
                    <span className="ledger-dir ledger-dir--out">Out</span>
                  </td>
                  <td>
                    <input
                      type="date"
                      value={m.date}
                      onChange={(e) => updateMovement(m.id, { date: e.target.value })}
                    />
                  </td>
                  <td className="cell-num">
                    <input
                      inputMode="decimal"
                      value={formatAmountField(m.amount)}
                      onChange={(e) =>
                        updateMovement(m.id, { amount: parseNumber(e.target.value) })
                      }
                    />
                  </td>
                  <td>
                    <input
                      value={m.memo}
                      onChange={(e) => updateMovement(m.id, { memo: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={m.category}
                      onChange={(e) => {
                        const category = e.target.value as Movement["category"];
                        updateMovement(m.id, {
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
                    <select
                      value={m.method}
                      onChange={(e) =>
                        updateMovement(m.id, {
                          method: e.target.value as Movement["method"],
                        })
                      }
                    >
                      <option value="bank">Bank</option>
                      <option value="cash">Cash</option>
                    </select>
                  </td>
                  <td>
                    {m.category === "food" ? (
                      <select
                        value={m.foodSubcategory ?? "other"}
                        onChange={(e) =>
                          updateMovement(m.id, {
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
                    <TaskPicker
                      state={state}
                      groceryCycleId={m.groceryCycleId}
                      taskDefId={m.taskDefId}
                      onApply={(patch) => updateMovement(m.id, patch)}
                    />
                  </td>
                  <td className="cell-num">
                    <OptMoney
                      value={m.remainingOnTask}
                      onCommit={(n) =>
                        updateMovement(m.id, { remainingOnTask: n })
                      }
                    />
                  </td>
                  <td className="cell-num">
                    <OptMoney
                      value={m.afterHisBank}
                      onCommit={(n) => updateMovement(m.id, { afterHisBank: n })}
                    />
                  </td>
                  <td className="cell-num">
                    <OptMoney
                      value={m.afterHisCash}
                      onCommit={(n) => updateMovement(m.id, { afterHisCash: n })}
                    />
                  </td>
                  <td className="cell-num">
                    <OptMoney
                      value={m.afterMyCash}
                      onCommit={(n) => updateMovement(m.id, { afterMyCash: n })}
                    />
                  </td>
                  <td className="cell-num">
                    <OptMoney
                      value={m.afterMyCashBills}
                      onCommit={(n) => updateMovement(m.id, { afterMyCashBills: n })}
                    />
                  </td>
                  <td className="cell-num">
                    <OptMoney
                      value={m.afterMyCashCoins}
                      onCommit={(n) => updateMovement(m.id, { afterMyCashCoins: n })}
                    />
                  </td>
                  <td className="cell-center">
                    <input
                      type="checkbox"
                      checked={!!m.billedOverSent}
                      title="Charge exceeded amount sent"
                      onChange={(e) =>
                        updateMovement(m.id, { billedOverSent: e.target.checked })
                      }
                    />
                  </td>
                  <td>
                    <span className="muted">—</span>
                  </td>
                  <td>
                    <span className="muted">—</span>
                  </td>
                  <td className="cell-actions">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => removeMovement(m.id)}
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
      {splitMismatch ? (
        <div className="hint-warn">
          Warning: some transfer rows have bank+cash split that does not match the transfer
          amount.
        </div>
      ) : null}
      {!embedScenario ? (
        <div className="sheet-block-footer sheet-block-footer--ledger">
          <button type="button" className="btn ledger-btn-in" onClick={addTransfer}>
            Add transfer (in)
          </button>
          <button type="button" className="btn ledger-btn-out" onClick={addMovement}>
            Add movement (out)
          </button>
        </div>
      ) : null}
    </div>
  );
}
