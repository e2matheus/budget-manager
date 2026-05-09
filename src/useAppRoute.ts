import { useSyncExternalStore } from "react";

export type AppRoute = "ledger" | "scenarios";

function readRoute(): AppRoute {
  const raw = (window.location.hash || "").replace(/^#/, "").replace(/^\//, "");
  return raw === "scenarios" ? "scenarios" : "ledger";
}

function subscribe(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export function useAppRoute(): AppRoute {
  return useSyncExternalStore(subscribe, readRoute, () => "ledger" as AppRoute);
}

export function navigateToRoute(route: AppRoute) {
  if (route === "scenarios") {
    window.location.hash = "#/scenarios";
  } else {
    window.location.hash = "";
  }
}
