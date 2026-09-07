import { currentUser, auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { SplitDashboard } from "@/components/dashboard/split-dashboard";
import { FileText } from "lucide-react";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  const user = await currentUser();

  if (!user) {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#f8f9fa] text-zinc-900">
      {/* Sleek Top Navigation Bar */}
      <header className="border-b border-zinc-200/80 text-zinc-900 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-900 shadow-sm">
              <FileText className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight text-zinc-900 font-sans">
                  DocStruct
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                  Studio
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 hidden sm:block">
                Document Parsing &amp; JSON Intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100/80 border border-zinc-200 text-xs text-zinc-700 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {user.emailAddresses[0]?.emailAddress}
            </div>

            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-9 h-9 ring-2 ring-zinc-200",
                },
              }}
            />
          </div>
        </div>
      </header>

      {/* Main Split-Screen Canvas */}
      <main className="flex-1 max-w-[1520px] w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 flex flex-col justify-center">
        <SplitDashboard />
      </main>

      {/* Subtle Minimal Footer */}
      <footer className="border-t border-zinc-200/80 py-4 text-center text-xs text-zinc-500 font-mono bg-white">
        <div className="max-w-[1520px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            &copy; {new Date().getFullYear()} DocStruct &bull; Mesh Document
            Intelligence
          </span>
          <div className="flex items-center gap-4 text-zinc-500">
            <span className="hover:text-zinc-900 cursor-pointer transition-colors">
              Privacy
            </span>
            <span className="hover:text-zinc-900 cursor-pointer transition-colors">
              Terms
            </span>
            <span className="hover:text-zinc-900 cursor-pointer transition-colors">
              API Docs
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
