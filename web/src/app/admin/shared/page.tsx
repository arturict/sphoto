"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
  Activity,
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Cloud,
  Crown,
  ExternalLink,
  Filter,
  HardDrive,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
  Users,
  XCircle,
} from "lucide-react"
import Link from "next/link"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "localhost"

type UserTier = "free" | "basic" | "pro"

interface SharedUser {
  id: string
  visibleId: string
  email: string
  immichUserId: string
  tier: UserTier
  instance: "free" | "paid"
  quotaGB: number
  status: "active" | "pending_deletion" | "deleted"
  created: string
  deletionScheduledFor?: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
}

interface SharedInstanceStats {
  totalUsers: number
  storageUsedBytes: number
  storageQuotaBytes: number
}

interface SharedInstances {
  deploymentMode: string
  instances: {
    free: {
      url: string
      healthy: boolean
      healthMessage: string
      hasML: boolean
      stats: SharedInstanceStats | null
    }
    paid: {
      url: string
      healthy: boolean
      healthMessage: string
      hasML: boolean
      stats: SharedInstanceStats | null
    }
  }
}

type TierFilter = "all" | UserTier
type InstanceFilter = "all" | "free" | "paid"
type StatusFilter = "all" | SharedUser["status"]
type SortField = "created" | "email" | "tier" | "quotaGB"
type SortOrder = "asc" | "desc"

const tierColors: Record<UserTier, string> = {
  free: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  basic: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  pro: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
}

const tierIcons: Record<UserTier, React.ReactNode> = {
  free: <User className="h-3 w-3" />,
  basic: <Sparkles className="h-3 w-3" />,
  pro: <Crown className="h-3 w-3" />,
}

const statusColors: Record<SharedUser["status"], string> = {
  active: "bg-green-500/10 text-green-600 dark:text-green-400",
  pending_deletion: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  deleted: "bg-red-500/10 text-red-600 dark:text-red-400",
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

function formatDate(value?: string) {
  return value
    ? new Date(value).toLocaleDateString("de-CH", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—"
}

export default function SharedAdminPage() {
  const [apiKey, setApiKey] = useState("")
  const [isAuthed, setIsAuthed] = useState(false)
  const [users, setUsers] = useState<SharedUser[]>([])
  const [instances, setInstances] = useState<SharedInstances | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filters, setFilters] = useState<{
    query: string
    tier: TierFilter
    instance: InstanceFilter
    status: StatusFilter
  }>({
    query: "",
    tier: "all",
    instance: "all",
    status: "all",
  })
  const [sortConfig, setSortConfig] = useState<{ field: SortField; order: SortOrder }>({
    field: "created",
    order: "desc",
  })

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("admin_api_key") : null
    if (stored) {
      setApiKey(stored)
      setIsAuthed(true)
    }
  }, [])

  const api = useCallback(
    async (endpoint: string, method: "GET" | "POST" | "DELETE" = "GET") => {
      if (!apiKey) throw new Error("No API key set")
      setError(null)
      try {
        const res = await fetch(`${API_URL}${endpoint}`, {
          method,
          headers: { "x-api-key": apiKey },
        })

        if (res.status === 401) {
          localStorage.removeItem("admin_api_key")
          setIsAuthed(false)
          setApiKey("")
          throw new Error("Invalid or expired API key")
        }

        if (res.status === 204) return null

        const isJson = res.headers.get("content-type")?.includes("application/json")
        const payload = isJson ? await res.json() : await res.text()

        if (!res.ok) {
          throw new Error(typeof payload === "string" ? payload : payload?.error || "API error")
        }

        return payload
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return null
        setError(err instanceof Error ? err.message : "Unknown error")
        throw err
      }
    },
    [apiKey]
  )

  const loadData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!apiKey) return
      if (!options?.silent) setLoading(true)
      try {
        const [usersData, instancesData] = await Promise.all([
          api("/api/shared/users"),
          api("/api/shared/instances"),
        ])
        if (Array.isArray(usersData)) setUsers(usersData)
        if (instancesData) setInstances(instancesData)
        setLastSync(new Date())
      } catch {
        // error already set
      } finally {
        if (!options?.silent) setLoading(false)
      }
    },
    [api, apiKey]
  )

  useEffect(() => {
    if (isAuthed) loadData()
  }, [isAuthed, loadData])

  useEffect(() => {
    if (!autoRefresh || !isAuthed) return
    const interval = setInterval(() => loadData({ silent: true }), 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, isAuthed, loadData])

  const handleLogin = () => {
    if (!apiKey) return
    localStorage.setItem("admin_api_key", apiKey)
    setIsAuthed(true)
  }

  const handleLogout = () => {
    localStorage.removeItem("admin_api_key")
    setIsAuthed(false)
    setApiKey("")
    setUsers([])
    setInstances(null)
    setLastSync(null)
  }

  const handleDeleteUser = async (userId: string, force: boolean = false) => {
    setActionLoading(userId)
    try {
      await api(`/api/shared/users/${userId}${force ? "/force" : ""}`, "DELETE")
      setDeleteConfirm(null)
      await loadData({ silent: true })
    } catch {
      // already handled
    } finally {
      setActionLoading(null)
    }
  }

  const handleSort = (field: SortField) => {
    setSortConfig((prev) => ({
      field,
      order: prev.field === field && prev.order === "asc" ? "desc" : "asc",
    }))
  }

  const filteredUsers = useMemo(() => {
    const q = filters.query.trim().toLowerCase()
    return users.filter((user) => {
      const matchesQuery =
        !q || user.email.toLowerCase().includes(q) || user.visibleId.toLowerCase().includes(q)
      const matchesTier = filters.tier === "all" || user.tier === filters.tier
      const matchesInstance = filters.instance === "all" || user.instance === filters.instance
      const matchesStatus = filters.status === "all" || user.status === filters.status
      return matchesQuery && matchesTier && matchesInstance && matchesStatus
    })
  }, [users, filters])

  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      const { field, order } = sortConfig
      let comparison = 0
      switch (field) {
        case "created":
          comparison = new Date(a.created).getTime() - new Date(b.created).getTime()
          break
        case "email":
          comparison = a.email.localeCompare(b.email)
          break
        case "tier":
          const tierOrder = { free: 0, basic: 1, pro: 2 }
          comparison = tierOrder[a.tier] - tierOrder[b.tier]
          break
        case "quotaGB":
          comparison = a.quotaGB - b.quotaGB
          break
      }
      return order === "asc" ? comparison : -comparison
    })
  }, [filteredUsers, sortConfig])

  // Stats
  const freeCount = users.filter((u) => u.tier === "free").length
  const basicCount = users.filter((u) => u.tier === "basic").length
  const proCount = users.filter((u) => u.tier === "pro").length
  const activeCount = users.filter((u) => u.status === "active").length
  const totalQuota = users.reduce((sum, u) => sum + u.quotaGB, 0)

  if (!isAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span>SPhoto Admin</span>
            </CardTitle>
            <CardDescription>Enter your API key to manage shared users.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="Admin API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full cursor-pointer" onClick={handleLogin} disabled={!apiKey.trim()}>
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70 sticky top-0 z-20">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xl font-semibold">
              <span className="text-primary">S</span>Photo Admin
            </p>
            <p className="text-sm text-muted-foreground">Shared Mode • {users.length} users</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link href="/admin">
              <Button variant="outline" size="sm" className="cursor-pointer">
                <Server className="mr-2 h-4 w-4" />
                Siloed Mode
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadData()}
              disabled={loading}
              className="cursor-pointer"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 space-y-6">
        {error && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Instance Health Cards */}
        {instances && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className={instances.instances.free.healthy ? "" : "border-destructive"}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Cloud className="h-4 w-4" />
                    Free Instance
                  </CardTitle>
                  {instances.instances.free.healthy ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Healthy
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="mr-1 h-3 w-3" />
                      Unhealthy
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">URL</span>
                  <a
                    href={instances.instances.free.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    {instances.instances.free.url.replace("https://", "")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">ML Features</span>
                  <span>{instances.instances.free.hasML ? "Yes" : "No"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Users</span>
                  <span>{freeCount}</span>
                </div>
              </CardContent>
            </Card>

            <Card className={instances.instances.paid.healthy ? "" : "border-destructive"}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Paid Instance
                  </CardTitle>
                  {instances.instances.paid.healthy ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-600">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Healthy
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="mr-1 h-3 w-3" />
                      Unhealthy
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">URL</span>
                  <a
                    href={instances.instances.paid.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    {instances.instances.paid.url.replace("https://", "")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">ML Features</span>
                  <span>{instances.instances.paid.hasML ? "Yes" : "No"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Users</span>
                  <span>{basicCount + proCount}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <Users className="h-10 w-10 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-semibold">{users.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <User className="h-10 w-10 text-slate-500" />
              <div>
                <p className="text-sm text-muted-foreground">Free</p>
                <p className="text-2xl font-semibold">{freeCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <Sparkles className="h-10 w-10 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Basic</p>
                <p className="text-2xl font-semibold">{basicCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <Crown className="h-10 w-10 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Pro</p>
                <p className="text-2xl font-semibold">{proCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <HardDrive className="h-10 w-10 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Quota</p>
                <p className="text-2xl font-semibold">{totalQuota} GB</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-5">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filters.query}
                  onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}
                  className="pl-9"
                  placeholder="Email or ID..."
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tier</label>
              <select
                value={filters.tier}
                onChange={(e) => setFilters((prev) => ({ ...prev, tier: e.target.value as TierFilter }))}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm cursor-pointer"
              >
                <option value="all">All</option>
                <option value="free">Free</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Instance</label>
              <select
                value={filters.instance}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, instance: e.target.value as InstanceFilter }))
                }
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm cursor-pointer"
              >
                <option value="all">All</option>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, status: e.target.value as StatusFilter }))
                }
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm cursor-pointer"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="pending_deletion">Pending Deletion</option>
                <option value="deleted">Deleted</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Users ({sortedUsers.length})</CardTitle>
              {lastSync && (
                <span className="text-xs text-muted-foreground">
                  Last sync: {lastSync.toLocaleTimeString("de-CH")}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : sortedUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {users.length === 0 ? "No users yet" : "No users match your filters"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th
                        className="text-left py-3 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => handleSort("email")}
                      >
                        <span className="flex items-center gap-1">
                          Email
                          <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </th>
                      <th
                        className="text-left py-3 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => handleSort("tier")}
                      >
                        <span className="flex items-center gap-1">
                          Tier
                          <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Instance</th>
                      <th
                        className="text-left py-3 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => handleSort("quotaGB")}
                      >
                        <span className="flex items-center gap-1">
                          Quota
                          <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </th>
                      <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                      <th
                        className="text-left py-3 px-2 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                        onClick={() => handleSort("created")}
                      >
                        <span className="flex items-center gap-1">
                          Created
                          <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </th>
                      <th className="text-right py-3 px-2 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedUsers.map((user) => (
                      <tr key={user.visibleId} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-2">
                          <div>
                            <span className="font-medium">{user.email}</span>
                            <span className="block text-xs text-muted-foreground">{user.visibleId}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <Badge className={`${tierColors[user.tier]} gap-1`}>
                            {tierIcons[user.tier]}
                            {user.tier.charAt(0).toUpperCase() + user.tier.slice(1)}
                          </Badge>
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant="outline">{user.instance}</Badge>
                        </td>
                        <td className="py-3 px-2">{user.quotaGB} GB</td>
                        <td className="py-3 px-2">
                          <Badge className={statusColors[user.status]}>
                            {user.status === "active"
                              ? "Active"
                              : user.status === "pending_deletion"
                              ? "Pending Delete"
                              : "Deleted"}
                          </Badge>
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">{formatDate(user.created)}</td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {user.stripeCustomerId && (
                              <a
                                href={`https://dashboard.stripe.com/test/customers/${user.stripeCustomerId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-muted-foreground hover:text-foreground transition-colors"
                                title="View in Stripe"
                              >
                                <TrendingUp className="h-4 w-4" />
                              </a>
                            )}
                            {deleteConfirm === user.visibleId ? (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDeleteUser(user.visibleId, true)}
                                  disabled={actionLoading === user.visibleId}
                                  className="cursor-pointer"
                                >
                                  {actionLoading === user.visibleId ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    "Confirm"
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDeleteConfirm(null)}
                                  className="cursor-pointer"
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setDeleteConfirm(user.visibleId)}
                                className="text-destructive hover:text-destructive cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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
