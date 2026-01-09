import { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ArrowRight, CheckCircle, ExternalLink, Key, Cloud, AlertCircle } from "lucide-react"

export const metadata: Metadata = {
  title: "Von Google Photos wechseln | SPhoto",
  description: "Übertrage alle deine Fotos und Videos von Google Photos zu SPhoto. Schritt-für-Schritt Anleitung.",
}

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "localhost"

export default function GooglePhotosMigrationPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-4 md:px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
              <Cloud className="h-4 w-4 text-background" />
            </div>
            <span>SPhoto</span>
          </Link>
          <Button variant="outline" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zurück
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <div className="mb-16 text-center">
            <Badge variant="secondary" className="mb-6">Migration</Badge>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              Von Google Photos wechseln
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed">
              Übertrage alle deine Fotos und Videos von Google Photos zu SPhoto. 
              Auf dieser Seite erklären wir Schritt für Schritt, wie du dein gesamtes Medienarchiv exportierst und importierst.
            </p>
          </div>

          <div className="mb-16 grid gap-6 md:grid-cols-2">
            <Card className="border-border/50">
              <CardHeader className="p-6">
                <Badge variant="outline" className="w-fit mb-2">Methode 1</Badge>
                <CardTitle className="text-lg font-medium">Schnell & einfach</CardTitle>
                <CardDescription className="mt-2">
                  Diese Methode ist einfacher, aber einige Daten und Albumstrukturen könnten nicht perfekt übertragen werden.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <Button variant="outline" className="w-full" asChild>
                  <a href="#methode-1">
                    Zur Anleitung
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-foreground">
              <CardHeader className="p-6">
                <Badge className="w-fit mb-2">Empfohlen</Badge>
                <CardTitle className="text-lg font-medium">Methode 2 – Mit Metadaten</CardTitle>
                <CardDescription className="mt-2">
                  Erfordert ein paar mehr Schritte, behält aber Datum und Alben. Wir erklären genau, wie es funktioniert.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                <Button className="w-full" asChild>
                  <a href="#methode-2">
                    Zur Anleitung
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>

          <section id="methode-1" className="mb-20 scroll-mt-24">
            <h2 className="mb-8 text-2xl font-semibold">Methode 1: Einfacher Import</h2>
            
            <div className="space-y-6">
              <Card className="border-border/50">
                <CardHeader className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background text-sm font-semibold">1</div>
                    <CardTitle className="text-lg font-medium">Fotos von Google Photos exportieren (via Google Takeout)</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-6 pb-6 space-y-4">
                  <ol className="list-decimal space-y-3 pl-6 text-muted-foreground">
                    <li>Gehe zu <a href="https://takeout.google.com" target="_blank" rel="noreferrer" className="text-foreground hover:underline">Google Takeout <ExternalLink className="inline h-3 w-3" /></a></li>
                    <li>Klicke auf <strong className="text-foreground">«Auswahl aufheben»</strong></li>
                    <li>Scrolle nach unten und wähle nur <strong className="text-foreground">Google Fotos</strong> aus</li>
                    <li>Klicke auf «Alle Fotoalben enthalten» (optional) um bestimmte Alben auszuwählen</li>
                    <li>Klicke auf <strong className="text-foreground">Nächster Schritt</strong></li>
                    <li>Wähle:
                      <ul className="ml-6 mt-2 list-disc space-y-1">
                        <li>Exporthäufigkeit: Ein Export</li>
                        <li>Dateityp: .zip</li>
                        <li>Dateigrösse: z.B. 10 GB</li>
                      </ul>
                    </li>
                    <li>Klicke auf <strong className="text-foreground">Export erstellen</strong></li>
                  </ol>
                  <div className="flex items-start gap-3 rounded-xl bg-secondary p-4 text-sm">
                    <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <p className="text-muted-foreground">Der Export kann je nach Anzahl Fotos einige Zeit dauern. Du erhältst eine E-Mail, wenn er bereit ist.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background text-sm font-semibold">2</div>
                    <CardTitle className="text-lg font-medium">Export herunterladen</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <ol className="list-decimal space-y-3 pl-6 text-muted-foreground">
                    <li>Du erhältst eine E-Mail, wenn der Export bereit ist</li>
                    <li>Lade die .zip-Datei(en) herunter</li>
                  </ol>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background text-sm font-semibold">3</div>
                    <CardTitle className="text-lg font-medium">Fotos für SPhoto vorbereiten</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <ol className="list-decimal space-y-3 pl-6 text-muted-foreground">
                    <li>Entpacke die .zip-Dateien auf deinem Computer</li>
                    <li>Navigiere zum Ordner <code className="rounded-md bg-secondary px-2 py-1 text-foreground">Google Photos/</code>, wo du deine Fotos nach Jahr oder Album findest</li>
                  </ol>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background text-sm font-semibold">4</div>
                    <CardTitle className="text-lg font-medium">Zu SPhoto hochladen</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <ol className="list-decimal space-y-3 pl-6 text-muted-foreground">
                    <li>Gehe zu deiner SPhoto-Domain im Browser (z.B. <code className="rounded-md bg-secondary px-2 py-1 text-foreground">deinname.{DOMAIN}</code>)</li>
                    <li>Melde dich an und klicke auf <strong className="text-foreground">Upload</strong></li>
                    <li>Wähle die Fotos oder Ordner aus, die du hochladen möchtest</li>
                  </ol>
                </CardContent>
              </Card>
            </div>
          </section>

          <section id="methode-2" className="mb-20 scroll-mt-24">
            <h2 className="mb-8 text-2xl font-semibold">Methode 2: Import mit Metadaten (empfohlen)</h2>
            
            <div className="mb-8 rounded-xl border border-border/50 bg-secondary/30 p-6">
              <h3 className="mb-3 font-medium">Was ist Immich Go?</h3>
              <p className="text-muted-foreground leading-relaxed">
                Immich Go ist ein Tool, mit dem du Fotos und Videos aus Google Takeout einfach in SPhoto importieren kannst, 
                wobei wichtige Metadaten wie Originaldaten und Albumnamen erhalten bleiben. So bleiben deine Fotos organisiert 
                und deine Erinnerungen erscheinen am richtigen Ort und in der richtigen Reihenfolge.
              </p>
            </div>

            <div className="space-y-6">
              <Card className="border-border/50">
                <CardHeader className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background text-sm font-semibold">1</div>
                    <CardTitle className="text-lg font-medium">Fotos mit Google Takeout exportieren</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-6 pb-6">
                  <p className="text-muted-foreground">
                    Folge Schritt 1 von Methode 1. Lade die Google Takeout ZIP-Dateien herunter, <strong className="text-foreground">aber du musst sie nicht entpacken</strong>.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background text-sm font-semibold">2</div>
                    <CardTitle className="text-lg font-medium">Immich Go herunterladen und einrichten</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-6 pb-6 space-y-4">
                  <p className="text-muted-foreground">
                    Immich Go ist keine normale App mit Installer. Es ist eine eigenständige Datei, die du auf deinen Computer legst und direkt nutzen kannst.
                  </p>
                  <ol className="list-decimal space-y-3 pl-6 text-muted-foreground">
                    <li>
                      Gehe zur <a href="https://github.com/simulot/immich-go/releases" target="_blank" rel="noreferrer" className="text-foreground hover:underline">
                        Immich Go Releases-Seite <ExternalLink className="inline h-3 w-3" />
                      </a>
                    </li>
                    <li>Lade die richtige Version für dein Betriebssystem herunter:
                      <ul className="ml-6 mt-2 list-disc space-y-1">
                        <li>Für Windows: die <code className="rounded-md bg-secondary px-1.5 py-0.5 text-foreground">.exe</code> Datei</li>
                        <li>Für Mac: die Datei mit <code className="rounded-md bg-secondary px-1.5 py-0.5 text-foreground">darwin</code> im Namen</li>
                        <li>Für Linux: die Datei mit <code className="rounded-md bg-secondary px-1.5 py-0.5 text-foreground">linux</code> im Namen</li>
                      </ul>
                    </li>
                    <li>Entpacke die .zip-Datei</li>
                    <li>Lege die <code className="rounded-md bg-secondary px-1.5 py-0.5 text-foreground">immich-go</code> Datei in einen neuen Ordner</li>
                    <li>Füge deine Takeout .zip-Dateien in denselben Ordner ein</li>
                  </ol>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background text-sm font-semibold">3</div>
                    <CardTitle className="text-lg font-medium">Domain und API-Key verbinden</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-6 pb-6 space-y-4">
                  <ol className="list-decimal space-y-3 pl-6 text-muted-foreground">
                    <li>Gehe zu deiner SPhoto-Domain</li>
                    <li>Klicke oben rechts auf dein Profil und wähle <strong className="text-foreground">Kontoeinstellungen</strong></li>
                    <li>Gehe zu <strong className="text-foreground">API-Key</strong></li>
                    <li>Klicke auf <strong className="text-foreground">Neuer API-Key</strong>, gib ihm einen Namen und kopiere den generierten Key</li>
                  </ol>
                  <div className="flex items-center gap-3 rounded-xl bg-secondary p-4">
                    <Key className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">Bewahre deinen API-Key sicher auf – er gewährt Zugriff auf dein Konto</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background text-sm font-semibold">4</div>
                    <CardTitle className="text-lg font-medium">Befehl im Terminal ausführen</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="px-6 pb-6 space-y-4">
                  <ol className="list-decimal space-y-3 pl-6 text-muted-foreground">
                    <li>Öffne ein Terminal im Ordner, wo immich-go und deine Takeout-Dateien liegen:
                      <ul className="ml-6 mt-2 list-disc space-y-1">
                        <li><strong className="text-foreground">Windows:</strong> Rechtsklick auf den Ordner, «Im Terminal öffnen»</li>
                        <li><strong className="text-foreground">macOS:</strong> Öffne die Terminal-App, tippe <code className="rounded-md bg-secondary px-1.5 py-0.5 text-foreground">cd </code> gefolgt von einem Leerzeichen, ziehe den Ordner ins Terminal und drücke Enter</li>
                      </ul>
                    </li>
                    <li>Füge den folgenden Befehl ein und ersetze Server-Adresse und API-Key:</li>
                  </ol>

                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-sm font-medium">Windows:</p>
                      <div className="rounded-xl bg-zinc-900 p-4 font-mono text-sm text-zinc-100 overflow-x-auto">
                        <code>./immich-go.exe --server=https://DEINNAME.{DOMAIN}/ --api-key=DEIN_API_KEY --pause-immich-jobs=false upload from-google-photos takeout-*.zip</code>
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-sm font-medium">macOS / Linux:</p>
                      <div className="rounded-xl bg-zinc-900 p-4 font-mono text-sm text-zinc-100 overflow-x-auto">
                        <code>./immich-go --server=https://DEINNAME.{DOMAIN}/ --api-key=DEIN_API_KEY --pause-immich-jobs=false upload from-google-photos takeout-*.zip</code>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl bg-secondary p-4">
                    <CheckCircle className="mt-0.5 h-5 w-5 text-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      Das Tool lädt automatisch alle deine Fotos hoch – mit Alben und Datum – zu SPhoto.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <Card className="border-0 bg-foreground text-background">
            <CardContent className="p-10 text-center">
              <h2 className="text-2xl font-semibold">Noch kein SPhoto-Konto?</h2>
              <p className="mx-auto mt-3 max-w-lg text-background/70">
                Erstelle jetzt deine eigene private Foto-Cloud und migriere deine Google Photos in unter 10 Minuten.
              </p>
              <Button size="lg" variant="secondary" className="mt-8" asChild>
                <Link href="/#pricing">
                  Jetzt starten
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="border-t py-10 mt-12">
        <div className="container mx-auto px-4 md:px-6 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} SPhoto · Basiert auf Immich · Schweiz</p>
        </div>
      </footer>
    </div>
  )
}
