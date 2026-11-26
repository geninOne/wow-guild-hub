import { Link, Navigate, NavLink, Route, Routes } from "react-router";
import { DiscordLink } from "./components/DiscordLink";
import { OBERFLAECHEN_ERWEITERUNGEN } from "./erweiterungen";
import { Sprachumschalter } from "./components/Sprachumschalter";
import { seite } from "./lib/seite";
import { SpracheProvider, useSprache, type Fassungen } from "./lib/sprache";
import { versionsText } from "./lib/version";
import { ZeitungArchivePage, ZeitungPage } from "./pages/ZeitungPage";
import { CharacterPage } from "./pages/CharacterPage";
import { DatenschutzPage } from "./pages/DatenschutzPage";
import { GuildPage } from "./pages/GuildPage";
import { ImpressumPage } from "./pages/ImpressumPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProfessionsPage } from "./pages/ProfessionsPage";
import { StatsPage } from "./pages/StatsPage";
import { TitlesPage } from "./pages/TitlesPage";

const NAVIGATION: { to: string; label: Fassungen; end: boolean }[] = [
  { to: "/", label: { de: "Gilde", en: "Guild", schwaebisch: "Gilde", bayrisch: "Gilde" }, end: true },
  { to: "/berufe", label: { de: "Berufe", en: "Professions", schwaebisch: "Berufe", bayrisch: "Berufe" }, end: false },
  {
    to: "/statistik",
    label: { de: "Statistik", en: "Statistics", schwaebisch: "Statistik", bayrisch: "Statistik" },
    end: false,
  },
  { to: "/titel", label: { de: "Titel", en: "Titles", schwaebisch: "Titel", bayrisch: "Titel" }, end: false },
  { to: "/zeitung", label: { de: "Wochenblatt", en: "Weekly", schwaebisch: "Wocheblatt", bayrisch: "Wochnblatt" }, end: false },
];

const T = {
  herkunft: {
    de: "Daten aus der Blizzard-API, stündlich aktualisiert. Inoffizielle Fanseite, nicht mit Blizzard Entertainment verbunden.",
    en: "Data from the Blizzard API, updated hourly. Unofficial fan site, not affiliated with Blizzard Entertainment.",
    schwaebisch:
      "Daten aus dr Blizzard-API, jede Stond frisch. Inoffizielle Fanseite, net mit Blizzard Entertainment verbandelt.",
    bayrisch:
      "Daten aus da Blizzard-API, jede Stund frisch. Inoffizielle Fanseitn, ned mit Blizzard Entertainment verbandelt.",
  },
  hauptnavigation: { de: "Hauptnavigation", en: "Main navigation" },
  zurUebersicht: { de: "zur Gildenübersicht", en: "to the guild overview" },
  rechtliches: { de: "Rechtliches", en: "Legal" },
  impressum: { de: "Impressum", en: "Legal notice" },
  datenschutz: { de: "Datenschutz", en: "Privacy" },
} satisfies Record<string, Fassungen>;

/** Rechtstexte aus einem Modul, sonst die Platzhalter-Vorlagen des Kerns. */
const EigenesImpressum = OBERFLAECHEN_ERWEITERUNGEN.find((e) => e.impressumSeite)?.impressumSeite ?? ImpressumPage;
const EigenerDatenschutz = OBERFLAECHEN_ERWEITERUNGEN.find((e) => e.datenschutzSeite)?.datenschutzSeite ?? DatenschutzPage;

/** Layout und Routen. Den Router setzt der Aufrufer (main.tsx bzw. Tests). */
export default function App() {
  return (
    <SpracheProvider>
      <Seite />
    </SpracheProvider>
  );
}

function Seite() {
  const { t, sprache } = useSprache();
  const version = versionsText(import.meta.env.VITE_VERSION, import.meta.env.VITE_VERSION_DATUM, sprache === "en");
  const { name, logo, logoAlt, untertitel, impressum } = seite();
  return (
    <div className="site">
      <header className="site-header">
        <div className="site-header-inner">
          <nav className="site-nav" aria-label={t(T.hauptnavigation)}>
            {NAVIGATION.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
                {t(item.label)}
              </NavLink>
            ))}
          </nav>
          <Link to="/" className="brand" aria-label={`${name}, ${t(T.zurUebersicht)}`}>
            <img
              className="brand-crest"
              src={logo}
              alt={logoAlt ?? (sprache === "en" ? `Crest of ${name}` : `Wappen der Gilde ${name}`)}
              width="256"
              height="256"
            />
          </Link>
          <div className="site-header-end">
            <Sprachumschalter />
            <DiscordLink className="discord-link" />
          </div>
        </div>
      </header>
      <main className="site-main">
        <Routes>
          <Route path="/" element={<GuildPage />} />
          <Route path="/charakter/:key" element={<CharacterPage />} />
          <Route path="/berufe" element={<ProfessionsPage />} />
          <Route path="/berufe/:beruf" element={<ProfessionsPage />} />
          <Route path="/statistik" element={<StatsPage />} />
          <Route path="/statistik/:reiter" element={<StatsPage />} />
          <Route path="/aktivitaet" element={<Navigate to="/statistik/aktivitaet" replace />} />
          <Route path="/titel" element={<TitlesPage />} />
          {OBERFLAECHEN_ERWEITERUNGEN.flatMap((e) =>
            (e.routen ?? []).map(({ pfad, Komponente }) => <Route key={`${e.id}:${pfad}`} path={pfad} element={<Komponente />} />),
          )}
          <Route path="/zeitung" element={<ZeitungPage />} />
          <Route path="/zeitung/archiv" element={<ZeitungArchivePage />} />
          <Route path="/zeitung/:woche" element={<ZeitungPage />} />
          {impressum && <Route path="/impressum" element={<EigenesImpressum />} />}
          {impressum && <Route path="/datenschutz" element={<EigenerDatenschutz />} />}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <footer className="site-footer">
        {untertitel && <p className="site-footer-guilds">{untertitel}</p>}
        {seite().discord && (
          <p>
            <DiscordLink className="footer-discord" />
          </p>
        )}
        <p>{t(T.herkunft)}</p>
        {impressum && (
          <nav className="footer-legal" aria-label={t(T.rechtliches)}>
            <Link to="/impressum">{t(T.impressum)}</Link>
            <Link to="/datenschutz">{t(T.datenschutz)}</Link>
          </nav>
        )}
        {version && <p className="footer-version">{version}</p>}
      </footer>
    </div>
  );
}
