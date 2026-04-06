import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quick Draw Duel - Western Reaction Time Game",
  description:
    "1v1 Western gunfight duel! Challenge your friends to a quick draw showdown. Wait for the signal, draw your gun, and prove you're the fastest in the West!",
  keywords: [
    "quick draw game",
    "reaction time duel",
    "western gunfight game",
    "1v1 reaction game",
    "reflex test multiplayer",
    "fastest gun game",
    "cowboy duel online",
    "reaction speed test",
  ],
  metadataBase: new URL("https://quick-draw-duel.vercel.app"),
  openGraph: {
    title: "Quick Draw Duel - Are You the Fastest Gun?",
    description:
      "1v1 Western quick draw duel! Wait for the signal and shoot first to win. Challenge your friends!",
    type: "website",
    siteName: "Quick Draw Duel",
  },
  twitter: {
    card: "summary_large_image",
    title: "Quick Draw Duel - Are You the Fastest Gun?",
    description:
      "1v1 Western quick draw duel! Wait for the signal and shoot first to win.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
