"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRight,
  Check,
  CheckCircle,
  Cloud,
  Cpu,
  Database,
  Globe,
  Heart,
  Loader2,
  Lock,
  Map,
  Search,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
  Users,
  XCircle,
} from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.sphoto.arturf.ch"
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "sphoto.arturf.ch"

const features = [
  {
    icon: ShieldCheck,
    title: "Erstklassige Gesichtserkennung",
    description: "Finde Bilder deiner Liebsten schnell und privat. KI-Technologie, die deine Privatsphäre respektiert.",
  },
  {
    icon: Smartphone,
    title: "iPhone & Android Apps",
    description: "Sofortige Backups deiner Fotos vom Handy in die Cloud. Unterstützt die nativen Immich-Apps.",
  },
  {
    icon: Lock,
    title: "Deine Daten gehören dir",
    description: "Verschlüsselt gespeichert in der Schweiz. Kein Tracking, keine Werbung, kein KI-Training mit deinen Bildern.",
  },
  {
    icon: Map,
    title: "Fotos auf der Weltkarte",
    description: "Sieh wo deine Erinnerungen entstanden sind. GPS-Daten werden sicher und privat verarbeitet.",
  },
  {
    icon: Search,
    title: "Intelligente Suche",
    description: "Finde Fotos nach Personen, Objekten, Orten oder Datum. KI-gestützte Objekterkennung inklusive.",
  },
  {
    icon: Users,
    title: "Teile mit Familie & Freunden",
    description: "Lade weitere Nutzer ein. Erstelle geteilte Alben und verwalte Zugriffsrechte.",
  },
]

const planDetails = [
  {
    id: "basic",
    name: "Basic",
    price: "5",
    storage: "200 GB",
    popular: false,
    description: "Perfekt für Einzelpersonen",
  },
  {
    id: "pro",
    name: "Pro",
    price: "15",
    storage: "1 TB",
    popular: true,
    description: "Ideal für Familien & Teams",
  },
]

const allFeatures = [
  "Keine Werbung oder Tracking",
  "Gesichtserkennung mit Privatsphäre",
  "KI-Objekterkennung",
  "Weitere Nutzer einladen",
  "Erweiterte Duplikaterkennung",
  "Sichere & private Speicherung",
  "Gehostet in der Schweiz 🇨🇭",
  "Keine Upload-Limits",
  "Voller API-Zugang",
  "Fotos archivieren",
  "Support durch echte Menschen",
  "Verschlüsselt gespeichert",
  "Fotos auf der Weltkarte",
  "Teilen mit wem du willst",
  "Detaillierte Bildsuche",
]

const faqs = [
  {
    q: "Was ist Immich?",
    a: "Immich ist eine führende Open-Source Foto-Cloud mit aktiver Community und tausenden Nutzern. Wir hosten und warten es für dich – inklusive Updates und Sicherheits-Patches.",
  },
  {
    q: "Kann ich von Google Photos wechseln?",
    a: "Ja! Wir haben eine detaillierte Anleitung zum Migrieren deiner Fotos von Google Photos. Alle Metadaten und Alben bleiben erhalten.",
  },
  {
    q: "Wie sicher sind meine Daten?",
    a: "Jede Instanz läuft isoliert mit eigenen Datenbanken und Secrets. Deine Daten sind verschlüsselt und werden ausschliesslich in der Schweiz gespeichert.",
  },
  {
    q: "Kann ich meine Fotos exportieren?",
    a: "Ja, jederzeit. Vollständige Exporte via Web oder CLI sind kostenfrei möglich. Deine Daten gehören dir – für immer.",
  },
  {
    q: "Wie läuft die Abrechnung?",
    a: "Monatliche Abrechnung via Stripe. Kündigung jederzeit möglich – deine Instanz bleibt bis zum Laufzeitende online.",
  },
  {
    q: "Gibt es eine kostenlose Testversion?",
    a: "Aktuell bieten wir keine kostenlose Version an, aber du kannst jederzeit innerhalb von 14 Tagen kündigen und erhältst dein Geld zurück.",
  },
]

export default function Home() {
  const [subdomain, setSubdomain] = useState("")
  const [subdomainStatus, setSubdomainStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle")
  const [statusMessage, setStatusMessage] = useState("")

  useEffect(() => {
    if (!subdomain) {
      setSubdomainStatus("idle")
      setStatusMessage("")
      return
    }

    if (subdomain.length < 3) {
      setSubdomainStatus("invalid")
      setStatusMessage("Mindestens 3 Zeichen")
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSubdomainStatus("checking")
      try {
        const res = await fetch(`${API_URL}/subdomain/check/${subdomain}`, { signal: controller.signal })
        const data = await res.json()
        if (data?.available) {
          setSubdomainStatus("available")
          setStatusMessage(`${subdomain}.${DOMAIN} ist verfügbar`)
        } else {
          setSubdomainStatus("taken")
          setStatusMessage(data?.reason || "Bereits vergeben")
        }
      } catch (error) {
        if ((error as DOMException)?.name === "AbortError") return
        setSubdomainStatus("invalid")
        setStatusMessage("Fehler beim Prüfen")
      }
    }, 400)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [subdomain])

  const checkoutDisabled = subdomainStatus !== "available"
  const subdomainUrl = useMemo(() => (subdomain ? `${subdomain}.${DOMAIN}` : ""), [subdomain])

  const renderStatusIcon = () => {
    if (subdomainStatus === "checking") return <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
    if (subdomainStatus === "available") return <CheckCircle className="h-4 w-4 text-green-600" />
    if (subdomainStatus === "taken" || subdomainStatus === "invalid") return <XCircle className="h-4 w-4 text-red-600" />
    return null
  }

  const handleCheckout = (plan: "basic" | "pro") => {
    if (checkoutDisabled) return
    window.location.href = `${API_URL}/checkout/${plan}?subdomain=${subdomain}`
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold">
            <Sparkles className="h-6 w-6 text-primary" />
            <span><span className="text-primary">S</span>Photo</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</Link>
            <Link href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Preise</Link>
            <Link href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
            <Link href="/migrate/google-photos" className="text-muted-foreground hover:text-foreground transition-colors">Migration</Link>
          </nav>
          <Button asChild>
            <a href="#pricing">Jetzt starten</a>
          </Button>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" />
          <div className="container mx-auto px-4 py-20 md:py-32">
            <div className="mx-auto max-w-4xl text-center">
              <Badge variant="secondary" className="mb-6">
                🇨🇭 Gehostet in der Schweiz
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                Befreie deine Fotos von
                <span className="block text-primary">amerikanischen Tech-Plattformen</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
                Privatsphäre und Sicherheit sind keine Option. Speichere deine Erinnerungen auf Schweizer Boden – 
                mit KI-Funktionen, die deine Daten respektieren.
              </p>
              <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Button size="lg" className="h-12 px-8 text-base" asChild>
                  <a href="#pricing">
                    Kostenlos starten
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-8 text-base" asChild>
                  <Link href="/migrate/google-photos">
                    Von Google Photos wechseln
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="border-t bg-muted/30 py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold md:text-4xl">Alles was du brauchst</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Modernste Technologie, maximale Privatsphäre
              </p>
            </div>
            <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Card key={feature.title} className="border-0 bg-background shadow-lg">
                  <CardHeader>
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Phone Backup Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <Badge variant="outline" className="mb-4">Mobile Apps</Badge>
                <h2 className="text-3xl font-bold md:text-4xl">iPhone & Android Apps</h2>
                <p className="mt-4 text-lg text-muted-foreground">
                  SPhoto unterstützt die nativen Immich-Apps für sofortige Backups deiner Fotos vom Handy in die Cloud. 
                  Basiert auf einer optimierten Version von Immich.
                </p>
                <ul className="mt-6 space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>Fotos auf dem Handy ansehen</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>Sofortige und sichere Backups</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>Erstklassiger Support für iPhone und Android</span>
                  </li>
                </ul>
                <div className="mt-8 flex gap-4">
                  <Button variant="outline" asChild>
                    <a href="https://apps.apple.com/app/immich/id1613945652" target="_blank" rel="noreferrer">
                      App Store
                    </a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="https://play.google.com/store/apps/details?id=app.alextran.immich" target="_blank" rel="noreferrer">
                      Google Play
                    </a>
                  </Button>
                </div>
              </div>
              <div className="flex justify-center">
                <div className="relative">
                  <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-primary/20 to-primary/5 blur-2xl" />
                  <Card className="relative w-72 shadow-2xl">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                          <Upload className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold">Auto-Backup aktiv</p>
                          <p className="text-sm text-muted-foreground">1.247 Fotos gesichert</p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        <div className="h-2 rounded-full bg-muted">
                          <div className="h-full w-3/4 rounded-full bg-primary" />
                        </div>
                        <p className="text-xs text-muted-foreground">150 GB von 200 GB verwendet</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="border-t bg-muted/30 py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold md:text-4xl">Einfache, transparente Preise</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Keine versteckten Gebühren. Monatlich kündbar.
              </p>
            </div>

            {/* Subdomain Picker */}
            <div className="mx-auto mt-12 max-w-md">
              <Card className="border-primary/20 shadow-lg">
                <CardHeader className="text-center">
                  <CardTitle>Wähle deine Subdomain</CardTitle>
                  <CardDescription>Jede Instanz läuft isoliert unter eigener URL</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Input
                      value={subdomain}
                      placeholder="deinname"
                      onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      className="pr-32 text-lg"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                      .{DOMAIN}
                    </span>
                  </div>
                  {subdomain && (
                    <div className="flex items-center gap-2 text-sm">
                      {renderStatusIcon()}
                      <span className={subdomainStatus === "available" ? "text-green-600" : subdomainStatus === "taken" || subdomainStatus === "invalid" ? "text-red-600" : ""}>
                        {statusMessage}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Pricing Cards */}
            <div className="mx-auto mt-8 grid max-w-4xl gap-6 md:grid-cols-2">
              {planDetails.map((plan) => (
                <Card key={plan.id} className={`relative ${plan.popular ? "border-primary shadow-xl" : ""}`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary">Beliebt</Badge>
                    </div>
                  )}
                  <CardHeader className="text-center">
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="mt-4">
                      <span className="text-5xl font-bold">{plan.price}</span>
                      <span className="text-xl text-muted-foreground"> CHF/Monat</span>
                    </div>
                    <p className="mt-2 text-lg font-medium text-primary">{plan.storage} Speicher</p>
                  </CardHeader>
                  <CardFooter>
                    <Button
                      className="w-full"
                      size="lg"
                      variant={plan.popular ? "default" : "outline"}
                      disabled={checkoutDisabled}
                      onClick={() => handleCheckout(plan.id as "basic" | "pro")}
                    >
                      {checkoutDisabled ? "Subdomain wählen" : `${plan.name} starten`}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>

            {/* All Features */}
            <div className="mx-auto mt-16 max-w-4xl">
              <h3 className="mb-8 text-center text-xl font-semibold">Alle Pläne beinhalten</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {allFeatures.map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Open Source Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="outline" className="mb-4">Open Source</Badge>
              <h2 className="text-3xl font-bold md:text-4xl">Basiert auf einer führenden Open-Source Plattform</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Aufgebaut auf Immich – einem vertrauenswürdigen Open-Source Projekt mit einer lebendigen Community 
                und tausenden aktiven Nutzern. Erlebe die Zuverlässigkeit und Innovation einer Plattform, 
                die für moderne Fotospeicherung entwickelt wurde.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-card p-4">
                  <p className="font-semibold">Sicher & privat</p>
                  <p className="text-sm text-muted-foreground">Verschlüsselte Speicherung</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="font-semibold">Aktive Community</p>
                  <p className="text-sm text-muted-foreground">Tausende Nutzer weltweit</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="font-semibold">Regelmässige Updates</p>
                  <p className="text-sm text-muted-foreground">Ständige Verbesserungen</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="font-semibold">Skalierbar</p>
                  <p className="text-sm text-muted-foreground">Für privat & Business</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="border-t bg-muted/30 py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold md:text-4xl">Häufig gestellte Fragen</h2>
            </div>
            <div className="mx-auto mt-12 max-w-3xl">
              <div className="grid gap-4">
                {faqs.map((faq) => (
                  <Card key={faq.q}>
                    <CardHeader>
                      <CardTitle className="text-lg">{faq.q}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">{faq.a}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <Card className="mx-auto max-w-4xl border-0 bg-primary text-primary-foreground">
              <CardContent className="p-8 text-center md:p-12">
                <h2 className="text-3xl font-bold md:text-4xl">Bereit für deine private Foto-Cloud?</h2>
                <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
                  Starte jetzt und sichere dir deine eigene Subdomain. Deine Instanz ist in unter 3 Minuten bereit.
                </p>
                <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                  <Button size="lg" variant="secondary" className="h-12 px-8" asChild>
                    <a href="#pricing">Jetzt starten</a>
                  </Button>
                  <Button size="lg" variant="outline" className="h-12 px-8 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10" asChild>
                    <a href={`mailto:hello@${DOMAIN}`}>Kontakt aufnehmen</a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-bold"><span className="text-primary">S</span>Photo</span>
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <Link href="/migrate/google-photos" className="hover:text-foreground">Migration</Link>
              <Link href="#faq" className="hover:text-foreground">FAQ</Link>
              <Link href="/admin" className="hover:text-foreground">Admin</Link>
              <a href={`mailto:hello@${DOMAIN}`} className="hover:text-foreground">Kontakt</a>
            </nav>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} SPhoto · Basiert auf Immich · 🇨🇭 Schweiz
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
