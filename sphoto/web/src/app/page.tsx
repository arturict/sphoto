"use client"

import { useState } from "react"
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
  ChevronDown,
  Cloud,
  HardDrive,
  Lock,
  Mail,
  Shield,
  Smartphone,
  Sparkles,
  Upload,
  XCircle,
  Zap,
} from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.sphoto.arturf.ch"
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "sphoto.arturf.ch"

const plans = [
  {
    id: "free",
    name: "Free",
    price: "0",
    storage: "5 GB",
    photos: "~1'000",
    description: "Zum Ausprobieren",
    features: ["5 GB Speicher", "Mobile Apps", "Automatische Backups"],
    cta: "Kostenlos starten",
    popular: false,
    variant: "secondary" as const,
  },
  {
    id: "basic",
    name: "Basic",
    price: "5",
    storage: "200 GB",
    photos: "~40'000",
    description: "Für Einzelpersonen",
    features: ["200 GB Speicher", "KI-Gesichtserkennung", "Objekterkennung", "Prioritäts-Support"],
    cta: "Basic wählen",
    popular: false,
    variant: "outline" as const,
  },
  {
    id: "pro",
    name: "Pro",
    price: "15",
    storage: "1 TB",
    photos: "~200'000",
    description: "Für Familien",
    features: ["1 TB Speicher", "Alles aus Basic", "Mehrere Nutzer", "Geteilte Alben"],
    cta: "Pro wählen",
    popular: true,
    variant: "default" as const,
  },
]

const features = [
  {
    icon: Shield,
    title: "Deine Daten, deine Kontrolle",
    description: "Gehostet in der Schweiz. Keine Analyse, kein Tracking, keine Werbung.",
  },
  {
    icon: Smartphone,
    title: "Mobile Apps",
    description: "Native iOS & Android Apps mit automatischem Foto-Backup.",
  },
  {
    icon: Zap,
    title: "KI-Suche",
    description: "Finde Fotos nach Gesichtern, Objekten oder Orten.",
  },
  {
    icon: Lock,
    title: "Verschlüsselt",
    description: "SSL/TLS verschlüsselt. Deine Fotos sind sicher.",
  },
  {
    icon: Upload,
    title: "Einfache Migration",
    description: "Importiere deine Fotos von Google Photos oder iCloud.",
  },
  {
    icon: HardDrive,
    title: "DSGVO-Export",
    description: "Exportiere jederzeit alle deine Daten.",
  },
]

const faqs = [
  {
    q: "Was ist SPhoto?",
    a: "SPhoto ist eine private Foto-Cloud basierend auf Immich - die beste Open-Source Alternative zu Google Photos. Deine Fotos werden sicher in der Schweiz gehostet.",
  },
  {
    q: "Wie funktioniert die KI-Erkennung?",
    a: "Bei Basic und Pro Plänen analysiert unsere KI deine Fotos lokal auf unseren Servern. So kannst du nach Gesichtern, Objekten oder Szenen suchen - ohne dass deine Daten die Schweiz verlassen.",
  },
  {
    q: "Kann ich meine Google Photos importieren?",
    a: "Ja! Exportiere deine Fotos über Google Takeout und lade sie dann über die Immich App oder Web-Oberfläche hoch.",
  },
  {
    q: "Was passiert wenn ich kündige?",
    a: "Du kannst jederzeit monatlich kündigen. Deine Daten bleiben 30 Tage verfügbar zum Export. Danach werden sie gelöscht.",
  },
  {
    q: "Gibt es eine Familienoption?",
    a: "Ja, mit dem Pro Plan kannst du weitere Nutzer einladen und Alben teilen. Jeder Nutzer hat sein eigenes Konto.",
  },
]

export default function Home() {
  const [email, setEmail] = useState("")
  const [isValidEmail, setIsValidEmail] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const validateEmail = (value: string) => {
    setEmail(value.toLowerCase())
    setIsValidEmail(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
  }

  const handleCheckout = (planId: string) => {
    if (!isValidEmail) return
    if (planId === "free") {
      window.location.href = `${API_URL}/signup/free?email=${encodeURIComponent(email)}`
    } else {
      window.location.href = `${API_URL}/checkout/${planId}?email=${encodeURIComponent(email)}`
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Cloud className="h-5 w-5 text-primary-foreground" />
            </div>
            SPhoto
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Preise
            </Link>
            <Link href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </Link>
          </nav>
          <Button asChild>
            <a href="#pricing">Loslegen</a>
          </Button>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="py-20 md:py-32">
          <div className="container">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="secondary" className="mb-4">
                <Sparkles className="mr-1 h-3 w-3" />
                Gehostet in der Schweiz 🇨🇭
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                Deine Fotos.
                <br />
                <span className="text-primary">Deine Cloud.</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
                Die private Google Photos Alternative mit Schweizer Hosting. 
                KI-Gesichtserkennung, automatische Backups, volle Kontrolle über deine Daten.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild>
                  <a href="#pricing">
                    Kostenlos starten
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="#features">Mehr erfahren</Link>
                </Button>
              </div>
              
              {/* Trust indicators */}
              <div className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Keine Kreditkarte nötig
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  DSGVO-konform
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Monatlich kündbar
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 bg-muted/50">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold">Warum SPhoto?</h2>
              <p className="mt-2 text-muted-foreground">
                Alles was du von Google Photos kennst - ohne die Nachteile.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {features.map((feature) => (
                <Card key={feature.title} className="border-0 shadow-none bg-background">
                  <CardHeader className="pb-2">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                      <feature.icon className="h-5 w-5 text-primary" />
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

        {/* Pricing */}
        <section id="pricing" className="py-20">
          <div className="container">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold">Einfache Preise</h2>
              <p className="mt-2 text-muted-foreground">
                Starte kostenlos. Upgrade wenn du mehr brauchst.
              </p>
            </div>

            {/* Email Input */}
            <div className="max-w-md mx-auto mb-10">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="deine@email.ch"
                  value={email}
                  onChange={(e) => validateEmail(e.target.value)}
                  className="pl-10 h-12 text-base"
                />
                {email && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isValidEmail ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                )}
              </div>
              {email && !isValidEmail && (
                <p className="mt-2 text-sm text-red-500">Bitte gib eine gültige E-Mail-Adresse ein</p>
              )}
            </div>

            {/* Plan Cards */}
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {plans.map((plan) => (
                <Card 
                  key={plan.id} 
                  className={`relative ${plan.popular ? "border-primary shadow-lg" : ""}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge>Beliebt</Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-center">
                    <div className="mb-4">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground"> CHF/Monat</span>
                    </div>
                    <div className="mb-6 text-sm">
                      <span className="font-medium text-primary">{plan.storage}</span>
                      <span className="text-muted-foreground"> · {plan.photos} Fotos</span>
                    </div>
                    <ul className="space-y-2 text-sm text-left">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full" 
                      variant={plan.variant}
                      disabled={!isValidEmail}
                      onClick={() => handleCheckout(plan.id)}
                    >
                      {!isValidEmail ? "E-Mail eingeben" : plan.cta}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>

            {/* All plans include */}
            <div className="mt-12 text-center">
              <p className="text-sm text-muted-foreground mb-4">Alle Pläne beinhalten:</p>
              <div className="flex flex-wrap justify-center gap-4">
                {["iOS & Android Apps", "Web-Zugang", "Automatische Backups", "DSGVO-Export", "Schweizer Hosting"].map((item) => (
                  <Badge key={item} variant="secondary">
                    <Check className="mr-1 h-3 w-3" />
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20 bg-muted/50">
          <div className="container">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold">Häufige Fragen</h2>
            </div>
            <div className="max-w-2xl mx-auto space-y-2">
              {faqs.map((faq, i) => (
                <Card 
                  key={i}
                  className="cursor-pointer"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <CardHeader className="py-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-medium">{faq.q}</CardTitle>
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

        {/* Final CTA */}
        <section className="py-20">
          <div className="container">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-3xl font-bold">Bereit loszulegen?</h2>
              <p className="mt-4 text-muted-foreground">
                Erstelle dein kostenloses Konto in unter einer Minute.
              </p>
              <Button size="lg" className="mt-8" asChild>
                <a href="#pricing">
                  Jetzt kostenlos starten
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
                <Cloud className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">SPhoto</span>
            </div>
            <nav className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="#faq" className="hover:text-foreground">FAQ</Link>
              <a href={`mailto:hello@${DOMAIN}`} className="hover:text-foreground">Kontakt</a>
              <Link href="/admin" className="hover:text-foreground">Admin</Link>
            </nav>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} SPhoto · Schweiz 🇨🇭
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
