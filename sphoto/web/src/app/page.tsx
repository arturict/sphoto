"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Check, Cloud, Shield, Smartphone, ArrowRight, Loader2, CheckCircle, XCircle } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.sphoto.arturf.ch"
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "sphoto.arturf.ch"

export default function Home() {
  const [subdomain, setSubdomain] = useState("")
  const [subdomainStatus, setSubdomainStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle")
  const [statusMessage, setStatusMessage] = useState("")

  useEffect(() => {
    if (subdomain.length < 3) {
      setSubdomainStatus("idle")
      return
    }

    const timer = setTimeout(async () => {
      setSubdomainStatus("checking")
      try {
        const res = await fetch(`${API_URL}/subdomain/check/${subdomain}`)
        const data = await res.json()
        if (data.available) {
          setSubdomainStatus("available")
          setStatusMessage(`${subdomain}.${DOMAIN} ist verfügbar!`)
        } else {
          setSubdomainStatus("taken")
          setStatusMessage(data.reason || "Nicht verfügbar")
        }
      } catch {
        setSubdomainStatus("invalid")
        setStatusMessage("Fehler beim Prüfen")
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [subdomain])

  const handleCheckout = (plan: "basic" | "pro") => {
    if (subdomainStatus !== "available") return
    window.location.href = `${API_URL}/checkout/${plan}?subdomain=${subdomain}`
  }

  const features = [
    { icon: Cloud, title: "Unbegrenzte Fotos", desc: "Speichere alle deine Erinnerungen" },
    { icon: Shield, title: "Schweizer Server", desc: "Deine Daten bleiben in der Schweiz" },
    { icon: Smartphone, title: "Mobile App", desc: "Automatischer Backup deiner Fotos" },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex justify-between items-center">
          <div className="text-2xl font-bold">
            <span className="text-primary">S</span>Photo
          </div>
          <div className="flex gap-4">
            <Button variant="ghost" asChild>
              <a href="#features">Features</a>
            </Button>
            <Button variant="ghost" asChild>
              <a href="#pricing">Preise</a>
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <Badge variant="secondary" className="mb-4">Google Photos Alternative</Badge>
        <h1 className="text-4xl md:text-6xl font-bold mb-6">
          Deine Fotos.<br />
          <span className="text-primary">Deine Cloud.</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Private Photo-Cloud mit Schweizer Hosting. 
          Keine Kompromisse bei Privatsphäre oder Qualität.
        </p>
        <Button size="lg" asChild>
          <a href="#pricing">Jetzt starten <ArrowRight className="ml-2 h-4 w-4" /></a>
        </Button>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <Card key={i} className="bg-card/50 backdrop-blur">
              <CardHeader>
                <f.icon className="h-10 w-10 text-primary mb-2" />
                <CardTitle>{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Einfache Preise</h2>
          <p className="text-muted-foreground">Keine versteckten Kosten. Jederzeit kündbar.</p>
        </div>

        {/* Subdomain Selection */}
        <Card className="max-w-md mx-auto mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Wähle deine Subdomain</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="deinname"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className="pr-32"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  .{DOMAIN}
                </span>
              </div>
            </div>
            {subdomain.length > 0 && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                {subdomainStatus === "checking" && <Loader2 className="h-4 w-4 animate-spin" />}
                {subdomainStatus === "available" && <CheckCircle className="h-4 w-4 text-green-500" />}
                {(subdomainStatus === "taken" || subdomainStatus === "invalid") && <XCircle className="h-4 w-4 text-destructive" />}
                <span className={subdomainStatus === "available" ? "text-green-500" : subdomainStatus === "taken" ? "text-destructive" : ""}>
                  {statusMessage || (subdomain.length < 3 ? "Mindestens 3 Zeichen" : "")}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Plans */}
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Basic */}
          <Card>
            <CardHeader>
              <Badge variant="secondary" className="w-fit">BASIC</Badge>
              <CardTitle className="text-4xl">5 <span className="text-lg text-muted-foreground">CHF/Mt.</span></CardTitle>
              <CardDescription>200 GB Speicher</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {["200 GB Speicher", "KI-Gesichtserkennung", "Mobile App (iOS/Android)", "Automatische Backups"].map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" /> {f}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                variant="outline"
                disabled={subdomainStatus !== "available"}
                onClick={() => handleCheckout("basic")}
              >
                {subdomainStatus !== "available" ? "Subdomain wählen ↑" : "Basic wählen"}
              </Button>
            </CardFooter>
          </Card>

          {/* Pro */}
          <Card className="border-primary">
            <CardHeader>
              <Badge className="w-fit">EMPFOHLEN</Badge>
              <CardTitle className="text-4xl">15 <span className="text-lg text-muted-foreground">CHF/Mt.</span></CardTitle>
              <CardDescription>1 TB Speicher</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {["1 TB Speicher", "Alles von Basic", "5x mehr Speicher", "Priority Support"].map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" /> {f}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full"
                disabled={subdomainStatus !== "available"}
                onClick={() => handleCheckout("pro")}
              >
                {subdomainStatus !== "available" ? "Subdomain wählen ↑" : "Pro wählen"}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Notice */}
        <Card className="max-w-4xl mx-auto mt-8 bg-yellow-500/10 border-yellow-500/20">
          <CardContent className="py-4 text-center text-sm text-yellow-500">
            ⚠️ Budget-Service ohne automatisches Backup. Für wichtige Erinnerungen empfehlen wir zusätzliche Sicherungen.
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t mt-20">
        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <div><span className="text-primary font-bold">S</span>Photo · Basiert auf <a href="https://immich.app" className="hover:text-foreground">Immich</a></div>
          <div>© 2025 {DOMAIN}</div>
        </div>
      </footer>
    </div>
  )
}
