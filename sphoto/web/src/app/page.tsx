'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  ArrowRight,
  Calendar,
  Camera,
  Check,
  CheckCircle,
  ChevronDown,
  Cloud,
  FileText,
  FolderSync,
  HardDrive,
  Mail,
  Search,
  Shield,
  Smartphone,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { HeroImage } from '@/components/hero-image'
import { GridPattern } from '@/components/ui/background-pattern'
import { ThemeToggle } from '@/components/theme-toggle'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.sphoto.arturf.ch'
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || 'sphoto.arturf.ch'

type Platform = 'immich' | 'nextcloud'

type Plan = {
  id: 'free' | 'basic' | 'pro'
  name: string
  price: string
  description: string
  highlights: string[]
  storage: string
  cta: string
  popular?: boolean
  variant: 'secondary' | 'outline' | 'default'
  immichOnly?: boolean
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '0',
    storage: '5 GB',
    description: 'For testing and small libraries.',
    highlights: ['Mobile apps', 'Automatic backups', 'Web gallery'],
    cta: 'Start for free',
    variant: 'secondary',
    immichOnly: true,
  },
  {
    id: 'basic',
    name: 'Basic',
    price: '5',
    storage: '200 GB',
    description: 'For individuals — enough for years of photos.',
    highlights: ['AI search (faces & objects)', 'EU servers', 'Priority support'],
    cta: 'Choose Basic',
    variant: 'outline',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '15',
    storage: '1 TB',
    description: 'For families — share without chaos.',
    highlights: ['Multiple users', 'Shared albums', 'Everything in Basic'],
    cta: 'Choose Pro',
    popular: true,
    variant: 'default',
  },
]

const immichFeatures = [
  {
    icon: Shield,
    title: 'Privacy first',
    description: 'Encrypted storage in the EU. No tracking, no ads. Your gallery belongs to you — not an ad network.',
  },
  {
    icon: Cloud,
    title: 'EU hosting',
    description: 'Data stored in the EU. You decide what you store and for how long.',
  },
  {
    icon: Smartphone,
    title: 'Automatic backups',
    description: 'iOS & Android apps back up in the background — no hassle, no manual sorting.',
  },
  {
    icon: Search,
    title: 'AI search',
    description: 'Find photos by faces, objects, or location — in seconds instead of scrolling.',
  },
  {
    icon: Users,
    title: 'Family & sharing',
    description: 'Multiple accounts, shared albums, and shared memories — without sharing passwords.',
  },
  {
    icon: HardDrive,
    title: 'Data portability',
    description: 'Export anytime. No lock-in, no hidden barriers.',
  },
]

const nextcloudFeatures = [
  {
    icon: Shield,
    title: 'Privacy first',
    description: 'Your own cloud workspace in the EU. No tracking, no data mining. Full control over your files.',
  },
  {
    icon: FolderSync,
    title: 'File sync',
    description: 'Sync files across all your devices. Desktop, mobile, and web — always in sync.',
  },
  {
    icon: Calendar,
    title: 'Calendar & contacts',
    description: 'Built-in calendar and address book. Sync with your phone and desktop apps.',
  },
  {
    icon: FileText,
    title: 'Office integration',
    description: 'Edit documents, spreadsheets, and presentations directly in the browser.',
  },
  {
    icon: Users,
    title: 'Collaboration',
    description: 'Share folders, comment on files, and work together in real-time.',
  },
  {
    icon: HardDrive,
    title: 'Data portability',
    description: 'Export anytime. Your data, your rules — no vendor lock-in.',
  },
]

const immichFaqs = [
  {
    q: 'What is SPhoto?',
    a: 'SPhoto is a private photo cloud in Europe, powered by Immich. It offers automatic backups, a fast web gallery, and AI search — without tracking.',
  },
  {
    q: 'Can I switch from Google Photos or iCloud?',
    a: 'Yes. You can export your data (e.g., Google Takeout) and then upload it to SPhoto. We can help with the migration if needed.',
  },
  {
    q: 'How secure are my photos?',
    a: 'Access is secured via HTTPS. There are no ads and no tracking. You can export your data and delete your account at any time.',
  },
  {
    q: 'Can I cancel monthly?',
    a: 'Yes. All paid plans are billed monthly and can be cancelled anytime. Your data remains accessible until the end of the billing period.',
  },
]

const nextcloudFaqs = [
  {
    q: 'What is SPhoto Nextcloud?',
    a: 'SPhoto Nextcloud is your private cloud workspace in Europe. Store files, sync calendars, and collaborate — all without tracking or data mining.',
  },
  {
    q: 'Can I switch from Dropbox or Google Drive?',
    a: 'Yes. Simply upload your files to your new Nextcloud instance. The desktop app makes migration easy with drag-and-drop.',
  },
  {
    q: 'What apps are included?',
    a: 'Files, Calendar, Contacts, and Office (document editing). Desktop and mobile apps available for all platforms.',
  },
  {
    q: 'Can I cancel monthly?',
    a: 'Yes. All paid plans are billed monthly and can be cancelled anytime. Your data remains accessible until the end of the billing period.',
  },
]

function isEmail(value: string) {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)
}

export default function Home() {
  const [email, setEmail] = useState('')
  const [platform, setPlatform] = useState<Platform>('immich')
  const validEmail = useMemo(() => isEmail(email), [email])

  const features = platform === 'immich' ? immichFeatures : nextcloudFeatures
  const faqs = platform === 'immich' ? immichFaqs : nextcloudFaqs
  const visiblePlans = platform === 'immich' ? plans : plans.filter(p => !p.immichOnly)

  const handleCheckout = (planId: Plan['id']) => {
    if (!validEmail) return

    const url =
      planId === 'free'
        ? `${API_URL}/signup/free?email=${encodeURIComponent(email)}`
        : `${API_URL}/checkout/${planId}?email=${encodeURIComponent(email)}&platform=${platform}`

    window.location.href = url
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Floating Navbar */}
      <header className="navbar-floating">
        <div className="flex h-14 items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 font-heading font-semibold tracking-tight">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Cloud className="h-4 w-4" />
            </div>
            <span className="text-lg">SPhoto</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm">
            <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#how" className="text-muted-foreground hover:text-foreground transition-colors">
              How it works
            </Link>
            <Link href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">
              FAQ
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <a href="#pricing">Get started</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative pt-24">
        <section className="relative pt-12 pb-24 md:pt-20 md:pb-32 overflow-hidden">
          <GridPattern />
          <div className="container px-4 md:px-6 relative z-10">
            <div className="mx-auto max-w-3xl text-center">
              {/* Platform Selector */}
              <div className="mb-8 flex justify-center animate-fade-in">
                <div className="inline-flex rounded-xl glass-strong p-1.5">
                  <button
                    onClick={() => setPlatform('immich')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      platform === 'immich'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Camera className="h-4 w-4" />
                    Immich Photos
                  </button>
                  <button
                    onClick={() => setPlatform('nextcloud')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      platform === 'nextcloud'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Cloud className="h-4 w-4" />
                    Nextcloud Workspace
                  </button>
                </div>
              </div>

              <Badge variant="secondary" className="mb-8 border-primary/20 bg-primary/5 text-primary animate-fade-in">
                <Sparkles className="mr-1.5 h-3 w-3" />
                Privacy-first + EU Hosting
              </Badge>

              <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-balance leading-[1.1] animate-slide-up">
                {platform === 'immich' ? (
                  <>
                    Your photos,
                    <br />
                    <span className="text-muted-foreground">without data trading.</span>
                  </>
                ) : (
                  <>
                    Your workspace,
                    <br />
                    <span className="text-muted-foreground">fully private.</span>
                  </>
                )}
              </h1>

              <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-balance leading-relaxed animate-slide-up delay-100">
                {platform === 'immich' ? (
                  <>
                    SPhoto is the private alternative to Google Photos: automatic backups, AI search, and sharing.
                    Hosted in Europe — without tracking.
                  </>
                ) : (
                  <>
                    SPhoto Nextcloud is your private workspace: file sync, calendar, contacts, and office apps.
                    Hosted in Europe — without tracking.
                  </>
                )}
              </p>

              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up delay-200">
                <Button size="lg" asChild className="h-12 px-8 text-base btn-cta">
                  <a href="#pricing">
                    {platform === 'immich' ? 'Start for free' : 'Get started'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild className="h-12 px-8 text-base glass">
                  <a href="#features">See features</a>
                </Button>
              </div>

              <div className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm text-muted-foreground animate-fade-in delay-300">
                {platform === 'immich' && (
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-success" />
                    No credit card for Free
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Cancel monthly
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Export anytime
                </div>
              </div>
            </div>

            {platform === 'immich' && <HeroImage />}
          </div>
        </section>

        <section id="features" className="py-24 md:py-32">
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl md:text-4xl font-semibold tracking-tight">Everything you need.</h2>
              <p className="mt-4 text-muted-foreground text-balance text-lg">
                {platform === 'immich'
                  ? 'A modern photo cloud that feels like a product — not a compromise.'
                  : 'A complete workspace that respects your privacy — not your data.'}
              </p>
            </div>

            <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Card key={feature.title} className="bg-card/50 dark:bg-card/30 card-hover border-border/50 cursor-pointer">
                  <CardHeader className="p-6 pb-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/20 mb-4">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="font-heading text-lg font-medium">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-6 pb-6 text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="py-24 md:py-32 section-alt">
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl md:text-4xl font-semibold tracking-tight">How it works</h2>
              <p className="mt-4 text-muted-foreground text-balance text-lg">
                Ready in minutes — no complicated setup.
              </p>
            </div>

            <div className="mt-16 grid gap-6 md:grid-cols-3">
              <Card className="bg-background border-border/50 card-hover cursor-pointer">
                <CardHeader className="p-6 pb-4">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold mb-4">
                    1
                  </div>
                  <CardTitle className="font-heading text-lg font-medium">Create account</CardTitle>
                  <CardDescription>With your email</CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6 text-sm text-muted-foreground">
                  {platform === 'immich'
                    ? 'Start free or choose Basic/Pro directly.'
                    : 'Choose Basic or Pro to get started.'}
                </CardContent>
              </Card>

              <Card className="bg-background border-border/50 card-hover cursor-pointer">
                <CardHeader className="p-6 pb-4">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold mb-4">
                    2
                  </div>
                  <CardTitle className="font-heading text-lg font-medium">Connect apps</CardTitle>
                  <CardDescription>
                    {platform === 'immich' ? 'iOS and Android' : 'Desktop, iOS, and Android'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6 text-sm text-muted-foreground">
                  {platform === 'immich'
                    ? 'Backups run automatically in the background.'
                    : 'Sync files and calendars across all devices.'}
                </CardContent>
              </Card>

              <Card className="bg-background border-border/50 card-hover cursor-pointer">
                <CardHeader className="p-6 pb-4">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold mb-4">
                    3
                  </div>
                  <CardTitle className="font-heading text-lg font-medium">
                    {platform === 'immich' ? 'Search & share' : 'Work & collaborate'}
                  </CardTitle>
                  <CardDescription>
                    {platform === 'immich' ? 'With AI and albums' : 'With your team or family'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6 text-sm text-muted-foreground">
                  {platform === 'immich'
                    ? 'Find instantly and share selectively — without "everything public".'
                    : 'Share folders, edit documents, and collaborate in real-time.'}
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section id="pricing" className="py-24 md:py-32">
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl md:text-4xl font-semibold tracking-tight">Pricing</h2>
              <p className="mt-4 text-muted-foreground text-balance text-lg">
                {platform === 'immich'
                  ? 'Start for free. Upgrade when you need more storage or features.'
                  : 'Simple, transparent pricing. No hidden fees.'}
              </p>
            </div>

            {/* Platform Selector (repeated for pricing section) */}
            <div className="mt-8 flex justify-center">
              <div className="inline-flex rounded-xl glass-strong p-1.5">
                <button
                  onClick={() => setPlatform('immich')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    platform === 'immich'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Camera className="h-4 w-4" />
                  Immich Photos
                </button>
                <button
                  onClick={() => setPlatform('nextcloud')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    platform === 'nextcloud'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Cloud className="h-4 w-4" />
                  Nextcloud Workspace
                </button>
              </div>
            </div>

            <div className="mt-12 max-w-md mx-auto">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  className="pl-12 h-14 text-base bg-background"
                />
                {email && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    {validEmail ? (
                      <CheckCircle className="h-5 w-5 text-success" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                  </div>
                )}
              </div>
              {email && !validEmail && (
                <p className="mt-3 text-sm text-destructive">Please enter a valid email address.</p>
              )}
            </div>

            <div className={`mt-12 grid gap-6 max-w-5xl mx-auto ${visiblePlans.length === 2 ? 'lg:grid-cols-2 max-w-3xl' : 'lg:grid-cols-3'}`}>
              {visiblePlans.map((plan) => (
                <Card
                  key={plan.id}
                  className={`relative bg-background card-hover ${plan.popular ? 'border-primary shadow-lg shadow-primary/10' : 'border-border/50'}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">Popular</Badge>
                    </div>
                  )}
                  <CardHeader className="p-6 text-center">
                    <CardTitle className="font-heading text-lg font-medium">{plan.name}</CardTitle>
                    <CardDescription className="mt-1">{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="px-6 pb-6 text-center">
                    <div className="mb-1">
                      <span className="font-heading text-5xl font-bold tracking-tight">{plan.price}</span>
                      <span className="text-muted-foreground ml-1">CHF/month</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{plan.storage}</span> storage
                    </div>

                    <div className="mt-8 space-y-3 text-sm text-left">
                      {plan.highlights.map((h) => (
                        <div key={h} className="flex items-start gap-3">
                          <Check className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter className="p-6 pt-0">
                    <Button
                      className={`w-full cursor-pointer ${plan.popular ? 'btn-cta' : ''}`}
                      variant={plan.popular ? 'default' : plan.variant}
                      disabled={!validEmail}
                      onClick={() => handleCheckout(plan.id)}
                    >
                      {!validEmail ? 'Enter email' : plan.cta}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>

            <div className="mt-12 text-center">
              <p className="text-sm text-muted-foreground">
                {platform === 'immich'
                  ? 'All plans include web gallery, mobile apps, and export.'
                  : 'All plans include web interface, desktop & mobile apps, and export.'}
              </p>
            </div>
          </div>
        </section>

        <section id="faq" className="py-24 md:py-32 section-alt">
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-heading text-3xl md:text-4xl font-semibold tracking-tight">FAQ</h2>
              <p className="mt-4 text-muted-foreground text-lg">Quick and honest answers.</p>
            </div>

            <div className="mt-12 max-w-2xl mx-auto space-y-3">
              {faqs.map((faq) => (
                <details key={faq.q} className="group rounded-xl border border-border/50 bg-card/50 dark:bg-card/30 p-0 overflow-hidden">
                  <summary className="cursor-pointer list-none select-none p-5 hover:bg-secondary/50 dark:hover:bg-secondary/20 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-heading font-medium text-left">{faq.q}</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform flex-shrink-0" />
                    </div>
                  </summary>
                  <div className="px-5 pb-5">
                    <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 md:py-32">
          <div className="container px-4 md:px-6">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="font-heading text-3xl md:text-4xl font-semibold tracking-tight">
                {platform === 'immich'
                  ? 'Ready for a photo cloud that feels right?'
                  : 'Ready for a workspace that respects your privacy?'}
              </h2>
              <p className="mt-6 text-muted-foreground text-lg text-balance">
                {platform === 'immich'
                  ? 'Start for free and upgrade later — when you realize you don\'t want to go back.'
                  : 'Get started today and experience true data ownership.'}
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" asChild className="btn-cta">
                  <a href="#pricing">
                    {platform === 'immich' ? 'Start for free' : 'Get started'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild className="glass">
                  <a href={`mailto:hello@${DOMAIN}`}>Ask questions</a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-12 bg-card/30 dark:bg-card/10">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Cloud className="h-3.5 w-3.5" />
              </div>
              <span className="font-heading font-semibold">SPhoto</span>
              <span className="text-sm text-muted-foreground">- EU Hosted</span>
            </div>

            <nav className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
              <Link href="#pricing" className="hover:text-foreground transition-colors">
                Pricing
              </Link>
              <Link href="#faq" className="hover:text-foreground transition-colors">
                FAQ
              </Link>
              <a href={`mailto:hello@${DOMAIN}`} className="hover:text-foreground transition-colors">
                Contact
              </a>
              <a
                href={platform === 'immich' ? 'https://immich.app' : 'https://nextcloud.com'}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground transition-colors"
              >
                Powered by {platform === 'immich' ? 'Immich' : 'Nextcloud'}
              </a>
              <Link href="/admin" className="hover:text-foreground transition-colors">
                Admin
              </Link>
            </nav>

            <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} SPhoto</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
