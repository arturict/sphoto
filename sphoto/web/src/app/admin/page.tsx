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
  CheckSquare,
  Clock4,
  ExternalLink,
  Filter,
  HardDrive,
  Mail,
  Play,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Square,
  SquareStack,
  Trash2,
} from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.sphoto.arturf.ch"
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "sphoto.arturf.ch"

interface Instance {
  id: string
  email: string
  plan: "Basic" | "Pro" | string
  storage_gb: number
  status: "active" | "stopped" | "deleted"
  created: string
  stopped_at?: string
}

interface InstanceStats {
  photos: number
  videos: number
  usage: number
  usagePhotos: number
  usageVideos: number
}

type StatusFilter = "all" | Instance["status"]
type PlanFilter = "all" | "Basic" | "Pro"

const statusPalette: Record<Instance["status"], string> = {
  active: "bg-green-500/10 text-green-600",
  stopped: "bg-amber-500/10 text-amber-600",
  deleted: "bg-red-500/10 text-red-600",
}

const statusLabel: Record<Instance["status"], string> = {
  active: "Aktiv",
  stopped: "Gestoppt",
  deleted: "Gelöscht",
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

function getEmailProvider(email: string): "gmail" | "outlook" | "other" {
  const domain = email.split("@")[1]?.toLowerCase() || ""
  if (domain === "gmail.com" || domain === "googlemail.com") return "gmail"
  if (["outlook.com", "hotmail.com", "live.com", "msn.com", "outlook.de", "hotmail.de"].includes(domain)) return "outlook"
  return "other"
}

function EmailButton({ email }: { email: string }) {
  const provider = getEmailProvider(email)
  
  if (provider === "gmail") {
    return (
      <a
        href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email)}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
        title="In Gmail öffnen"
      >
        <Mail className="h-3 w-3" />
        Gmail
      </a>
    )
  }
  
  if (provider === "outlook") {
    return (
      <a
        href={`https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(email)}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
        title="In Outlook öffnen"
      >
        <Mail className="h-3 w-3" />
        Outlook
      </a>
    )
  }
  
  return (
    <a
      href={`mailto:${email}`}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
      title="E-Mail senden"
    >
      <Mail className="h-3 w-3" />
      Mail
    </a>
  )
}

function StorageUsageCell({ 
  instanceId, 
  storageQuota, 
  apiKey,
}: { 
  instanceId: string
  storageQuota: number
  apiKey: string
}) {
  const [stats, setStats] = useState<InstanceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch(`${API_URL}/api/instances/${instanceId}/stats`, {
          headers: {
            'x-api-key': apiKey,
          },
        })
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        } else {
          setError(true)
        }
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [instanceId, apiKey])

  const quotaBytes = storageQuota * 1024 * 1024 * 1024

  if (loading) {
    return <span className="text-muted-foreground text-xs animate-pulse">Laden...</span>
  }

  if (error || !stats) {
    return <span className="text-muted-foreground">{storageQuota} GB</span>
  }

  const usagePercent = quotaBytes > 0 ? Math.round((stats.usage / quotaBytes) * 100) : 0
  const isHigh = usagePercent > 80

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className={isHigh ? "text-amber-600 font-medium" : ""}>
          {formatBytes(stats.usage)}
        </span>
        <span className="text-muted-foreground">/ {storageQuota} GB</span>
      </div>
      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${isHigh ? "bg-amber-500" : "bg-primary"}`}
          style={{ width: `${Math.min(usagePercent, 100)}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground">
        {stats.photos} Fotos · {stats.videos} Videos
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [apiKey, setApiKey] = useState("")
  const [isAuthed, setIsAuthed] = useState(false)
  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<{ query: string; status: StatusFilter; plan: PlanFilter }>({
    query: "",
    status: "all",
    plan: "all",
  })

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("admin_api_key") : null
    if (stored) {
      setApiKey(stored)
      setIsAuthed(true)
    }
  }, [])

  const api = useCallback(async (endpoint: string, method: "GET" | "POST" | "DELETE" = "GET") => {
    if (!apiKey) {
      throw new Error("Kein API Key gesetzt")
    }
    setError(null)
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: {
          "x-api-key": apiKey,
        },
      })

      if (res.status === 401) {
        localStorage.removeItem("admin_api_key")
        setIsAuthed(false)
        setApiKey("")
        throw new Error("API Key ungültig oder abgelaufen")
      }

      if (res.status === 204) {
        return null
      }

      const isJson = res.headers.get("content-type")?.includes("application/json")
      const payload = isJson ? await res.json() : await res.text()

      if (!res.ok) {
        const message = typeof payload === "string" ? payload : payload?.message
        throw new Error(message || "Unbekannter API Fehler")
      }

      return payload
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") {
        return null
      }
      setError(err instanceof Error ? err.message : "Unbekannter Fehler")
      throw err
    }
  }, [apiKey])

  const loadInstances = useCallback(async (options?: { silent?: boolean }) => {
    if (!apiKey) return
    if (!options?.silent) {
      setLoading(true)
    }
    try {
      const data = await api("/api/instances")
      if (Array.isArray(data)) {
        setInstances(data)
        setLastSync(new Date())
        // Clear selection for instances that no longer exist
        setSelectedIds(prev => {
          const existingIds = new Set(data.map((i: Instance) => i.id))
          const newSet = new Set<string>()
          prev.forEach(id => {
            if (existingIds.has(id)) newSet.add(id)
          })
          return newSet
        })
      }
    } catch {
      // Fehler bereits gesetzt
    } finally {
      if (!options?.silent) {
        setLoading(false)
      }
    }
  }, [api, apiKey])

  useEffect(() => {
    if (isAuthed) {
      loadInstances()
    }
  }, [isAuthed, loadInstances])

  useEffect(() => {
    if (!autoRefresh || !isAuthed) return
    const interval = setInterval(() => {
      loadInstances({ silent: true })
    }, 15000)
    return () => clearInterval(interval)
  }, [autoRefresh, isAuthed, loadInstances])

  const handleLogin = () => {
    if (!apiKey) return
    localStorage.setItem("admin_api_key", apiKey)
    setIsAuthed(true)
  }

  const handleLogout = () => {
    localStorage.removeItem("admin_api_key")
    setIsAuthed(false)
    setApiKey("")
    setInstances([])
    setLastSync(null)
    setSelectedIds(new Set())
  }

  const handleAction = async (id: string, action: "start" | "stop" | "delete") => {
    setActionLoading(id)
    try {
      if (action === "delete") {
        await api(`/api/instances/${id}`, "DELETE")
      } else {
        await api(`/api/instances/${id}/${action}`, "POST")
      }
      setDeleteConfirm(null)
      await loadInstances({ silent: true })
    } catch {
      // bereits behandelt
    } finally {
      setActionLoading(null)
    }
  }

  const handleBulkAction = async (action: "stop" | "delete") => {
    if (selectedIds.size === 0) return
    setBulkLoading(true)
    try {
      const promises = Array.from(selectedIds).map(id => {
        if (action === "delete") {
          return api(`/api/instances/${id}`, "DELETE").catch(() => null)
        } else {
          return api(`/api/instances/${id}/${action}`, "POST").catch(() => null)
        }
      })
      await Promise.all(promises)
      setSelectedIds(new Set())
      setBulkDeleteConfirm(false)
      await loadInstances({ silent: true })
    } catch {
      // bereits behandelt
    } finally {
      setBulkLoading(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === sortedInstances.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sortedInstances.map(i => i.id)))
    }
  }

  const resetFilters = () => setFilters({ query: "", status: "all", plan: "all" })
  const filteredInstances = useMemo(() => {
    const normalizedQuery = filters.query.trim().toLowerCase()
    return instances.filter((instance) => {
      const matchesQuery =
        !normalizedQuery ||
        instance.id.toLowerCase().includes(normalizedQuery) ||
        instance.email.toLowerCase().includes(normalizedQuery)
      const matchesPlan = filters.plan === "all" || instance.plan === filters.plan
      const matchesStatus = filters.status === "all" || instance.status === filters.status
      return matchesQuery && matchesPlan && matchesStatus
    })
  }, [instances, filters])

  const sortedInstances = useMemo(() => {
    return [...filteredInstances].sort(
      (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
    )
  }, [filteredInstances])

  const activeCount = instances.filter((instance) => instance.status === "active").length
  const stoppedCount = instances.filter((instance) => instance.status === "stopped").length
  const totalStorage = instances.reduce((sum, instance) => sum + (instance.storage_gb || 0), 0)

  const selectedActiveCount = useMemo(() => {
    return Array.from(selectedIds).filter(id => {
      const inst = instances.find(i => i.id === id)
      return inst?.status === "active"
    }).length
  }, [selectedIds, instances])

  const planBreakdown = useMemo(() => {
    return instances.reduce((acc, instance) => {
      const key = instance.plan || "Unbekannt"
      if (!acc[key]) {
        acc[key] = { count: 0, storage: 0 }
      }
      acc[key].count += 1
      acc[key].storage += instance.storage_gb || 0
      return acc
    }, {} as Record<string, { count: number; storage: number }>)
  }, [instances])

  const planEntries = useMemo(() => {
    const entries = Object.entries(planBreakdown).map(([plan, value]) => ({
      plan,
      ...value,
    }))
    const order = ["Pro", "Basic"]
    return entries.sort((a, b) => {
      const indexA = order.indexOf(a.plan)
      const indexB = order.indexOf(b.plan)
      if (indexA === -1 && indexB === -1) return a.plan.localeCompare(b.plan)
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      return indexA - indexB
    })
  }, [planBreakdown])

  const recentActivity = useMemo(() => {
    return instances
      .map((instance) => {
        const timestamp = instance.stopped_at ? new Date(instance.stopped_at) : new Date(instance.created)
        return {
          id: instance.id,
          label:
            instance.status === "deleted"
              ? "Gelöscht"
              : instance.status === "active"
                ? "Gestartet"
                : "Gestoppt",
          timestamp,
        }
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 5)
  }, [instances])

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 }),
    []
  )

  const formatDate = (value?: string) =>
    value ? new Date(value).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"

  const formatDateTime = (value: Date) =>
    value.toLocaleString("de-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })

  const planOptions: PlanFilter[] = ["all", "Basic", "Pro"]
  const statusOptions: StatusFilter[] = ["all", "active", "stopped", "deleted"]
  if (!isAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span>SPhoto Admin</span>
            </CardTitle>
            <CardDescription>API Key eingeben um die Instanzen zu verwalten.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="Admin API Key"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleLogin()}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={handleLogin} disabled={!apiKey.trim()}>
              Anmelden
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70 sticky top-0 z-20">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xl font-semibold">
              <span className="text-primary">S</span>Photo Dashboard
            </p>
            <p className="text-sm text-muted-foreground">Managed Immich Instanzen</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="secondary">{instances.length} Instanzen</Badge>
            {lastSync && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock4 className="h-4 w-4" />
                Letztes Update {formatDateTime(lastSync)}
              </span>
            )}
            <label className="flex items-center gap-2 text-muted-foreground">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
                className="h-4 w-4 rounded border-muted"
              />
              Auto-Refresh 15s
            </label>
            <Button variant="outline" size="sm" onClick={() => loadInstances()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Aktualisieren
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto space-y-8 px-4 py-8">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <Server className="h-10 w-10 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Instanzen</p>
                <p className="text-2xl font-semibold">{instances.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <Activity className="h-10 w-10 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Aktiv</p>
                <p className="text-2xl font-semibold">{activeCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <AlertTriangle className="h-10 w-10 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Gestoppt</p>
                <p className="text-2xl font-semibold">{stoppedCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <HardDrive className="h-10 w-10 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Speicher</p>
                <p className="text-2xl font-semibold">{numberFormatter.format(totalStorage)} GB</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-4 w-4" />
              Filter
            </CardTitle>
            <CardDescription>Suche nach Subdomain, E-Mail, Status oder Plan.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Suche</label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filters.query}
                  onChange={(event) => setFilters((prev) => ({ ...prev, query: event.target.value }))}
                  className="pl-9"
                  placeholder="artur, nils, kunde@domain.ch"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select
                value={filters.status}
                onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value as StatusFilter }))}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status === "all" ? "Alle" : statusLabel[status]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Plan</label>
              <select
                value={filters.plan}
                onChange={(event) => setFilters((prev) => ({ ...prev, plan: event.target.value as PlanFilter }))}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {planOptions.map((plan) => (
                  <option key={plan} value={plan}>
                    {plan === "all" ? "Alle" : plan}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
          <CardContent className="border-t pt-4">
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Filter zurücksetzen
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[2.6fr,1fr]">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <span>Instanzen</span>
                <div className="flex items-center gap-2">
                  {selectedIds.size > 0 && (
                    <Badge variant="outline" className="font-normal">
                      <CheckSquare className="mr-1 h-3 w-3" />
                      {selectedIds.size} ausgewählt
                    </Badge>
                  )}
                  <Badge variant="secondary">{filteredInstances.length} Ergebnis(se)</Badge>
                </div>
              </CardTitle>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-sm text-muted-foreground">Bulk-Aktionen:</span>
                  {selectedActiveCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkAction("stop")}
                      disabled={bulkLoading}
                    >
                      <Square className="mr-1 h-3 w-3" />
                      {selectedActiveCount} stoppen
                    </Button>
                  )}
                  {bulkDeleteConfirm ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleBulkAction("delete")}
                      disabled={bulkLoading}
                    >
                      {selectedIds.size} löschen bestätigen
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBulkDeleteConfirm(true)}
                      disabled={bulkLoading}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      {selectedIds.size} löschen
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedIds(new Set())
                      setBulkDeleteConfirm(false)
                    }}
                  >
                    Abbrechen
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {loading && (
                <div className="py-6 text-center text-sm text-muted-foreground">Lade Instanzen…</div>
              )}
              {!loading && sortedInstances.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">Keine Instanzen gefunden.</div>
              )}
              {!loading && sortedInstances.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="pb-3 pr-2">
                        <button
                          onClick={toggleSelectAll}
                          className="flex items-center gap-1 hover:text-foreground"
                          title={selectedIds.size === sortedInstances.length ? "Alle abwählen" : "Alle auswählen"}
                        >
                          <SquareStack className="h-4 w-4" />
                        </button>
                      </th>
                      <th className="pb-3">Subdomain</th>
                      <th className="pb-3">Plan</th>
                      <th className="pb-3">Speicher</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Erstellt</th>
                      <th className="pb-3 text-right">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedInstances.map((instance) => {
                      const isDeleted = instance.status === "deleted"
                      const canStop = instance.status === "active"
                      const canStart = instance.status === "stopped"
                      const isSelected = selectedIds.has(instance.id)
                      return (
                        <tr key={instance.id} className={`border-b last:border-0 ${isSelected ? "bg-primary/5" : ""}`}>
                          <td className="py-3 pr-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(instance.id)}
                              className="h-4 w-4 rounded border-muted"
                            />
                          </td>
                          <td className="py-3">
                            <a
                              href={`https://${instance.id}.${DOMAIN}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 font-medium text-primary"
                            >
                              {instance.id}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-foreground">{instance.email}</p>
                              <EmailButton email={instance.email} />
                            </div>
                          </td>
                          <td className="py-3">
                            <Badge variant={instance.plan === "Pro" ? "default" : "secondary"}>{instance.plan}</Badge>
                          </td>
                          <td className="py-3">
                            {instance.status === "active" ? (
                              <StorageUsageCell
                                instanceId={instance.id}
                                storageQuota={instance.storage_gb}
                                apiKey={apiKey}
                              />
                            ) : (
                              <span className="text-muted-foreground">
                                {numberFormatter.format(instance.storage_gb || 0)} GB
                              </span>
                            )}
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusPalette[instance.status]}`}>
                              {statusLabel[instance.status]}
                            </span>
                          </td>
                          <td className="py-3 text-sm text-muted-foreground">{formatDate(instance.created)}</td>
                          <td className="py-3">
                            <div className="flex justify-end gap-2">
                              {(canStart || canStop) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAction(instance.id, canStop ? "stop" : "start")}
                                  disabled={actionLoading === instance.id}
                                >
                                  {canStop ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                </Button>
                              )}
                              {!isDeleted && (
                                deleteConfirm === instance.id ? (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleAction(instance.id, "delete")}
                                    disabled={actionLoading === instance.id}
                                  >
                                    Bestätigen
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteConfirm(instance.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Plan Überblick</CardTitle>
                <CardDescription>Verteilung nach Tarifen</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {planEntries.length === 0 && (
                  <p className="text-sm text-muted-foreground">Noch keine Instanzen.</p>
                )}
                {planEntries.map((entry) => {
                  const percentage = instances.length ? Math.round((entry.count / instances.length) * 100) : 0
                  return (
                    <div key={entry.plan}>
                      <div className="flex items-center justify-between text-sm font-medium">
                        <span>{entry.plan}</span>
                        <span>
                          {entry.count} · {entry.storage} GB
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Aktivitäten</CardTitle>
                <CardDescription>Letzte 5 Ereignisse</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {recentActivity.length === 0 && (
                  <p className="text-muted-foreground">Noch keine Aktivitäten.</p>
                )}
                {recentActivity.map((event) => (
                  <div key={event.id + event.timestamp.toISOString()} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{event.label}</p>
                      <p className="text-xs text-muted-foreground">{event.id}.{DOMAIN}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDateTime(event.timestamp)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
