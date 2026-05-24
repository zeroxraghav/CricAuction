# Cricket Auction Platform

A comprehensive, real-time cricket auction platform built with a modern tech stack. Designed for scale and performance, it features live bidding, a host dashboard, and a live spectator view with real-time stats and leaderboards.

## Features
- **Real-Time Bidding Engine**: Powered by Socket.IO for zero-latency bid propagation.
- **Host Dashboard**: Dedicated dashboard to control the auction, pause/resume, revert players, and manage bids.
- **Spectator Live View**: Auto-updating live screen with dynamic "Auction Paused" overlays and squad leaderboards.
- **Authentication**: Secure login and role-management via Clerk.
- **Monorepo Architecture**: Clean separation between Frontend, Backend, and Shared types using NPM Workspaces.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), Tailwind CSS, Framer Motion
- **Backend**: Node.js, Express, Socket.IO, Prisma ORM
- **Database**: PostgreSQL
- **Authentication**: Clerk

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/en/) (v18 or higher)
- [NPM](https://www.npmjs.com/) (v9 or higher)
- A [PostgreSQL](https://www.postgresql.org/) database (e.g., Supabase or Neon)
- A [Clerk](https://clerk.com/) account for authentication

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/zeroxraghav/CricAuction.git
   cd CricAuction
   ```

2. **Install all dependencies**
   The project uses NPM workspaces. Running install from the root will install dependencies for the frontend, backend, and shared packages.
   ```bash
   npm install
   ```

3. **Environment Setup**
   You need to set up environment variables for both the backend and frontend.

   **Backend (`backend/.env`)**
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@your-db-host/postgres?pgbouncer=true"
   PORT=4000
   FRONTEND_URL="http://localhost:3000"
   CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```

   **Frontend (`frontend/.env.local`)**
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_API_URL="http://localhost:4000"
   ```

4. **Database Setup**
   Push the Prisma schema to your PostgreSQL database.
   ```bash
   cd backend
   npx prisma db push
   cd ..
   ```

5. **Build Shared Package**
   The `shared` workspace contains TypeScript definitions used by both the frontend and backend.
   ```bash
   npm run build --workspace=shared
   ```

### Running Locally

You can start both the frontend and backend servers concurrently from the root directory:

```bash
npm run dev
```

- **Frontend** will run on [http://localhost:3000](http://localhost:3000)
- **Backend** will run on [http://localhost:4000](http://localhost:4000)

## Project Structure

- `/frontend` - Next.js application (Spectator views, Host controls, Dashboards)
- `/backend` - Express API & Socket.IO server handling the live auction state
- `/shared` - Shared TypeScript interfaces and Socket Event constants

## Deployment

- The frontend is optimized for deployment on [Vercel](https://vercel.com).
- The backend can be deployed to any Node.js hosting platform (e.g., Render, Railway, AWS).
- Ensure that the `FRONTEND_URL` and `NEXT_PUBLIC_API_URL` environment variables are correctly updated in production to point to the deployed instances.
