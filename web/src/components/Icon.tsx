import { useState, type ReactNode } from "react";
import { fallbackIconUrl } from "../lib/wow";

/**
 * Liefert die aktuell zu ladende URL und einen Fehler-Handler. Ohne eigene Rückfälle wird nach einem Fehler
 * einmal `fallbackIconUrl` versucht, mit `fallbacks` der Reihe nach diese Adressen. Danach ist die URL null.
 */
export function useIconSource(src: string | null | undefined, fallbacks?: string[]): [string | null, () => void] {
  const key = [src ?? "", ...(fallbacks ?? [])].join("|");
  const [state, setState] = useState<{ key: string; index: number }>({ key, index: 0 });
  const index = state.key === key ? state.index : 0;
  const first = fallbackIconUrl(src ?? "");
  const candidates = src ? [src, ...(fallbacks ?? (first ? [first] : []))] : [];
  const current = candidates[index] ?? null;
  const onError = () => {
    if (current) setState({ key, index: index + 1 });
  };
  return [current, onError];
}

interface IconProps {
  src: string | null | undefined;
  alt: string;
  size: number;
  /** Rahmenfarbe, z. B. die Qualitätsfarbe eines Gegenstands. */
  tone?: string;
  /** In Tooltips "eager", sonst lädt das Bild erst nach dem Einblenden. */
  loading?: "lazy" | "eager";
  /** Weitere Adressen, die nacheinander versucht werden, wenn `src` nicht lädt. */
  fallbacks?: string[];
  /** Ersatz, wenn kein Bild lädt; ohne Angabe ein leeres dunkles Feld. */
  placeholder?: ReactNode;
  className?: string;
}

/** Quadratisches Symbol mit Rahmen. Ohne Quelle oder bei Ladefehler ein Platzhalter. */
export function Icon({ src, alt, size, tone, loading = "lazy", fallbacks, placeholder, className }: IconProps) {
  const [url, onError] = useIconSource(src, fallbacks);
  const style = { width: size, height: size, borderColor: tone };
  const extra = className ? ` ${className}` : "";

  if (url === null) {
    if (placeholder !== undefined) return <>{placeholder}</>;
    return <span className={`icon icon-empty${extra}`} style={style} role={alt ? "img" : undefined} aria-label={alt || undefined} />;
  }
  return (
    <span className={`icon${extra}`} style={style}>
      <img src={url} alt={alt} width={size} height={size} loading={loading} decoding="async" onError={onError} />
    </span>
  );
}
