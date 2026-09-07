import { currentUser, auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import {
  User,
  Mail,
  Calendar,
  Shield,
  CheckCircle,
  FileText,
} from "lucide-react";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  const user = await currentUser();

  if (!user) {
    redirect("/");
  }

  const createdAt = new Date(user.createdAt);
  const lastSignIn = user.lastSignInAt ? new Date(user.lastSignInAt) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-black dark:to-zinc-900">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-zinc-900 dark:text-white" />
            <span className="text-xl font-semibold text-zinc-900 dark:text-white">
              DocStruct
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {user.emailAddresses[0]?.emailAddress}
            </span>
            <UserButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-2">
            Welcome back, {user.firstName || "User"}! 👋
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            Here's your account information and authentication details.
          </p>
        </div>

        {/* User Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Profile Card */}
          <div className="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-zinc-900 dark:text-white">
                Profile
              </h3>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Full Name</p>
                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                  {user.firstName} {user.lastName || ""}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Username</p>
                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                  {user.username || "Not set"}
                </p>
              </div>
            </div>
          </div>

          {/* Email Card */}
          <div className="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Mail className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-zinc-900 dark:text-white">
                Email
              </h3>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Primary Email</p>
                <p className="text-sm font-medium text-zinc-900 dark:text-white break-all">
                  {user.emailAddresses[0]?.emailAddress}
                </p>
              </div>
              {user.emailAddresses[0]?.verification?.status === "verified" && (
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-xs font-medium">Verified</span>
                </div>
              )}
            </div>
          </div>

          {/* Account Status Card */}
          <div className="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-zinc-900 dark:text-white">
                Account Status
              </h3>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">User ID</p>
                <p className="text-xs font-mono text-zinc-900 dark:text-white break-all">
                  {user.id}
                </p>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="text-xs font-medium text-zinc-900 dark:text-white">
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="p-6 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="font-semibold text-zinc-900 dark:text-white">
              Activity Timeline
            </h3>
          </div>

          <div className="space-y-4">
            {lastSignIn && (
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-24 text-xs text-zinc-500 dark:text-zinc-400 pt-1">
                  Last Sign In
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">
                    {lastSignIn.toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {lastSignIn.toLocaleTimeString("en-US")}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-24 text-xs text-zinc-500 dark:text-zinc-400 pt-1">
                Account Created
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-white">
                  {createdAt.toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {createdAt.toLocaleTimeString("en-US")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Raw Data Section (for developers) */}
        <div className="mt-8 p-6 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          <h3 className="font-semibold text-zinc-900 dark:text-white mb-4">
            Raw User Data (Developer View)
          </h3>
          <pre className="text-xs text-zinc-600 dark:text-zinc-400 overflow-x-auto p-4 bg-white dark:bg-black rounded-lg border border-zinc-200 dark:border-zinc-800">
            {JSON.stringify(
              {
                id: user.id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                emailAddresses: user.emailAddresses.map((email) => ({
                  email: email.emailAddress,
                  verified: email.verification?.status === "verified",
                })),
                imageUrl: user.imageUrl,
                createdAt: user.createdAt,
                lastSignInAt: user.lastSignInAt,
              },
              null,
              2
            )}
          </pre>
        </div>
      </main>
    </div>
  );
}
