import type { ReactNode } from "react";
import type { ApiError } from "../lib/api";
import { useLanguage, type Translations } from "../lib/language";

const T = {
  noData: {
    de: "Noch keine Daten gesammelt. Der erste Lauf des Sammlers steht noch aus.",
    en: "No data collected yet. The collector has not run for the first time.",
    schwaebisch: "No koine Daten gsammlet. Dr Sammler isch no net 's erschte Mol glaufa.",
    bayrisch: "No koane Datn gsammelt. Da Sammler is no ned 's erste Moi glaffa.",
  },
  notFound: { de: "Nicht gefunden.", en: "Not found.", schwaebisch: "Net gfonda.", bayrisch: "Ned gfundn." },
  error: {
    de: "Die Daten konnten nicht geladen werden.",
    en: "The data could not be loaded.",
    schwaebisch: "D'Daten hen sich net lada lassa.",
    bayrisch: "De Datn ham se ned ladn lassn.",
  },
  loading: { de: "Lade Daten", en: "Loading data", schwaebisch: "Lad Daten", bayrisch: "Lad Datn" },
} satisfies Record<string, Translations>;

interface DataStateProps {
  loading: boolean;
  error: ApiError | null;
  children?: ReactNode;
}

function errorText(error: ApiError): Translations {
  if (error.status === 503) return T.noData;
  if (error.status === 404) return T.notFound;
  return T.error;
}

/** Shows loading, empty state or error, otherwise the children. */
export function DataState({ loading, error, children }: DataStateProps) {
  const { t } = useLanguage();
  if (loading) {
    return (
      <div className="state" role="status">
        <span className="state-spinner" aria-hidden="true" />
        <p>{t(T.loading)}</p>
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
