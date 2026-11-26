import type { ReactNode } from "react";
import type { ApiError } from "../lib/api";
import { useSprache, type Fassungen } from "../lib/sprache";

const T = {
  nochLeer: {
    de: "Noch keine Daten gesammelt. Der erste Lauf des Sammlers steht noch aus.",
    en: "No data collected yet. The collector has not run for the first time.",
    schwaebisch: "No koine Daten gsammlet. Dr Sammler isch no net 's erschte Mol glaufa.",
    bayrisch: "No koane Datn gsammelt. Da Sammler is no ned 's erste Moi glaffa.",
  },
  nichtGefunden: { de: "Nicht gefunden.", en: "Not found.", schwaebisch: "Net gfonda.", bayrisch: "Ned gfundn." },
  fehler: {
    de: "Die Daten konnten nicht geladen werden.",
    en: "The data could not be loaded.",
    schwaebisch: "D'Daten hen sich net lada lassa.",
    bayrisch: "De Datn ham se ned ladn lassn.",
  },
  laden: { de: "Lade Daten", en: "Loading data", schwaebisch: "Lad Daten", bayrisch: "Lad Datn" },
} satisfies Record<string, Fassungen>;

interface DataStateProps {
  loading: boolean;
  error: ApiError | null;
  children?: ReactNode;
}

function errorText(error: ApiError): Fassungen {
  if (error.status === 503) return T.nochLeer;
  if (error.status === 404) return T.nichtGefunden;
  return T.fehler;
}

/** Zeigt Laden, Leerzustand oder Fehler, sonst die Kinder. */
export function DataState({ loading, error, children }: DataStateProps) {
  const { t } = useSprache();
  if (loading) {
    return (
      <div className="state" role="status">
        <span className="state-spinner" aria-hidden="true" />
        <p>{t(T.laden)}</p>
      </div>
    );
  }
  if (error) {
    const kind = error.status === 503 ? "state-empty" : "state-error";
    return (
      <div className={`state ${kind}`} role={error.status === 503 ? "status" : "alert"}>
        <p>{t(errorText(error))}</p>
      </div>
    );
  }
  return <>{children}</>;
}
