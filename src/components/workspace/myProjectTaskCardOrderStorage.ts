import { sanitizeMyProjectCardOrder } from "./myProjectTaskCardReorderModel";

const MY_PROJECT_CARD_ORDER_STORAGE_KEY = "timemanage.myProjectTaskCardOrder.v1";

export const readStoredMyProjectCardOrder = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MY_PROJECT_CARD_ORDER_STORAGE_KEY);
    return sanitizeMyProjectCardOrder(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
};

export const writeStoredMyProjectCardOrder = (projectIds: string[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MY_PROJECT_CARD_ORDER_STORAGE_KEY, JSON.stringify(projectIds));
  } catch {
    // localStorage may be disabled by the browser; sorting still works for the current page session.
  }
};
