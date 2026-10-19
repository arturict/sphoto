import { Link } from '@tanstack/react-router';
import { usePageTitle } from '../lib/use-page-title';
import { Button, Card, RouterLinkButton } from './ui';

export function NotFound() {
  usePageTitle('Seite nicht gefunden');
  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <h1 className="text-2xl font-semibold">Seite nicht gefunden</h1>
        <p className="mt-3 text-muted">Diese Adresse gibt es bei SPhoto nicht. Vielleicht hat sich ein Tippfehler eingeschlichen.</p>
        <RouterLinkButton to="/" className="mt-5">
          Zur Startseite
        </RouterLinkButton>
      </Card>
    </div>
  );
}

export function RootError({ reset }: { reset: () => void }) {
  usePageTitle('Fehler');
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <Card>
        <h1 className="text-2xl font-semibold">Hier ist etwas schiefgelaufen</h1>
        <p className="mt-3 text-muted">Die Seite konnte nicht angezeigt werden. Versuche es noch einmal oder gehe zurück zur Startseite.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={reset}>Erneut versuchen</Button>
          <Link to="/" className="inline-flex min-h-11 items-center px-2 font-medium text-accent underline underline-offset-2">
            Zur Startseite
          </Link>
        </div>
      </Card>
    </div>
  );
}
