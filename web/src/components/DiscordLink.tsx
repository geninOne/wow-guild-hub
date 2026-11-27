import { site } from "../lib/site";

/** Link zum Discord der Gemeinschaft aus `WEBSITE_DISCORD`; ohne Adresse erscheint nichts. Eigenes, schlichtes Symbol. */
export function DiscordLink({ className }: { className?: string }) {
  const href = site().discord;
  if (!href) return null;
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer">
      <svg className="discord-icon" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
        <path
          d="M4 3.5h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="7.5" cy="9" r="1.2" fill="currentColor" />
        <circle cx="12.5" cy="9" r="1.2" fill="currentColor" />
      </svg>
      Discord
    </a>
  );
}
