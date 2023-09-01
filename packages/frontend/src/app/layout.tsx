import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Head from 'next/head'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Optimism Gas Tracker',
  description: 'Optimism Gas Tracker site for tracking gas prices and top gas spenders on Optimism Mainnet network.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <Head>
        <meta charSet="UTF-8" />
        <meta http-equiv="content-language" content="en-us" />
        <meta name="description" content="Optimism Gas Tracker site for tracking gas prices and top gas spenders on Optimism Mainnet network." />
        <meta name="keywords" content="optimism, gas, tracker, etherscan, spenders, guzzlers, prices, historical, history, table, chart" />
        <meta name="robots" content="index,follow" />
        <meta name="googlebot" content="index,follow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="application-name" content="Optimism Gas Tracker" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Optimism Gas Tracker" />
        <meta name="theme-color" content="#000000" />
        <meta name="author" content="Buildooor" />
        <link rel="canonical" href="https://optimismgastracker.com" />
      </Head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
