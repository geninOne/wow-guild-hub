import { useState, type ReactNode } from "react";
import { fallbackIconUrl } from "../lib/wow";

/**
 * Returns the URL to load right now and an error handler. Without own fallbacks, `fallbackIconUrl` is tried once
 * after an error; with `fallbacks`, these addresses are tried in order. After that the URL is null.
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
  /** Border color, e.g. the quality color of an item. */
  tone?: string;
  /** "eager" in tooltips, otherwise the image only loads once it is shown. */
  loading?: "lazy" | "eager";
  /** Further addresses tried one after another when `src` does not load. */
  fallbacks?: string[];
  /** Replacement when no image loads; if not given, an empty dark box. */
  placeholder?: ReactNode;
  className?: string;
}

/** Square icon with a border. A placeholder without a source or on a load error. */

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
