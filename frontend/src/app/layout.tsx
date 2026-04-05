import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JobPilot – Job Application Dashboard",
  description: "AI-powered job application pipeline manager",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased" style={{ backgroundColor: "var(--midnight)", color: "var(--praxeti)" }}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main
            className="flex-1 ml-64 overflow-y-auto flex flex-col"
            style={{ backgroundColor: "var(--midnight)" }}
          >
            <div className="flex-1 min-h-0">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
