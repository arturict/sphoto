'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  ArrowRight,
  Check,
  CheckCircle,
  ChevronDown,
  Cloud,
  HardDrive,
  Lock,
  Mail,
  Search,
  Shield,
  Smartphone,
  Upload,
  Users,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { HeroImage } from '@/components/hero-image'
import { GridPattern } from '@/components/ui/background-pattern'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.sphoto.arturf.ch'
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || 'sphoto.arturf.ch'

type Plan = {
  id: 'free' | 'basic' | 'pro'
  name: string
  price: string
  description: string
  highlights: string[]
  storage: string
  cta: string
  popular?: boolean
  variant: 'secondary' | 'outline' | 'default'
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '0',
    storage: '5 GB',
    description: 'Zum Testen und für kleine Libraries.',
    highlights: ['Mobile Apps', 'Automatische Backups', 'Web-Galerie'],
    cta: 'Kostenlos starten',
    variant: 'secondary',
  },
  {
    id: 'basic',
    name: 'Basic',
    price: '5',
    storage: '200 GB',
    description: 'Für Einzelpersonen — genug für Jahre Fotos.',
    highlights: ['KI-Suche (Gesichter & Objekte)', "Server in Europa 🇪🇺",
      'Prioritäts-Support'],
    cta: 'Basic wählen',
    variant: 'outline',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '15',
    storage: '1 TB',
    description: 'Für Familien — teilen ohne Chaos.',
    highlights: ['Mehrere Nutzer', 'Geteilte Alben', 'Alles aus Basic'],
    cta: 'Pro wählen',
    popular: true,
    variant: 'default',
  },
]

const featureRows = [
  {
    icon: Shield,
    title: 'Privatsphäre zuerst',
    description: "Verschlüsselt gespeichert in der EU. Kein Tracking, keine Werbung. Die Galerie gehört dir — nicht einem Werbenetzwerk.",
  },
  {
    icon: Cloud,
    title: 'EU Hosting',
    description: 'Datenhaltung in der EU. Du entscheidest, was du speicherst und wie lange.',
  },
  {
    icon: Smartphone,
    title: 'Automatische Backups',
    description: 'iOS & Android Apps sichern im Hintergrund — ohne Frust und ohne manuelles Sortieren.',
  },
  {
    icon: Search,
    title: 'KI-Suche',
    description: 'Finde Fotos nach Gesichtern, Objekten oder Ort — in Sekunden statt Scrollen.',
  },
  {
    icon: Users,
    title: 'Familie & Sharing',
    description: 'Mehrere Konten, geteilte Alben und gemeinsame Erinnerungen — ohne Passwort teilen.',
  },
  {
    icon: HardDrive,
    title: 'Daten mitnehmen',
    description: 'Export jederzeit möglich. Keine Lock-in-Fallen, keine versteckten Hürden.',
  },
]

const faqs = [
  {
    q: 'Was ist SPhoto?',
    a: 'SPhoto ist eine private Foto-Cloud in Europa, basierend auf Immich. Sie bietet automatische Backups, eine schnelle Web-Galerie und KI-Suche — ohne Tracking.',
  },
  {
    q: 'Kann ich von Google Photos oder iCloud wechseln?',
    a: 'Ja. Du kannst deine Daten exportieren (z.B. Google Takeout) und danach in SPhoto hochladen. Bei Bedarf helfen wir dir beim Umzug.',
  },
  {
    q: 'Wie sicher sind meine Fotos?',
    a: 'Der Zugriff ist per HTTPS abgesichert. Es gibt keine Werbung und kein Tracking. Zusätzlich kannst du deine Daten jederzeit exportieren und dein Konto löschen.',
  },
  {
    q: 'Kann ich monatlich kündigen?',
    a: "Jede Instanz läuft isoliert mit eigenen Containern und Datenbanken. Deine Daten werden ausschliesslich in Europa gespeichert.",
  },
]

function isEmail(value: string) {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)
}

export default function Home() {
  const [email, setEmail] = useState('')
  const validEmail = useMemo(() => isEmail(email), [email])

  const handleCheckout = (planId: Plan['id']) => {
    if (!validEmail) return

    const url =
      planId === 'free'
        ? `${API_URL}/signup/free?email=${encodeURIComponent(email)}`
        : `${API_URL}/checkout/${planId}?email=${encodeURIComponent(email)}`

    window.location.href = url
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Cloud className="h-4 w-4" />
            </div>
            <span className="text-lg">SPhoto</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm">
            <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Funktionen
            </Link>
            <Link href="#how" className="text-muted-foreground hover:text-foreground transition-colors">
              So funktionierts
            </Link>
            <Link href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Preise
            </Link>
            <Link href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </Link>
          </nav>
          <Button asChild>
            <a href="#pricing">Jetzt starten</a>
          </Button>
        </div>
      </header>

      <main className="relative">
        <section className="relative pt-24 pb-24 md:pt-32 md:pb-32 overflow-hidden">
          <GridPattern />
          <div className="container px-4 md:px-6 relative z-10">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="secondary" className="mb-8 border-primary/20 bg-primary/5 text-primary">
                <Shield className="mr-1.5 h-3 w-3" />
                Privatsphäre + EU Hosting
              </Badge>

              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-balance leading-[1.1]">
                Deine Fotos,
                <br />
                <span className="text-muted-foreground">ohne Datenhandel.</span>
              </h1>

              <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-balance leading-relaxed">
                SPhoto ist die private Alternative zu Google Photos: automatische Backups, KI-Suche und Sharing.
                Gehostet in Europa 🇪🇺
                — ohne Tracking.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" asChild className="h-12 px-8 text-base shadow-lg shadow-primary/20 transition-all hover:shadow-primary/40">
                  <a href="#pricing">
                    Kostenlos starten
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild className="h-12 px-8 text-base bg-background/50 backdrop-blur-sm">
                  <a href="#features">Features ansehen</a>
                </Button>
              </div>

              <div className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  Keine Kreditkarte für Free
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  Monatlich kündbar
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  Export jederzeit möglich
                </div>
              </div>
            </div>

            <HeroImage />


          </div>
        </section>

        <section id="features" className="py-24 md:py-32">
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Alles, was du brauchst.</h2>
              <p className="mt-4 text-muted-foreground text-balance text-lg">
                Eine moderne Foto-Cloud, die sich nach Produkt anfühlt — nicht nach Kompromiss.
              </p>
            </div>

            <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featureRows.map((feature) => (
                <Card key={feature.title} className="bg-card/50 card-hover border-border/50">
                  <CardHeader className="p-6 pb-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary mb-4">
                      <feature.icon className="h-5 w-5 text-foreground" />
                    </div>
                    <CardTitle className="text-lg font-medium">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-6 pb-6 text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="py-24 md:py-32 bg-secondary/30">
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">So funktioniert&apos;s</h2>
              <p className="mt-4 text-muted-foreground text-balance text-lg">
                In wenigen Minuten startklar — ohne kompliziertes Setup.
              </p>
            </div>

            <div className="mt-16 grid gap-6 md:grid-cols-3">
              <Card className="bg-background border-border/50">
                <CardHeader className="p-6 pb-4">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background text-sm font-semibold mb-4">
                    1
                  </div>
                  <CardTitle className="text-lg font-medium">Konto erstellen</CardTitle>
                  <CardDescription>Mit deiner E-Mail</CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6 text-sm text-muted-foreground">
                  Free starten oder direkt Basic/Pro wählen.
                </CardContent>
              </Card>

              <Card className="bg-background border-border/50">
                <CardHeader className="p-6 pb-4">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background text-sm font-semibold mb-4">
                    2
                  </div>
                  <CardTitle className="text-lg font-medium">Apps verbinden</CardTitle>
                  <CardDescription>iOS und Android</CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6 text-sm text-muted-foreground">
                  Backups laufen automatisch im Hintergrund.
                </CardContent>
              </Card>

              <Card className="bg-background border-border/50">
                <CardHeader className="p-6 pb-4">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background text-sm font-semibold mb-4">
                    3
                  </div>
                  <CardTitle className="text-lg font-medium">Suchen & teilen</CardTitle>
                  <CardDescription>Mit KI und Alben</CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6 text-sm text-muted-foreground">
                  Finde sofort und teile gezielt — ohne «alles öffentlich».
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-24 md:py-32">
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">SPhoto vs. Google Photos</h2>
              <p className="mt-4 text-muted-foreground text-lg">Die Experience, die du willst — ohne das Geschäft dahinter.</p>
            </div>

            <div className="mt-16 grid gap-8 lg:grid-cols-2 max-w-4xl mx-auto">
              <Card className="bg-card/50 border-border/50">
                <CardHeader className="p-6">
                  <CardTitle className="text-lg font-medium">SPhoto</CardTitle>
                  <CardDescription>Privat, fair, exportierbar</CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6 space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-foreground flex-shrink-0" />
                    Kein Tracking, keine Werbung
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-foreground flex-shrink-0" />
                    EU Hosting
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-foreground flex-shrink-0" />
                    Export jederzeit möglich
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-foreground flex-shrink-0" />
                    KI-Suche (Basic/Pro)
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/50 border-border/50">
                <CardHeader className="p-6">
                  <CardTitle className="text-lg font-medium">Google Photos</CardTitle>
                  <CardDescription>Starkes Produkt, aber falsche Anreize</CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6 space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                    Tracking & Profiling als Geschäftsmodell
                  </div>
                  <div className="flex items-center gap-3">
                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                    Datenhaltung je nach Region
                  </div>
                  <div className="flex items-center gap-3">
                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                    Kündigung / Export oft mit Hürden
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-4 w-4 text-foreground flex-shrink-0" />
                    Sehr gute Suche
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section id="pricing" className="py-24 md:py-32 bg-secondary/30">
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Preise</h2>
              <p className="mt-4 text-muted-foreground text-balance text-lg">
                Starte kostenlos. Upgraden, wenn du mehr Speicher oder Features brauchst.
              </p>
            </div>

            <div className="mt-12 max-w-md mx-auto">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="deine@email.ch"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  className="pl-12 h-14 text-base bg-background"
                />
                {email && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {validEmail ? (
                      <CheckCircle className="h-5 w-5 text-foreground" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                  </div>
                )}
              </div>
              {email && !validEmail && (
                <p className="mt-3 text-sm text-destructive">Bitte gib eine gültige E-Mail-Adresse ein.</p>
              )}
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3 max-w-5xl mx-auto">
              {plans.map((plan) => (
                <Card
                  key={plan.id}
                  className={`relative bg-background ${plan.popular ? 'border-foreground shadow-lg' : 'border-border/50'}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge>Beliebt</Badge>
                    </div>
                  )}
                  <CardHeader className="p-6 text-center">
                    <CardTitle className="text-lg font-medium">{plan.name}</CardTitle>
                    <CardDescription className="mt-1">{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="px-6 pb-6 text-center">
                    <div className="mb-1">
                      <span className="text-5xl font-semibold tracking-tight">{plan.price}</span>
                      <span className="text-muted-foreground ml-1">CHF/Monat</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{plan.storage}</span> Speicher
                    </div>

                    <div className="mt-8 space-y-3 text-sm text-left">
                      {plan.highlights.map((h) => (
                        <div key={h} className="flex items-start gap-3">
                          <Check className="h-4 w-4 text-foreground mt-0.5 flex-shrink-0" />
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter className="p-6 pt-0">
                    <Button
                      className="w-full"
                      variant={plan.variant}
                      disabled={!validEmail}
                      onClick={() => handleCheckout(plan.id)}
                    >
                      {!validEmail ? 'E-Mail eingeben' : plan.cta}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>

            <div className="mt-12 text-center">
              <p className="text-sm text-muted-foreground">Alle Pläne beinhalten Web-Galerie, Mobile Apps und Export.</p>
            </div>
          </div>
        </section>

        <section id="faq" className="py-24 md:py-32">
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">FAQ</h2>
              <p className="mt-4 text-muted-foreground text-lg">Kurz und ehrlich beantwortet.</p>
            </div>

            <div className="mt-12 max-w-2xl mx-auto space-y-3">
              {faqs.map((faq) => (
                <details key={faq.q} className="group rounded-xl border border-border/50 bg-card/50 p-0 overflow-hidden">
                  <summary className="cursor-pointer list-none select-none p-5 hover:bg-secondary/30 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium text-left">{faq.q}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform flex-shrink-0" />
                    </div>
                  </summary>
                  <div className="px-5 pb-5">
                    <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 md:py-32 bg-secondary/30">
          <div className="container px-4 md:px-6">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Bereit für eine Foto-Cloud, die sich richtig anfühlt?</h2>
              <p className="mt-6 text-muted-foreground text-lg text-balance">
                Starte kostenlos und upgrade später — wenn du merkst, dass du nicht mehr zurück willst.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild>
                  <a href="#pricing">
                    Jetzt kostenlos starten
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a href={`mailto:hello@${DOMAIN}`}>Fragen stellen</a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-12">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground">
                <Cloud className="h-3.5 w-3.5 text-background" />
              </div>
              <span className="font-semibold">SPhoto</span>
              <span className="text-sm text-muted-foreground">· Europa</span>
            </div>

            <nav className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
              <Link href="#pricing" className="hover:text-foreground transition-colors">
                Preise
              </Link>
              <Link href="#faq" className="hover:text-foreground transition-colors">
                FAQ
              </Link>
              <a href={`mailto:hello@${DOMAIN}`} className="hover:text-foreground transition-colors">
                Kontakt
              </a>
              <a
                href="https://immich.app"
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Powered by Immich
              </a>
              <Link href="/admin" className="hover:text-foreground transition-colors">
                Admin
              </Link>
            </nav>

            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} SPhoto · 🇪🇺</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
