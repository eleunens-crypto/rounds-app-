import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Drinks App",
  description: "Bar tracking app met Supabase",
}

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
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
