import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { DatabaseProvider } from "@/providers/database-provider";
import { SiteProvider } from "@/providers/site-provider";

export const metadata: Metadata = {
  title: "THE EAST PALACE | Parking Management",
  description: "Professional parking management system for Sant Wamanbhau Parking, Ahilyanagar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <AuthProvider>
            <DatabaseProvider>
              <QueryProvider>
                <SiteProvider>{children}</SiteProvider>
              </QueryProvider>
            </DatabaseProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

