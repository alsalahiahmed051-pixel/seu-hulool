import { Analytics } from '@vercel/analytics/next';

export const metadata = {
  title: 'حلول | SEU',
  description: 'بوابتك الأكاديمية الذكية للجامعة السعودية الإلكترونية',
  manifest: '/manifest.json',
}

export const viewport = {
  themeColor: '#001f5a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Reem+Kufi:wght@500;700&display=swap"
          rel="stylesheet"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body style={{
        margin: 0,
        fontFamily: "'Tajawal','Cairo',sans-serif",
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        background: '#050a16',
      }}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
