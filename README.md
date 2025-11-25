# AI Grader - Canvas LMS Analytics Dashboard

A web-based application that integrates with Canvas LMS to provide enhanced grading analytics, including student major tracking and analytics by academic program.

## Features

- **Canvas LMS Integration** - Connect to Canvas courses and assignments
- **Analytics Dashboard** - View submission statistics by section/program
- **PDF Roster Upload** - Upload USF Photo Roster to track student majors
- **Major-Based Analytics** - Compare performance across different majors (e.g., Computer Science vs Computer Engineering)
- **Submission Tracking** - Monitor graded vs ungraded assignments

## Technical Stack

### Backend
- **Framework:** FastAPI (Python)
- **PDF Processing:** pdfplumber
- **API Integration:** Canvas LMS REST API
- **Server:** Uvicorn

### Frontend
- **Language:** Vanilla JavaScript (ES6+)
- **Styling:** CSS3
- **HTTP Server:** Python http.server

## Prerequisites

- Python 3.8 or higher
- Canvas LMS API Token
- Modern web browser (Chrome, Firefox, Edge, Safari)

## Installation

### 1. Clone/Download the Project

```bash
cd AI_Grader_Research/WebApp
```

### 2. Install Backend Dependencies

Navigate to the backend directory:

```bash
cd backend
pip install -r requirements.txt
```

**Required packages:**
- fastapi==0.104.1
- uvicorn==0.24.0
- requests==2.31.0
- python-multipart==0.0.6
- pdfplumber==0.10.3

### 3. Get Your Canvas API Token

1. Log into Canvas (https://usflearn.instructure.com)
2. Go to **Account → Settings**
3. Scroll to **Approved Integrations**
4. Click **+ New Access Token**
5. Set purpose: "AI Grader Development"
6. Click **Generate Token**
7. **Copy and save the token** (you won't see it again!)

## Running the Application

### Step 1: Start the Backend Server

Open a terminal in the `backend` directory:

```bash
cd backend
python main.py
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8765 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

**Backend is now running on:** `http://localhost:8765`

### Step 2: Start the Frontend Server

Open a **new terminal** in the `frontend` directory:

```bash
cd frontend
python -m http.server 8000
```

You should see:
```
Serving HTTP on :: port 8000 (http://[::]:8000/) ...
```

**Frontend is now running on:** `http://localhost:8000`

### Step 3: Open the Application

1. Open your web browser
2. Navigate to: **http://localhost:8000**
3. You should see the AI Grader dashboard

## Using the Application

### First Time Setup

1. **Enter Canvas API Token**
   - Click the "🔑 Enter Canvas Token" button in the top-right
   - Paste your Canvas API token
   - Click "Connect"

2. **Select a Course**
   - Click on any course card to view its assignments

3. **View Assignments**
   - Toggle between "Needs Grading" and "Graded" tabs
   - Click "View Submissions" on any assignment

### Uploading a Roster

1. Navigate to any assignment's submission page
2. Locate the **"Class Roster (PDF)"** section
3. Click **"Choose File"**
4. Select your USF Photo Roster PDF
5. Wait for processing (you'll see a success message)
6. The page will automatically update with:
   - Student majors in the submissions table
   - Analytics by Major section with breakdowns

### Expected PDF Format

The roster PDF should contain student information in this format:
```
Name                SIS ID        Major
John Doe            U12345678     Computer Science
Jane Smith          U87654321     Computer Engineering
```

