import { Link, Outlet } from '@tanstack/react-router';
import { LogoMark } from './icons';

const navLink = 'rounded-md px-2 py-1.5 text-sm font-medium text-muted hover:text-fg';

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-accent-fg"
      >
        Zum Inhalt springen
      </a>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 text-lg font-bold" aria-label="SPhoto, Startseite">
            <LogoMark />
            SPhoto
          </Link>
          <nav aria-label="Hauptnavigation" className="flex items-center gap-1 sm:gap-2">
            <Link to="/" hash="preise" className={navLink}>
              Preise
            </Link>
            <Link to="/portal" className={`${navLink} border border-line bg-surface text-fg`}>
              Anmelden
            </Link>
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 focus:outline-none sm:px-6 sm:py-12">
        <Outlet />
      </main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-6">
          <p>SPhoto – private Foto-Cloud auf Basis von Immich.</p>
          <Link to="/portal" className="font-medium text-accent underline underline-offset-2">
            Kundenportal
          </Link>
        </div>
      </footer>
    </div>
  );
}
