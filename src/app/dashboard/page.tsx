import { currentUser, auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { SplitDashboard } from "@/components/dashboard/split-dashboard";
import { FileText } from "lucide-react";
import { FooterLink } from "@/components/landing/cta-buttons";

export default async function DashboardPage() {
  const { userId } = await auth();
  const user = await currentUser();

  // Clerk middleware handles auth redirects automatically
  // This page is protected by middleware, so we only need to handle edge cases
  if (!userId || !user) {
    redirect("/");
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      {/* Premium Header - Minimal, precise, hairline border */}
      <header className="sticky top-0 z-50" style={{
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg)'
      }}>
        <div className="max-w-[1600px] mx-auto px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)'
            }}>
              <FileText className="w-4 h-4" style={{ color: 'var(--color-accent)' }} />
            </div>
            <span style={{
              fontSize: '15px',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-primary)',
              letterSpacing: '-0.006em'
            }}>
              MESH
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center" style={{
              fontSize: '13px',
              fontWeight: 'var(--font-weight-regular)',
              color: 'var(--color-text-secondary)'
            }}>
              {user.emailAddresses[0]?.emailAddress}
            </div>

            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8",
                },
              }}
            />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 lg:px-8 py-8 flex flex-col">
        <SplitDashboard />
      </main>

      {/* Premium Footer - Minimal hairline */}
      <footer style={{
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-bg)'
      }}>
        <div className="max-w-[1600px] mx-auto px-6 lg:px-8 py-4 flex items-center justify-between">
          <span style={{
            fontSize: '13px',
            fontWeight: 'var(--font-weight-regular)',
            color: 'var(--color-text-tertiary)'
          }}>
            © {new Date().getFullYear()} MESH
          </span>
          <div className="flex items-center gap-6">
            <FooterLink>Privacy</FooterLink>
            <FooterLink>Terms</FooterLink>
            <FooterLink>API Docs</FooterLink>
          </div>
        </div>
      </footer>
    </div>
  );
}
