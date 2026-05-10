import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Drinks App",
  description: "Bar tracking app met Supabase",
}

// ❌ viewport NIET in metadata zetten
export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f7ef7",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  )
}