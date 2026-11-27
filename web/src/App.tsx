import { Link, Navigate, NavLink, Route, Routes } from "react-router";
import { DiscordLink } from "./components/DiscordLink";
import { OBERFLAECHEN_ERWEITERUNGEN } from "./erweiterungen";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { site } from "./lib/site";
import { SpracheProvider, useSprache, type Fassungen } from "./lib/sprache";
import { versionText } from "./lib/version";
import { NewspaperArchivePage, NewspaperPage } from "./pages/NewspaperPage";
import { CharacterPage } from "./pages/CharacterPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { GuildPage } from "./pages/GuildPage";
import { ImprintPage } from "./pages/ImprintPage";
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
  source: {
    de: "Daten aus der Blizzard-API, stündlich aktualisiert. Inoffizielle Fanseite, nicht mit Blizzard Entertainment verbunden.",
    en: "Data from the Blizzard API, updated hourly. Unofficial fan site, not affiliated with Blizzard Entertainment.",
    schwaebisch:
      "Daten aus dr Blizzard-API, jede Stond frisch. Inoffizielle Fanseite, net mit Blizzard Entertainment verbandelt.",
    bayrisch:
      "Daten aus da Blizzard-API, jede Stund frisch. Inoffizielle Fanseitn, ned mit Blizzard Entertainment verbandelt.",
  },
  mainNavigation: { de: "Hauptnavigation", en: "Main navigation" },
  toOverview: { de: "zur Gildenübersicht", en: "to the guild overview" },
  legal: { de: "Rechtliches", en: "Legal" },
  imprint: { de: "Impressum", en: "Legal notice" },
  privacy: { de: "Datenschutz", en: "Privacy" },
} satisfies Record<string, Fassungen>;

/** Legal texts from a module, otherwise the core's placeholder templates. */
const CustomImprint = OBERFLAECHEN_ERWEITERUNGEN.find((e) => e.impressumSeite)?.impressumSeite ?? ImprintPage;
const CustomPrivacy = OBERFLAECHEN_ERWEITERUNGEN.find((e) => e.datenschutzSeite)?.datenschutzSeite ?? PrivacyPage;

/** Layout and routes. The caller provides the router (main.tsx or tests). */
export default function App() {
  return (
    <SpracheProvider>
      <Site />
    </SpracheProvider>
  );
}

function Site() {
  const { t, sprache } = useSprache();
  const version = versionText(import.meta.env.VITE_VERSION, import.meta.env.VITE_VERSION_DATE, sprache === "en");
  const { name, logo, logoAlt, tagline, imprint } = site();
  return (
    <div className="site">
      <header className="site-header">
        <div className="site-header-inner">
          <nav className="site-nav" aria-label={t(T.mainNavigation)}>
            {NAVIGATION.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
                {t(item.label)}
              </NavLink>
            ))}
          </nav>
          <Link to="/" className="brand" aria-label={`${name}, ${t(T.toOverview)}`}>
            <img
              className="brand-crest"
              src={logo}
              alt={logoAlt ?? (sprache === "en" ? `Crest of ${name}` : `Wappen der Gilde ${name}`)}
              width="256"
              height="256"
            />
          </Link>
          <div className="site-header-end">
            <LanguageSwitcher />
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
          <Route path="/zeitung" element={<NewspaperPage />} />
          <Route path="/zeitung/archiv" element={<NewspaperArchivePage />} />
          <Route path="/zeitung/:woche" element={<NewspaperPage />} />
          {imprint && <Route path="/impressum" element={<CustomImprint />} />}
          {imprint && <Route path="/datenschutz" element={<CustomPrivacy />} />}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <footer className="site-footer">
        {tagline && <p className="site-footer-guilds">{tagline}</p>}
        {site().discord && (
          <p>
            <DiscordLink className="footer-discord" />
          </p>
        )}
        <p>{t(T.source)}</p>
        {imprint && (
          <nav className="footer-legal" aria-label={t(T.legal)}>
            <Link to="/impressum">{t(T.imprint)}</Link>
            <Link to="/datenschutz">{t(T.privacy)}</Link>
          </nav>
        )}
        {version && <p className="footer-version">{version}</p>}
      </footer>
    </div>
  );
}
