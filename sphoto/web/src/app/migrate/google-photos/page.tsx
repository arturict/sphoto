import { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ArrowRight, CheckCircle, Download, ExternalLink, Key, Terminal, Upload, Sparkles } from "lucide-react"

export const metadata: Metadata = {
  title: "Von Google Photos wechseln | SPhoto",
  description: "Übertrage alle deine Fotos und Videos von Google Photos zu SPhoto. Schritt-für-Schritt Anleitung.",
}

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "sphoto.arturf.ch"

export default function GooglePhotosMigrationPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold">
            <Sparkles className="h-6 w-6 text-primary" />
            <span><span className="text-primary">S</span>Photo</span>
          </Link>
          <Button variant="outline" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zurück zur Startseite
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-4xl">
          {/* Hero */}
          <div className="mb-12 text-center">
            <Badge variant="secondary" className="mb-4">Migration</Badge>
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
              Von Google Photos wechseln
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Übertrage alle deine Fotos und Videos von Google Photos zu SPhoto. 
              Auf dieser Seite erklären wir Schritt für Schritt, wie du dein gesamtes Medienarchiv exportierst und importierst.
            </p>
          </div>

          {/* Methods Overview */}
          <div className="mb-12 grid gap-6 md:grid-cols-2">
            <Card className="border-2">
              <CardHeader>
                <Badge variant="outline" className="w-fit">Methode 1</Badge>
                <CardTitle className="mt-2">Schnell & einfach</CardTitle>
                <CardDescription>
                  Diese Methode ist einfacher, aber einige Daten und Albumstrukturen könnten nicht perfekt übertragen werden.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" asChild>
                  <a href="#methode-1">
                    Zur Anleitung
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 border-primary">
              <CardHeader>
                <Badge className="w-fit">Empfohlen</Badge>
                <CardTitle className="mt-2">Methode 2 – Mit Metadaten</CardTitle>
                <CardDescription>
                  Erfordert ein paar mehr Schritte, behält aber Datum und Alben. Wir erklären genau, wie es funktioniert.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" asChild>
                  <a href="#methode-2">
                    Zur Anleitung
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Method 1 */}
          <section id="methode-1" className="mb-16 scroll-mt-24">
            <h2 className="mb-6 text-2xl font-bold">Methode 1: Einfacher Import</h2>
            
            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">1</div>
                    <CardTitle>Fotos von Google Photos exportieren (via Google Takeout)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ol className="list-decimal space-y-2 pl-6">
                    <li>Gehe zu <a href="https://takeout.google.com" target="_blank" rel="noreferrer" className="text-primary hover:underline">Google Takeout <ExternalLink className="inline h-3 w-3" /></a></li>
                    <li>Klicke auf <strong>"Auswahl aufheben"</strong></li>
                    <li>Scrolle nach unten und wähle nur <strong>Google Fotos</strong> aus</li>
                    <li>Klicke auf "Alle Fotoalben enthalten" (optional) um bestimmte Alben auszuwählen</li>
                    <li>Klicke auf <strong>Nächster Schritt</strong></li>
                    <li>Wähle:
                      <ul className="ml-6 mt-1 list-disc text-muted-foreground">
                        <li>Exporthäufigkeit: Ein Export</li>
                        <li>Dateityp: .zip</li>
                        <li>Dateigrösse: z.B. 10 GB</li>
                      </ul>
                    </li>
                    <li>Klicke auf <strong>Export erstellen</strong></li>
                  </ol>
                  <div className="rounded-lg bg-amber-500/10 p-4 text-sm">
                    <p className="font-medium text-amber-600">🔔 Hinweis:</p>
                    <p className="text-muted-foreground">Der Export kann je nach Anzahl Fotos einige Zeit dauern. Du erhältst eine E-Mail, wenn er bereit ist.</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">2</div>
                    <CardTitle>Export herunterladen</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ol className="list-decimal space-y-2 pl-6">
                    <li>Du erhältst eine E-Mail, wenn der Export bereit ist</li>
                    <li>Lade die .zip-Datei(en) herunter</li>
                  </ol>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">3</div>
                    <CardTitle>Fotos für SPhoto vorbereiten</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ol className="list-decimal space-y-2 pl-6">
                    <li>Entpacke die .zip-Dateien auf deinem Computer</li>
                    <li>Navigiere zum Ordner <code className="rounded bg-muted px-1.5 py-0.5">Google Photos/</code>, wo du deine Fotos nach Jahr oder Album findest</li>
                  </ol>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">4</div>
                    <CardTitle>Zu SPhoto hochladen</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ol className="list-decimal space-y-2 pl-6">
                    <li>Gehe zu deiner SPhoto-Domain im Browser (z.B. <code className="rounded bg-muted px-1.5 py-0.5">deinname.{DOMAIN}</code>)</li>
                    <li>Melde dich an und klicke auf <strong>Upload</strong></li>
                    <li>Wähle die Fotos oder Ordner aus, die du hochladen möchtest</li>
                  </ol>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Method 2 */}
          <section id="methode-2" className="mb-16 scroll-mt-24">
            <h2 className="mb-6 text-2xl font-bold">Methode 2: Import mit Metadaten (empfohlen)</h2>
            
            <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-6">
              <h3 className="mb-2 font-semibold">Was ist Immich Go?</h3>
              <p className="text-muted-foreground">
                Immich Go ist ein Tool, mit dem du Fotos und Videos aus Google Takeout einfach in SPhoto importieren kannst, 
                wobei wichtige Metadaten wie Originaldaten und Albumnamen erhalten bleiben. So bleiben deine Fotos organisiert 
                und deine Erinnerungen erscheinen am richtigen Ort und in der richtigen Reihenfolge.
              </p>
            </div>

            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">1</div>
                    <CardTitle>Fotos mit Google Takeout exportieren</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Folge Schritt 1 von Methode 1. Lade die Google Takeout ZIP-Dateien herunter, <strong>aber du musst sie nicht entpacken</strong>.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">2</div>
                    <CardTitle>Immich Go herunterladen und einrichten</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Immich Go ist keine normale App mit Installer. Es ist eine eigenständige Datei, die du auf deinen Computer legst und direkt nutzen kannst.
                  </p>
                  <ol className="list-decimal space-y-2 pl-6">
                    <li>
                      Gehe zur <a href="https://github.com/simulot/immich-go/releases" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        Immich Go Releases-Seite <ExternalLink className="inline h-3 w-3" />
                      </a>
                    </li>
                    <li>Lade die richtige Version für dein Betriebssystem herunter:
                      <ul className="ml-6 mt-1 list-disc text-muted-foreground">
                        <li>Für Windows: die <code className="rounded bg-muted px-1">.exe</code> Datei</li>
                        <li>Für Mac: die Datei mit <code className="rounded bg-muted px-1">darwin</code> im Namen</li>
                        <li>Für Linux: die Datei mit <code className="rounded bg-muted px-1">linux</code> im Namen</li>
                      </ul>
                    </li>
                    <li>Entpacke die .zip-Datei</li>
                    <li>Lege die <code className="rounded bg-muted px-1">immich-go</code> Datei in einen neuen Ordner</li>
                    <li>Füge deine Takeout .zip-Dateien in denselben Ordner ein</li>
                  </ol>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">3</div>
                    <CardTitle>Domain und API-Key verbinden</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ol className="list-decimal space-y-2 pl-6">
                    <li>Gehe zu deiner SPhoto-Domain</li>
                    <li>Klicke oben rechts auf dein Profil und wähle <strong>Kontoeinstellungen</strong></li>
                    <li>Gehe zu <strong>API-Key</strong></li>
                    <li>Klicke auf <strong>Neuer API-Key</strong>, gib ihm einen Namen und kopiere den generierten Key</li>
                  </ol>
                  <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                    <Key className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Bewahre deinen API-Key sicher auf – er gewährt Zugriff auf dein Konto</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">4</div>
                    <CardTitle>Befehl im Terminal ausführen</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ol className="list-decimal space-y-2 pl-6">
                    <li>Öffne ein Terminal im Ordner, wo immich-go und deine Takeout-Dateien liegen:
                      <ul className="ml-6 mt-1 list-disc text-muted-foreground">
                        <li><strong>Windows:</strong> Rechtsklick auf den Ordner → "Im Terminal öffnen"</li>
                        <li><strong>macOS:</strong> Öffne die Terminal-App, tippe <code className="rounded bg-muted px-1">cd </code> gefolgt von einem Leerzeichen, ziehe den Ordner ins Terminal und drücke Enter</li>
                      </ul>
                    </li>
                    <li>Füge den folgenden Befehl ein und ersetze Server-Adresse und API-Key:</li>
                  </ol>

                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-sm font-medium">Windows:</p>
                      <div className="rounded-lg bg-zinc-900 p-4 font-mono text-sm text-zinc-100 overflow-x-auto">
                        <code>./immich-go.exe --server=https://DEINNAME.{DOMAIN}/ --api-key=DEIN_API_KEY --pause-immich-jobs=false upload from-google-photos takeout-*.zip</code>
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-medium">macOS / Linux:</p>
                      <div className="rounded-lg bg-zinc-900 p-4 font-mono text-sm text-zinc-100 overflow-x-auto">
                        <code>./immich-go --server=https://DEINNAME.{DOMAIN}/ --api-key=DEIN_API_KEY --pause-immich-jobs=false upload from-google-photos takeout-*.zip</code>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-lg bg-green-500/10 p-4">
                    <CheckCircle className="mt-0.5 h-5 w-5 text-green-600 shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      Das Tool lädt automatisch alle deine Fotos hoch – mit Alben und Datum – zu SPhoto.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* CTA */}
          <Card className="border-0 bg-primary text-primary-foreground">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold">Noch kein SPhoto-Konto?</h2>
              <p className="mx-auto mt-2 max-w-lg text-primary-foreground/80">
                Erstelle jetzt deine eigene private Foto-Cloud und migriere deine Google Photos in unter 10 Minuten.
              </p>
              <Button size="lg" variant="secondary" className="mt-6" asChild>
                <Link href="/#pricing">
                  Jetzt starten
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} SPhoto · Basiert auf Immich · 🇨🇭 Schweiz</p>
        </div>
      </footer>
    </div>
  )
}
