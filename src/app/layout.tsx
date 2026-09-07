import type { Metadata } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const openSans = localFont({
  src: "../../public/fonts/OpenSans-Regular.ttf",
  variable: "--font-open-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DocStruct - Document Intelligence Platform",
  description: "AI-powered document processing and extraction",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${openSans.variable} font-sans h-full antialiased`}
        style={{ fontFamily: "var(--font-open-sans), 'Open Sans', sans-serif" }}
      >
        <body
          className="min-h-full flex flex-col font-sans"
          style={{ fontFamily: "var(--font-open-sans), 'Open Sans', sans-serif" }}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
