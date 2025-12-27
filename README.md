# Super Master Resume

A full-stack application to manage your master resume, track job applications, and generate ATS-optimized LaTeX resumes using Gemini AI.

## Architecture

- **Frontend**: Next.js (React), Tailwind CSS.
- **Backend**: Node.js, Express.
- **Database**: MongoDB.
- **AI**: Google Gemini API.

## Setup Instructions

### 1. Backend Setup

1.  Navigate to `backend` directory: `cd backend`
2.  Install dependencies: `npm install` (Already done)
3.  Configure Environment Variables:
    -   Open `backend/.env`
    -   Add your **GEMINI_API_KEY** (Get one from [Google AI Studio](https://makersuite.google.com/app/apikey))
    -   Ensure `MONGO_URI` is correct (defaults to local).
4.  **Start MongoDB (Important)**:
    Since you need a database running, use Docker:
    ```bash
    # Run this in the project root (where docker-compose.yml is)
    docker-compose up -d
    ```
5.  Start the server:
    ```bash
    npm start
    # or for development with auto-restart:
    npm run dev
    # (You might need to add "dev": "nodemon server.js" to package.json scripts)
    ```

### 2. Frontend Setup

1.  Navigate to `frontend` directory: `cd frontend`
2.  Install dependencies: `npm install` (Already done)
3.  Start the development server:
    ```bash
    npm run dev
    ```
4.  Open [http://localhost:3000](http://localhost:3000)

## Features Implemented (Backend API)

-   **Master Profile**: Store and update all your details (`/api/master`).
-   **Job Tracker**: CRUD for job applications (`/api/jobs`).
-   **Resume Generator**: Create resumes tailored to specific jobs (`/api/resumes`).
-   **AI Chat**: Context-aware chat with Gemini (`/api/ai`).

## Next Steps

-   Build the UI Forms in `frontend/app/profile/page.tsx`.
-   Build the Job Board in `frontend/app/dashboard/page.tsx`.
-   Integrate the API calls in the frontend.
