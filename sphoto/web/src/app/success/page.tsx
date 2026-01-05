"use client"

import { useState, useEffect, useCallback, Suspense, useRef } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  CheckCircle,
  ExternalLink,
  Mail,
  Smartphone,
  Download,
  XCircle,
  Cloud,
  Camera,
  ArrowRight,
} from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.sphoto.arturf.ch"
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "sphoto.arturf.ch"

type Platform = "immich" | "nextcloud"

function getEmailProvider(email: string): "gmail" | "outlook" | "other" {
  const domain = email.split("@")[1]?.toLowerCase() || ""
  if (domain === "gmail.com" || domain === "googlemail.com") return "gmail"
  if (["outlook.com", "hotmail.com", "live.com", "msn.com", "outlook.de", "hotmail.de"].includes(domain)) return "outlook"
  return "other"
}

function EmailLink({ email }: { email: string }) {
  const provider = getEmailProvider(email)
  
  if (provider === "gmail") {
    return (
      <Button variant="outline" size="sm" asChild>
        <a
          href="https://mail.google.com/mail/u/0/#inbox"
          target="_blank"
          rel="noreferrer"
        >
          <Mail className="mr-2 h-4 w-4" />
          Gmail öffnen
        </a>
      </Button>
    )
  }
  
  if (provider === "outlook") {
    return (
      <Button variant="outline" size="sm" asChild>
        <a
          href="https://outlook.live.com/mail/0/inbox"
          target="_blank"
          rel="noreferrer"
        >
          <Mail className="mr-2 h-4 w-4" />
          Outlook öffnen
        </a>
      </Button>
    )
  }
  
  return null
}

interface SessionStatus {
  status: "processing" | "complete" | "error" | "pending" | "unknown"
  message?: string
  instanceId?: string
  instanceUrl?: string
  email?: string
  plan?: string
  platform?: Platform
  autoSetup?: boolean
}

const POLL_INTERVAL_MS = 3000
const MAX_POLLS = 60 // max ~3 minutes

// Translate common error messages to German
function translateError(error: string): string {
  const translations: Record<string, string> = {
    'Email already registered': 'Diese E-Mail-Adresse ist bereits registriert.',
    'Email+already+registered': 'Diese E-Mail-Adresse ist bereits registriert.',
    'Email is required': 'E-Mail-Adresse ist erforderlich.',
    'Email+is+required': 'E-Mail-Adresse ist erforderlich.',
    'Invalid email format': 'Ungültiges E-Mail-Format.',
    'Invalid+email+format': 'Ungültiges E-Mail-Format.',
    'Failed to create account': 'Kontoeröffnung fehlgeschlagen. Bitte versuche es erneut.',
    'Failed+to+create+account': 'Kontoeröffnung fehlgeschlagen. Bitte versuche es erneut.',
  }
  
  // Check for exact match first
  if (translations[error]) return translations[error]
  
  // Check if error contains known patterns
  const decoded = decodeURIComponent(error.replace(/\+/g, ' '))
  if (decoded.includes('User exists') || decoded.includes('already exists') || decoded.includes('already registered')) {
    return 'Diese E-Mail-Adresse ist bereits registriert.'
  }
  if (decoded.includes('Invalid email')) {
    return 'Ungültiges E-Mail-Format.'
  }
  
  // Return decoded error as fallback
  return decoded
}

function SuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")
  
  // Free signup flow params
  const freePlan = searchParams.get("plan")
  const freeEmail = searchParams.get("email")
  const freeInstance = searchParams.get("instance")
  const errorParam = searchParams.get("error")
  
  // Check if this is a free signup redirect
  const isFreeSignup = freePlan === "free" && freeEmail && freeInstance
  
  const [status, setStatus] = useState<SessionStatus>({ status: "processing", message: "Laden..." })
  const [progress, setProgress] = useState(0)
  const pollCount = useRef(0)

  const checkStatus = useCallback(async () => {
    if (!sessionId) return
    try {
      const res = await fetch(`${API_URL}/status/${sessionId}`)
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json()
      setStatus(data)

      // Simulate progress during processing
      if (data.status === "processing" || data.status === "pending") {
        setProgress((prev) => Math.min(prev + 5, 90))
      } else if (data.status === "complete") {
        setProgress(100)
      }
    } catch {
      setStatus({ status: "error", message: "Verbindungsfehler – bitte Seite neu laden" })
    }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return

    checkStatus()

    const interval = setInterval(() => {
      pollCount.current += 1
      if (pollCount.current > MAX_POLLS) {
        setStatus({
          status: "error",
          message: "Timeout – bitte Support kontaktieren falls die Instanz nicht erscheint.",
        })
        clearInterval(interval)
        return
      }

      if (status.status === "processing" || status.status === "pending") {
        checkStatus()
      } else {
        clearInterval(interval)
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [checkStatus, sessionId, status.status])

  // Handle error from redirect
  if (errorParam) {
    const errorMessage = translateError(errorParam)
    const isEmailExists = errorMessage.includes('bereits registriert')
    
    return (
      <Card className="max-w-md border-destructive">
        <CardHeader className="text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
          <CardTitle>Registrierung fehlgeschlagen</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">{errorMessage}</p>
          {isEmailExists && (
            <p className="text-sm text-muted-foreground">
              Falls du dein Passwort vergessen hast, melde dich bei deiner Immich-Instanz an und nutze die &quot;Passwort vergessen&quot; Funktion.
            </p>
          )}
          <Button className="mt-2" asChild>
            <Link href="/">Zur Startseite</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Handle free signup success
  if (isFreeSignup) {
    return (
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center pb-4">
          <CheckCircle className="h-14 w-14 text-foreground mx-auto mb-4" />
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            Dein Konto ist bereit
          </CardTitle>
          <CardDescription>Du kannst dich jetzt anmelden und loslegen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-secondary rounded-xl p-5 text-center">
            <p className="text-sm text-muted-foreground mb-2">Deine URL:</p>
            <a
              href={freeInstance}
              target="_blank"
              rel="noreferrer"
              className="text-lg font-semibold text-foreground hover:underline inline-flex items-center gap-2"
            >
              {freeInstance.replace("https://", "").replace("http://", "")}
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <div className="flex gap-2 justify-center flex-wrap">
            <Badge variant="secondary">Free</Badge>
            <Badge variant="outline" className="flex items-center gap-1.5">
              <Camera className="h-3 w-3" /> Immich
            </Badge>
          </div>

          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">E-Mail gesendet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Deine Login-Daten wurden an <span className="font-mono text-foreground">{freeEmail}</span> gesendet.
                </p>
                <div className="mt-3">
                  <EmailLink email={freeEmail} />
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <Smartphone className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Mobile App</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Lade die <strong>Immich</strong> App und verbinde mit deiner URL.
                </p>
                <div className="mt-3 flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href="https://apps.apple.com/app/immich/id1613945652"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download className="mr-1.5 h-3 w-3" /> iOS
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href="https://play.google.com/store/apps/details?id=app.alextran.immich"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Download className="mr-1.5 h-3 w-3" /> Android
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Button className="w-full" size="lg" asChild>
            <a href={freeInstance} target="_blank" rel="noreferrer">
              Zur Cloud öffnen
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!sessionId) {
    return (
      <Card className="max-w-md">
        <CardHeader className="text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
          <CardTitle>Keine Session gefunden</CardTitle>
          <CardDescription>Der Link ist ungültig oder abgelaufen.</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button className="mt-2" asChild>
            <Link href="/">Zur Startseite</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (status.status === "processing" || status.status === "pending") {
    return (
      <Card className="max-w-md w-full">
        <CardHeader className="text-center pb-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-foreground mb-4" />
          <CardTitle>Deine Cloud wird erstellt...</CardTitle>
          <CardDescription>Das dauert normalerweise 1–2 Minuten.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-foreground h-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="space-y-3 text-sm">
            <div className={`flex items-center gap-3 ${progress >= 10 ? "text-foreground" : "text-muted-foreground"}`}>
              {progress >= 10 ? <CheckCircle className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border-2 border-current" />}
              Zahlung erhalten
            </div>
            <div className={`flex items-center gap-3 ${progress >= 40 ? "text-foreground" : progress >= 10 ? "animate-pulse text-foreground" : "text-muted-foreground"}`}>
              {progress >= 40 ? <CheckCircle className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border-2 border-current" />}
              Container werden gestartet
            </div>
            <div className={`flex items-center gap-3 ${progress >= 70 ? "text-foreground" : progress >= 40 ? "animate-pulse text-foreground" : "text-muted-foreground"}`}>
              {progress >= 70 ? <CheckCircle className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border-2 border-current" />}
              SSL-Zertifikat wird erstellt
            </div>
            <div className={`flex items-center gap-3 ${progress >= 100 ? "text-foreground" : progress >= 70 ? "animate-pulse text-foreground" : "text-muted-foreground"}`}>
              {progress >= 100 ? <CheckCircle className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border-2 border-current" />}
              Account wird eingerichtet
            </div>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            Diese Seite aktualisiert sich automatisch.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (status.status === "error" || status.status === "unknown") {
    return (
      <Card className="max-w-md border-destructive">
        <CardHeader className="text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
          <CardTitle>Etwas ist schiefgelaufen</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">{status.message || "Unbekannter Fehler"}</p>
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Seite neu laden
            </Button>
            <Button variant="ghost" asChild>
              <a href={`mailto:support@${DOMAIN}`}>Support kontaktieren</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Success!
  return (
    <Card className="max-w-lg w-full">
      <CardHeader className="text-center pb-4">
        <CheckCircle className="h-14 w-14 text-foreground mx-auto mb-4" />
        <CardTitle className="text-2xl flex items-center justify-center gap-2">
          Deine Cloud ist bereit
        </CardTitle>
        <CardDescription>Du kannst dich jetzt anmelden und loslegen.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-secondary rounded-xl p-5 text-center">
          <p className="text-sm text-muted-foreground mb-2">Deine URL:</p>
          <a
            href={status.instanceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-lg font-semibold text-foreground hover:underline inline-flex items-center gap-2"
          >
            {status.instanceUrl?.replace("https://", "")}
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <div className="flex gap-2 justify-center flex-wrap">
          <Badge variant="secondary">{status.plan}</Badge>
          <Badge variant="outline" className="flex items-center gap-1.5">
            {status.platform === "nextcloud" ? (
              <><Cloud className="h-3 w-3" /> Nextcloud</>
            ) : (
              <><Camera className="h-3 w-3" /> Immich</>
            )}
          </Badge>
          {status.autoSetup && <Badge variant="success">Auto-Setup</Badge>}
        </div>

        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">E-Mail gesendet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Deine Login-Daten wurden an <span className="font-mono text-foreground">{status.email}</span> gesendet.
              </p>
              {status.email && (
                <div className="mt-3">
                  <EmailLink email={status.email} />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-4">
            <Smartphone className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Mobile App</p>
              {status.platform === "nextcloud" ? (
                <>
                  <p className="text-sm text-muted-foreground mt-1">
                    Lade die <strong>Nextcloud</strong> App und verbinde mit deiner URL.
                  </p>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href="https://apps.apple.com/app/nextcloud/id1125420102"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download className="mr-1.5 h-3 w-3" /> iOS
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href="https://play.google.com/store/apps/details?id=com.nextcloud.client"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download className="mr-1.5 h-3 w-3" /> Android
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href="https://nextcloud.com/install/#install-clients"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download className="mr-1.5 h-3 w-3" /> Desktop
                      </a>
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mt-1">
                    Lade die <strong>Immich</strong> App und verbinde mit deiner URL.
                  </p>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href="https://apps.apple.com/app/immich/id1613945652"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download className="mr-1.5 h-3 w-3" /> iOS
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href="https://play.google.com/store/apps/details?id=app.alextran.immich"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download className="mr-1.5 h-3 w-3" /> Android
                      </a>
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <Button className="w-full" size="lg" asChild>
          <a href={status.instanceUrl} target="_blank" rel="noreferrer">
            Zur Cloud öffnen
            <ArrowRight className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}

export default function SuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Suspense
        fallback={
          <Card className="max-w-md w-full">
            <CardContent className="py-12 text-center">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">Lade Status...</p>
            </CardContent>
          </Card>
        }
      >
        <SuccessContent />
      </Suspense>
    </div>
  )
}
