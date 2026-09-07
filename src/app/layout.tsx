import type { Metadata } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const clashDisplay = localFont({
  src: "../../public/fonts/ClashDisplay-Variable.woff2",
  variable: "--font-clash",
  weight: "200 700",
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
        className={`${clashDisplay.variable} h-full antialiased`}
        style={{ fontFamily: "var(--font-clash)" }}
      >
        <body className="min-h-full flex flex-col" style={{ fontFamily: "var(--font-clash)" }}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
