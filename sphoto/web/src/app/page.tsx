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
  ChevronDown,
  Zap,
  Globe,
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
    description: "Verschlüsselt gespeichert in der Schweiz. Kein Tracking, keine Werbung.",
  },
  {
    icon: Smartphone,
    title: "Native Mobile Apps",
    description: "Sofortige Backups und Sync vom Handy für iOS & Android.",
  },
  {
    icon: Lock,
    title: "Isolierte Instanzen",
    description: "Jede Cloud läuft in eigenen Containern mit separater DB.",
  },
  {
    icon: Zap,
    title: "Schnelle Einrichtung",
    description: "In unter 3 Minuten ist deine Cloud bereit zur Nutzung.",
  },
  {
    icon: Search,
    title: "Intelligente Suche",
    description: "Finde Fotos nach Personen, Objekten oder Orten.",
  },
  {
    icon: Users,
    title: "Teilen leicht gemacht",
    description: "Lade weitere Nutzer ein und verwalte Zugriffsrechte.",
  },
]

const planDetails = [
  {
    id: "basic",
    name: "Basic",
    price: "5",
    storage: "200 GB",
    popular: false,
    description: "Für Einzelpersonen",
    highlight: "~40'000 Fotos",
  },
  {
    id: "pro",
    name: "Pro",
    price: "15",
    storage: "1 TB",
    popular: true,
    description: "Für Familien & Teams",
    highlight: "~200'000 Fotos",
  },
]

const allFeatures = [
  "Keine Werbung",
  "Automatische Backups",
  "Eigene Subdomain",
  "Schweizer Server 🇨🇭",
  "Voller API-Zugang",
  "DSGVO-Export",
  "Mobile & Desktop Apps",
  "Monatlich kündbar",
]

const faqs = [
  {
    q: "Was ist der Unterschied zwischen Immich und Nextcloud?",
    a: "Immich ist spezialisiert auf Fotos & Videos mit KI-gestützter Gesichts- und Objekterkennung. Nextcloud ist eine komplette Cloud-Lösung für Dateien, Kalender, Kontakte und Office-Dokumente.",
  },
  {
    q: "Kann ich später die Plattform wechseln?",
    a: "Ein direkter Wechsel ist nicht möglich, aber du kannst deine Daten exportieren und eine neue Instanz mit der anderen Plattform erstellen.",
  },
  {
    q: "Wie sicher sind meine Daten?",
    a: "Jede Instanz läuft isoliert mit eigenen Containern und Datenbanken. Deine Daten werden ausschliesslich in der Schweiz gespeichert.",
  },
  {
    q: "Kann ich meine Daten exportieren?",
    a: "Ja, jederzeit. DSGVO-konforme Exporte sind kostenlos möglich. Deine Daten gehören dir.",
  },
]

export default function Home() {
  const [subdomain, setSubdomain] = useState("")
  const [subdomainStatus, setSubdomainStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle")
  const [statusMessage, setStatusMessage] = useState("")
  const [platform, setPlatform] = useState<Platform>("immich")
  const [openFaq, setOpenFaq] = useState<number | null>(null)

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
    if (subdomainStatus === "checking") return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    if (subdomainStatus === "available") return <CheckCircle className="h-4 w-4 text-green-500" />
    if (subdomainStatus === "taken" || subdomainStatus === "invalid") return <XCircle className="h-4 w-4 text-red-500" />
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
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span>SPhoto</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm md:flex">
            <Link href="#features" className="text-muted-foreground transition-colors hover:text-foreground">Features</Link>
            <Link href="#pricing" className="text-muted-foreground transition-colors hover:text-foreground">Preise</Link>
            <Link href="#faq" className="text-muted-foreground transition-colors hover:text-foreground">FAQ</Link>
          </nav>
          <Button size="sm" className="font-medium" asChild>
            <a href="#pricing">Jetzt starten</a>
          </Button>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden hero-gradient">
          <div className="container mx-auto px-4 py-24 md:py-32 lg:py-40">
            <div className="mx-auto max-w-4xl text-center">
              <Badge variant="secondary" className="mb-6 animate-in">
                <Globe className="mr-1 h-3 w-3" />
                Gehostet in der Schweiz 🇨🇭
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl animate-in">
                Deine private Cloud
                <span className="block gradient-text mt-2">ohne Big-Tech</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl animate-in">
                Google Photos Alternative mit Schweizer Hosting. 
                Deine Fotos, deine Daten, deine Kontrolle.
              </p>
              <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center animate-in">
                <Button size="lg" className="h-12 px-8 text-base glow" asChild>
                  <a href="#pricing">
                    Jetzt starten
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-8 text-base" asChild>
                  <Link href="#features">
                    Mehr erfahren
                  </Link>
                </Button>
              </div>
              
              {/* Trust badges */}
              <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-green-500" />
                  <span>SSL verschlüsselt</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-green-500" />
                  <span>DSGVO-konform</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-green-500" />
                  <span>In 3 Min. bereit</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-24 md:py-32">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <Badge variant="outline" className="mb-4">Features</Badge>
              <h2 className="text-3xl font-bold md:text-4xl">Alles was du brauchst</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Modernste Technologie, maximale Privatsphäre
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
              {features.map((feature) => (
                <Card key={feature.title} className="card-hover border-border/50 bg-card/50">
                  <CardHeader>
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Platform Comparison */}
        <section className="border-y bg-muted/30 py-24 md:py-32">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <Badge variant="outline" className="mb-4">Zwei Plattformen</Badge>
              <h2 className="text-3xl font-bold md:text-4xl">Wähle was zu dir passt</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Beide Optionen mit Schweizer Hosting und nativen Apps
              </p>
            </div>
            <div className="grid gap-8 lg:grid-cols-2 max-w-5xl mx-auto">
              {/* Immich Card */}
              <Card className="card-hover border-primary/20 overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-primary to-primary/50" />
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                      <Camera className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Immich</CardTitle>
                      <CardDescription>Foto-Cloud mit KI</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-muted-foreground">
                    Die perfekte Google Photos Alternative mit KI-gestützter Gesichtserkennung.
                  </p>
                  <ul className="space-y-3">
                    {platformInfo.immich.features.map((f) => (
                      <li key={f} className="flex items-center gap-3 text-sm">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/10">
                          <Check className="h-3 w-3 text-green-500" />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground pt-2 border-t">
                    Ideal als Google Photos oder iCloud Alternative
                  </p>
                </CardContent>
              </Card>

              {/* Nextcloud Card */}
              <Card className="card-hover border-blue-500/20 overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-blue-500 to-blue-500/50" />
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10">
                      <Cloud className="h-7 w-7 text-blue-500" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Nextcloud</CardTitle>
                      <CardDescription>Komplette Cloud-Lösung</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-muted-foreground">
                    All-in-One Lösung für Dateien, Kalender, Kontakte und Office.
                  </p>
                  <ul className="space-y-3">
                    {platformInfo.nextcloud.features.map((f) => (
                      <li key={f} className="flex items-center gap-3 text-sm">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/10">
                          <Check className="h-3 w-3 text-green-500" />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground pt-2 border-t">
                    Ideal als Google Drive oder Dropbox Alternative
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="py-24 md:py-32">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center mb-12">
              <Badge variant="outline" className="mb-4">Preise</Badge>
              <h2 className="text-3xl font-bold md:text-4xl">Einfach & transparent</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Keine versteckten Gebühren. Monatlich kündbar.
              </p>
            </div>

            {/* Platform Selection */}
            <div className="mx-auto max-w-lg mb-8">
              <div className="grid grid-cols-2 gap-3 p-1 rounded-xl bg-muted/50">
                {(["immich", "nextcloud"] as Platform[]).map((p) => {
                  const info = platformInfo[p]
                  const Icon = info.icon
                  const isSelected = platform === p
                  return (
                    <button
                      key={p}
                      onClick={() => setPlatform(p)}
                      className={`flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                        isSelected 
                          ? "bg-background shadow-sm text-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isSelected ? info.color : ""}`} />
                      {info.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Subdomain Picker */}
            <div className="mx-auto max-w-md mb-10">
              <div className="relative">
                <Input
                  value={subdomain}
                  placeholder="deinname"
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="h-14 pr-36 text-lg bg-muted/30 border-border/50 focus-ring"
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-muted-foreground">
                  .{DOMAIN}
                </span>
              </div>
              {subdomain && (
                <div className="flex items-center gap-2 mt-3 text-sm">
                  {renderStatusIcon()}
                  <span className={
                    subdomainStatus === "available" ? "text-green-500" : 
                    subdomainStatus === "taken" || subdomainStatus === "invalid" ? "text-red-500" : 
                    "text-muted-foreground"
                  }>
                    {statusMessage}
                  </span>
                </div>
              )}
            </div>

            {/* Pricing Cards */}
            <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
              {planDetails.map((plan) => (
                <Card 
                  key={plan.id} 
                  className={`relative card-hover overflow-hidden ${
                    plan.popular ? "border-primary shadow-lg glow" : "border-border/50"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute top-0 right-0">
                      <div className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-bl-lg">
                        Beliebt
                      </div>
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <PlatformIcon className={`h-5 w-5 ${currentPlatform.color}`} />
                      <span className="text-sm text-muted-foreground">{currentPlatform.name}</span>
                    </div>
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-center pb-2">
                    <div className="mb-2">
                      <span className="text-5xl font-bold">{plan.price}</span>
                      <span className="text-lg text-muted-foreground"> CHF/Mt.</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-primary font-medium">
                      <span>{plan.storage}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground text-sm">{plan.highlight}</span>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-4">
                    <Button
                      className={`w-full h-12 text-base ${plan.popular ? "glow" : ""}`}
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
            <div className="mx-auto mt-16 max-w-2xl">
              <h3 className="mb-6 text-center text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Alle Pläne beinhalten
              </h3>
              <div className="flex flex-wrap justify-center gap-3">
                {allFeatures.map((feature) => (
                  <Badge key={feature} variant="secondary" className="px-3 py-1.5">
                    <Check className="mr-1.5 h-3 w-3 text-green-500" />
                    {feature}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="border-t bg-muted/30 py-24 md:py-32">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center mb-12">
              <Badge variant="outline" className="mb-4">FAQ</Badge>
              <h2 className="text-3xl font-bold md:text-4xl">Häufig gestellte Fragen</h2>
            </div>
            <div className="mx-auto max-w-2xl space-y-3">
              {faqs.map((faq, i) => (
                <Card 
                  key={i} 
                  className="cursor-pointer border-border/50 bg-card/50 overflow-hidden"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-medium pr-8">{faq.q}</CardTitle>
                      <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                    </div>
                  </CardHeader>
                  {openFaq === i && (
                    <CardContent className="pt-0 pb-4">
                      <p className="text-sm text-muted-foreground">{faq.a}</p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 md:py-32">
          <div className="container mx-auto px-4">
            <Card className="mx-auto max-w-4xl border-0 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground overflow-hidden">
              <CardContent className="p-10 text-center md:p-16">
                <h2 className="text-3xl font-bold md:text-4xl">Bereit für deine private Cloud?</h2>
                <p className="mx-auto mt-4 max-w-xl text-primary-foreground/80">
                  Starte jetzt und sichere dir deine eigene Subdomain. In unter 3 Minuten bereit.
                </p>
                <div className="mt-8">
                  <Button size="lg" variant="secondary" className="h-12 px-8 text-base font-medium" asChild>
                    <a href="#pricing">
                      Jetzt starten
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </a>
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
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">SPhoto</span>
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <Link href="/migrate/google-photos" className="hover:text-foreground transition-colors">Migration</Link>
              <Link href="#faq" className="hover:text-foreground transition-colors">FAQ</Link>
              <Link href="/admin" className="hover:text-foreground transition-colors">Admin</Link>
              <a href={`mailto:hello@${DOMAIN}`} className="hover:text-foreground transition-colors">Kontakt</a>
            </nav>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} SPhoto · 🇨🇭
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
