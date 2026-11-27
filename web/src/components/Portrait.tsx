import { useIconSource } from "./Icon";
import type { CharacterRecord } from "../../../src/model";
import { useSprache, type Fassungen } from "../lib/sprache";
import { classColor } from "../lib/wow";

const T = {
  noPortrait: {
    de: "Kein Charakterbild verfügbar",
    en: "No character portrait available",
    schwaebisch: "Koi Charakterbild do",
    bayrisch: "Koa Charakterbild do",
  },
  portraitOf: {
    de: (name: string) => `Charakterbild von ${name}`,
    en: (name: string) => `Portrait of ${name}`,
    schwaebisch: (name: string) => `Charakterbild vo ${name}`,
    bayrisch: (name: string) => `Charakterbild vo ${name}`,
  },
} satisfies Record<string, Fassungen | Fassungen<(name: string) => string>>;

/** Full-body image of the character, loaded directly from render.worldofwarcraft.com. */

export function Portrait({ character }: { character: CharacterRecord }) {
  const src = character.media?.["main-raw"] ?? null;
  const [url, onError] = useIconSource(src);
  const color = classColor(character.classId);
  const { t } = useSprache();

  if (!url) {
    return (
      <div className="portrait portrait-empty" style={{ ["--portrait-tone" as string]: color }}>
        <p>{t(T.noPortrait)}</p>
      </div>
    );
  }
  return (
    <div className="portrait" style={{ ["--portrait-tone" as string]: color }}>
      <img src={url} alt={t(T.portraitOf)(character.name)} onError={onError} />
    </div>
  );
}
