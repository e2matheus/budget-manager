export type Allocation = "food" | "utilities" | "general";

export interface TransferSplit {
  bank: number;
  cash: number;
}

export interface Transfer {
  id: string;
  date: string;
  amount: number;
  concept: string;
  allocation: Allocation;
  /** If omitted, the full amount is credited to the bank account. */
  split?: TransferSplit;
  /** Optional link to a grocery run (same wording as food movements). */
  groceryCycleId?: string;
  /** Link to a named task (Tasks table), exclusive of grocery run link. */
  taskDefId?: string;
  /** Overrides composed grocery label for filtering and display. */
  taskLabel?: string;
  /** Budget left for this task after this line (you maintain as you go). */
  remainingOnTask?: number;
  /** History trail: balances after this line (same idea as story snapshot “after” columns). */
  afterHisBank?: number;
  afterHisCash?: number;
  afterMyCash?: number;
  afterMyCashBills?: number;
  afterMyCashCoins?: number;
  /** e.g. service charged more than amount sent (pair with a movement). */
  billedOverSent?: boolean;
}

export type PaymentMethod = "bank" | "cash";

export type FoodSubcategory =
  | "online"
  | "mercadona"
  | "carrefour"
  | "dia"
  | "other";

/** A grocery “run” (e.g. biweekly), anchored by the first in-person purchase day. */
export interface GroceryCycle {
  id: string;
  /** e.g. “Compra del 30 de Marzo” */
  label: string;
  /** First in-person purchase day for this cycle (~2-week window). */
  anchorDate: string;
  memo?: string;
}

/** Friendly labels for non–grocery-run lines (water, church collection, etc.). */
export interface TaskDef {
  id: string;
  /** Short display name e.g. “Aquaservice Marzo 2026”. */
  name: string;
  memo?: string;
}

export interface Movement {
  id: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  category: "food" | "utilities" | "other";
  foodSubcategory?: FoodSubcategory;
  memo: string;
  /** When set, this food spend belongs to a grocery cycle (multiple lines per run). */
  groceryCycleId?: string;
  taskDefId?: string;
  /** Overrides composed grocery label for filtering and display. */
  taskLabel?: string;
  remainingOnTask?: number;
  /** History trail: balances after this line. */
  afterHisBank?: number;
  afterHisCash?: number;
  afterMyCash?: number;
  afterMyCashBills?: number;
  afterMyCashCoins?: number;
  /** True when the charge exceeded what was sent (e.g. water 34,06 vs 24 sent). */
  billedOverSent?: boolean;
}

/** Legacy single-scenario shape (migrated to `scenarios`). */
export interface ScenarioInputs {
  amount: number;
  method: PaymentMethod;
  category: Movement["category"];
}

export function defaultScenarioInputs(): ScenarioInputs {
  return {
    amount: 0,
    method: "bank",
    category: "food",
  };
}

/** Bank steps for a “what happened” story — independent of the global ledger balance. */
export interface ScenarioBankWalkthrough {
  /** Balance on the account before the first line (e.g. 37,30). */
  opening: number;
  lines: {
    memo: string;
    /** Outgoing amount (positive number; shown as minus in the UI). */
    debit: number;
  }[];
}

/** Excel-style amounts for one scenario — when set, the UI uses these instead of ledger-derived totals. */
export interface ScenarioManualGrid {
  myCash?: number;
  /** Optional breakdown next to “My cash” (bills vs coins). */
  myCashBills?: number;
  myCashCoins?: number;
  hisCash?: number;
  hisBank?: number;
  /** Food / utilities / general “pool” remainder for this scenario row. */
  poolRemainder?: number;
}

/** Reference before an episode (e.g. before C). */
export interface ScenarioBeforeEpisode {
  hisBank?: number;
  hisCash?: number;
  note?: string;
}

/** Cash split: his wallet vs what you received (bills, 1 € coins for church, etc.). */
export interface ScenarioCashWalkthrough {
  /** His cash at the start of this episode. */
  hisOpening: number;
  steps: {
    memo: string;
    /** His cash after this step. */
    hisCashAfter: number;
  }[];
  /** Cash that is yours (tracked separately from his balance). */
  yourCash: {
    /** e.g. 10,00 bill for taxi Felipe */
    taxiFelipeBill?: number;
    /** How many 1,00 € coins for church (face value = count × 1 €). */
    churchOneEuroCoins?: number;
    extraMemo?: string;
  };
  /** His cash left at the end (e.g. 5,85 — not 10,55). */
  hisFinalCash: number;
}

/** One saved “what if” row (Estimation A, B, actual plan, etc.). */
export interface ScenarioRow {
  id: string;
  name: string;
  amount: number;
  method: PaymentMethod;
  category: Movement["category"];
  notes?: string;
  /** In-person / purchase day for this food task (e.g. Mercadona run). */
  purchaseDate?: string;
  /** Ties the scenario to a grocery run (“Compra del … · date”). */
  groceryCycleId?: string;
  /** Ties the scenario to a named task (Tasks table). */
  linkedTaskDefId?: string;
  /** Extra label for non-food tasks or free-text context (water service, etc.). */
  taskLabel?: string;
  /**
   * Snapshot at the point you made the estimation (“before walking” the lines below).
   */
  estimationSnapshot?: {
    hisBank?: number;
    hisCash?: number;
    /** How many 1,00 € coins you had (count). */
    myOneEuroCoinCount?: number;
    /** Bills total (EUR), e.g. 40. */
    myCashBills?: number;
    note?: string;
  };
  /** Optional episode math (legacy JSON; not shown in UI). */
  bankWalkthrough?: ScenarioBankWalkthrough;
  cashWalkthrough?: ScenarioCashWalkthrough;
  manualGrid?: ScenarioManualGrid;
  beforeEpisode?: ScenarioBeforeEpisode;
}

export type LedgerRowRef = { kind: "transfer" | "movement"; id: string };

export interface AppState {
  meta: {
    currency: string;
    openingBank: number;
    openingCash: number;
  };
  transfers: Transfer[];
  movements: Movement[];
  groceryCycles: GroceryCycle[];
  /** Named tasks (water, church, etc.) — link from Movements via taskDefId. */
  tasks: TaskDef[];
  scenarios: ScenarioRow[];
  /** Display order for the merged Movements table (transfers + movements). */
  ledgerOrder: LedgerRowRef[];
}

/** Raw load may omit `ledgerOrder` (filled on normalize) or legacy `scenario`. */
export type AppStateLoaded = Omit<AppState, "ledgerOrder"> & {
  ledgerOrder?: LedgerRowRef[];
  scenario?: ScenarioInputs;
};

export interface DerivedBalances {
  bank: number;
  cash: number;
  foodRemaining: number;
  utilitiesRemaining: number;
  generalRemaining: number;
}
