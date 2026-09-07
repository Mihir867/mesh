import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { ArrowRight, FileText, Sparkles, MessageSquare } from "lucide-react";
import Link from "next/link";

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-black dark:to-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-zinc-900 dark:text-white" />
            <span className="text-xl font-semibold text-zinc-900 dark:text-white">
              DocStruct
            </span>
          </div>
          
          {!userId ? (
            <div className="flex gap-3">
              <SignInButton mode="modal">
                <button className="px-4 py-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition-colors">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors">
                  Get Started
                </button>
              </SignUpButton>
            </div>
          ) : (
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-colors"
            >
              Go to Dashboard
            </Link>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
            <Sparkles className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              AI-Powered Document Intelligence
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-zinc-900 dark:text-white">
            Transform Your Documents
            <br />
            <span className="bg-gradient-to-r from-zinc-600 to-zinc-900 dark:from-zinc-400 dark:to-zinc-100 bg-clip-text text-transparent">
              Into Structured Data
            </span>
          </h1>

          {/* Description */}
          <p className="text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Upload PDFs, spreadsheets, and documents. Extract structured information with AI.
            Chat with your documents to get instant insights.
          </p>

          {/* CTA Buttons */}
          {!userId ? (
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <SignUpButton mode="modal">
                <button className="group px-6 py-3 text-base font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-all flex items-center gap-2 shadow-lg hover:shadow-xl">
                  Start Free Trial
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </SignUpButton>
              <button className="px-6 py-3 text-base font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white border border-zinc-300 dark:border-zinc-700 rounded-lg hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
                Watch Demo
              </button>
            </div>
          ) : (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 text-base font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-all shadow-lg hover:shadow-xl"
            >
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 max-w-3xl mx-auto">
            <div className="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <FileText className="h-8 w-8 text-zinc-900 dark:text-white mb-3" />
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
                Smart Extraction
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Automatically extract key information from any document format
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <Sparkles className="h-8 w-8 text-zinc-900 dark:text-white mb-3" />
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
                AI Processing
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Powered by advanced AI to understand context and meaning
              </p>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <MessageSquare className="h-8 w-8 text-zinc-900 dark:text-white mb-3" />
              <h3 className="font-semibold text-zinc-900 dark:text-white mb-2">
                Interactive Chat
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Ask questions and get instant answers about your documents
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-black/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          © 2026 DocStruct. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
