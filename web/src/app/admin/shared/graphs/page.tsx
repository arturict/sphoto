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
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Crown,
  DollarSign,
  HardDrive,
  ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
  User,
  Users,
  Video,
} from "lucide-react"
import Link from "next/link"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

type UserTier = "free" | "basic" | "pro"

interface SharedUser {
  id: string
  visibleId: string
  email: string
  tier: UserTier
  instance: "free" | "paid"
  quotaGB: number
  status: "active" | "pending_deletion" | "deleted"
  created: string
  stats?: {
    usedBytes: number
    photos: number
    videos: number
  }
}

interface RevenueData {
  mrr: number
  mrrFormatted: string
  activeSubscriptions: number
  totalCustomers: number
  recentRevenue: number
  recentRevenueFormatted: string
  newSignups30d: number
  churn30d: number
  churnRate: string
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

export default function SharedGraphsPage() {
  const [apiKey, setApiKey] = useState("")
  const [isAuthed, setIsAuthed] = useState(false)
  const [users, setUsers] = useState<SharedUser[]>([])
  const [revenue, setRevenue] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("admin_api_key") : null
    if (stored) {
      setApiKey(stored)
      setIsAuthed(true)
    }
  }, [])

  const api = useCallback(async (endpoint: string) => {
    setError(null)
    const res = await fetch(`${API_URL}${endpoint}`, {
      headers: { "x-api-key": apiKey },
    })

    if (res.status === 401) {
      localStorage.removeItem("admin_api_key")
      setIsAuthed(false)
      throw new Error("API Key ungultig")
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(err.error || `Error ${res.status}`)
    }

    return res.json()
  }, [apiKey])

  const loadData = useCallback(async () => {
    if (!apiKey) return
    setLoading(true)
    try {
      const [usersData, revenueData] = await Promise.all([
        api("/api/shared/users/stats"),
        api("/api/admin/revenue"),
      ])
      if (Array.isArray(usersData)) setUsers(usersData)
      if (revenueData) setRevenue(revenueData)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [api, apiKey])

  useEffect(() => {
    if (isAuthed) {
      loadData()
    }
  }, [isAuthed, loadData])

  const handleLogin = () => {
    if (!apiKey) return
    localStorage.setItem("admin_api_key", apiKey)
    setIsAuthed(true)
  }

  // Computed stats
  const stats = useMemo(() => {
    const activeUsers = users.filter(u => u.status === "active")
    const freeUsers = activeUsers.filter(u => u.tier === "free")
    const basicUsers = activeUsers.filter(u => u.tier === "basic")
    const proUsers = activeUsers.filter(u => u.tier === "pro")

    // Storage by tier
    const storageByTier = {
      free: freeUsers.reduce((sum, u) => sum + (u.stats?.usedBytes || 0), 0),
      basic: basicUsers.reduce((sum, u) => sum + (u.stats?.usedBytes || 0), 0),
      pro: proUsers.reduce((sum, u) => sum + (u.stats?.usedBytes || 0), 0),
    }
    const totalStorage = storageByTier.free + storageByTier.basic + storageByTier.pro

    // Media counts
    const totalPhotos = activeUsers.reduce((sum, u) => sum + (u.stats?.photos || 0), 0)
    const totalVideos = activeUsers.reduce((sum, u) => sum + (u.stats?.videos || 0), 0)

    // User growth by month (last 6 months)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    
    const monthlySignups: Record<string, number> = {}
    users.forEach(u => {
      const date = new Date(u.created)
      if (date >= sixMonthsAgo) {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        monthlySignups[key] = (monthlySignups[key] || 0) + 1
      }
    })

    const sortedMonths = Object.entries(monthlySignups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({
        month,
        label: new Date(month + "-01").toLocaleDateString("de-CH", { month: "short" }),
        count,
      }))

    // Quota utilization
    const quotaUtilization = activeUsers.map(u => {
      const usedGB = (u.stats?.usedBytes || 0) / (1024 * 1024 * 1024)
      return {
        tier: u.tier,
        utilization: u.quotaGB > 0 ? (usedGB / u.quotaGB) * 100 : 0,
      }
    })

    const avgUtilizationByTier = {
      free: freeUsers.length > 0 
        ? quotaUtilization.filter(q => q.tier === "free").reduce((s, q) => s + q.utilization, 0) / freeUsers.length 
        : 0,
      basic: basicUsers.length > 0 
        ? quotaUtilization.filter(q => q.tier === "basic").reduce((s, q) => s + q.utilization, 0) / basicUsers.length 
        : 0,
      pro: proUsers.length > 0 
        ? quotaUtilization.filter(q => q.tier === "pro").reduce((s, q) => s + q.utilization, 0) / proUsers.length 
        : 0,
    }

    return {
      activeUsers: activeUsers.length,
      freeCount: freeUsers.length,
      basicCount: basicUsers.length,
      proCount: proUsers.length,
      storageByTier,
      totalStorage,
      totalPhotos,
      totalVideos,
      monthlySignups: sortedMonths,
      avgUtilizationByTier,
    }
  }, [users])

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
            <Button className="w-full cursor-pointer" onClick={handleLogin}>
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
          <Link href="/admin/shared" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Analytics & Graphs
            </h1>
            <p className="text-sm text-muted-foreground">Shared Mode Statistics</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="cursor-pointer">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && !users.length && (
          <div className="py-12 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading analytics...
          </div>
        )}

        {users.length > 0 && (
          <>
            {/* Revenue Stats */}
            {revenue && (
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                        <p className="text-3xl font-bold text-green-600">{revenue.mrrFormatted}</p>
                      </div>
                      <DollarSign className="h-10 w-10 text-green-500/50" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Active Subscriptions</p>
                        <p className="text-2xl font-semibold">{revenue.activeSubscriptions}</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">New Signups (30d)</p>
                        <p className="text-2xl font-semibold">{revenue.newSignups30d}</p>
                      </div>
                      <Users className="h-8 w-8 text-primary" />
                    </div>
                    <div className="mt-2">
                      <GrowthIndicator value={revenue.newSignups30d > 0 ? 100 : 0} suffix="%" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Churn Rate (30d)</p>
                        <p className="text-2xl font-semibold">{revenue.churnRate}</p>
                      </div>
                      <ArrowDownRight className="h-8 w-8 text-amber-500" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{revenue.churn30d} churned</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* User Distribution */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    User Distribution by Tier
                  </CardTitle>
                  <CardDescription>{stats.activeUsers} active users total</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Visual bar chart */}
                    <div className="flex items-end gap-4 h-40 justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <div 
                          className="w-16 bg-slate-500/80 rounded-t transition-all"
                          style={{ height: `${stats.activeUsers > 0 ? (stats.freeCount / stats.activeUsers) * 100 : 0}%`, minHeight: stats.freeCount > 0 ? "20px" : "4px" }}
                        />
                        <div className="text-center">
                          <p className="text-2xl font-bold">{stats.freeCount}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" /> Free
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div 
                          className="w-16 bg-blue-500/80 rounded-t transition-all"
                          style={{ height: `${stats.activeUsers > 0 ? (stats.basicCount / stats.activeUsers) * 100 : 0}%`, minHeight: stats.basicCount > 0 ? "20px" : "4px" }}
                        />
                        <div className="text-center">
                          <p className="text-2xl font-bold">{stats.basicCount}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> Basic
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div 
                          className="w-16 bg-amber-500/80 rounded-t transition-all"
                          style={{ height: `${stats.activeUsers > 0 ? (stats.proCount / stats.activeUsers) * 100 : 0}%`, minHeight: stats.proCount > 0 ? "20px" : "4px" }}
                        />
                        <div className="text-center">
                          <p className="text-2xl font-bold">{stats.proCount}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Crown className="h-3 w-3" /> Pro
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Percentages */}
                    <div className="flex justify-center gap-6 text-sm">
                      <Badge variant="outline" className="bg-slate-500/10">
                        {stats.activeUsers > 0 ? ((stats.freeCount / stats.activeUsers) * 100).toFixed(0) : 0}% Free
                      </Badge>
                      <Badge variant="outline" className="bg-blue-500/10">
                        {stats.activeUsers > 0 ? ((stats.basicCount / stats.activeUsers) * 100).toFixed(0) : 0}% Basic
                      </Badge>
                      <Badge variant="outline" className="bg-amber-500/10">
                        {stats.activeUsers > 0 ? ((stats.proCount / stats.activeUsers) * 100).toFixed(0) : 0}% Pro
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Storage by Tier */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    Storage by Tier
                  </CardTitle>
                  <CardDescription>{formatBytes(stats.totalStorage)} total used</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Visual bar chart */}
                    <div className="flex items-end gap-4 h-40 justify-center">
                      <div className="flex flex-col items-center gap-2">
                        <div 
                          className="w-16 bg-slate-500/80 rounded-t transition-all"
                          style={{ height: `${stats.totalStorage > 0 ? (stats.storageByTier.free / stats.totalStorage) * 100 : 0}%`, minHeight: stats.storageByTier.free > 0 ? "20px" : "4px" }}
                        />
                        <div className="text-center">
                          <p className="text-lg font-bold">{formatBytes(stats.storageByTier.free)}</p>
                          <p className="text-xs text-muted-foreground">Free</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div 
                          className="w-16 bg-blue-500/80 rounded-t transition-all"
                          style={{ height: `${stats.totalStorage > 0 ? (stats.storageByTier.basic / stats.totalStorage) * 100 : 0}%`, minHeight: stats.storageByTier.basic > 0 ? "20px" : "4px" }}
                        />
                        <div className="text-center">
                          <p className="text-lg font-bold">{formatBytes(stats.storageByTier.basic)}</p>
                          <p className="text-xs text-muted-foreground">Basic</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-2">
                        <div 
                          className="w-16 bg-amber-500/80 rounded-t transition-all"
                          style={{ height: `${stats.totalStorage > 0 ? (stats.storageByTier.pro / stats.totalStorage) * 100 : 0}%`, minHeight: stats.storageByTier.pro > 0 ? "20px" : "4px" }}
                        />
                        <div className="text-center">
                          <p className="text-lg font-bold">{formatBytes(stats.storageByTier.pro)}</p>
                          <p className="text-xs text-muted-foreground">Pro</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* User Growth */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  User Growth (Last 6 Months)
                </CardTitle>
                <CardDescription>New signups per month</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.monthlySignups.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No data available yet</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-end gap-2 h-32">
                      {stats.monthlySignups.map((m, i) => {
                        const max = Math.max(...stats.monthlySignups.map(x => x.count), 1)
                        const height = (m.count / max) * 100
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-xs font-medium">{m.count}</span>
                            <div
                              className="w-full bg-primary/80 rounded-t hover:bg-primary transition-colors"
                              style={{ height: `${Math.max(height, 5)}%` }}
                              title={`${m.label}: ${m.count} signups`}
                            />
                            <span className="text-xs text-muted-foreground">{m.label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Media & Utilization */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Media Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Media Overview
                  </CardTitle>
                  <CardDescription>Total photos and videos stored</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-6 rounded-lg bg-blue-500/10 text-center">
                      <ImageIcon className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                      <p className="text-3xl font-bold">{stats.totalPhotos.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Photos</p>
                    </div>
                    <div className="p-6 rounded-lg bg-purple-500/10 text-center">
                      <Video className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                      <p className="text-3xl font-bold">{stats.totalVideos.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Videos</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total Media</span>
                      <span className="font-medium">{(stats.totalPhotos + stats.totalVideos).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-muted-foreground">Avg per User</span>
                      <span className="font-medium">
                        {stats.activeUsers > 0 
                          ? Math.round((stats.totalPhotos + stats.totalVideos) / stats.activeUsers).toLocaleString()
                          : 0
                        }
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quota Utilization */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Avg Quota Utilization
                  </CardTitle>
                  <CardDescription>How much of their quota users are using</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm flex items-center gap-1">
                          <User className="h-3 w-3" /> Free Tier
                        </span>
                        <span className="text-sm font-medium">{stats.avgUtilizationByTier.free.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3">
                        <div 
                          className="bg-slate-500 h-3 rounded-full transition-all"
                          style={{ width: `${Math.min(stats.avgUtilizationByTier.free, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> Basic Tier
                        </span>
                        <span className="text-sm font-medium">{stats.avgUtilizationByTier.basic.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3">
                        <div 
                          className="bg-blue-500 h-3 rounded-full transition-all"
                          style={{ width: `${Math.min(stats.avgUtilizationByTier.basic, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm flex items-center gap-1">
                          <Crown className="h-3 w-3" /> Pro Tier
                        </span>
                        <span className="text-sm font-medium">{stats.avgUtilizationByTier.pro.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3">
                        <div 
                          className="bg-amber-500 h-3 rounded-full transition-all"
                          style={{ width: `${Math.min(stats.avgUtilizationByTier.pro, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
