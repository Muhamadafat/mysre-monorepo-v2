# MySRE Frontend Ecosystem

![Next.js](https://img.shields.io/badge/Next.js-15.4-000000?style=for-the-badge&logo=nextdotjs)
![React](https://img.shields.io/badge/React-19.1-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-06B6D4?style=for-the-badge&logo=tailwindcss)
![Mantine](https://img.shields.io/badge/Mantine-v7.17-339AF0?style=for-the-badge&logo=mantine&logoColor=white)
![Turborepo](https://img.shields.io/badge/Turborepo-2.8-FF0080?style=for-the-badge&logo=turborepo)

The frontend monorepo ecosystem for **MySRE** (Smart Research Environment). Built on a modern **Turborepo** architecture, this repository houses multiple Next.js applications and shared workspace packages, delivering a high-fidelity visual and computational workbench for scientific research.

---

## 🏛️ Ecosystem Architecture

This monorepo leverages **npm workspaces** and **Turborepo** to orchestrate independent, high-performance web applications and shared modules, ensuring code reusability and visual consistency.

### 📱 Applications (Workspaces: `/apps`)

| App | Local Port | Key Capabilities | Core Tech |
| :--- | :---: | :--- | :--- |
| **`main`** | `3000` | Landing page, central portal, and routing hub for the MySRE ecosystem. | Next.js, Mantine, Next-Themes |
| **`profile`** | `3001` | User profile settings, workspace coordination, and subscription management. | Next.js, Mantine Form |
| **`brain`** | `3002` | Core RAG and Knowledge Graph interface. Dynamically visualizes isolated tenant graphs, controls STRICT/RESEARCH search modes, and tracks reader attention. | Next.js, `vis-network`, `react-pdf-highlighter`, `webgazer` |
| **`writer`** | `3003` | Dynamic block-based document writing workbench with integrated AI assistance and LaTeX math typesetting. | Next.js, BlockNote Editor, Vercel AI SDK (`@ai-sdk/google`), `react-katex` |

### 📦 Shared Packages (Workspaces: `/packages`)

*   **`@sre-monorepo/lib`**: Core database (Prisma Client `^6.12.0`) and authentication (Supabase SSR & JS Clients `^2.52.0`) integration wrapper. Acts as the main data bridge for the applications.
*   **`@sre-monorepo/components`**: Shared, high-fidelity UI components built on Mantine primitives.
*   **`@repo/ui`**: Primitive styling/component definitions.
*   **`@repo/styles`**: Design token definitions and global CSS overrides.
*   **`@repo/types`**: Centralized TypeScript data contracts, synchronizing schema changes from the FastAPI backend.
*   **`@repo/typescript-config` & `@repo/eslint-config`**: Standardized workspace tooling configurations.

---

## ⚙️ Environment Variables Setup

Create a `.env` file in the root of the monorepo using the template below:

```env
# Canonical Backend URL (backend-sre)
NEXT_PUBLIC_FASTAPI_URL=http://localhost:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Supabase Configurations (Authentication & Storage)
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT-ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_[YOUR_KEY]

# Database Server-Side (Used strictly by Prisma)
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:6543/postgres?pgbouncer=true&sslmode=require
```

For application-specific variables, create `.env.local` inside `apps/brain/`:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3002
NEXT_PUBLIC_MAIN_APP_URL=http://localhost:3000
SKIP_AUTH=false
```

---

## 🛠️ Development Quick Start

### 1. Prerequisites
*   Node.js version `>= 18`
*   NPM version `>= 10.9.2`

### 2. Dependency Installation
Initialize packages and link workspaces globally:
```bash
npm install
```

### 3. API Data Contract Synchronization
Synchronize TypeScript frontend typings with the backend's Pydantic model OpenAPI specifications:
```bash
npm run generate:types
```
*(Ensure the MySRE FastAPI backend is active at `http://localhost:8000` before running the command).*

### 4. Database Schema Sync (Prisma)
Prisma operations are managed from the root package:
*   **Client Generation:** `npm run db:generate`
*   **Deploy Dev Migrations:** `npm run db:migrate:dev`
*   **Open Database UI:** `npm run db:studio`

### 5. Running the Development Servers
Launch all applications simultaneously under a unified Turborepo pipeline:
```bash
npm run dev
```

To run a specific application in isolation:
```bash
# Run the Brain RAG & Graph application
npx turbo dev --filter=brain

# Run the AI Document Writer application
npx turbo dev --filter=writer
```

### 6. Production Compilation
Build all applications and packages for production:
```bash
npm run build
```

---

*Created By Muhammad Zaidan Rafat*
