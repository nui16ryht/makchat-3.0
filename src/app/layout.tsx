import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import Script from 'next/script';
import { PwaInstallProvider } from '@/hooks/use-pwa-install';
import { NotificationProvider } from '@/components/makchat/notification-provider';
import { ThemeProvider } from '@/components/makchat/theme-provider';

export const metadata: Metadata = {
  title: 'MakChat | Makerere Student Network',
  description: 'The exclusive social network for Makerere University students. Connect, trade, and chat anonymously.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#5DADE2" />
        <link rel="icon" href="/icon.png" sizes="any" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(e) {
                if (e && e.message && (e.message.indexOf('Loading chunk') !== -1 || e.message.indexOf('ChunkLoadError') !== -1)) {
                  var last = sessionStorage.getItem('chunk_err_reload');
                  var now = Date.now();
                  if (!last || now - parseInt(last) > 8000) {
                    sessionStorage.setItem('chunk_err_reload', String(now));
                    window.location.reload();
                  }
                }
              });
            `,
          }}
        />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PwaInstallProvider>
            <NotificationProvider>
              {children}
            </NotificationProvider>
          </PwaInstallProvider>
          <Toaster />
        </ThemeProvider>
        <Script src="/sw-register.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
