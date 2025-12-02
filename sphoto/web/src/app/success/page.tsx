"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, ExternalLink, Mail, Smartphone } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.sphoto.arturf.ch"

interface SessionStatus {
  status: "processing" | "complete" | "error" | "pending" | "unknown"
  message?: string
  instanceId?: string
  instanceUrl?: string
  email?: string
  plan?: string
  autoSetup?: boolean
}

function SuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")
  const [status, setStatus] = useState<SessionStatus>({ status: "processing", message: "Laden..." })

  const checkStatus = useCallback(async () => {
    if (!sessionId) return
    try {
      const res = await fetch(`${API_URL}/status/${sessionId}`)
      const data = await res.json()
      setStatus(data)
    } catch {
      setStatus({ status: "error", message: "Verbindungsfehler" })
    }
  }, [sessionId])

  useEffect(() => {
    checkStatus()
    const interval = setInterval(() => {
      if (status.status === "processing" || status.status === "pending") {
        checkStatus()
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [checkStatus, status.status])

  if (!sessionId) {
    return (
      <Card className="max-w-md">
        <CardContent className="pt-6 text-center">
          <p className="text-muted-foreground">Keine Session gefunden</p>
          <Button className="mt-4" asChild>
            <a href="/">Zur Startseite</a>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (status.status === "processing" || status.status === "pending") {
    return (
      <Card className="max-w-md">
        <CardHeader className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
          <CardTitle>Deine Cloud wird erstellt...</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">{status.message || "Bitte warten..."}</p>
          <div className="mt-6 space-y-2 text-sm text-muted-foreground">
            <p>✓ Zahlung erhalten</p>
            <p className="animate-pulse">⏳ Container werden gestartet...</p>
            <p className="opacity-50">○ SSL-Zertifikat wird erstellt</p>
            <p className="opacity-50">○ Account wird eingerichtet</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (status.status === "error") {
    return (
      <Card className="max-w-md border-destructive">
        <CardContent className="pt-6 text-center">
          <p className="text-destructive font-medium">Fehler</p>
          <p className="text-muted-foreground mt-2">{status.message}</p>
          <Button className="mt-4" variant="outline" asChild>
            <a href="mailto:support@arturf.ch">Support kontaktieren</a>
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Success!
  return (
    <Card className="max-w-lg">
      <CardHeader className="text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <CardTitle className="text-2xl">Deine Cloud ist bereit! 🎉</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-muted rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground mb-1">Deine URL:</p>
          <a 
            href={status.instanceUrl} 
            target="_blank" 
            className="text-xl font-semibold text-primary hover:underline flex items-center justify-center gap-2"
          >
            {status.instanceUrl?.replace("https://", "")}
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <div className="flex gap-2 justify-center">
          <Badge variant="secondary">{status.plan}</Badge>
          {status.autoSetup && <Badge variant="success">Auto-Setup ✓</Badge>}
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">E-Mail gesendet</p>
              <p className="text-sm text-muted-foreground">
                Deine Login-Daten wurden an {status.email} gesendet
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Smartphone className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">Mobile App</p>
              <p className="text-sm text-muted-foreground">
                Lade die &quot;Immich&quot; App und verbinde mit deiner URL
              </p>
            </div>
          </div>
        </div>

        <Button className="w-full" asChild>
          <a href={status.instanceUrl} target="_blank">
            Zur Cloud <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}

export default function SuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Suspense fallback={
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          </CardContent>
        </Card>
      }>
        <SuccessContent />
      </Suspense>
    </div>
  )
}
