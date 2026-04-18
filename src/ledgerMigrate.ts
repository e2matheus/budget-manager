import type { Movement, Transfer } from "./types";

type Legacy = { myCash?: number; hisCash?: number; hisBank?: number };

/** Map old story keys to after-* trail columns and drop legacy keys. */
export function migrateTransferRow(t: Transfer & Partial<Legacy>): Transfer {
  const { myCash, hisCash, hisBank, ...rest } = t as Transfer & Legacy;
  return {
    ...rest,
    afterHisBank: rest.afterHisBank ?? hisBank,
    afterHisCash: rest.afterHisCash ?? hisCash,
    afterMyCash: rest.afterMyCash ?? myCash,
    afterMyCashBills: rest.afterMyCashBills,
    afterMyCashCoins: rest.afterMyCashCoins,
  };
}

export function migrateMovementRow(m: Movement & Partial<Legacy>): Movement {
  const { myCash, hisCash, hisBank, ...rest } = m as Movement & Legacy;
  return {
    ...rest,
    afterHisBank: rest.afterHisBank ?? hisBank,
    afterHisCash: rest.afterHisCash ?? hisCash,
    afterMyCash: rest.afterMyCash ?? myCash,
    afterMyCashBills: rest.afterMyCashBills,
    afterMyCashCoins: rest.afterMyCashCoins,
  };
}
