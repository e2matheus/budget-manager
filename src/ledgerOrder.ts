import type {
  AppState,
  LedgerRowRef,
  Movement,
  Transfer,
} from "./types";

export type OrderedLedgerRow =
  | { ref: LedgerRowRef; kind: "transfer"; transfer: Transfer }
  | { ref: LedgerRowRef; kind: "movement"; movement: Movement };

/** Keep order in sync with transfers/movements: drop orphans, append new ids. */
export function reconcileLedgerOrder(
  transfers: Transfer[],
  movements: Movement[],
  existing?: LedgerRowRef[] | null
): LedgerRowRef[] {
  const transferIds = new Set(transfers.map((t) => t.id));
  const movementIds = new Set(movements.map((m) => m.id));
  const usedTransfers = new Set<string>();
  const usedMovements = new Set<string>();
  const result: LedgerRowRef[] = [];

  const pushValid = (ref: LedgerRowRef) => {
    if (ref.kind === "transfer") {
      if (transferIds.has(ref.id) && !usedTransfers.has(ref.id)) {
        result.push(ref);
        usedTransfers.add(ref.id);
      }
    } else {
      if (movementIds.has(ref.id) && !usedMovements.has(ref.id)) {
        result.push(ref);
        usedMovements.add(ref.id);
      }
    }
  };

  if (existing?.length) {
    for (const ref of existing) {
      pushValid(ref);
    }
  }
  for (const t of transfers) {
    if (!usedTransfers.has(t.id)) {
      pushValid({ kind: "transfer", id: t.id });
    }
  }
  for (const m of movements) {
    if (!usedMovements.has(m.id)) {
      pushValid({ kind: "movement", id: m.id });
    }
  }
  return result;
}

export function getOrderedLedgerRows(state: AppState): OrderedLedgerRow[] {
  const order = reconcileLedgerOrder(
    state.transfers,
    state.movements,
    state.ledgerOrder
  );
  const tMap = new Map(state.transfers.map((t) => [t.id, t]));
  const mMap = new Map(state.movements.map((m) => [m.id, m]));
  const rows: OrderedLedgerRow[] = [];
  for (const ref of order) {
    if (ref.kind === "transfer") {
      const transfer = tMap.get(ref.id);
      if (transfer) {
        rows.push({ ref, kind: "transfer", transfer });
      }
    } else {
      const movement = mMap.get(ref.id);
      if (movement) {
        rows.push({ ref, kind: "movement", movement });
      }
    }
  }
  return rows;
}

/** Swap two positions in the merged ledger order (move row up/down). */
export function swapLedgerRefs(
  order: LedgerRowRef[],
  i: number,
  j: number
): LedgerRowRef[] {
  if (i < 0 || j < 0 || i >= order.length || j >= order.length || i === j) {
    return order;
  }
  const next = [...order];
  const tmp = next[i];
  next[i] = next[j]!;
  next[j] = tmp!;
  return next;
}

/** Full ledger order sorted by ISO date on each row (tie-break: transfer before movement id). */
export function sortLedgerRefsByDate(
  transfers: Transfer[],
  movements: Movement[],
  direction: "asc" | "desc"
): LedgerRowRef[] {
  type Row = { ref: LedgerRowRef; date: string; tie: string };
  const rows: Row[] = [];
  for (const t of transfers) {
    rows.push({
      ref: { kind: "transfer", id: t.id },
      date: t.date,
      tie: `t:${t.id}`,
    });
  }
  for (const m of movements) {
    rows.push({
      ref: { kind: "movement", id: m.id },
      date: m.date,
      tie: `m:${m.id}`,
    });
  }
  rows.sort((a, b) => {
    const c = a.date.localeCompare(b.date);
    if (c !== 0) return direction === "asc" ? c : -c;
    return a.tie.localeCompare(b.tie);
  });
  return rows.map((r) => r.ref);
}

/** Latest “remaining on task” on the ledger for this grocery cycle (walks ledger order). */
export function getLastRemainingForGroceryCycle(
  state: AppState,
  cycleId: string
): number | undefined {
  const order = reconcileLedgerOrder(
    state.transfers,
    state.movements,
    state.ledgerOrder
  );
  const tMap = new Map(state.transfers.map((t) => [t.id, t]));
  const mMap = new Map(state.movements.map((m) => [m.id, m]));
  let last: number | undefined;
  for (const ref of order) {
    const row =
      ref.kind === "transfer"
        ? tMap.get(ref.id)
        : mMap.get(ref.id);
    if (!row || row.groceryCycleId !== cycleId) continue;
    if (
      row.remainingOnTask != null &&
      Number.isFinite(row.remainingOnTask)
    ) {
      last = row.remainingOnTask;
    }
  }
  return last;
}
