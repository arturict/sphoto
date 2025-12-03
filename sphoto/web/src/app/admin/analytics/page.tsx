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
  BarChart3,
  TrendingUp,
  HardDrive,
  Users,
  AlertTriangle,
  RefreshCw,
  Activity,
} from "lucide-react"
import Link from "next/link"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.sphoto.arturf.ch"

interface AnalyticsData {
  uploadTrend: Array<{ date: string; uploads: number }>
  storageGrowth: Array<{ date: string; total_bytes: number }>
  activeInstances: number
  inactiveInstances: number
  topInstances: Array<{ id: string; storage_bytes: number; files: number }>
  churnRisk: Array<{ id: string; lastActivity: string }>
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" })
}

export default function AnalyticsPage() {
  const [apiKey, setApiKey] = useState("")
  const [isAuthed, setIsAuthed] = useState(false)
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [collecting, setCollecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)

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
      headers: { "x-api-key": apiKey },
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

  const loadAnalytics = useCallback(async () => {
    if (!apiKey) return
    setLoading(true)
    try {
      const data = await api(`/api/analytics?days=${days}`)
      setAnalytics(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [api, apiKey, days])

  useEffect(() => {
    if (isAuthed) {
      loadAnalytics()
    }
  }, [isAuthed, loadAnalytics])

  const handleCollectStats = async () => {
    setCollecting(true)
    try {
      await api("/api/analytics/collect", "POST")
      await loadAnalytics()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setCollecting(false)
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

  const totalUploads = analytics?.uploadTrend.reduce((sum, d) => sum + d.uploads, 0) || 0
  const latestStorage = analytics?.storageGrowth[analytics.storageGrowth.length - 1]?.total_bytes || 0

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
              <BarChart3 className="h-5 w-5 text-primary" />
              Usage Analytics
            </h1>
            <p className="text-sm text-muted-foreground">Nutzungsstatistiken aller Instanzen</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value={7}>7 Tage</option>
              <option value={30}>30 Tage</option>
              <option value={60}>60 Tage</option>
              <option value={90}>90 Tage</option>
            </select>
            <Button variant="outline" size="sm" onClick={loadAnalytics} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={handleCollectStats} disabled={collecting}>
              {collecting ? "Sammeln..." : "Stats sammeln"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && !analytics && (
          <div className="py-12 text-center text-muted-foreground">Lade Analytics...</div>
        )}

        {analytics && (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="flex items-center gap-4 pt-6">
                  <TrendingUp className="h-10 w-10 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Uploads ({days}d)</p>
                    <p className="text-2xl font-semibold">{totalUploads.toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 pt-6">
                  <HardDrive className="h-10 w-10 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Gesamt-Speicher</p>
                    <p className="text-2xl font-semibold">{formatBytes(latestStorage)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 pt-6">
                  <Users className="h-10 w-10 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Aktive Instanzen</p>
                    <p className="text-2xl font-semibold">{analytics.activeInstances}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 pt-6">
                  <AlertTriangle className="h-10 w-10 text-amber-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Churn Risk</p>
                    <p className="text-2xl font-semibold">{analytics.churnRisk.length}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Upload Trend */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Upload-Trend
                  </CardTitle>
                  <CardDescription>Neue Dateien pro Tag</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.uploadTrend.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">Noch keine Daten vorhanden</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-end gap-1 h-32">
                        {analytics.uploadTrend.slice(-14).map((d, i) => {
                          const max = Math.max(...analytics.uploadTrend.map(x => x.uploads), 1)
                          const height = (d.uploads / max) * 100
                          return (
                            <div
                              key={i}
                              className="flex-1 bg-primary/80 rounded-t hover:bg-primary transition-colors"
                              style={{ height: `${Math.max(height, 2)}%` }}
                              title={`${formatDate(d.date)}: ${d.uploads} Uploads`}
                            />
                          )
                        })}
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatDate(analytics.uploadTrend[Math.max(0, analytics.uploadTrend.length - 14)]?.date || "")}</span>
                        <span>{formatDate(analytics.uploadTrend[analytics.uploadTrend.length - 1]?.date || "")}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Storage Growth */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    Speicher-Wachstum
                  </CardTitle>
                  <CardDescription>Gesamt-Speichernutzung über Zeit</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.storageGrowth.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">Noch keine Daten vorhanden</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-end gap-1 h-32">
                        {analytics.storageGrowth.slice(-14).map((d, i) => {
                          const max = Math.max(...analytics.storageGrowth.map(x => x.total_bytes), 1)
                          const height = (d.total_bytes / max) * 100
                          return (
                            <div
                              key={i}
                              className="flex-1 bg-blue-500/80 rounded-t hover:bg-blue-500 transition-colors"
                              style={{ height: `${Math.max(height, 2)}%` }}
                              title={`${formatDate(d.date)}: ${formatBytes(d.total_bytes)}`}
                            />
                          )
                        })}
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{formatDate(analytics.storageGrowth[Math.max(0, analytics.storageGrowth.length - 14)]?.date || "")}</span>
                        <span>{formatDate(analytics.storageGrowth[analytics.storageGrowth.length - 1]?.date || "")}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Top Instances */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Top Instanzen
                  </CardTitle>
                  <CardDescription>Nach Speichernutzung</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.topInstances.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Keine Daten</p>
                  ) : (
                    <div className="space-y-3">
                      {analytics.topInstances.slice(0, 5).map((inst, i) => (
                        <div key={inst.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-muted-foreground w-4">{i + 1}</span>
                            <span className="font-medium">{inst.id}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatBytes(inst.storage_bytes)}</p>
                            <p className="text-xs text-muted-foreground">{inst.files.toLocaleString()} Dateien</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Churn Risk */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Churn Risk
                  </CardTitle>
                  <CardDescription>Instanzen ohne Aktivität seit 14+ Tagen</CardDescription>
                </CardHeader>
                <CardContent>
                  {analytics.churnRisk.length === 0 ? (
                    <p className="text-sm text-green-600 flex items-center gap-2">
                      ✓ Keine gefährdeten Instanzen
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {analytics.churnRisk.map((inst) => {
                        const daysSince = Math.floor(
                          (Date.now() - new Date(inst.lastActivity).getTime()) / (24 * 60 * 60 * 1000)
                        )
                        return (
                          <div key={inst.id} className="flex items-center justify-between">
                            <span className="font-medium">{inst.id}</span>
                            <Badge variant="outline" className="text-amber-600">
                              {daysSince} Tage inaktiv
                            </Badge>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
