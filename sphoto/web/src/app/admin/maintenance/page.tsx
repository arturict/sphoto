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
  Wrench,
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  Play,
  Square,
  Calendar,
  Clock,
  Server,
  AlertTriangle,
  Trash2,
} from "lucide-react"
import Link from "next/link"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.sphoto.arturf.ch"

type MaintenanceType = "update" | "backup" | "migration" | "emergency"
type MaintenanceStatus = "scheduled" | "in_progress" | "completed" | "cancelled"

interface Maintenance {
  id: string
  title: string
  description: string
  type: MaintenanceType
  scheduledStart: string
  scheduledEnd: string
  affectedInstances: string[] | "all"
  status: MaintenanceStatus
  notificationsSent: {
    scheduled: boolean
    reminder: boolean
    started: boolean
    completed: boolean
  }
  createdAt: string
  createdBy: string
  actualStart?: string
  actualEnd?: string
}

const typeLabels: Record<MaintenanceType, string> = {
  update: "Software-Update",
  backup: "Backup-Wartung",
  migration: "Server-Migration",
  emergency: "Notfall-Wartung",
}

const typeIcons: Record<MaintenanceType, string> = {
  update: "🔧",
  backup: "💾",
  migration: "🚀",
  emergency: "⚠️",
}

const statusLabels: Record<MaintenanceStatus, string> = {
  scheduled: "Geplant",
  in_progress: "Läuft",
  completed: "Abgeschlossen",
  cancelled: "Abgesagt",
}

const statusColors: Record<MaintenanceStatus, string> = {
  scheduled: "bg-blue-500/10 text-blue-600",
  in_progress: "bg-amber-500/10 text-amber-600",
  completed: "bg-green-500/10 text-green-600",
  cancelled: "bg-gray-500/10 text-gray-600",
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatDuration(start: string, end: string): string {
  const diff = new Date(end).getTime() - new Date(start).getTime()
  const minutes = Math.round(diff / (1000 * 60))
  if (minutes < 60) return `${minutes} Min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

export default function MaintenancePage() {
  const [apiKey, setApiKey] = useState("")
  const [isAuthed, setIsAuthed] = useState(false)
  const [maintenances, setMaintenances] = useState<Maintenance[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "update" as MaintenanceType,
    scheduledStart: "",
    scheduledEnd: "",
    affectedInstances: "all" as string[] | "all",
  })

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

  const loadMaintenances = useCallback(async () => {
    if (!apiKey) return
    setLoading(true)
    try {
      const data = await api("/api/admin/maintenance")
      setMaintenances(data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [api, apiKey])

  useEffect(() => {
    if (isAuthed) {
      loadMaintenances()
    }
  }, [isAuthed, loadMaintenances])

  const handleCreateMaintenance = async () => {
    if (!formData.title || !formData.scheduledStart || !formData.scheduledEnd) {
      setError("Bitte alle Pflichtfelder ausfüllen")
      return
    }
    
    try {
      await api("/api/admin/maintenance", "POST", {
        ...formData,
        createdBy: "admin",
      })
      setSuccess("Wartung erfolgreich geplant")
      setShowForm(false)
      setFormData({
        title: "",
        description: "",
        type: "update",
        scheduledStart: "",
        scheduledEnd: "",
        affectedInstances: "all",
      })
      await loadMaintenances()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleStartMaintenance = async (id: string) => {
    setActionLoading(id)
    try {
      await api(`/api/admin/maintenance/${id}/start`, "POST")
      setSuccess("Wartung gestartet")
      await loadMaintenances()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCompleteMaintenance = async (id: string) => {
    setActionLoading(id)
    try {
      await api(`/api/admin/maintenance/${id}/complete`, "POST")
      setSuccess("Wartung abgeschlossen")
      await loadMaintenances()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancelMaintenance = async (id: string) => {
    setActionLoading(id)
    try {
      await api(`/api/admin/maintenance/${id}`, "DELETE")
      setSuccess("Wartung abgesagt")
      await loadMaintenances()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleLogin = () => {
    if (!apiKey) return
    localStorage.setItem("admin_api_key", apiKey)
    setIsAuthed(true)
  }

  // Separate maintenances by status
  const scheduled = maintenances.filter(m => m.status === "scheduled")
  const inProgress = maintenances.filter(m => m.status === "in_progress")
  const past = maintenances.filter(m => m.status === "completed" || m.status === "cancelled")

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
              <Wrench className="h-5 w-5 text-primary" />
              Scheduled Maintenance
            </h1>
            <p className="text-sm text-muted-foreground">Wartungsfenster planen und verwalten</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadMaintenances} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Neue Wartung
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
              <Calendar className="h-10 w-10 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Geplant</p>
                <p className="text-2xl font-semibold">{scheduled.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <Clock className="h-10 w-10 text-amber-500" />
              <div>
                <p className="text-sm text-muted-foreground">Läuft</p>
                <p className="text-2xl font-semibold">{inProgress.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <CheckCircle className="h-10 w-10 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Abgeschlossen</p>
                <p className="text-2xl font-semibold">{past.filter(m => m.status === "completed").length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <Server className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Gesamt</p>
                <p className="text-2xl font-semibold">{maintenances.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* New Maintenance Form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Neue Wartung planen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Titel *</label>
                  <Input
                    placeholder="z.B. Software Update v2.5"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Typ</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as MaintenanceType })}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {Object.entries(typeLabels).map(([type, label]) => (
                      <option key={type} value={type}>
                        {typeIcons[type as MaintenanceType]} {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Beschreibung</label>
                <textarea
                  placeholder="Details zur Wartung..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-20"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Start *</label>
                  <Input
                    type="datetime-local"
                    value={formData.scheduledStart}
                    onChange={(e) => setFormData({ ...formData, scheduledStart: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Ende *</label>
                  <Input
                    type="datetime-local"
                    value={formData.scheduledEnd}
                    onChange={(e) => setFormData({ ...formData, scheduledEnd: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleCreateMaintenance}>
                  Wartung planen
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Abbrechen
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* In Progress */}
        {inProgress.length > 0 && (
          <Card className="border-amber-500/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600">
                <Clock className="h-5 w-5" />
                Aktive Wartung
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {inProgress.map((m) => (
                  <div key={m.id} className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{typeIcons[m.type]}</span>
                          <h4 className="font-semibold">{m.title}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{m.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span>Gestartet: {formatDateTime(m.actualStart || m.scheduledStart)}</span>
                          <span>Geplantes Ende: {formatDateTime(m.scheduledEnd)}</span>
                        </div>
                      </div>
                      <Button 
                        onClick={() => handleCompleteMaintenance(m.id)}
                        disabled={actionLoading === m.id}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Abschliessen
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Scheduled */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Geplante Wartungen
            </CardTitle>
            <CardDescription>Bevorstehende Wartungsfenster</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && <p className="text-muted-foreground">Lade...</p>}
            {!loading && scheduled.length === 0 && (
              <p className="text-muted-foreground">Keine geplanten Wartungen</p>
            )}
            {!loading && scheduled.length > 0 && (
              <div className="space-y-4">
                {scheduled.map((m) => (
                  <div key={m.id} className="p-4 rounded-lg border">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{typeIcons[m.type]}</span>
                          <h4 className="font-semibold">{m.title}</h4>
                          <Badge className={statusColors[m.status]}>{statusLabels[m.status]}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{m.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span>{formatDateTime(m.scheduledStart)}</span>
                          <span>→</span>
                          <span>{formatDateTime(m.scheduledEnd)}</span>
                          <span>({formatDuration(m.scheduledStart, m.scheduledEnd)})</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          {m.notificationsSent.scheduled && <Badge variant="outline">📧 48h</Badge>}
                          {m.notificationsSent.reminder && <Badge variant="outline">📧 2h</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleStartMaintenance(m.id)}
                          disabled={actionLoading === m.id}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleCancelMaintenance(m.id)}
                          disabled={actionLoading === m.id}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Past Maintenances */}
        {past.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-muted-foreground" />
                Vergangene Wartungen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {past.slice(0, 10).map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <span>{typeIcons[m.type]}</span>
                      <div>
                        <p className="font-medium">{m.title}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(m.scheduledStart)}</p>
                      </div>
                    </div>
                    <Badge className={statusColors[m.status]}>{statusLabels[m.status]}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
