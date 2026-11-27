/**
 * Anteil des Budgets, in dem ein Sammler nichts Neues mehr beginnt (2 s bei den üblichen 12 s). Der Rest gehört den
 * Anfragen, die noch unterwegs sind, und dem Schreiben am Ende. Der Planer von Netlify wartet höchstens etwa 15 s
 * auf die Antwort und startet den Lauf sonst ein zweites Mal; der Start der Function kostet davon schon bis zu 1 s.
 */
export const END_RESERVE_SHARE = 1 / 6;

/** Zeitpunkt, ab dem ein Lauf mit Start `started` keine neue Arbeit mehr beginnt. */
export function workEndOf(started: number, budgetMs: number): number {
  return started + Math.floor(budgetMs * (1 - END_RESERVE_SHARE));
}
