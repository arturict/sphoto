import type { Metadata } from "next"
import { Poppins, Open_Sans } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-heading",
  display: "swap",
})

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
})

export const metadata: Metadata = {
  title: "SPhoto - Your Private Photo Cloud",
  description: "Google Photos alternative with EU hosting. Privacy-first, no tracking. From 5 CHF/month.",
  keywords: ["photo cloud", "photo backup", "immich", "google photos alternative", "privacy", "eu hosting"],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "SPhoto - Your Private Photo Cloud",
    description: "Google Photos alternative with EU hosting. Privacy-first, no tracking.",
    type: "website",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.variable} ${openSans.variable} font-body antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none"
        >
          Skip to main content
        </a>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <main id="main-content">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
