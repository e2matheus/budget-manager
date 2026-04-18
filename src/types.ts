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

export interface AppState {
  meta: {
    currency: string;
    openingBank: number;
    openingCash: number;
  };
  transfers: Transfer[];
  movements: Movement[];
}

export interface DerivedBalances {
  bank: number;
  cash: number;
  foodRemaining: number;
  utilitiesRemaining: number;
  generalRemaining: number;
}
