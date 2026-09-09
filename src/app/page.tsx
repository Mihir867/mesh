import { auth } from "@clerk/nextjs/server";
import { FileText } from "lucide-react";
import Link from "next/link";
import { CTAButtons, HeaderCTAButtons, FooterLink } from "@/components/landing/cta-buttons";

export default async function Home() {
  const { userId } = await auth();

  return (
    <div className="flex flex-col min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Header - Minimal, precise, no decoration */}
      <header className="sticky top-0 z-50" style={{ 
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg)'
      }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center" style={{ 
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
          
          {!userId ? (
            <HeaderCTAButtons />
          ) : (
            <Link
              href="/dashboard"
              style={{
                padding: '6px 14px',
                fontSize: '15px',
                fontWeight: 'var(--font-weight-medium)',
                color: 'white',
                background: 'var(--color-accent)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                transition: 'background 120ms ease-out',
                letterSpacing: '-0.006em',
                display: 'inline-block'
              }}
            >
              Go to Dashboard
            </Link>
          )}
        </div>
      </header>

      {/* Hero Section - Left-aligned, clean, single focus */}
      <main className="flex-1 flex flex-col justify-center px-6 lg:px-8 py-24">
        <div className="max-w-4xl mx-auto w-full">
          {/* Hero Content */}
          <div className="space-y-6 mb-16">
            <h1 style={{
              fontSize: '56px',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-primary)',
              lineHeight: '1.05',
              letterSpacing: '-0.02em',
              maxWidth: '700px'
            }}>
              Transform documents into structured data
            </h1>

            <p style={{
              fontSize: '20px',
              fontWeight: 'var(--font-weight-regular)',
              color: 'var(--color-text-secondary)',
              lineHeight: '1.5',
              maxWidth: '560px'
            }}>
              Upload PDFs, spreadsheets, and documents. Extract structured information with AI and get instant insights.
            </p>

            {/* CTA Buttons - Primary + Secondary */}
            {!userId ? (
              <CTAButtons />
            ) : (
              <div className="pt-4">
                <Link
                  href="/dashboard"
                  style={{
                    height: '36px',
                    padding: '0 16px',
                    fontSize: '15px',
                    fontWeight: 'var(--font-weight-medium)',
                    color: 'white',
                    background: 'var(--color-accent)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    textDecoration: 'none',
                    transition: 'background 120ms ease-out',
                    letterSpacing: '-0.006em',
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}
                >
                  Go to Dashboard
                </Link>
              </div>
            )}
          </div>

          {/* Product Screenshot - Real UI preview */}
          <div style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            background: 'var(--color-surface)',
            marginBottom: '96px'
          }}>
            <div style={{
              padding: '48px',
              background: 'var(--color-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '400px'
            }}>
              <div style={{
                textAlign: 'center',
                color: 'var(--color-text-tertiary)',
                fontSize: '13px',
                fontWeight: 'var(--font-weight-medium)'
              }}>
                <FileText className="w-12 h-12 mx-auto mb-3" style={{ opacity: 0.3 }} />
                Product Interface Preview
              </div>
            </div>
          </div>

          {/* Features - Simple three-column grid, no icons glued to labels */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '48px',
            paddingTop: '32px',
            borderTop: '1px solid var(--color-border-subtle)'
          }}>
            <div>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-primary)',
                marginBottom: '8px',
                letterSpacing: '-0.006em'
              }}>
                Smart Extraction
              </h3>
              <p style={{
                fontSize: '15px',
                fontWeight: 'var(--font-weight-regular)',
                color: 'var(--color-text-secondary)',
                lineHeight: '1.5'
              }}>
                Automatically extract key information from any document format with precision.
              </p>
            </div>

            <div>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-primary)',
                marginBottom: '8px',
                letterSpacing: '-0.006em'
              }}>
                AI Processing
              </h3>
              <p style={{
                fontSize: '15px',
                fontWeight: 'var(--font-weight-regular)',
                color: 'var(--color-text-secondary)',
                lineHeight: '1.5'
              }}>
                Advanced AI models understand context and meaning to deliver accurate results.
              </p>
            </div>

            <div>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-primary)',
                marginBottom: '8px',
                letterSpacing: '-0.006em'
              }}>
                Interactive Chat
              </h3>
              <p style={{
                fontSize: '15px',
                fontWeight: 'var(--font-weight-regular)',
                color: 'var(--color-text-secondary)',
                lineHeight: '1.5'
              }}>
                Ask questions and get instant answers about your documents through natural conversation.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer - Minimal hairline */}
      <footer style={{ 
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-bg)'
      }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 flex items-center justify-between">
          <span style={{
            fontSize: '13px',
            fontWeight: 'var(--font-weight-regular)',
            color: 'var(--color-text-tertiary)'
          }}>
            © 2026 MESH
          </span>
          <div className="flex items-center gap-6">
            <FooterLink>Privacy</FooterLink>
            <FooterLink>Terms</FooterLink>
          </div>
        </div>
      </footer>
    </div>
  );
}
