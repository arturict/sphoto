"use client"

import { useEffect, useState } from "react"
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
  Loader2,
  Lock,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users,
  XCircle,
  Camera,
} from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.sphoto.arturf.ch"
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "sphoto.arturf.ch"

type Platform = "immich" | "nextcloud"

const platformInfo = {
  immich: {
    name: "Immich",
    icon: Camera,
    description: "KI-gestützte Foto-Cloud mit Gesichtserkennung",
    color: "text-primary",
    features: [
      "KI-Gesichtserkennung",
      "Automatische Backups",
      "iOS & Android Apps",
      "Objekterkennung",
      "Fotos auf Weltkarte",
    ],
  },
  nextcloud: {
    name: "Nextcloud",
    icon: Cloud,
    description: "Komplette Cloud-Lösung für Dateien, Kalender & mehr",
    color: "text-blue-500",
    features: [
      "Datei-Synchronisation",
      "Kalender & Kontakte",
      "Office-Integration",
      "Desktop & Mobile Apps",
      "Collaboration Tools",
    ],
  },
}

const features = [
  {
    icon: ShieldCheck,
    title: "Deine Daten gehören dir",
    description: "Verschlüsselt gespeichert in der Schweiz. Kein Tracking, keine Werbung, kein KI-Training mit deinen Bildern.",
  },
  {
    icon: Smartphone,
    title: "Native Mobile Apps",
    description: "Sofortige Backups und Sync vom Handy. Unterstützt Immich und Nextcloud Apps für iOS & Android.",
  },
  {
    icon: Lock,
    title: "Isolierte Instanzen",
    description: "Jede Cloud läuft in eigenen Containern mit separater Datenbank. Maximale Sicherheit und Privatsphäre.",
  },
  {
    icon: Cloud,
    title: "Wähle deine Plattform",
    description: "Immich für Fotos mit KI-Erkennung oder Nextcloud für Dateien, Kalender und Office – du entscheidest.",
  },
  {
    icon: Search,
    title: "Intelligente Suche",
    description: "Finde Fotos nach Personen, Objekten oder Orten. Nextcloud bietet Volltextsuche in Dokumenten.",
  },
  {
    icon: Users,
    title: "Teile mit Familie & Freunden",
    description: "Lade weitere Nutzer ein. Erstelle geteilte Alben oder Ordner und verwalte Zugriffsrechte.",
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
  "Wahl zwischen Immich & Nextcloud",
  "Automatische Backups",
  "Weitere Nutzer einladen",
  "Eigene Subdomain",
  "Sichere & private Speicherung",
  "Gehostet in der Schweiz 🇨🇭",
  "Keine Upload-Limits",
  "Voller API-Zugang",
  "DSGVO-konformer Export",
  "Support durch echte Menschen",
  "Verschlüsselt gespeichert",
  "Mobile & Desktop Apps",
  "Teilen mit wem du willst",
  "Monatlich kündbar",
]

const faqs = [
  {
    q: "Was ist der Unterschied zwischen Immich und Nextcloud?",
    a: "Immich ist spezialisiert auf Fotos & Videos mit KI-gestützter Gesichts- und Objekterkennung. Nextcloud ist eine komplette Cloud-Lösung für Dateien, Kalender, Kontakte und Office-Dokumente. Beide laufen isoliert auf Schweizer Servern.",
  },
  {
    q: "Kann ich später die Plattform wechseln?",
    a: "Ein direkter Wechsel ist nicht möglich, aber du kannst deine Daten exportieren und eine neue Instanz mit der anderen Plattform erstellen. Kontaktiere uns für Unterstützung.",
  },
  {
    q: "Wie sicher sind meine Daten?",
    a: "Jede Instanz läuft isoliert mit eigenen Containern, Datenbanken und Secrets. Deine Daten werden ausschliesslich in der Schweiz gespeichert.",
  },
  {
    q: "Kann ich meine Daten exportieren?",
    a: "Ja, jederzeit. DSGVO-konforme Exporte sind kostenlos möglich. Deine Daten gehören dir – für immer.",
  },
  {
    q: "Wie läuft die Abrechnung?",
    a: "Monatliche Abrechnung via Stripe. Kündigung jederzeit möglich – deine Instanz bleibt bis zum Laufzeitende online.",
  },
  {
    q: "Gibt es eine kostenlose Testversion?",
    a: "Aktuell bieten wir keine kostenlose Version an, aber du kannst innerhalb von 14 Tagen kündigen und erhältst dein Geld zurück.",
  },
]

export default function Home() {
  const [subdomain, setSubdomain] = useState("")
  const [subdomainStatus, setSubdomainStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle")
  const [statusMessage, setStatusMessage] = useState("")
  const [platform, setPlatform] = useState<Platform>("immich")

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

  const renderStatusIcon = () => {
    if (subdomainStatus === "checking") return <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
    if (subdomainStatus === "available") return <CheckCircle className="h-4 w-4 text-green-600" />
    if (subdomainStatus === "taken" || subdomainStatus === "invalid") return <XCircle className="h-4 w-4 text-red-600" />
    return null
  }

  const handleCheckout = (plan: "basic" | "pro") => {
    if (checkoutDisabled) return
    window.location.href = `${API_URL}/checkout/${plan}?subdomain=${subdomain}&platform=${platform}`
  }

  const currentPlatform = platformInfo[platform]
  const PlatformIcon = currentPlatform.icon

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
                Deine private Cloud
                <span className="block text-primary">ohne Big-Tech Überwachung</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
                Fotos, Dateien oder beides – du wählst. Immich für KI-gestützte Fotoverwaltung 
                oder Nextcloud für deine komplette Cloud. Gehostet auf Schweizer Servern.
              </p>
              <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Button size="lg" className="h-12 px-8 text-base" asChild>
                  <a href="#pricing">
                    Jetzt starten
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

        {/* Platform Comparison Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center mb-12">
              <Badge variant="outline" className="mb-4">Zwei Plattformen</Badge>
              <h2 className="text-3xl font-bold md:text-4xl">Wähle was zu dir passt</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Beide Plattformen laufen isoliert auf Schweizer Servern mit nativen Mobile Apps.
              </p>
            </div>
            <div className="grid gap-8 lg:grid-cols-2 max-w-5xl mx-auto">
              {/* Immich */}
              <Card className="border-primary/30">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Camera className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Immich</CardTitle>
                      <CardDescription>Foto-Cloud mit KI</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Perfekt für alle, die ihre Fotos & Videos organisieren wollen. Mit KI-gestützter 
                    Gesichtserkennung und Objekterkennung.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Gesichtserkennung & Personenalben
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Fotos auf Weltkarte anzeigen
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Objekterkennung (Hund, Auto, etc.)
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Duplikat-Erkennung
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      iOS & Android App
                    </li>
                  </ul>
                  <p className="text-xs text-muted-foreground pt-2">
                    Ideal als Google Photos oder iCloud Alternative
                  </p>
                </CardContent>
              </Card>

              {/* Nextcloud */}
              <Card className="border-blue-500/30">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                      <Cloud className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle>Nextcloud</CardTitle>
                      <CardDescription>Komplette Cloud-Lösung</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Die All-in-One Lösung für Dateien, Kalender, Kontakte und mehr. 
                    Mit Office-Integration und Collaboration-Tools.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Datei-Synchronisation
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Kalender & Kontakte Sync
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Office-Dokumente bearbeiten
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Notizen & Aufgaben
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      iOS, Android & Desktop App
                    </li>
                  </ul>
                  <p className="text-xs text-muted-foreground pt-2">
                    Ideal als Google Drive oder Dropbox Alternative
                  </p>
                </CardContent>
              </Card>
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

            {/* Platform Selection */}
            <div className="mx-auto mt-12 max-w-2xl">
              <Card className="border-primary/20 shadow-lg">
                <CardHeader className="text-center">
                  <CardTitle>Wähle deine Plattform</CardTitle>
                  <CardDescription>Beide Plattformen nutzen den gleichen Speicherplatz</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {(["immich", "nextcloud"] as Platform[]).map((p) => {
                      const info = platformInfo[p]
                      const Icon = info.icon
                      const isSelected = platform === p
                      return (
                        <button
                          key={p}
                          onClick={() => setPlatform(p)}
                          className={`relative rounded-lg border-2 p-4 text-left transition-all ${
                            isSelected 
                              ? "border-primary bg-primary/5" 
                              : "border-muted hover:border-muted-foreground/30"
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute -top-2 -right-2">
                              <CheckCircle className="h-5 w-5 text-primary fill-primary/20" />
                            </div>
                          )}
                          <div className="flex items-center gap-3 mb-2">
                            <Icon className={`h-6 w-6 ${info.color}`} />
                            <span className="font-semibold">{info.name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">{info.description}</p>
                          <ul className="space-y-1">
                            {info.features.slice(0, 3).map((f) => (
                              <li key={f} className="flex items-center gap-2 text-xs">
                                <Check className="h-3 w-3 text-green-500" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Subdomain Picker */}
            <div className="mx-auto mt-6 max-w-md">
              <Card className="border-muted shadow-md">
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-lg">Wähle deine Subdomain</CardTitle>
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
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <PlatformIcon className={`h-5 w-5 ${currentPlatform.color}`} />
                      <span className="text-sm font-medium text-muted-foreground">{currentPlatform.name}</span>
                    </div>
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
              <h2 className="text-3xl font-bold md:text-4xl">Basiert auf führenden Open-Source Projekten</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Immich und Nextcloud sind bewährte Open-Source Projekte mit Millionen von Nutzern weltweit. 
                Wir hosten, warten und aktualisieren sie für dich – du profitierst von der Innovation 
                einer aktiven Community.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-card p-4">
                  <p className="font-semibold">100% Open Source</p>
                  <p className="text-sm text-muted-foreground">Kein Vendor Lock-in</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="font-semibold">Schweizer Server</p>
                  <p className="text-sm text-muted-foreground">Daten bleiben in der CH</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="font-semibold">Automatische Updates</p>
                  <p className="text-sm text-muted-foreground">Immer aktuell & sicher</p>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="font-semibold">Volle Kontrolle</p>
                  <p className="text-sm text-muted-foreground">Export jederzeit möglich</p>
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
