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
}

export type PaymentMethod = "bank" | "cash";

export type FoodSubcategory =
  | "online"
  | "mercadona"
  | "carrefour"
  | "dia"
  | "other";

export interface Movement {
  id: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  category: "food" | "utilities" | "other";
  foodSubcategory?: FoodSubcategory;
  memo: string;
}

/** Hypothetical “what if” spend — persisted in state.json with Save. */
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

export interface AppState {
  meta: {
    currency: string;
    openingBank: number;
    openingCash: number;
  };
  transfers: Transfer[];
  movements: Movement[];
  /** Estimation / scenario fields — part of your JSON backup. */
  scenario?: ScenarioInputs;
}

export interface DerivedBalances {
  bank: number;
  cash: number;
  foodRemaining: number;
  utilitiesRemaining: number;
  generalRemaining: number;
}
