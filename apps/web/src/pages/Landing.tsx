import { FreeSignupForm } from '../components/FreeSignupForm';
import { CheckIcon } from '../components/icons';
import { PlanCards } from '../components/PlanCards';
import { buttonClasses } from '../components/ui';
import { usePageTitle } from '../lib/use-page-title';

const features = [
  { title: 'Automatisches Backup vom Handy', text: 'Mit der Immich-App für iOS und Android sichern sich neue Fotos und Videos von selbst.' },
  { title: 'Gesichter- und Objektsuche', text: 'In den bezahlten Plänen findest du Bilder nach Personen, Orten und Motiven.' },
  { title: 'Export aus dem Portal', text: 'Du kannst deine ganze Bibliothek im Portal als ZIP-Archive herunterladen und mitnehmen.' },
  { title: 'Deine Daten bleiben bei uns', text: 'Deine Fotos liegen auf den eigenen Servern von SPhoto. Es gibt kein Tracking und keine Werbung.' },
];

const faq = [
  {
    question: 'Was ist SPhoto?',
    answer:
      'SPhoto ist eine private Foto-Cloud auf Basis der Open-Source-Software Immich. Du bekommst ein eigenes Konto mit Speicherplatz, Handy-Backup und Suche und zahlst einen festen Preis in Franken.',
  },
  {
    question: 'Wie wechsle ich von Google Fotos oder iCloud?',
    answer:
      'Exportiere deine Fotos bei Google Fotos oder iCloud und lade sie danach mit der Immich-App oder dem Immich-CLI in dein SPhoto-Konto hoch. Beginne am besten mit dem kostenlosen Plan.',
  },
  {
    question: 'Was passiert, wenn ich kündige?',
    answer:
      'Nach dem Ende deines Abos läuft eine Frist von 14 Tagen, danach wechselt dein Konto auf den Free-Plan. Wir löschen nichts. Belegt dein Konto mehr, als der Free-Plan erlaubt, schaffst du Platz oder schliesst wieder ein Abo ab, bevor du weitere Fotos hochlädst.',
  },
  {
    question: 'Wie lösche ich mein Konto?',
    answer:
      'Im Kundenportal unter «Konto löschen». Dein Konto und alle Fotos werden nach 14 Tagen endgültig gelöscht. Bis dahin kannst du die Löschung im Portal jederzeit abbrechen.',
  },
];

export function Landing() {
  usePageTitle('Private Foto-Cloud');

  return (
    <div className="flex flex-col gap-20">
      <section aria-labelledby="hero-title" className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <h1 id="hero-title" className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Deine Fotos gehören dir.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">Deine private Foto-Cloud auf Basis von Immich: Schweizer Preise in Franken, keine Werbung und kein Tracking.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#gratis" className={buttonClasses('primary')}>
              Gratis-Konto erstellen
            </a>
            <a href="#preise" className={buttonClasses('secondary')}>
              Preise ansehen
            </a>
          </div>
        </div>
        <FreeSignupForm />
      </section>

      <section aria-labelledby="features-title">
        <h2 id="features-title" className="text-2xl font-semibold">
          Was du bekommst
        </h2>
        <ul className="mt-6 grid gap-5 sm:grid-cols-2">
          {features.map((feature) => (
            <li key={feature.title} className="flex gap-3 rounded-2xl border border-line bg-surface p-5">
              <CheckIcon className="mt-1 size-5 shrink-0 text-ok-text" />
              <div>
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="mt-1 text-sm text-muted">{feature.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section id="preise" aria-labelledby="plans-title" className="scroll-mt-6">
        <h2 id="plans-title" className="text-2xl font-semibold">
          Preise
        </h2>
        <p className="mt-2 text-muted">Alle Preise in Schweizer Franken pro Monat.</p>
        <div className="mt-6">
          <PlanCards />
        </div>
      </section>

      <section aria-labelledby="faq-title">
        <h2 id="faq-title" className="text-2xl font-semibold">
          Häufige Fragen
        </h2>
        <div className="mt-6 flex flex-col gap-3">
          {faq.map((item) => (
            <details key={item.question} className="rounded-2xl border border-line bg-surface p-5">
              <summary className="cursor-pointer font-semibold">{item.question}</summary>
              <p className="mt-3 text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
