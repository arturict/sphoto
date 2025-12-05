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
  Activity,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  AlertTriangle,
  Server,
  Zap,
} from "lucide-react"
import Link from "next/link"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.sphoto.arturf.ch"

interface HealthStatus {
  instanceId: string
  healthy: boolean
  responseTime: number | null
  sslValid: boolean
  sslExpiresAt: string | null
  sslDaysRemaining: number | null
  lastCheck: string
  consecutiveFailures: number
}

interface HealthSummary {
  totalInstances: number
  healthyInstances: number
  unhealthyInstances: number
  sslExpiringInstances: number
  statuses: HealthStatus[]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMins = Math.floor((now - then) / (1000 * 60))
  
  if (diffMins < 1) return "Gerade eben"
  if (diffMins < 60) return `Vor ${diffMins} Min`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `Vor ${diffHours}h`
  const diffDays = Math.floor(diffHours / 24)
  return `Vor ${diffDays} Tagen`
}

export default function HealthPage() {
  const [apiKey, setApiKey] = useState("")
  const [isAuthed, setIsAuthed] = useState(false)
  const [health, setHealth] = useState<HealthSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("admin_api_key") : null
    if (stored) {
      setApiKey(stored)
      setIsAuthed(true)
    }
  }, [])

  const api = useCallback(async (endpoint: string, method: string = "GET") => {
    setError(null)
    const res = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
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

  const loadHealth = useCallback(async () => {
    if (!apiKey) return
    setLoading(true)
    try {
      const data = await api("/api/admin/health")
      setHealth(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [api, apiKey])

  useEffect(() => {
    if (isAuthed) {
      loadHealth()
    }
  }, [isAuthed, loadHealth])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!isAuthed) return
    const interval = setInterval(() => {
      loadHealth()
    }, 30000)
    return () => clearInterval(interval)
  }, [isAuthed, loadHealth])

  const handleRunCheck = async () => {
    setChecking(true)
    try {
      const data = await api("/api/admin/health/check", "POST")
      setHealth(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setChecking(false)
    }
  }

  const handleLogin = () => {
    if (!apiKey) return
    localStorage.setItem("admin_api_key", apiKey)
    setIsAuthed(true)
  }

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

  const healthyStatuses = health?.statuses.filter(s => s.healthy) || []
  const unhealthyStatuses = health?.statuses.filter(s => !s.healthy) || []
  const sslWarningStatuses = health?.statuses.filter(s => s.sslDaysRemaining !== null && s.sslDaysRemaining <= 30) || []

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
              <Activity className="h-5 w-5 text-primary" />
              Health Monitor
            </h1>
            <p className="text-sm text-muted-foreground">Instanz-Verfügbarkeit & SSL-Status</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Auto-Refresh 30s
            </Badge>
            <Button variant="outline" size="sm" onClick={loadHealth} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={handleRunCheck} disabled={checking}>
              {checking ? "Prüfe..." : "Jetzt prüfen"}
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

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <Server className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Instanzen</p>
                <p className="text-2xl font-semibold">{health?.totalInstances || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <CheckCircle className="h-10 w-10 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Healthy</p>
                <p className="text-2xl font-semibold text-green-600">{health?.healthyInstances || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <XCircle className="h-10 w-10 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Unhealthy</p>
                <p className="text-2xl font-semibold text-red-600">{health?.unhealthyInstances || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <Shield className="h-10 w-10 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">SSL Warning</p>
                <p className="text-2xl font-semibold text-amber-600">{health?.sslExpiringInstances || 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Unhealthy Instances */}
        {unhealthyStatuses.length > 0 && (
          <Card className="border-red-500/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <XCircle className="h-5 w-5" />
                Unhealthy Instances ({unhealthyStatuses.length})
              </CardTitle>
              <CardDescription>Diese Instanzen haben Health-Checks nicht bestanden</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {unhealthyStatuses.map((status) => (
                  <div key={status.instanceId} className="p-4 rounded-lg border border-red-500/30 bg-red-500/5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{status.instanceId}</h4>
                          <Badge variant="destructive">Down</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span>Consecutive Failures: {status.consecutiveFailures}</span>
                          <span>Last Check: {formatRelativeTime(status.lastCheck)}</span>
                        </div>
                      </div>
                      <a 
                        href={`https://${status.instanceId}.sphoto.arturf.ch`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Öffnen →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* SSL Warnings */}
        {sslWarningStatuses.length > 0 && (
          <Card className="border-amber-500/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <Shield className="h-5 w-5" />
                SSL Certificate Warnings ({sslWarningStatuses.length})
              </CardTitle>
              <CardDescription>Zertifikate die bald ablaufen</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sslWarningStatuses.sort((a, b) => (a.sslDaysRemaining || 0) - (b.sslDaysRemaining || 0)).map((status) => (
                  <div key={status.instanceId} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Shield className={`h-5 w-5 ${status.sslDaysRemaining! <= 7 ? 'text-red-500' : 'text-amber-500'}`} />
                      <div>
                        <p className="font-medium">{status.instanceId}</p>
                        <p className="text-xs text-muted-foreground">
                          Expires: {status.sslExpiresAt ? formatDate(status.sslExpiresAt) : 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <Badge variant={status.sslDaysRemaining! <= 7 ? "destructive" : "outline"}>
                      {status.sslDaysRemaining} Tage
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Healthy Instances */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Healthy Instances ({healthyStatuses.length})
            </CardTitle>
            <CardDescription>Alle Health-Checks bestanden</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !health && <p className="text-muted-foreground">Lade...</p>}
            {!loading && healthyStatuses.length === 0 && (
              <p className="text-muted-foreground">Keine Daten verfügbar</p>
            )}
            {healthyStatuses.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-3">Instance</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Response Time</th>
                      <th className="pb-3">SSL</th>
                      <th className="pb-3">Last Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {healthyStatuses.map((status) => (
                      <tr key={status.instanceId} className="border-b last:border-0">
                        <td className="py-3 font-medium">{status.instanceId}</td>
                        <td className="py-3">
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            Healthy
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="flex items-center gap-1">
                            <Zap className="h-3 w-3 text-muted-foreground" />
                            {status.responseTime ? `${status.responseTime}ms` : 'N/A'}
                          </span>
                        </td>
                        <td className="py-3">
                          {status.sslValid ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <Shield className="h-4 w-4" />
                              {status.sslDaysRemaining !== null ? `${status.sslDaysRemaining}d` : 'Valid'}
                            </span>
                          ) : (
                            <span className="text-red-600 flex items-center gap-1">
                              <AlertTriangle className="h-4 w-4" />
                              Invalid
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {formatRelativeTime(status.lastCheck)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
