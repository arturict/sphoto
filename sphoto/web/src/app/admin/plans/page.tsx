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
  CreditCard,
  RefreshCw,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  HardDrive,
  AlertTriangle,
} from "lucide-react"
import Link from "next/link"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.sphoto.arturf.ch"

interface PlanInfo {
  currentPlan: string
  storageGb: number
  usedBytes: number
  usedGb: number
  percentage: number
  canDowngrade: boolean
  downgradeBlockReason?: string
}

interface Instance {
  id: string
  email: string
  plan: string
  storage_gb: number
  platform: string
  status: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

export default function PlansPage() {
  const [apiKey, setApiKey] = useState("")
  const [isAuthed, setIsAuthed] = useState(false)
  const [instances, setInstances] = useState<Instance[]>([])
  const [planInfos, setPlanInfos] = useState<Record<string, PlanInfo>>({})
  const [loading, setLoading] = useState(false)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: "upgrade" | "downgrade" } | null>(null)

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

  const loadInstances = useCallback(async () => {
    if (!apiKey) return
    setLoading(true)
    try {
      const data = await api("/api/instances")
      setInstances(data.filter((i: Instance) => i.status === "active"))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [api, apiKey])

  const loadPlanInfo = async (instanceId: string) => {
    setLoadingPlan(instanceId)
    try {
      const info = await api(`/api/instances/${instanceId}/plan`)
      setPlanInfos(prev => ({ ...prev, [instanceId]: info }))
    } catch (err) {
      console.error(`Failed to load plan info for ${instanceId}:`, err)
    } finally {
      setLoadingPlan(null)
    }
  }

  useEffect(() => {
    if (isAuthed) {
      loadInstances()
    }
  }, [isAuthed, loadInstances])

  const handleUpgrade = async (instanceId: string) => {
    setActionLoading(instanceId)
    setSuccess(null)
    try {
      const result = await api(`/api/instances/${instanceId}/plan/upgrade`, "POST", {})
      if (result.success) {
        setSuccess(`${instanceId} erfolgreich auf Pro geupgraded!`)
        setConfirmAction(null)
        await loadInstances()
        await loadPlanInfo(instanceId)
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDowngrade = async (instanceId: string) => {
    setActionLoading(instanceId)
    setSuccess(null)
    try {
      const result = await api(`/api/instances/${instanceId}/plan/downgrade`, "POST", {})
      if (result.success) {
        setSuccess(`${instanceId} erfolgreich auf Basic downgraded!`)
        setConfirmAction(null)
        await loadInstances()
        await loadPlanInfo(instanceId)
      } else {
        setError(result.message)
      }
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

  // Separate by plan
  const basicInstances = instances.filter(i => i.plan.toLowerCase() === "basic")
  const proInstances = instances.filter(i => i.plan.toLowerCase() === "pro")

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
              <CreditCard className="h-5 w-5 text-primary" />
              Plan Migration
            </h1>
            <p className="text-sm text-muted-foreground">Upgrade/Downgrade von Instanzen</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadInstances} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
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
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
                <span className="text-xl font-bold">B</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Basic (200 GB)</p>
                <p className="text-2xl font-semibold">{basicInstances.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <span className="text-xl font-bold text-primary">P</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pro (1 TB)</p>
                <p className="text-2xl font-semibold">{proInstances.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <HardDrive className="h-10 w-10 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Gesamt-Speicher</p>
                <p className="text-2xl font-semibold">
                  {instances.reduce((sum, i) => sum + i.storage_gb, 0)} GB
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Migration Info */}
        <Card>
          <CardHeader>
            <CardTitle>Plan-Übersicht</CardTitle>
            <CardDescription>Upgrade/Downgrade Regeln</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUp className="h-5 w-5 text-green-600" />
                  <h4 className="font-semibold text-green-600">Upgrade (Basic → Pro)</h4>
                </div>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>✓ Sofort wirksam</li>
                  <li>✓ Anteilige Verrechnung (Proration)</li>
                  <li>✓ Keine Downtime</li>
                  <li>✓ Quota wird auf 1 TB erhöht</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg border bg-amber-50 dark:bg-amber-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDown className="h-5 w-5 text-amber-600" />
                  <h4 className="font-semibold text-amber-600">Downgrade (Pro → Basic)</h4>
                </div>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>⚠️ Nur wenn Nutzung &lt; 200 GB</li>
                  <li>⚠️ Wirksam zum Billing-Ende</li>
                  <li>✓ Keine Datenverlust</li>
                  <li>✓ Quota wird auf 200 GB gesenkt</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instance List */}
        <Card>
          <CardHeader>
            <CardTitle>Aktive Instanzen</CardTitle>
            <CardDescription>Klicke auf eine Instanz um Details zu laden</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && <p className="text-muted-foreground">Lade...</p>}
            {!loading && instances.length === 0 && (
              <p className="text-muted-foreground">Keine aktiven Instanzen</p>
            )}
            {!loading && instances.length > 0 && (
              <div className="space-y-4">
                {instances.map((instance) => {
                  const info = planInfos[instance.id]
                  const isBasic = instance.plan.toLowerCase() === "basic"
                  const isConfirming = confirmAction?.id === instance.id
                  
                  return (
                    <div key={instance.id} className="p-4 rounded-lg border">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{instance.id}</h4>
                            <Badge variant={isBasic ? "secondary" : "default"}>
                              {instance.plan}
                            </Badge>
                            <Badge variant="outline">{instance.platform}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{instance.email}</p>
                          
                          {/* Plan Info */}
                          {info ? (
                            <div className="mt-3 p-3 rounded bg-muted/50">
                              <div className="flex items-center gap-4 text-sm">
                                <span>
                                  <strong>Speicher:</strong> {info.usedGb.toFixed(1)} GB / {info.storageGb} GB ({info.percentage}%)
                                </span>
                              </div>
                              <div className="w-full h-2 bg-muted rounded-full mt-2 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${info.percentage > 80 ? "bg-amber-500" : "bg-primary"}`}
                                  style={{ width: `${Math.min(info.percentage, 100)}%` }}
                                />
                              </div>
                              {!info.canDowngrade && info.downgradeBlockReason && (
                                <div className="flex items-center gap-2 mt-2 text-xs text-amber-600">
                                  <AlertTriangle className="h-3 w-3" />
                                  {info.downgradeBlockReason}
                                </div>
                              )}
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-2"
                              onClick={() => loadPlanInfo(instance.id)}
                              disabled={loadingPlan === instance.id}
                            >
                              {loadingPlan === instance.id ? "Lade..." : "Details laden"}
                            </Button>
                          )}
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {isBasic ? (
                            // Upgrade button
                            isConfirming && confirmAction?.action === "upgrade" ? (
                              <div className="flex items-center gap-2">
                                <Button 
                                  size="sm"
                                  onClick={() => handleUpgrade(instance.id)}
                                  disabled={actionLoading === instance.id}
                                >
                                  {actionLoading === instance.id ? "..." : "Bestätigen"}
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setConfirmAction(null)}
                                >
                                  Abbrechen
                                </Button>
                              </div>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setConfirmAction({ id: instance.id, action: "upgrade" })}
                              >
                                <ArrowUp className="h-4 w-4 mr-1" />
                                Upgrade
                              </Button>
                            )
                          ) : (
                            // Downgrade button
                            isConfirming && confirmAction?.action === "downgrade" ? (
                              <div className="flex items-center gap-2">
                                <Button 
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleDowngrade(instance.id)}
                                  disabled={actionLoading === instance.id || (info && !info.canDowngrade)}
                                >
                                  {actionLoading === instance.id ? "..." : "Bestätigen"}
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setConfirmAction(null)}
                                >
                                  Abbrechen
                                </Button>
                              </div>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  loadPlanInfo(instance.id)
                                  setConfirmAction({ id: instance.id, action: "downgrade" })
                                }}
                                disabled={info && !info.canDowngrade}
                              >
                                <ArrowDown className="h-4 w-4 mr-1" />
                                Downgrade
                              </Button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
