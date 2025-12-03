"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  ArrowLeft,
  Bell,
  AlertTriangle,
  HardDrive,
  Clock,
  RefreshCw,
  Send,
  CheckCircle,
  XCircle,
  Users,
  Server,
} from "lucide-react"
import Link from "next/link"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.sphoto.arturf.ch"

interface AlertSummary {
  instanceId: string
  type: string
  triggeredAt: string
  recipient: "customer" | "admin" | "both"
  details: Record<string, unknown>
}

interface AlertHistory {
  lastAlerts: Record<string, string | null>
  settings: {
    emailAlerts: boolean
    storageThresholds: number[]
    inactivityDays: number
    churnRiskDays: number
  }
}

const alertTypeLabels: Record<string, string> = {
  storage_80: "Speicher 80%",
  storage_90: "Speicher 90%",
  storage_100: "Speicher 100%",
  inactive: "Inaktivität",
  churn_risk: "Churn Risk",
  instance_down: "Instance Down",
  backup_failed: "Backup Failed",
}

const alertTypeIcons: Record<string, string> = {
  storage_80: "🟡",
  storage_90: "🟠",
  storage_100: "🔴",
  inactive: "😴",
  churn_risk: "📉",
  instance_down: "🚨",
  backup_failed: "💾",
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffHours = Math.floor((now - then) / (1000 * 60 * 60))
  
  if (diffHours < 1) return "Vor weniger als 1 Stunde"
  if (diffHours < 24) return `Vor ${diffHours} Stunden`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return "Vor 1 Tag"
  return `Vor ${diffDays} Tagen`
}

export default function AlertsPage() {
  const [apiKey, setApiKey] = useState("")
  const [isAuthed, setIsAuthed] = useState(false)
  const [alerts, setAlerts] = useState<AlertSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [testInstanceId, setTestInstanceId] = useState("")
  const [testAlertType, setTestAlertType] = useState("storage_80")
  const [sendingTest, setSendingTest] = useState(false)

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("admin_api_key") : null
    if (stored) {
      setApiKey(stored)
      setIsAuthed(true)
    }
  }, [])

  const api = useCallback(async (endpoint: string, method: string = "GET", body?: unknown) => {
    setError(null)
    const res = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (res.status === 401) {
      localStorage.removeItem("admin_api_key")
      setIsAuthed(false)
      throw new Error("API Key ungültig")
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(err.error || `Error ${res.status}`)
    }

    return res.json()
  }, [apiKey])

  const loadAlerts = useCallback(async () => {
    if (!apiKey) return
    setLoading(true)
    try {
      const data = await api("/api/admin/alerts/summary")
      setAlerts(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [api, apiKey])

  useEffect(() => {
    if (isAuthed) {
      loadAlerts()
    }
  }, [isAuthed, loadAlerts])

  const handleCheckAlerts = async () => {
    setChecking(true)
    setSuccess(null)
    try {
      const result = await api("/api/admin/alerts/check", "POST", {})
      setSuccess(`Alert-Check abgeschlossen. ${result.triggered} Alerts ausgelöst.`)
      await loadAlerts()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setChecking(false)
    }
  }

  const handleSendTestAlert = async () => {
    if (!testInstanceId.trim()) {
      setError("Bitte Instance ID eingeben")
      return
    }
    setSendingTest(true)
    setSuccess(null)
    try {
      await api(`/api/admin/alerts/test/${testInstanceId}`, "POST", { type: testAlertType })
      setSuccess(`Test-Alert (${alertTypeLabels[testAlertType]}) an ${testInstanceId} gesendet.`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSendingTest(false)
    }
  }

  const handleLogin = () => {
    if (!apiKey) return
    localStorage.setItem("admin_api_key", apiKey)
    setIsAuthed(true)
  }

  // Group alerts by type
  const alertsByType = alerts.reduce((acc, alert) => {
    if (!acc[alert.type]) acc[alert.type] = []
    acc[alert.type].push(alert)
    return acc
  }, {} as Record<string, AlertSummary[]>)

  // Count by recipient
  const customerAlerts = alerts.filter(a => a.recipient === "customer" || a.recipient === "both").length
  const adminAlerts = alerts.filter(a => a.recipient === "admin" || a.recipient === "both").length

  if (!isAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Admin Login</CardTitle>
            <CardDescription>API Key eingeben</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="Admin API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <Button className="w-full" onClick={handleLogin}>
              Anmelden
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-20">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Link href="/admin" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Usage Alerts
            </h1>
            <p className="text-sm text-muted-foreground">Automatische E-Mail-Benachrichtigungen</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadAlerts} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={handleCheckAlerts} disabled={checking}>
              {checking ? "Prüfe..." : "Alle Instanzen prüfen"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            {error}
          </div>
        )}
        
        {success && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-600 flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            {success}
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <Bell className="h-10 w-10 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Aktive Alerts</p>
                <p className="text-2xl font-semibold">{alerts.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <Users className="h-10 w-10 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Kunden-Alerts</p>
                <p className="text-2xl font-semibold">{customerAlerts}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <Server className="h-10 w-10 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Admin-Alerts</p>
                <p className="text-2xl font-semibold">{adminAlerts}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <Clock className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Nächster Check</p>
                <p className="text-2xl font-semibold">6h</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alert Types Reference */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Alert-Typen</CardTitle>
            <CardDescription>Übersicht aller konfigurierten Alerts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              {Object.entries(alertTypeLabels).map(([type, label]) => (
                <div key={type} className="flex items-center gap-3 p-3 rounded-lg border">
                  <span className="text-2xl">{alertTypeIcons[type]}</span>
                  <div>
                    <p className="font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      {type.startsWith("storage") ? "Kunde" : 
                       type === "storage_100" ? "Beide" : "Admin"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          {/* Active Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Aktive Alerts (letzte 7 Tage)
              </CardTitle>
              <CardDescription>Kürzlich ausgelöste Benachrichtigungen</CardDescription>
            </CardHeader>
            <CardContent>
              {loading && <p className="text-muted-foreground">Lade...</p>}
              {!loading && alerts.length === 0 && (
                <p className="text-muted-foreground flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Keine aktiven Alerts
                </p>
              )}
              {!loading && alerts.length > 0 && (
                <div className="space-y-4">
                  {Object.entries(alertsByType).map(([type, typeAlerts]) => (
                    <div key={type}>
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <span>{alertTypeIcons[type]}</span>
                        {alertTypeLabels[type]} ({typeAlerts.length})
                      </h4>
                      <div className="space-y-2 pl-6">
                        {typeAlerts.map((alert, i) => (
                          <div key={`${alert.instanceId}-${i}`} className="flex items-center justify-between py-2 border-b last:border-0">
                            <div>
                              <p className="font-medium">{alert.instanceId}</p>
                              <p className="text-xs text-muted-foreground">{formatRelativeTime(alert.triggeredAt)}</p>
                            </div>
                            <Badge variant={alert.recipient === "admin" ? "secondary" : "outline"}>
                              {alert.recipient === "both" ? "Beide" : alert.recipient === "admin" ? "Admin" : "Kunde"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Test Alert */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Test-Alert senden
              </CardTitle>
              <CardDescription>Sende einen Test-Alert an eine Instanz</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Instance ID</label>
                <Input
                  placeholder="z.B. artur-abc1"
                  value={testInstanceId}
                  onChange={(e) => setTestInstanceId(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Alert-Typ</label>
                <select
                  value={testAlertType}
                  onChange={(e) => setTestAlertType(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {Object.entries(alertTypeLabels).map(([type, label]) => (
                    <option key={type} value={type}>
                      {alertTypeIcons[type]} {label}
                    </option>
                  ))}
                </select>
              </div>
              <Button 
                className="w-full" 
                onClick={handleSendTestAlert}
                disabled={sendingTest || !testInstanceId.trim()}
              >
                {sendingTest ? "Sende..." : "Test-Alert senden"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
