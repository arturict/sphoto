"use client"

import { useState, useEffect, useCallback, Suspense, useRef } from "react"
import { useSearchParams } from "next/navigation"
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
  Sparkles,
  XCircle,
} from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.sphoto.arturf.ch"
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "sphoto.arturf.ch"

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
  autoSetup?: boolean
}

const POLL_INTERVAL_MS = 3000
const MAX_POLLS = 60 // max ~3 minutes

function SuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")
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
            <a href="/">Zur Startseite</a>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (status.status === "processing" || status.status === "pending") {
    return (
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <Loader2 className="h-14 w-14 animate-spin mx-auto text-primary mb-4" />
          <CardTitle>Deine Cloud wird erstellt...</CardTitle>
          <CardDescription>Das dauert normalerweise 1–2 Minuten.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="space-y-2 text-sm">
            <p className={progress >= 10 ? "text-green-600" : "text-muted-foreground"}>
              {progress >= 10 ? "✓" : "○"} Zahlung erhalten
            </p>
            <p className={progress >= 40 ? "text-green-600" : progress >= 10 ? "animate-pulse text-primary" : "text-muted-foreground"}>
              {progress >= 40 ? "✓" : progress >= 10 ? "⏳" : "○"} Container werden gestartet
            </p>
            <p className={progress >= 70 ? "text-green-600" : progress >= 40 ? "animate-pulse text-primary" : "text-muted-foreground"}>
              {progress >= 70 ? "✓" : progress >= 40 ? "⏳" : "○"} SSL-Zertifikat wird erstellt
            </p>
            <p className={progress >= 100 ? "text-green-600" : progress >= 70 ? "animate-pulse text-primary" : "text-muted-foreground"}>
              {progress >= 100 ? "✓" : progress >= 70 ? "⏳" : "○"} Account wird eingerichtet
            </p>
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
      <CardHeader className="text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <CardTitle className="text-2xl flex items-center justify-center gap-2">
          Deine Cloud ist bereit!
          <Sparkles className="h-5 w-5 text-primary" />
        </CardTitle>
        <CardDescription>Du kannst dich jetzt anmelden und loslegen.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-muted rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground mb-1">Deine URL:</p>
          <a
            href={status.instanceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xl font-semibold text-primary hover:underline inline-flex items-center gap-2"
          >
            {status.instanceUrl?.replace("https://", "")}
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <div className="flex gap-2 justify-center flex-wrap">
          <Badge variant="secondary">{status.plan}</Badge>
          {status.autoSetup && <Badge variant="success">Auto-Setup ✓</Badge>}
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">E-Mail gesendet</p>
              <p className="text-sm text-muted-foreground">
                Deine Login-Daten wurden an <span className="font-mono">{status.email}</span> gesendet.
              </p>
              {status.email && (
                <div className="mt-2">
                  <EmailLink email={status.email} />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Smartphone className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Mobile App</p>
              <p className="text-sm text-muted-foreground">
                Lade die <strong>Immich</strong> App und verbinde mit deiner URL.
              </p>
              <div className="mt-2 flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href="https://apps.apple.com/app/immich/id1613945652"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Download className="mr-1 h-3 w-3" /> iOS
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href="https://play.google.com/store/apps/details?id=app.alextran.immich"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Download className="mr-1 h-3 w-3" /> Android
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Button className="w-full" size="lg" asChild>
          <a href={status.instanceUrl} target="_blank" rel="noreferrer">
            Zur Cloud öffnen
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}

export default function SuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/5 via-background to-background p-4">
      <Suspense
        fallback={
          <Card className="max-w-md w-full">
            <CardContent className="py-12 text-center">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
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
