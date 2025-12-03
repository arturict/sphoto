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
import { Input } from "@/components/ui/input"
import {
  ArrowLeft,
  Palette,
  Image as ImageIcon,
  Type,
  MessageSquare,
  Save,
  Trash2,
  RefreshCw,
} from "lucide-react"
import Link from "next/link"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.sphoto.arturf.ch"

interface BrandingSettings {
  logo_url?: string
  primary_color?: string
  welcome_message?: string
  favicon_url?: string
  app_name?: string
}

interface Instance {
  id: string
  email: string
  plan: string
  status: string
}

export default function BrandingPage() {
  const [apiKey, setApiKey] = useState("")
  const [isAuthed, setIsAuthed] = useState(false)
  const [instances, setInstances] = useState<Instance[]>([])
  const [selectedInstance, setSelectedInstance] = useState<string>("")
  const [branding, setBranding] = useState<BrandingSettings>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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

  const loadBranding = useCallback(async (instanceId: string) => {
    if (!instanceId) return
    setLoading(true)
    try {
      const data = await api(`/api/instances/${instanceId}/branding`)
      setBranding(data || {})
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    if (isAuthed) {
      loadInstances()
    }
  }, [isAuthed, loadInstances])

  useEffect(() => {
    if (selectedInstance) {
      loadBranding(selectedInstance)
    }
  }, [selectedInstance, loadBranding])

  const handleSave = async () => {
    if (!selectedInstance) return
    setSaving(true)
    setSuccess(null)
    try {
      await api(`/api/instances/${selectedInstance}/branding`, "PUT", branding)
      setSuccess("Branding gespeichert!")
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!selectedInstance) return
    setSaving(true)
    try {
      await api(`/api/instances/${selectedInstance}/branding`, "DELETE")
      setBranding({})
      setSuccess("Branding zurückgesetzt!")
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
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
              <Palette className="h-5 w-5 text-primary" />
              Branding / White-Label
            </h1>
            <p className="text-sm text-muted-foreground">Instanz-Personalisierung</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}
        
        {success && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-600">
            {success}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Instanz auswählen</CardTitle>
            <CardDescription>Wähle die Instanz für Branding-Einstellungen</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <select
                value={selectedInstance}
                onChange={(e) => setSelectedInstance(e.target.value)}
                className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">-- Instanz wählen --</option>
                {instances.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.id} ({inst.email}) - {inst.plan}
                  </option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={loadInstances} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {selectedInstance && (
          <>
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Type className="h-4 w-4" />
                    App Name
                  </CardTitle>
                  <CardDescription>Ersetzt &quot;Immich&quot; im UI</CardDescription>
                </CardHeader>
                <CardContent>
                  <Input
                    placeholder="z.B. MeineCloud"
                    value={branding.app_name || ""}
                    onChange={(e) => setBranding({ ...branding, app_name: e.target.value })}
                    maxLength={50}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Akzentfarbe
                  </CardTitle>
                  <CardDescription>Primärfarbe für Buttons & Links</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={branding.primary_color || "#dc2626"}
                      onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                      className="h-10 w-16 rounded cursor-pointer"
                    />
                    <Input
                      placeholder="#dc2626"
                      value={branding.primary_color || ""}
                      onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Logo URL
                  </CardTitle>
                  <CardDescription>Custom Logo für Header</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="https://example.com/logo.png"
                    value={branding.logo_url || ""}
                    onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })}
                  />
                  {branding.logo_url && (
                    <div className="p-4 bg-muted rounded-lg">
                      <img 
                        src={branding.logo_url} 
                        alt="Logo Preview" 
                        className="max-h-16 object-contain"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Favicon URL
                  </CardTitle>
                  <CardDescription>Browser-Tab Icon</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="https://example.com/favicon.ico"
                    value={branding.favicon_url || ""}
                    onChange={(e) => setBranding({ ...branding, favicon_url: e.target.value })}
                  />
                  {branding.favicon_url && (
                    <div className="flex items-center gap-2">
                      <img 
                        src={branding.favicon_url} 
                        alt="Favicon Preview" 
                        className="h-8 w-8 object-contain"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                      <span className="text-sm text-muted-foreground">Vorschau</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Willkommensnachricht
                </CardTitle>
                <CardDescription>Text auf der Login-Seite (max. 500 Zeichen)</CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  placeholder="Willkommen bei deiner persönlichen Photo-Cloud!"
                  value={branding.welcome_message || ""}
                  onChange={(e) => setBranding({ ...branding, welcome_message: e.target.value })}
                  maxLength={500}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {(branding.welcome_message?.length || 0)}/500 Zeichen
                </p>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={handleReset} disabled={saving}>
                <Trash2 className="h-4 w-4 mr-2" />
                Zurücksetzen
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Speichern..." : "Speichern"}
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>CSS-Vorschau</CardTitle>
                <CardDescription>
                  Generiertes CSS für Immich (via <code>/api/instances/{selectedInstance}/custom.css</code>)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                  {generateCssPreview(branding)}
                </pre>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}

function generateCssPreview(branding: BrandingSettings): string {
  const parts: string[] = []
  
  if (branding.primary_color) {
    parts.push(`:root {\n  --immich-primary: ${branding.primary_color};\n}`)
  }
  
  if (branding.logo_url) {
    parts.push(`/* Custom logo */\n.immich-logo { background-image: url('${branding.logo_url}'); }`)
  }
  
  if (branding.welcome_message) {
    parts.push(`/* Welcome message */\n.login-form::before { content: '${branding.welcome_message.slice(0, 50)}...'; }`)
  }
  
  return parts.length > 0 ? parts.join('\n\n') : '/* No custom branding configured */'
}
