import type { AppState, DerivedBalances, Movement, Transfer } from "./types";

function transferBankIn(t: Transfer): number {
  if (t.split) return t.split.bank;
  return t.amount;
}

function transferCashIn(t: Transfer): number {
  if (t.split) return t.split.cash;
  return 0;
}

function movementOut(m: Movement, method: Movement["method"]): number {
  if (m.method !== method) return 0;
  return m.amount;
}

export function deriveBalances(state: AppState): DerivedBalances {
  const { meta, transfers, movements } = state;

  let bank =
    meta.openingBank +
    transfers.reduce((s, t) => s + transferBankIn(t), 0) -
    movements.reduce((s, m) => s + movementOut(m, "bank"), 0);

  let cash =
    meta.openingCash +
    transfers.reduce((s, t) => s + transferCashIn(t), 0) -
    movements.reduce((s, m) => s + movementOut(m, "cash"), 0);

  const foodIn = transfers
    .filter((t) => t.allocation === "food")
    .reduce((s, t) => s + t.amount, 0);
  const foodOut = movements
    .filter((m) => m.category === "food")
    .reduce((s, m) => s + m.amount, 0);

  const utilIn = transfers
    .filter((t) => t.allocation === "utilities")
    .reduce((s, t) => s + t.amount, 0);
  const utilOut = movements
    .filter((m) => m.category === "utilities")
    .reduce((s, m) => s + m.amount, 0);

  const genIn = transfers
    .filter((t) => t.allocation === "general")
    .reduce((s, t) => s + t.amount, 0);
  const genOut = movements
    .filter((m) => m.category === "other")
    .reduce((s, m) => s + m.amount, 0);

  return {
    bank,
    cash,
    foodRemaining: foodIn - foodOut,
    utilitiesRemaining: utilIn - utilOut,
    generalRemaining: genIn - genOut,
  };
}

/** Project balances after a hypothetical one-off expense (not persisted). */
export function projectAfterExpense(
  state: AppState,
  expense: {
    amount: number;
    method: Movement["method"];
    category: Movement["category"];
  }
): DerivedBalances {
  const hypothetical: Movement = {
    id: "__hypothetical__",
    date: "",
    amount: expense.amount,
    method: expense.method,
    category: expense.category,
    memo: "(scenario)",
  };
  return deriveBalances({
    ...state,
    movements: [...state.movements, hypothetical],
  });
}
