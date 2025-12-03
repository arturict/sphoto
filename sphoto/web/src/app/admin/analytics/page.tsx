"use client"

import { useCallback, useEffect, useState, useMemo } from "react"
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
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
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

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-CH", { day: "2-digit", month: "short", year: "numeric" })
}

function GrowthIndicator({ value, suffix = "" }: { value: number; suffix?: string }) {
  const isPositive = value > 0
  const isZero = value === 0
  const Icon = isPositive ? ArrowUpRight : isZero ? null : ArrowDownRight
  const color = isPositive ? "text-green-600" : isZero ? "text-muted-foreground" : "text-red-600"
  
  return (
    <span className={`flex items-center gap-0.5 text-sm font-medium ${color}`}>
      {Icon && <Icon className="h-4 w-4" />}
      {isPositive ? "+" : ""}{value.toFixed(1)}{suffix}
    </span>
  )
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

  // Computed analytics values
  const computedStats = useMemo(() => {
    if (!analytics) return null
    
    const uploadTrend = analytics.uploadTrend
    const storageGrowth = analytics.storageGrowth
    
    // Total uploads
    const totalUploads = uploadTrend.reduce((sum, d) => sum + d.uploads, 0)
    
    // Average uploads per day
    const avgUploadsPerDay = uploadTrend.length > 0 ? totalUploads / uploadTrend.length : 0
    
    // Upload growth (compare first half to second half)
    const halfIdx = Math.floor(uploadTrend.length / 2)
    const firstHalf = uploadTrend.slice(0, halfIdx)
    const secondHalf = uploadTrend.slice(halfIdx)
    const firstHalfAvg = firstHalf.length > 0 ? firstHalf.reduce((s, d) => s + d.uploads, 0) / firstHalf.length : 0
    const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((s, d) => s + d.uploads, 0) / secondHalf.length : 0
    const uploadGrowthPercent = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0
    
    // Storage stats
    const latestStorage = storageGrowth[storageGrowth.length - 1]?.total_bytes || 0
    const firstStorage = storageGrowth[0]?.total_bytes || 0
    const storageGrowthBytes = latestStorage - firstStorage
    const storageGrowthPercent = firstStorage > 0 ? ((latestStorage - firstStorage) / firstStorage) * 100 : 0
    
    // Peak day
    const peakDay = uploadTrend.length > 0 
      ? uploadTrend.reduce((max, d) => d.uploads > max.uploads ? d : max, uploadTrend[0])
      : null
    
    // Instance utilization
    const totalInstances = analytics.activeInstances + analytics.inactiveInstances
    const utilizationPercent = totalInstances > 0 ? (analytics.activeInstances / totalInstances) * 100 : 0
    
    // Average storage per instance
    const avgStoragePerInstance = analytics.topInstances.length > 0
      ? analytics.topInstances.reduce((s, i) => s + i.storage_bytes, 0) / analytics.topInstances.length
      : 0
    
    // Total files
    const totalFiles = analytics.topInstances.reduce((s, i) => s + i.files, 0)
    
    return {
      totalUploads,
      avgUploadsPerDay,
      uploadGrowthPercent,
      latestStorage,
      storageGrowthBytes,
      storageGrowthPercent,
      peakDay,
      utilizationPercent,
      avgStoragePerInstance,
      totalFiles,
    }
  }, [analytics])

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
              <option value={14}>14 Tage</option>
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

        {analytics && computedStats && (
          <>
            {/* Primary Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Uploads ({days}d)</p>
                      <p className="text-2xl font-semibold">{computedStats.totalUploads.toLocaleString()}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <GrowthIndicator value={computedStats.uploadGrowthPercent} suffix="%" />
                    <span className="text-xs text-muted-foreground">vs. Vorperiode</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Gesamt-Speicher</p>
                      <p className="text-2xl font-semibold">{formatBytes(computedStats.latestStorage)}</p>
                    </div>
                    <HardDrive className="h-8 w-8 text-blue-500" />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <GrowthIndicator value={computedStats.storageGrowthPercent} suffix="%" />
                    <span className="text-xs text-muted-foreground">+{formatBytes(computedStats.storageGrowthBytes)}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Aktive Instanzen</p>
                      <p className="text-2xl font-semibold">{analytics.activeInstances}</p>
                    </div>
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {computedStats.utilizationPercent.toFixed(0)}% Auslastung
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Churn Risk</p>
                      <p className="text-2xl font-semibold">{analytics.churnRisk.length}</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-amber-500" />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">14+ Tage inaktiv</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Secondary Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Activity className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Ø Uploads/Tag</p>
                      <p className="text-lg font-semibold">{computedStats.avgUploadsPerDay.toFixed(1)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                      <HardDrive className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Ø Speicher/Instanz</p>
                      <p className="text-lg font-semibold">{formatBytes(computedStats.avgStoragePerInstance)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                      <BarChart3 className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Dateien</p>
                      <p className="text-lg font-semibold">{computedStats.totalFiles.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {computedStats.peakDay && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                        <Calendar className="h-5 w-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Peak Tag</p>
                        <p className="text-lg font-semibold">{computedStats.peakDay.uploads} Uploads</p>
                        <p className="text-xs text-muted-foreground">{formatFullDate(computedStats.peakDay.date)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
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
