# Mesh

> Automated, schema-induced document intelligence pipeline with exact source snippet grounding, multi-format client previewers, and a minimal-context Q&A assistant.

MESH transforms heterogeneous documents (**PDF**, **DOCX**, **XLSX**, **CSV**, **TXT**) into type-safe, validated JSON with exact substring citations, zero-token deterministic extraction for tabular data, and full session persistence across browser reloads.

- 📐 **Architecture Specification:** See [design.md](./design.md)
- 🧠 **Engineering Decisions & Tradeoffs:** See [decisions.md](./decisions.md)

---

## Features

- **Multi-Format Ingestion**: Supports `.pdf`, `.docx`, `.xlsx`, `.csv`, and `.txt`.
- **Two-Track Pipeline**:
  - _Path A (Tabular: CSV/XLSX)_: Deterministic parsing via `papaparse` and `xlsx` (zero LLM tokens burned for row data).
  - _Path B (Unstructured Text: PDF/DOCX/TXT)_: Two-pass schema induction with Gemini 3.6 Flash and grammar-constrained JSON decoding (`responseSchema`).
- **Hallucination Defense**: Every extracted field must quote the exact `source_snippet` from the document; documents are wrapped inside `<untrusted_document>` XML tags to neutralize indirect prompt injection.
- **Minimal-Context Q&A Assistant**: Injects only pre-verified structured JSON into chat prompts, reducing token overhead by ~98% and delivering sub-second grounded answers.
- **Native Multi-Format Previews**: High-DPI Retina PDF canvas (`pdfjs-dist`), native Word XML stylesheet renderer (`docx-preview`), and virtualized spreadsheet grid.
- **Session Persistence**: Syncs document state to URL query parameters and PostgreSQL, restoring dashboard state on page reload without re-running LLM extraction.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS, Shadcn/UI, Lucide Icons
- **Database**: PostgreSQL (Neon Serverless) with Prisma ORM
- **File Storage**: Supabase Storage
- **Authentication**: Clerk
- **AI / LLM**: Google Gemini 3.6 Flash (`@google/genai`)

---

## Local Development Setup

### Prerequisites

Ensure you have the following installed / configured:

- **Node.js**: `v20.x` or later
- **Package Manager**: `npm`, `pnpm`, or `bun`
- **PostgreSQL Database**: A running local Postgres instance ($\ge 15$) or a free serverless database on [Neon](https://neon.tech)
- **Clerk Account**: Free account at [Clerk](https://clerk.com) for authentication
- **Supabase Account**: Free project at [Supabase](https://supabase.com) for binary file storage
- **Google AI Studio Key**: API key for Gemini models from [Google AI Studio](https://aistudio.google.com/)

---

### Step 1: Clone the Repository & Install Dependencies

```bash
git clone <your-repo-url>
cd mesh
npm install
```

---

### Step 2: Configure Environment Variables

Copy `.env.example` to create your local environment file:

```bash
cp .env.example .env.local
```

Open `.env.local` and populate the required keys:

```bash
# ---------------------------------------------------------------------------
# Database (PostgreSQL / Neon)
# ---------------------------------------------------------------------------
DATABASE_URL="postgresql://user:password@ep-cool-pool-12345.us-east-2.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:password@ep-cool-pool-12345.us-east-2.aws.neon.tech/neondb?sslmode=require"

# ---------------------------------------------------------------------------
# Clerk Authentication (https://dashboard.clerk.com/)
# ---------------------------------------------------------------------------
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
CLERK_WEBHOOK_SECRET="whsec_..." # Required if using Clerk user sync webhooks

NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL="/dashboard"
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL="/dashboard"

# ---------------------------------------------------------------------------
# Supabase Storage (https://supabase.com/dashboard)
# ---------------------------------------------------------------------------
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
SUPABASE_BUCKET_NAME="MESH"

# ---------------------------------------------------------------------------
# Google Gemini API (https://aistudio.google.com/)
# ---------------------------------------------------------------------------
GEMINI_API_KEY="AIzaSy..."
GEMINI_MODEL="gemini-3.6-flash"
```

---

### Step 3: Set Up the Supabase Storage Bucket

1. Log into your [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **Storage** $\to$ **New Bucket**.
3. Name the bucket `MESH` (matching `SUPABASE_BUCKET_NAME` in your `.env.local`).
4. Set the bucket to **Public** (or configure Row Level Security policies allowing reads for public URLs and uploads via the service role key).

---

### Step 4: Initialize the Database (Prisma)

Generate the Prisma Client and push the schema to your PostgreSQL database:

```bash
# Generate the Prisma client types
npx prisma generate

# Push the schema migrations to PostgreSQL
npx prisma db push
```

_(Optional)_ To inspect your database tables and rows visually:

```bash
npx prisma studio
```

---

### Step 5: Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

- Sign up / Sign in with Clerk.
- You will be redirected to `/dashboard`.
- Drag and drop any supported file (`.pdf`, `.docx`, `.xlsx`, `.csv`, `.txt`) into the left dropzone.
- Watch the document render in the native viewer while the extraction streams structured JSON with confidence scores and source citations on the right panel.
- Click **"Ask Document"** to chat with the document using minimal-context Q&A.

---

## Project Structure

```
mesh/
├── decisions.md                 # Running log of real architectural calls, tradeoffs & limits
├── design.md                    # System architecture, data flow & component contracts
├── prisma/
│   └── schema.prisma            # PostgreSQL schema (User, Document, Extraction, ChatMessage)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── documents/
│   │   │   │   ├── [id]/process # Pipeline orchestrator (deterministic or schema induction)
│   │   │   │   └── [id]/chat    # Minimal-context Q&A assistant route
│   │   │   └── uploads/         # Direct-to-Supabase file ingestion route
│   │   ├── dashboard/           # Main split-panel intelligence dashboard
│   │   └── page.tsx             # Marketing landing page
│   ├── components/
│   │   └── dashboard/
│   │       ├── document-upload-panel.tsx  # Drag & drop upload handler
│   │       ├── pdf-canvas-preview.tsx     # High-DPI Retina PDF canvas renderer
│   │       ├── docx-viewer.tsx            # Native Word XML previewer
│   │       ├── json-output-panel.tsx      # Typewriter JSON streaming viewer
│   │       ├── chat-sidebar.tsx           # Interactive Q&A drawer
│   │       └── split-dashboard.tsx        # Top-level state coordinator
│   └── lib/
│       ├── pipeline/
│       │   ├── sanitizer.ts       # Control character & zero-width space stripping
│       │   ├── tabular-parser.ts  # Zero-LLM PapaParse & SheetJS tabular parser
│       │   ├── text-extractor.ts  # pdf2json & mammoth text extraction
│       │   ├── schema-inducer.ts  # Pass 1: Category & schema induction
│       │   ├── extractor.ts       # Pass 2: Grounded field extraction with source snippets
│       │   ├── retry.ts           # Exponential backoff with jitter for Gemini 503/429
│       │   └── orchestrator.ts    # Central pipeline coordinator & Prisma transaction
│       ├── prisma.ts              # Global Prisma client singleton
│       └── supabase-admin.ts      # Supabase admin client singleton
```

---

## Known Limitations

See [decisions.md](./decisions.md#project-limitations--honest-constraints) for detailed technical discussion on system constraints, including:

- No OCR for scanned/photocopied documents without embedded text layers.
- First-sheet limitation on multi-tab Excel workbooks.
- Synchronous serverless HTTP timeout window on 100+ page documents.
- Lack of pixel-coordinate visual bounding boxes for PDF source snippets.
