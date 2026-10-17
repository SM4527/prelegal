import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppHeader } from "@/components/AppHeader";
import { SITE_DISCLAIMER } from "@/lib/disclaimer";
import { UserProvider } from "@/lib/user";
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
  title: { default: "Prelegal", template: "%s | Prelegal" },
  description: "Draft common legal agreements.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <UserProvider>
          <AppHeader />
          {children}
          <footer className="border-t border-slate-200 bg-white">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:px-8">
              <p>{SITE_DISCLAIMER}</p>
              <p>
                Based on Common Paper standard agreements, free to use under{" "}
                <a className="underline hover:text-brand-navy" href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
              </p>
            </div>
          </footer>
        </UserProvider>
      </body>
    </html>
  );
}
