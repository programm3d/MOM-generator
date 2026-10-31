# AI Minutes of Meeting (MoM) Generator

A single-purpose, local-first AI application that converts meeting transcripts into structured, evidence-backed Microsoft Word (`.docx`) Minutes of Meeting documents using the standard 6-column format.

---

## Features

- **Multi-Format Ingestion**: Supports `.docx`, `.pdf`, and `.txt` transcripts.
- **Scanned PDF Detection**: Automatically detects non-selectable/image-only PDFs and requests text-based transcripts.
- **Token-Aware Chunking**: Intelligently segments long transcripts (15+ pages) with configurable token limits and overlap to preserve speaker turns and contextual boundaries.
- **Evidence Traceability**: Validates quotes verbatim against source transcript segments; filters out hallucinations.
- **Strict 6-Column Output**: Follows the required schema:
  1. `Agenda No.` (1-based sequence)
  2. `Agenda` (concise topic heading)
  3. `Discussion Points` (readable bullet points)
  4. `Decision Made` (explicit decision or "Not specified")
  5. `Responsible Person` (named owner or "Not specified")
  6. `Timeline` (explicit deadline or "Not specified")
- **Dual Free LLM Architecture**:
  - **Primary**: Google Gemini 2.0 Flash via Google AI Studio (100% free tier, native JSON schema enforcement, 1M context window).
  - **Fallback**: Groq Cloud (Llama 3.3 70B, free tier, OpenAI-compatible).
- **Prompt Injection Defense**: Untrusted transcript text is delimited in `<meeting_transcript>` tags with explicit model directives to ignore embedded instructions.
- **Ephemeral Storage**: Uploads and generated documents are stored in temporary storage with automatic retention-based cleanup; no database required.

---

## Architecture

```text
React 19 + Vite + TypeScript (Client on :5173)
        │
        ▼ (Multipart Upload & Polling)
Express + Node.js + TypeScript (Server on :4000)
        │
        ├── Upload Validation & TempStorage (nanoid filenames, traversal protection)
        ├── Ingestion Adapters (Mammoth.js for DOCX, pdfjs-dist for PDF, UTF-8/BOM for TXT)
        ├── Transcript Normalization & Chunking (gpt-tokenizer, SourceSegment IDs)
        ├── AI Extraction & Consolidation (Gemini 2.0 Flash / Groq Llama 3.3 70B)
        ├── Runtime Zod Validation & Verbatim Evidence Verification
        ├── DOCX Renderer (Programmatic docx table with custom styles)
        └── Ephemeral Output Delivery & Lifecycle Cleanup
```

---

## Getting Started

### Prerequisites
- Node.js 18+ (tested on Node.js v24.15)
- Free Google AI Studio API Key from [https://aistudio.google.com/](https://aistudio.google.com/) (or free Groq key from [https://console.groq.com/](https://console.groq.com/))

### 1. Installation

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configuration

Create `.env` in the project root (or inside `server/`):

```env
# Server
NODE_ENV=development
PORT=4000
CLIENT_ORIGIN=http://localhost:5173

# Temporary File Storage & Uploads
UPLOAD_MAX_MB=25
TEMP_DIR=./tmp
JOB_RETENTION_MINUTES=120

# Primary LLM Provider: Google Gemini (Free tier)
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.0-flash
GEMINI_API_KEY=your_google_ai_studio_api_key_here

# Fallback LLM Provider: Groq Cloud (Free tier)
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# Chunking Parameters
CHUNK_MAX_TOKENS=6000
CHUNK_OVERLAP_TOKENS=300
```

### 3. Running the Application

You can start both server and client in development mode:

```bash
# Start server (runs on http://localhost:4000)
npm --prefix server run dev

# In another terminal, start client (runs on http://localhost:5173)
npm --prefix client run dev
```

Open your browser at **`http://localhost:5173`**.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check & active LLM provider info |
| `POST` | `/api/generations` | Upload transcript (`multipart/form-data`) & start pipeline |
| `GET` | `/api/generations/:id` | Poll generation status, current stage & progress |
| `GET` | `/api/generations/:id/download` | Download generated Microsoft Word `.docx` file |
| `DELETE` | `/api/generations/:id` | Cancel/clean up job files |

---

## Running Automated Tests

Run the full suite of 24 unit and end-to-end tests:

```bash
npm --prefix server test
```

Test coverage includes:
- **Milestone 1**: Upload validation, file limits, temp storage safety, job manager lifecycle.
- **Milestone 2**: Ingestion from `.txt`, `.docx` (Mammoth), `.pdf` (pdfjs-dist), corrupt file rejection, scanned PDF detection.
- **Milestone 3**: Transcript normalization, stable segment IDs, token-aware chunking with boundary overlap.
- **Milestone 4**: Zod schemas, evidence quote matching, fact extraction, single & multi-chunk consolidation.
- **Milestone 5**: DOCX programmatic table generation, column structure, style formatting, file integrity.
- **Milestone 6**: End-to-end pipeline execution from upload to verified DOCX download, prompt-injection isolation.

---

## Privacy & Security

- **Untrusted Source Material**: Transcripts are treated strictly as data payloads and enclosed within `<meeting_transcript>` delimiters. Prompt directives prohibit the model from interpreting content as executable instructions.
- **No Secret Leakage**: API keys and transcript text are never logged to console or output files.
- **Local Ephemeral Storage**: Uploaded files and generated documents are stored only in temporary folders and automatically purged after expiration.
- **Path Traversal Protection**: Temp storage filenames use cryptographic random IDs (`nanoid`) and validate path boundaries.
