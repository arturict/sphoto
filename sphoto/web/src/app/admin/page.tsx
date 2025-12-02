"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  RefreshCw, Server, HardDrive, Play, Square, Trash2, 
  ExternalLink, Users, Activity, AlertTriangle
} from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.sphoto.arturf.ch"
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "sphoto.arturf.ch"

interface Instance {
  id: string
  email: string
  plan: string
  storage_gb: number
  status: "active" | "stopped" | "deleted"
  created: string
  stopped_at?: string
}

export default function AdminPage() {
  const [apiKey, setApiKey] = useState("")
  const [isAuthed, setIsAuthed] = useState(false)
  const [instances, setInstances] = useState<Instance[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem("admin_api_key")
    if (stored) {
      setApiKey(stored)
      setIsAuthed(true)
    }
  }, [])

  const api = useCallback(async (endpoint: string, method = "GET") => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers: { "x-api-key": apiKey }
    })
    if (res.status === 401) {
      localStorage.removeItem("admin_api_key")
      setIsAuthed(false)
      setApiKey("")
      return null
    }
    return res.json()
  }, [apiKey])

  const loadInstances = useCallback(async () => {
    if (!apiKey) return
    setLoading(true)
    const data = await api("/api/instances")
    if (data) setInstances(data)
    setLoading(false)
  }, [api, apiKey])

  useEffect(() => {
    if (isAuthed) loadInstances()
  }, [isAuthed, loadInstances])

  const handleLogin = () => {
    localStorage.setItem("admin_api_key", apiKey)
    setIsAuthed(true)
  }

  const handleAction = async (id: string, action: "start" | "stop" | "delete") => {
    setActionLoading(id)
    if (action === "delete") {
      await api(`/api/instances/${id}`, "DELETE")
    } else {
      await api(`/api/instances/${id}/${action}`, "POST")
    }
    setDeleteConfirm(null)
    await loadInstances()
    setActionLoading(null)
  }

  // Stats
  const activeCount = instances.filter(i => i.status === "active").length
  const stoppedCount = instances.filter(i => i.status === "stopped").length
  const totalStorage = instances.reduce((sum, i) => sum + (i.storage_gb || 0), 0)

  if (!isAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-primary">S</span>Photo Admin
            </CardTitle>
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
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">
            <span className="text-primary">S</span>Photo Admin
          </h1>
          <div className="flex items-center gap-4">
            <Badge variant="secondary">{instances.length} Instances</Badge>
            <Button variant="outline" size="sm" onClick={loadInstances} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Server className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-3xl font-bold">{instances.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Activity className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-3xl font-bold text-green-500">{activeCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Stopped</p>
                  <p className="text-3xl font-bold text-yellow-500">{stoppedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <HardDrive className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Storage</p>
                  <p className="text-3xl font-bold text-blue-500">{totalStorage} GB</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Instances Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Instances
            </CardTitle>
          </CardHeader>
          <CardContent>
            {instances.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Keine Instanzen gefunden
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">ID</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Email</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Plan</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Storage</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Created</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {instances.map((instance) => (
                      <tr key={instance.id} className="border-b hover:bg-muted/50">
                        <td className="py-3 px-4">
                          <a 
                            href={`https://${instance.id}.${DOMAIN}`} 
                            target="_blank" 
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            {instance.id}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </td>
                        <td className="py-3 px-4 text-sm">{instance.email}</td>
                        <td className="py-3 px-4">
                          <Badge variant={instance.plan === "Pro" ? "default" : "secondary"}>
                            {instance.plan}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm">{instance.storage_gb} GB</td>
                        <td className="py-3 px-4">
                          <Badge variant={instance.status === "active" ? "success" : "warning"}>
                            {instance.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {new Date(instance.created).toLocaleDateString("de-CH")}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-2">
                            {instance.status === "active" ? (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleAction(instance.id, "stop")}
                                disabled={actionLoading === instance.id}
                              >
                                <Square className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleAction(instance.id, "start")}
                                disabled={actionLoading === instance.id}
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                            )}
                            {deleteConfirm === instance.id ? (
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => handleAction(instance.id, "delete")}
                                disabled={actionLoading === instance.id}
                              >
                                Confirm
                              </Button>
                            ) : (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setDeleteConfirm(instance.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
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
