import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "Drinks App",
  description: "Bar tracking app met Supabase",
}

// Vast op schaal 1: telefoons zoomen dan nooit meer automatisch in op invoervelden
// en kunnen ook geen ingezoomde stand meer vasthouden tussen schermen. Dit staat in
// de server-HTML zelf, dus Android Chrome kent het al vóór er iets rendert.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#4f7ef7",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl">
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
