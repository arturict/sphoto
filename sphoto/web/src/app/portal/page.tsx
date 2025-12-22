"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  ArrowRight,
  Camera,
  Cloud,
  CreditCard,
  Download,
  ExternalLink,
  HardDrive,
  Image,
  Loader2,
  LogOut,
  Sparkles,
  Trash2,
  Video,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.sphoto.arturf.ch"

interface PortalData {
  email: string
  tier: string
  plan: string
  quotaGB: number
  usedGB: number
  percentUsed: number
  photos: number
  videos: number
  instance: "free" | "paid"
  instanceUrl: string
  hasML: boolean
  status: string
  created: string
  isPendingDeletion: boolean
  deletionScheduledFor?: string
  canRequestExport: boolean
  lastExportAt?: string
}

export default function PortalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <PortalContent />
    </Suspense>
  )
}

function PortalContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [token, setToken] = useState<string | null>(null)
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Check for token in URL (magic link) or localStorage
  useEffect(() => {
    const urlToken = searchParams.get("token")
    if (urlToken) {
      // Validate and store token
      validateToken(urlToken)
    } else {
      // Check localStorage
      const storedToken = localStorage.getItem("portal_token")
      if (storedToken) {
        setToken(storedToken)
        fetchDashboard(storedToken)
      } else {
        setLoading(false)
      }
    }
  }, [searchParams])

  async function validateToken(urlToken: string) {
    try {
      const res = await fetch(`${API_URL}/portal/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: urlToken }),
      })
      
      if (!res.ok) {
        setError("Invalid or expired login link")
        setLoading(false)
        return
      }

      const result = await res.json()
      localStorage.setItem("portal_token", result.token)
      setToken(result.token)
      
      // Remove token from URL
      router.replace("/portal")
      
      fetchDashboard(result.token)
    } catch (err) {
      setError("Failed to validate login")
      setLoading(false)
    }
  }

  async function fetchDashboard(authToken: string) {
    try {
      const res = await fetch(`${API_URL}/portal/dashboard`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("portal_token")
          setToken(null)
          setError("Session expired. Please login again.")
        } else {
          setError("Failed to load dashboard")
        }
        setLoading(false)
        return
      }

      const dashboardData = await res.json()
      setData(dashboardData)
      setLoading(false)
    } catch (err) {
      setError("Failed to load dashboard")
      setLoading(false)
    }
  }

  async function handleLogout() {
    if (!token) return
    
    try {
      await fetch(`${API_URL}/portal/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch (err) {
      // Ignore errors
    }
    
    localStorage.removeItem("portal_token")
    setToken(null)
    setData(null)
  }

  async function handleBilling() {
    if (!token) return
    setActionLoading("billing")
    
    try {
      const res = await fetch(`${API_URL}/portal/billing`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      
      const result = await res.json()
      
      if (result.url) {
        window.location.href = result.url
      } else if (result.canUpgrade) {
        // Redirect to pricing for free users
        window.location.href = "/#pricing"
      } else {
        setError(result.error || "Failed to open billing")
      }
    } catch (err) {
      setError("Failed to open billing portal")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeleteAccount() {
    if (!token) return
    setActionLoading("delete")
    
    try {
      const res = await fetch(`${API_URL}/portal/delete-account`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      
      const result = await res.json()
      
      if (result.success) {
        // Refresh dashboard to show pending deletion
        fetchDashboard(token)
      } else {
        setError(result.error || "Failed to request deletion")
      }
    } catch (err) {
      setError("Failed to request deletion")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCancelDeletion() {
    if (!token) return
    setActionLoading("cancel")
    
    try {
      const res = await fetch(`${API_URL}/portal/cancel-deletion`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      
      const result = await res.json()
      
      if (result.success) {
        fetchDashboard(token)
      } else {
        setError(result.error || "Failed to cancel deletion")
      }
    } catch (err) {
      setError("Failed to cancel deletion")
    } finally {
      setActionLoading(null)
    }
  }

  // Login form if not authenticated
  if (!token && !loading) {
    return <LoginForm onSuccess={(t) => { setToken(t); fetchDashboard(t); }} />
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <XCircle className="h-12 w-12 text-destructive" />
        <p className="text-lg">{error}</p>
        <Button onClick={() => { setError(null); setToken(null); }}>
          Try Again
        </Button>
      </div>
    )
  }

  if (!data) return null

  const storageColor = data.percentUsed > 90 ? "bg-destructive" : data.percentUsed > 70 ? "bg-yellow-500" : "bg-primary"

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span>SPhoto</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">{data.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Pending Deletion Warning */}
        {data.isPendingDeletion && (
          <Card className="mb-6 border-destructive bg-destructive/10">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="font-medium text-destructive">Account-Löschung geplant</p>
                  <p className="text-sm text-muted-foreground">
                    Dein Account wird am {new Date(data.deletionScheduledFor!).toLocaleDateString("de-CH")} gelöscht
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleCancelDeletion}
                disabled={actionLoading === "cancel"}
              >
                {actionLoading === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Abbrechen"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Error Toast */}
        {error && data && (
          <Card className="mb-6 border-destructive bg-destructive/10">
            <CardContent className="flex items-center justify-between p-4">
              <p className="text-destructive">{error}</p>
              <Button variant="ghost" size="sm" onClick={() => setError(null)}>×</Button>
            </CardContent>
          </Card>
        )}

        {/* Plan & Storage Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {data.instance === "paid" ? (
                  <Camera className="h-6 w-6 text-primary" />
                ) : (
                  <Cloud className="h-6 w-6 text-muted-foreground" />
                )}
                <div>
                  <CardTitle>{data.plan} Plan</CardTitle>
                  <CardDescription>
                    {data.hasML ? "Mit KI-Features" : "Ohne KI-Features"}
                  </CardDescription>
                </div>
              </div>
              <Badge variant={data.tier === "free" ? "secondary" : "default"}>
                {data.tier === "free" ? "Free" : data.tier === "pro" ? "Pro" : "Basic"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Storage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Speicher</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {data.usedGB.toFixed(1)} / {data.quotaGB} GB
                </span>
              </div>
              <Progress value={data.percentUsed} className={storageColor} />
              <p className="text-xs text-muted-foreground mt-1">
                {data.percentUsed}% verwendet
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Image className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{data.photos.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Fotos</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Video className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{data.videos.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Videos</p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button className="flex-1" asChild>
              <a href={data.instanceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Zu meinen Fotos
              </a>
            </Button>
            {data.tier === "free" ? (
              <Button variant="outline" asChild>
                <Link href="/#pricing">
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Upgrade
                </Link>
              </Button>
            ) : (
              <Button 
                variant="outline" 
                onClick={handleBilling}
                disabled={actionLoading === "billing"}
              >
                {actionLoading === "billing" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Abo verwalten
                  </>
                )}
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Actions */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Export */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Download className="h-5 w-5" />
                Daten exportieren
              </CardTitle>
              <CardDescription>
                Lade alle deine Fotos und Videos herunter
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.canRequestExport ? (
                <p className="text-sm text-muted-foreground">
                  Du kannst einmal pro Monat einen Export anfordern. Der Download-Link wird dir per E-Mail zugeschickt.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Letzter Export: {data.lastExportAt ? new Date(data.lastExportAt).toLocaleDateString("de-CH") : "Nie"}
                  <br />Nächster Export möglich in {30 - Math.floor((Date.now() - new Date(data.lastExportAt!).getTime()) / (1000 * 60 * 60 * 24))} Tagen.
                </p>
              )}
            </CardContent>
            <CardFooter>
              <Button variant="outline" disabled={!data.canRequestExport} className="w-full">
                Export anfordern
              </Button>
            </CardFooter>
          </Card>

          {/* Delete Account */}
          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Account löschen
              </CardTitle>
              <CardDescription>
                Lösche deinen Account und alle Daten
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Nach der Anfrage hast du 14 Tage Zeit, die Löschung abzubrechen. 
                Danach werden alle Daten unwiderruflich gelöscht.
              </p>
            </CardContent>
            <CardFooter>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    disabled={data.isPendingDeletion || actionLoading === "delete"}
                  >
                    {data.isPendingDeletion ? "Löschung bereits geplant" : "Account löschen"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Bist du sicher?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Dein Account wird in 14 Tagen gelöscht. Du kannst die Löschung bis dahin jederzeit abbrechen.
                      <br /><br />
                      <strong>Alle Fotos und Videos werden unwiderruflich gelöscht.</strong>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Ja, Account löschen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          </Card>
        </div>

        {/* Account Info */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Account-Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">E-Mail</span>
              <span>{data.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Erstellt</span>
              <span>{new Date(data.created).toLocaleDateString("de-CH")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Instance</span>
              <span>{data.instanceUrl}</span>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

// Login Form Component
function LoginForm({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${API_URL}/portal/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const result = await res.json()

      if (result.success) {
        setSent(true)
        // Dev mode: auto-login with token
        if (result._devToken) {
          localStorage.setItem("portal_token", result._devToken)
          onSuccess(result._devToken)
        }
      } else {
        setError(result.error || "Failed to send login link")
      }
    } catch (err) {
      setError("Failed to send login link")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Check deine E-Mails</CardTitle>
            <CardDescription>
              Wir haben dir einen Login-Link an <strong>{email}</strong> geschickt.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button variant="ghost" onClick={() => setSent(false)}>
              Andere E-Mail verwenden
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="mx-auto mb-4 flex items-center gap-2 text-xl font-bold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span>SPhoto</span>
          </Link>
          <CardTitle>Portal Login</CardTitle>
          <CardDescription>
            Gib deine E-Mail-Adresse ein, um einen Login-Link zu erhalten.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="deine@email.ch"
              required
              className="w-full h-12 px-4 rounded-lg border bg-background"
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full h-12" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Login-Link senden"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
