"use client"

import { useEffect, useMemo, useState } from "react"
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
  ArrowUpRight,
  Check,
  CheckCircle,
  Cloud,
  Cpu,
  Database,
  Globe,
  Loader2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Users2,
  XCircle,
} from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.sphoto.arturf.ch"
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "sphoto.arturf.ch"

const heroHighlights = [
  { label: "Aktive Silos", value: "180+", description: "Familien nutzen SPhoto täglich" },
  { label: "Uptime", value: "99.9%", description: "Traefik + Healthchecks" },
  { label: "Hosting", value: "🇨🇭 Zürich & Luzern", description: "ISO 27001 zertifiziert" },
]

const differentiators = [
  {
    title: "Zero-Ads & Zero-Tracking",
    description: "Kein Datenverkauf, kein KI-Training mit deinen Erinnerungen.",
    icon: ShieldCheck,
  },
  {
    title: "Eigenes Subdomain-Silo",
    description: "Jede Installation läuft isoliert mit eigenen Datenbanken.",
    icon: Globe,
  },
  {
    title: "Sofortiger Upload von Handy & Desktop",
    description: "Immich-Apps für iOS, Android, macOS, Windows und Linux.",
    icon: Smartphone,
  },
]

const steps = [
  { badge: "Schritt 1", title: "Subdomain wählen", description: "Name prüfen und Reservierung abschicken." },
  { badge: "Schritt 2", title: "Plan auswählen", description: "5 CHF Basic oder 15 CHF Pro – monatlich kündbar." },
  { badge: "Schritt 3", title: "Automatisch deployt", description: "In ~2 Minuten läuft dein persönlicher Immich-Stack." },
]

const planDetails = [
  {
    id: "basic",
    name: "Basic",
    price: "5",
    storage: "200 GB",
    badge: "Budget",
    description: "Für Einzelpersonen",
    accent: "border-muted",
    features: [
      "200 GB Speicher",
      "Mobile Apps & Auto-Upload",
      "KI-Suche & Gesichtserkennung",
      "E-Mail Support innerhalb 24h",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "15",
    storage: "1 TB",
    badge: "Beliebt",
    description: "Für Familien & Teams",
    accent: "border-primary",
    features: [
      "1 TB Speicher",
      "5 Nutzer inkl. Familienfreigaben",
      "Priorisierter Support (4h)",
      "Erweiterbar + eigene Domain",
    ],
  },
]

const testimonials = [
  {
    quote:
      "Wir haben 12 Jahre Familienfotos zu SPhoto migriert. Die Geschwindigkeit der Immich-Apps ist besser als bei Google Photos und endlich bleiben die Daten in der Schweiz.",
    author: "Sandra & Joel",
    role: "Zürich",
  },
  {
    quote:
      "Für mein Hochzeitsstudio wollte ich eine private Ablage, die Kunden-Logins unterstützt. Mit den Mandanten-Silos kann ich jedes Paar separieren – mega.",
    author: "Nora",
    role: "Fotografin aus Luzern",
  },
]

const faqs = [
  {
    q: "Was ist Immich?",
    a: "Immich ist eine Open-Source Foto-Cloud. Wir betreiben und warten sie für dich inklusive Updates, Backups und Sicherheits-Patches.",
  },
  {
    q: "Kann ich meine Fotos exportieren?",
    a: "Ja. Vollständige Exporte via Web oder CLI sind jederzeit möglich und kostenfrei.",
  },
  {
    q: "Wie läuft die Abrechnung?",
    a: "Stripe bucht monatlich ab. Kündigung jederzeit möglich – dein Silo bleibt bis zum Laufzeitende online.",
  },
  {
    q: "Sind meine Daten wirklich privat?",
    a: "Jedes Silo erhält eigene Container, Datenbanken, Secrets und Backups. Kein Teammitglied sieht deine Inhalte.",
  },
]

const featureGrid = [
  { title: "Unbegrenzte Uploads", description: "Volle Qualität, keine Kompression, kein Limit pro Tag.", icon: Cloud },
  { title: "Dedizierte Datenbank", description: "Postgres + Valkey je Instanz – kein Shared Schema.", icon: Database },
  { title: "ML-Funktionen", description: "Face Clustering, Objekterkennung, Duplikat-Prüfung.", icon: Cpu },
  { title: "Teamzugriff", description: "Geteilte Alben, Rollen & gerätebasierte Freigaben.", icon: Users2 },
]

const statusClasses: Record<string, string> = {
  idle: "bg-muted text-muted-foreground",
  checking: "bg-amber-100 text-amber-700",
  available: "bg-green-100 text-green-700",
  taken: "bg-red-100 text-red-600",
  invalid: "bg-red-100 text-red-600",
}

export default function Home() {
  const [subdomain, setSubdomain] = useState("")
  const [subdomainStatus, setSubdomainStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle")
  const [statusMessage, setStatusMessage] = useState("")
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  useEffect(() => {
    if (!subdomain) {
      setSubdomainStatus("idle")
      setStatusMessage("")
      setLastChecked(null)
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
          setStatusMessage(data?.reason || "Bereits reserviert")
        }
        setLastChecked(new Date())
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
  const lastCheckedLabel = lastChecked?.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })
  const statusBadgeClass = statusClasses[subdomainStatus] ?? statusClasses.idle

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
    <div className="bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2 text-xl font-bold">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>
              <span className="text-primary">S</span>Photo
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Button variant="ghost" asChild>
              <a href="#features">Features</a>
            </Button>
            <Button variant="ghost" asChild>
              <a href="#pricing">Preise</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/admin">Dashboard</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" aria-hidden />

        <section className="container mx-auto grid gap-12 px-4 py-16 lg:grid-cols-[1.2fr,0.8fr]">
          <div>
            <Badge variant="secondary" className="mb-5 w-fit">
              Schweizer Immich Hosting
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Deine Fotos.
              <br />
              <span className="text-primary">Deine private Cloud.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground md:text-xl">
              SPhoto betreibt Immich für dich – inklusive Updates, Backups, Monitoring und Schweizer Support. Starte mit
              einer eigenen Subdomain und eigener Infrastruktur in unter 3 Minuten.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <a href="#pricing">
                  Jetzt starten
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#faq">
                  Mehr erfahren
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {heroHighlights.map((item) => (
                <Card key={item.label} className="bg-card/70 shadow-sm">
                  <CardContent className="pt-6">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
                    <p className="text-2xl font-semibold">{item.value}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card className="border-primary/40 bg-card/80 shadow-xl backdrop-blur">
            <CardHeader>
              <CardTitle>Subdomain reservieren</CardTitle>
              <CardDescription>Jede Instanz läuft isoliert unter eigener URL.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="text-sm font-medium text-muted-foreground" htmlFor="subdomain-input">
                Wunsch-URL
              </label>
              <div className="relative">
                <Input
                  id="subdomain-input"
                  value={subdomain}
                  placeholder="deinname"
                  onChange={(event) => setSubdomain(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="pr-28 text-base"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                  .{DOMAIN}
                </span>
              </div>
              {subdomain && (
                <p className="text-xs text-muted-foreground">https://{subdomainUrl}</p>
              )}
              {subdomain && (
                <div className="flex items-center gap-2 text-sm">
                  {renderStatusIcon()}
                  <span className="font-medium">{statusMessage}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className={`${statusBadgeClass} border-0 px-3 py-1 font-medium capitalize`}>
                  {subdomainStatus === "idle" ? "bereit" : subdomainStatus}
                </Badge>
                {lastCheckedLabel && <span>zuletzt geprüft {lastCheckedLabel} Uhr</span>}
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-3">
              <p className="text-sm text-muted-foreground">Weiter unten kannst du deinen Plan auswählen.</p>
              <div className="grid w-full gap-2 sm:grid-cols-2">
                <Button variant="outline" disabled={checkoutDisabled} onClick={() => handleCheckout("basic")}>
                  Basic (5 CHF)
                </Button>
                <Button disabled={checkoutDisabled} onClick={() => handleCheckout("pro")}>
                  Pro (15 CHF)
                </Button>
              </div>
              {checkoutDisabled && subdomain.length < 3 && (
                <span className="text-xs text-muted-foreground">Mindestens 3 Zeichen, nur a-z und -</span>
              )}
            </CardFooter>
          </Card>
        </section>

        <section id="features" className="container mx-auto grid gap-8 px-4 py-16 lg:grid-cols-2">
          <div className="space-y-4">
            <Badge variant="secondary" className="w-fit">
              Warum SPhoto?
            </Badge>
            <h2 className="text-3xl font-semibold">Volle Kontrolle über deine Erinnerungen</h2>
            <p className="text-lg text-muted-foreground">
              Wir kombinieren die Stärke von Immich mit einem durchdachten Hosting-Setup: isolierte Container, automatisierte
              Backups und Monitoring – managed wie ein modernes SaaS, aber zu deinem Preis.
            </p>
            <div className="space-y-5">
              {differentiators.map((item) => (
                <div key={item.title} className="flex gap-4 rounded-xl border p-4 shadow-sm">
                  <item.icon className="h-10 w-10 text-primary" />
                  <div>
                    <p className="text-lg font-semibold">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {featureGrid.map((feature) => (
              <Card key={feature.title} className="bg-card/70">
                <CardContent className="flex flex-col gap-3 pt-6">
                  <feature.icon className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-lg font-semibold">{feature.title}</p>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4 py-12">
          <div className="rounded-2xl border bg-card p-8 shadow-lg">
            <div className="grid gap-6 md:grid-cols-3">
              {steps.map((step) => (
                <div key={step.title} className="space-y-2">
                  <Badge variant="outline" className="uppercase tracking-tight">
                    {step.badge}
                  </Badge>
                  <p className="text-xl font-semibold">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="container mx-auto px-4 py-16">
          <div className="flex flex-col items-center text-center">
            <Badge variant="secondary" className="mb-4">
              Preise
            </Badge>
            <h2 className="text-3xl font-semibold">Einfaches Preismodell – monatlich kündbar</h2>
            <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
              Keine Setup-Kosten, keine versteckten Gebühren. Sobald du kündigst, exportierst du deine Fotos mit wenigen Klicks.
            </p>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {planDetails.map((plan) => (
              <Card key={plan.id} className={`${plan.accent} ${plan.id === "pro" ? "shadow-xl" : ""}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <Badge variant={plan.id === "pro" ? "default" : "secondary"}>{plan.badge}</Badge>
                    <span className="text-sm text-muted-foreground">{plan.description}</span>
                  </div>
                  <CardTitle className="text-4xl">
                    {plan.price} CHF
                    <span className="text-sm font-normal text-muted-foreground"> / Monat</span>
                  </CardTitle>
                  <CardDescription>{plan.storage} Speicher</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 text-green-500" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={plan.id === "pro" ? "default" : "outline"}
                    disabled={checkoutDisabled}
                    onClick={() => handleCheckout(plan.id as "basic" | "pro")}
                  >
                    {checkoutDisabled ? "Subdomain zuerst prüfen" : `Plan ${plan.name} sichern`}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            ⚠️ Budget-Service ohne sekundäre Offsite-Backups. Für geschäftskritische Daten empfehlen wir zusätzliche Sicherung.
          </p>
        </section>

        <section className="container mx-auto grid gap-6 px-4 py-16 lg:grid-cols-2">
          {testimonials.map((item) => (
            <Card key={item.author} className="bg-card/80">
              <CardHeader>
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="h-4 w-4" />
                  Erfahrungsbericht
                </div>
                <CardTitle className="text-xl font-semibold text-foreground">{item.author}</CardTitle>
                <CardDescription>{item.role}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="leading-relaxed text-muted-foreground">“{item.quote}”</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section id="faq" className="container mx-auto px-4 py-16">
          <div className="flex flex-col items-center text-center">
            <Badge variant="secondary" className="mb-4">
              FAQ
            </Badge>
            <h2 className="text-3xl font-semibold">Antworten auf die häufigsten Fragen</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {faqs.map((item) => (
              <Card key={item.q} className="bg-card/70">
                <CardHeader>
                  <CardTitle className="text-lg">{item.q}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{item.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="container mx-auto px-4 pb-20">
          <Card className="border-primary/40 bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle>Bereit für eine private Foto-Cloud?</CardTitle>
              <CardDescription className="text-primary-foreground/90">
                Sichere dir jetzt eine Subdomain und lass dir deine Instanz automatisch deployen.
              </CardDescription>
            </CardHeader>
            <CardFooter className="gap-4">
              <Button variant="secondary" asChild>
                <a href="#pricing">Plan wählen</a>
              </Button>
              <Button variant="outline" className="text-primary-foreground" asChild>
                <a href={`mailto:hello@${DOMAIN}`}>Kontakt aufnehmen</a>
              </Button>
            </CardFooter>
          </Card>
        </section>
      </main>

      <footer className="border-t bg-background/90">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground">
          <div>
            <span className="text-primary font-semibold">SPhoto</span> · Basiert auf Immich · Betrieben in der Schweiz
          </div>
          <div className="flex gap-4">
            <a href="/admin" className="hover:text-foreground">
              Admin
            </a>
            <span>© {new Date().getFullYear()} {DOMAIN}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
