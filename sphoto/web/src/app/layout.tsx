import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SPhoto - Deine private Photo Cloud",
  description: "Google Photos Alternative mit Schweizer Hosting. Ab 5 CHF/Monat.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
