# Trident - Setup and Installation Guide

This guide provides step-by-step instructions to set up and run the Trident dual-model OCR pipeline on your local machine.

## Prerequisites
Before you begin, ensure you have the following installed on your system:
- **Python 3.8 or higher** (for the backend) - [Download Python](https://www.python.org/downloads/)
- **Node.js 18 or higher** (for the frontend) - [Download Node.js](https://nodejs.org/)

## Step 1: Extract the Project
Extract the provided Trident zip file to a folder on your computer.

## Step 2: Environment Configuration
The project relies on external AI providers (OpenAI and Google) for processing. You need to provide API keys for the services you intend to use.

1. In the root directory of the project, look for a `.env` file. If it doesn't exist, create a new file named `.env`.
2. Open the `.env` file in any text editor and configure your API keys:
   ```env
   # ── AI Providers ──
   OPENAI_API_KEY=your_openai_api_key_here
   GOOGLE_API_KEY=your_google_api_key_here

   # ── Model Names ──
   OPENAI_MODEL=gpt-4o  # Replace with gpt-5 if you have access
   GOOGLE_MODEL=gemini-1.5-pro # Replace with gemini-3.1-pro if you have access

   # ── CORS ──
   FRONTEND_ORIGIN=http://localhost:3000
   ```
*(Note: A backup configuration file is also located at `backend/.env.example` for reference).*

## Step 3: Set up the Backend (FastAPI)
The backend is powered by Python. It's highly recommended to use a virtual environment to avoid conflicting dependencies.

1. Open a terminal (or command prompt) and navigate to the `backend` folder:
   ```bash
   cd path/to/Trident/backend
   ```
2. Create and activate a virtual environment:
   - **Windows:**
     ```bash
     python -m venv .venv
     .venv\Scripts\activate
     ```
   - **Mac/Linux:**
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```
3. Install the required Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the backend server:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   The backend API will now be running at `http://localhost:8000`. You can view the interactive API documentation at `http://localhost:8000/docs`.

## Step 4: Set up the Frontend (Next.js)
The frontend is powered by Next.js and requires Node.js.

1. Open a **new** terminal window (keep the backend running in the other one) and navigate to the `frontend` folder:
   ```bash
   cd path/to/Trident/frontend
   ```
2. Install the required Node.js dependencies:
   ```bash
   npm install
   ```
3. Start the frontend development server:
   ```bash
   npm run dev
   # or with explicit --host flag:
   npm run dev -- --host
   ```

## Step 5: Start Using Trident
Open your web browser and go to:
- **Local:** `http://localhost:3000`
- **Network / IP:** `http://<your-ip>:3000` (e.g. `http://192.168.1.87:3000`)

You should now see the Trident interactive UI!

## Troubleshooting
- **Port Conflicts:** If ports 8000 or 3000 are already in use, you will need to stop those services.
- **Initial Load Time:** On the very first run, the backend may take a moment to automatically download the layout detection model (`yolov8x-doclaynet.pt`). Please be patient during the first processing request.
