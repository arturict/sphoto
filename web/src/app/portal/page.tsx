"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
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
  Calendar,
  Camera,
  CheckCircle2,
  Cloud,
  CreditCard,
  Download,
  ExternalLink,
  HardDrive,
  ImageIcon,
  Loader2,
  LogOut,
  Mail,
  Sparkles,
  Trash2,
  X,
  Video,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Shield,
} from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

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

// Helper function to format relative time
function formatMemberSince(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return "Heute"
  if (diffDays === 1) return "Gestern"
  if (diffDays < 7) return `vor ${diffDays} Tagen`
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `vor ${weeks} ${weeks === 1 ? "Woche" : "Wochen"}`
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `vor ${months} ${months === 1 ? "Monat" : "Monaten"}`
  }
  const years = Math.floor(diffDays / 365)
  return `vor ${years} ${years === 1 ? "Jahr" : "Jahren"}`
}

// Format date nicely
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("de-CH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export default function PortalPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Laden...</p>
        </div>
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const fetchDashboard = useCallback(async (authToken: string) => {
    try {
      const res = await fetch(`${API_URL}/portal/dashboard`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("portal_token")
          setToken(null)
          setError("Sitzung abgelaufen. Bitte erneut anmelden.")
        } else {
          setError("Dashboard konnte nicht geladen werden")
        }
        setLoading(false)
        return
      }

      const dashboardData = await res.json()
      setData(dashboardData)
      setLoading(false)
    } catch {
      setError("Dashboard konnte nicht geladen werden")
      setLoading(false)
    }
  }, [])

  const validateToken = useCallback(async (urlToken: string) => {
    try {
      const res = await fetch(`${API_URL}/portal/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: urlToken }),
      })
      
      if (!res.ok) {
        setError("Ungültiger oder abgelaufener Login-Link")
        setLoading(false)
        return
      }

      const result = await res.json()
      localStorage.setItem("portal_token", result.token)
      setToken(result.token)
      
      // Remove token from URL
      router.replace("/portal")
      
      fetchDashboard(result.token)
    } catch {
      setError("Login konnte nicht validiert werden")
      setLoading(false)
    }
  }, [router, fetchDashboard])

  // Check for token in URL (magic link) or localStorage
  useEffect(() => {
    const urlToken = searchParams.get("token")
    if (urlToken) {
      validateToken(urlToken)
    } else {
      const storedToken = localStorage.getItem("portal_token")
      if (storedToken) {
        setToken(storedToken)
        fetchDashboard(storedToken)
      } else {
        setLoading(false)
      }
    }
  }, [searchParams, validateToken, fetchDashboard])

  async function handleLogout() {
    if (!token) return
    
    try {
      await fetch(`${API_URL}/portal/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
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
        window.location.href = "/#pricing"
      } else {
        setError(result.error || "Billing Portal konnte nicht geöffnet werden")
      }
    } catch {
      setError("Billing Portal konnte nicht geöffnet werden")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleUpgrade(plan: 'basic' | 'pro') {
    if (!token) return
    setActionLoading(`upgrade-${plan}`)
    setError(null)
    
    try {
      const res = await fetch(`${API_URL}/portal/upgrade`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      })
      
      const result = await res.json()
      
      if (result.url) {
        // Redirect to Stripe checkout
        window.location.href = result.url
      } else if (result.success) {
        // Instant upgrade (Basic -> Pro)
        setSuccessMessage(result.message || "Upgrade erfolgreich!")
        fetchDashboard(token)
      } else {
        setError(result.error || "Upgrade fehlgeschlagen")
      }
    } catch {
      setError("Upgrade konnte nicht durchgeführt werden")
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
        fetchDashboard(token)
      } else {
        setError(result.error || "Löschung konnte nicht angefordert werden")
      }
    } catch {
      setError("Löschung konnte nicht angefordert werden")
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
        setError(result.error || "Löschung konnte nicht abgebrochen werden")
      }
    } catch {
      setError("Löschung konnte nicht abgebrochen werden")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRequestExport() {
    if (!token || !data?.canRequestExport) return
    setActionLoading("export")
    
    try {
      const res = await fetch(`${API_URL}/portal/request-export`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      
      const result = await res.json()
      
      if (result.success) {
        fetchDashboard(token)
        setError(null)
        // Show success in a simple way
        alert("Export angefordert! Du erhältst eine E-Mail mit dem Download-Link.")
      } else {
        setError(result.error || "Export konnte nicht angefordert werden")
      }
    } catch {
      setError("Export konnte nicht angefordert werden")
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Laden...</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <XCircle className="h-8 w-8 text-destructive" />
        </div>
        <p className="text-lg text-center">{error}</p>
        <Button onClick={() => { setError(null); setToken(null); }} className="cursor-pointer">
          Erneut versuchen
        </Button>
      </div>
    )
  }

  if (!data) return null

  const storageColor = data.percentUsed > 90 ? "bg-destructive" : data.percentUsed > 70 ? "bg-warning" : "bg-primary"
  const tierConfig = {
    free: { label: "Free", color: "bg-secondary text-secondary-foreground", icon: Cloud },
    basic: { label: "Basic", color: "bg-primary text-primary-foreground", icon: Camera },
    pro: { label: "Pro", color: "bg-gradient-to-r from-primary to-purple-600 text-white", icon: Sparkles },
  }
  const currentTier = tierConfig[data.tier as keyof typeof tierConfig] || tierConfig.free
  const TierIcon = currentTier.icon

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-tight hover:opacity-80 transition-opacity cursor-pointer">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
              <Cloud className="h-4 w-4 text-background" />
            </div>
            <span>SPhoto</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block max-w-[200px] truncate">{data.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="cursor-pointer">
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-8 max-w-5xl">
        {/* Pending Deletion Warning */}
        {data.isPendingDeletion && (
          <Card className="mb-6 border-destructive bg-destructive/5 animate-slide-up">
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4">
              <div className="flex items-start sm:items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="font-medium text-destructive">Account-Löschung geplant</p>
                  <p className="text-sm text-muted-foreground">
                    Dein Account wird am {formatDate(data.deletionScheduledFor!)} gelöscht
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleCancelDeletion}
                disabled={actionLoading === "cancel"}
                className="w-full sm:w-auto cursor-pointer"
              >
                {actionLoading === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Löschung abbrechen"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Success Toast */}
        {successMessage && (
          <Card className="mb-6 border-success bg-success/5 animate-slide-up">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-success" />
                <p className="text-success text-sm font-medium">{successMessage}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSuccessMessage(null)} className="cursor-pointer shrink-0" aria-label="Schliessen">
                <X className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Error Toast */}
        {error && data && (
          <Card className="mb-6 border-destructive bg-destructive/5 animate-slide-up">
            <CardContent className="flex items-center justify-between p-4">
              <p className="text-destructive text-sm">{error}</p>
              <Button variant="ghost" size="icon" onClick={() => setError(null)} className="cursor-pointer shrink-0" aria-label="Schliessen">
                <X className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Welcome Section */}
        <div className="mb-6 animate-slide-up">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Willkommen zurück
          </h1>
          <p className="text-muted-foreground mt-1">
            Verwalte dein SPhoto-Konto und deine Fotos
          </p>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          
          {/* Plan Card - Spans 2 columns on lg */}
          <Card className="md:col-span-2 lg:col-span-2 card-hover animate-slide-up">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${currentTier.color}`}>
                    <TierIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{data.plan} Plan</CardTitle>
                    <CardDescription className="flex items-center gap-1.5 mt-0.5">
                      {data.hasML ? (
                        <>
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          <span>Mit KI-Features</span>
                        </>
                      ) : (
                        <span>Standard-Features</span>
                      )}
                    </CardDescription>
                  </div>
                </div>
                <Badge className={`${currentTier.color} px-3 py-1`}>
                  {currentTier.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Storage Bar */}
              <div className="p-4 rounded-xl bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Speicherplatz</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {data.usedGB.toFixed(1)} / {data.quotaGB} GB
                  </span>
                </div>
                <Progress value={data.percentUsed} className={`h-2.5 ${storageColor}`} />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground">
                    {data.percentUsed.toFixed(0)}% verwendet
                  </p>
                  {data.percentUsed > 80 && (
                    <p className="text-xs text-warning font-medium">
                      Speicher fast voll
                    </p>
                  )}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 transition-colors hover:bg-muted/70">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <ImageIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums">{data.photos.toLocaleString("de-CH")}</p>
                    <p className="text-xs text-muted-foreground">Fotos</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 transition-colors hover:bg-muted/70">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Video className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tabular-nums">{data.videos.toLocaleString("de-CH")}</p>
                    <p className="text-xs text-muted-foreground">Videos</p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button className="flex-1 h-11 cursor-pointer" asChild>
                <a href={data.instanceUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Zu meinen Fotos
                </a>
              </Button>
              {data.tier === "free" ? (
                <Button 
                  variant="outline" 
                  className="flex-1 h-11 cursor-pointer border-primary text-primary hover:bg-primary/5"
                  onClick={() => handleUpgrade("basic")}
                  disabled={actionLoading?.startsWith("upgrade")}
                >
                  {actionLoading === "upgrade-basic" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Jetzt upgraden
                    </>
                  )}
                </Button>
              ) : data.tier === "basic" ? (
                <Button 
                  variant="outline" 
                  className="flex-1 h-11 cursor-pointer border-primary text-primary hover:bg-primary/5"
                  onClick={() => handleUpgrade("pro")}
                  disabled={actionLoading?.startsWith("upgrade")}
                >
                  {actionLoading === "upgrade-pro" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Auf Pro upgraden
                    </>
                  )}
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  className="flex-1 h-11 cursor-pointer"
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

          {/* Account Info Card */}
          <Card className="card-hover animate-slide-up delay-100">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-muted-foreground" />
                Konto-Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">E-Mail</p>
                    <p className="text-sm font-medium truncate">{data.email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Mitglied seit</p>
                    <p className="text-sm font-medium">{formatMemberSince(data.created)}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(data.created)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${data.isPendingDeletion ? "bg-destructive" : "bg-success"}`} />
                      <p className="text-sm font-medium">
                        {data.isPendingDeletion ? "Löschung geplant" : "Aktiv"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upgrade Prompt for Free Users */}
          {data.tier === "free" && (
            <Card className="md:col-span-2 lg:col-span-3 bg-gradient-to-br from-primary/5 via-primary/10 to-purple-500/10 border-primary/20 card-hover animate-slide-up delay-200">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                    <Zap className="h-7 w-7 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">Upgrade auf Basic oder Pro</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Erhalte mehr Speicherplatz, KI-Features wie Gesichtserkennung und automatische Kategorisierung, 
                      und unterstütze die Weiterentwicklung von SPhoto.
                    </p>
                  </div>
                </div>
                
                {/* Plan Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Basic Plan */}
                  <div className="p-4 rounded-xl bg-background/80 border">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold">Basic</h4>
                        <p className="text-2xl font-bold">CHF 5<span className="text-sm font-normal text-muted-foreground">/Mt.</span></p>
                      </div>
                      <Camera className="h-8 w-8 text-primary/50" />
                    </div>
                    <ul className="space-y-2 text-sm mb-4">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        200 GB Speicher
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        KI-Features
                      </li>
                    </ul>
                    <Button 
                      className="w-full cursor-pointer" 
                      onClick={() => handleUpgrade("basic")}
                      disabled={actionLoading?.startsWith("upgrade")}
                    >
                      {actionLoading === "upgrade-basic" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Basic wählen"
                      )}
                    </Button>
                  </div>
                  
                  {/* Pro Plan */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/30">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">Pro</h4>
                          <Badge className="bg-primary/20 text-primary text-xs">Beliebt</Badge>
                        </div>
                        <p className="text-2xl font-bold">CHF 15<span className="text-sm font-normal text-muted-foreground">/Mt.</span></p>
                      </div>
                      <Sparkles className="h-8 w-8 text-primary" />
                    </div>
                    <ul className="space-y-2 text-sm mb-4">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        1 TB Speicher
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        Alle KI-Features
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        Prioritäts-Support
                      </li>
                    </ul>
                    <Button 
                      className="w-full btn-cta cursor-pointer" 
                      onClick={() => handleUpgrade("pro")}
                      disabled={actionLoading?.startsWith("upgrade")}
                    >
                      {actionLoading === "upgrade-pro" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Pro wählen"
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Upgrade Prompt for Basic Users */}
          {data.tier === "basic" && (
            <Card className="md:col-span-2 lg:col-span-3 bg-gradient-to-br from-purple-500/5 via-purple-500/10 to-primary/10 border-purple-500/20 card-hover animate-slide-up delay-200">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-purple-500/10">
                    <Sparkles className="h-7 w-7 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">Upgrade auf Pro</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Erweitere auf 1 TB Speicher und erhalte Prioritäts-Support für nur CHF 10 mehr pro Monat.
                    </p>
                  </div>
                  <Button 
                    className="btn-cta h-11 px-6 cursor-pointer shrink-0" 
                    onClick={() => handleUpgrade("pro")}
                    disabled={actionLoading?.startsWith("upgrade")}
                  >
                    {actionLoading === "upgrade-pro" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Auf Pro upgraden
                      </>
                    )}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0" />
                    <span>1 TB statt 200 GB</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0" />
                    <span>Prioritäts-Support</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-purple-500 shrink-0" />
                    <span>Sofortige Aktivierung</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Export Card */}
          <Card className="card-hover animate-slide-up delay-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Download className="h-5 w-5 text-muted-foreground" />
                Daten exportieren
              </CardTitle>
              <CardDescription>
                Alle Fotos und Videos herunterladen
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.canRequestExport ? (
                <p className="text-sm text-muted-foreground">
                  Du kannst einmal pro Monat einen Export anfordern. Der Download-Link wird dir per E-Mail zugeschickt.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Letzter Export: {data.lastExportAt ? formatDate(data.lastExportAt) : "Nie"}
                  </p>
                  {data.lastExportAt && (
                    <p className="text-sm text-muted-foreground">
                      Nächster Export möglich in {Math.max(0, 30 - Math.floor((Date.now() - new Date(data.lastExportAt).getTime()) / (1000 * 60 * 60 * 24)))} Tagen.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                disabled={!data.canRequestExport || actionLoading === "export"} 
                className="w-full cursor-pointer"
                onClick={handleRequestExport}
              >
                {actionLoading === "export" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Export anfordern"
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Delete Account Card */}
          <Card className="border-destructive/20 card-hover animate-slide-up delay-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Account löschen
              </CardTitle>
              <CardDescription>
                Account und alle Daten löschen
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
                    className="w-full cursor-pointer"
                    disabled={data.isPendingDeletion || actionLoading === "delete"}
                  >
                    {data.isPendingDeletion ? "Löschung bereits geplant" : "Account löschen"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Bist du sicher?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3">
                        <p>Dein Account wird in 14 Tagen gelöscht. Du kannst die Löschung bis dahin jederzeit abbrechen.</p>
                        <p className="font-semibold text-destructive">
                          Alle Fotos und Videos werden unwiderruflich gelöscht.
                        </p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="cursor-pointer">Abbrechen</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDeleteAccount} 
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
                    >
                      Ja, Account löschen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardFooter>
          </Card>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t text-center text-sm text-muted-foreground">
          <p>
            Fragen? Kontaktiere uns unter{" "}
            <a href="mailto:support@sphoto.ch" className="text-primary hover:underline cursor-pointer">
              support@sphoto.ch
            </a>
          </p>
        </footer>
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
        setError(result.error || "Login-Link konnte nicht gesendet werden")
      }
    } catch {
      setError("Login-Link konnte nicht gesendet werden")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md animate-scale-up">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <CardTitle className="text-xl">Check deine E-Mails</CardTitle>
            <CardDescription className="mt-2">
              Wir haben dir einen Login-Link an <strong className="text-foreground">{email}</strong> geschickt.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            <p>Der Link ist 15 Minuten gültig. Falls du keine E-Mail erhalten hast, überprüfe deinen Spam-Ordner.</p>
          </CardContent>
          <CardFooter className="justify-center">
            <Button variant="ghost" onClick={() => setSent(false)} className="cursor-pointer">
              Andere E-Mail verwenden
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md animate-scale-up">
        <CardHeader className="text-center pb-4">
          <Link href="/" className="mx-auto mb-4 flex items-center gap-2.5 text-lg font-semibold tracking-tight hover:opacity-80 transition-opacity cursor-pointer">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground">
              <Cloud className="h-5 w-5 text-background" />
            </div>
            <span className="text-xl">SPhoto</span>
          </Link>
          <CardTitle className="text-xl">Portal Login</CardTitle>
          <CardDescription className="mt-1">
            Gib deine E-Mail-Adresse ein, um einen Login-Link zu erhalten.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
                <XCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="deine@email.ch"
                required
                className="w-full h-12 px-4 rounded-xl border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
              />
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Button type="submit" className="w-full h-12 cursor-pointer" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Login-Link senden
                </>
              )}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Noch kein Konto?{" "}
              <Link href="/#pricing" className="text-primary hover:underline cursor-pointer">
                Jetzt registrieren
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
