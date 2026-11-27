import type { ReputationView } from "../../../src/api/types";
import { useLanguage, type Translations } from "../lib/language";

const T = {
  gathering: {
    de: "Rufdaten werden gerade zusammengetragen. Schau bald wieder vorbei.",
    en: "Reputation data is being gathered right now. Check back soon.",
    schwaebisch: "D'Rufdaten werdet grad zammatraga. Schau bald wieder vorbei, gell.",
    bayrisch: "De Rufdatn wern grad zammtragn. Schau boid wieder vorbei, gell.",
  },
  noReputation: {
    de: "Noch keinen Ruf bei einer Fraktion gesammelt.",
    en: "No reputation with any faction yet.",
    schwaebisch: "No koin Ruf bei ra Fraktion gsammlet.",
    bayrisch: "No koan Ruf bei a Fraktion gsammelt.",
  },
} satisfies Record<string, Translations>;

/** Color by standing: red up to Unfriendly, yellow for Neutral, green from Friendly on (standing ids 0 to 7). */
function tierClass(tier: number): string {
  if (tier <= 2) return "reputation-hostile";
  if (tier === 3) return "reputation-neutral";
  return "reputation-friendly";
}

/** Reputation of a character, by faction group. Only its own standing, no comparison. */

export function ReputationPanel({ view }: { view: ReputationView }) {
  const { t } = useLanguage();
  if (!view.available) {
    return (
      <div className="state state-empty">
        <p>{t(T.gathering)}</p>
      </div>
    );
  }
  if (view.groups.length === 0) {
    return (
      <div className="state state-empty">
        <p>{t(T.noReputation)}</p>
      </div>
    );
  }
  return (
    <div className="panel reputation">
      {view.groups.map((group, i) => (
        <section key={group.name} className="reputation-group" aria-labelledby={`ruf-${i}`}>
          <h2 className="panel-title" id={`ruf-${i}`}>
            {group.name}
          </h2>
          <ul className="reputation-list">
            {group.factions.map((f) => {
              const share = f.max > 0 ? Math.min(100, Math.max(0, (f.value / f.max) * 100)) : 0;
              return (
                <li key={f.id} className="reputation-row">
                  <span className="reputation-name">{f.name}</span>
                  <span className="reputation-tier small">{f.tierName}</span>
                  <span className="skill-bar reputation-bar" role="presentation">
                    <span className={`skill-bar-fill reputation-fill ${tierClass(f.tier)}`} style={{ width: `${share}%` }} />
                  </span>
                  <span className="num small reputation-value">
                    {f.value} / {f.max}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
