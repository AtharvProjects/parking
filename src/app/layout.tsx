import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { SiteProvider } from "@/providers/site-provider";
import { RealtimeProvider } from "@/providers/realtime-provider";
import { NotificationProvider } from "@/providers/notification-provider";
import { BackButtonProvider } from "@/providers/back-button-provider";
import { LanguageProvider } from "@/providers/language-provider";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

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
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="font-sans antialiased">
        <LanguageProvider>
          <ThemeProvider>
            <AuthProvider>
              <QueryProvider>
                <SiteProvider>
                  <RealtimeProvider>
                    <NotificationProvider>
                      <BackButtonProvider>
                        {children}
                      </BackButtonProvider>
                    </NotificationProvider>
                  </RealtimeProvider>
                </SiteProvider>
              </QueryProvider>
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
