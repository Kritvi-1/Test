"""
Assessment Data Retriever Backend - Canvas LMS
(Grades + Analytics; UID/Program mapping + grading + roster upload for majors)
"""

from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Optional, List, Dict, Any
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import io
import requests
import pdfplumber  # make sure this is in requirements.txt

app = FastAPI(title="Assessment Data Retriever Backend", version="2.3.0")
# ========= FRONTEND =========
app.mount("/static", StaticFiles(directory="frontend"), name="static")


# ========= CORS =========
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_credentials=True,
    allow_headers=["*"],
)

# ========= CONFIG =========
CANVAS_BASE_URL = os.getenv("CANVAS_BASE_URL", "https://usflearn.instructure.com")
CANVAS_API_BASE = f"{CANVAS_BASE_URL}/api/v1"


# ========= HELPERS =========
def get_headers(token: str) -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }


def fetch_all_pages(url: str, headers: dict, params: dict = None) -> List[Any]:
    """
    Canvas returns paginated results via Link headers.
    This helper walks all pages and returns a single list.
    """
    results: List[Any] = []
    next_url = url
    first = True

    while next_url:
        res = requests.get(next_url, headers=headers, params=params if first else None)
        first = False

        if res.status_code != 200:
            raise HTTPException(res.status_code, res.text)

        data = res.json()
        if isinstance(data, list):
            results.extend(data)
        else:
            results.append(data)

        next_url = res.links.get("next", {}).get("url")

    return results


# ========= BASIC ENDPOINTS =========
@app.get("/")
async def root():
    return FileResponse("frontend/index.html")



@app.get("/api/courses")
async def get_courses(token: str = Query(...)):
    """
    Returns all active courses for the authenticated Canvas user.
    """
    headers = get_headers(token)
    url = f"{CANVAS_API_BASE}/courses"
    params = {
        "enrollment_state": "active",
        "state[]": ["available", "completed"],
        "include[]": ["term"],
        "per_page": 100,
    }
    return JSONResponse(content=fetch_all_pages(url, headers, params))


@app.get("/api/assignments")
async def get_assignments(
    course_id: int = Query(...),
    token: str = Query(...),
):
    """
    Returns assignments in a course (with needs_grading_count).
    """
    headers = get_headers(token)
    url = f"{CANVAS_API_BASE}/courses/{course_id}/assignments"
    params = {
        "include[]": ["submission"],
        "order_by": "due_at",
        "per_page": 100,
    }
    return JSONResponse(content=fetch_all_pages(url, headers, params))


@app.get("/api/assignment")
async def get_assignment(
    course_id: int = Query(...),
    assignment_id: int = Query(...),
    token: str = Query(...),
):
    """
    Return a single assignment's details.
    """
    headers = get_headers(token)
    url = f"{CANVAS_API_BASE}/courses/{course_id}/assignments/{assignment_id}"
    res = requests.get(url, headers=headers)
    if res.status_code != 200:
        raise HTTPException(res.status_code, res.text)
    return JSONResponse(content=res.json())


# ========= ROSTER / SECTION HELPERS =========
def get_section_map(course_id: int, headers: dict) -> Dict[int, str]:
    """
    section_id -> section_name
    Used as the "Program" in the UI.
    """
    url = f"{CANVAS_API_BASE}/courses/{course_id}/sections"
    result = fetch_all_pages(url, headers, params={"per_page": 100})
    return {sec["id"]: sec["name"] for sec in result}


def get_enrollment_map(course_id: int, headers: dict) -> Dict[int, Dict[str, Any]]:
    """
    Return dict:
      user_id -> { sis_user_id, login_id, course_section_id }

    We use enrollments because submissions' embedded user objects
    often lack sis_user_id (U-number).
    """
    url = f"{CANVAS_API_BASE}/courses/{course_id}/enrollments"
    params = {
        "type[]": "StudentEnrollment",
        "include[]": "user",
        "per_page": 100,
    }
    enrollments = fetch_all_pages(url, headers, params)

    mapping: Dict[int, Dict[str, Any]] = {}
    for e in enrollments:
        user = e.get("user", {}) or {}
        uid = user.get("id")
        if not uid:
            continue
        mapping[uid] = {
            "sis_user_id": user.get("sis_user_id"),
            "login_id": user.get("login_id"),
            "course_section_id": e.get("course_section_id"),
        }
    return mapping


# ========= SUBMISSIONS (GRADES + PROGRAM) =========
@app.get("/api/submissions")
async def get_submissions(
    course_id: int = Query(...),
    assignment_id: int = Query(...),
    token: str = Query(...),
):
    """
    Returns per-student submission info for one assignment:
      - user_name
      - login_id
      - sis_user_id (UID)
      - section_name (Program – Canvas section name)
      - submitted / missing / workflow_state
      - score
    """
    headers = get_headers(token)

    # Enrollment + section data for UID / program
    roster_map = get_enrollment_map(course_id, headers)
    section_map = get_section_map(course_id, headers)

    # Submissions
    subs_url = f"{CANVAS_API_BASE}/courses/{course_id}/assignments/{assignment_id}/submissions"
    params = {
        "include[]": ["user"],
        "per_page": 100,
    }
    submissions = fetch_all_pages(subs_url, headers, params)

    output = []
    for s in submissions:
        user = s.get("user", {}) or {}
        user_id = s.get("user_id")

        enrollment = roster_map.get(user_id, {})
        section_name = section_map.get(enrollment.get("course_section_id")) if enrollment else None

        output.append(
            {
                "user_id": user_id,
                "user_name": user.get("name"),
                "login_id": enrollment.get("login_id") or user.get("login_id"),
                "sis_user_id": enrollment.get("sis_user_id"),  # U-number
                "section_name": section_name or "Unknown Section",  # Program
                "submitted": bool(s.get("submitted_at")),
                "missing": s.get("missing", False),
                "workflow_state": s.get("workflow_state"),
                "score": s.get("score"),
            }
        )

    return JSONResponse(content=output)


# ========= ASSIGNMENT ANALYTICS (BY PROGRAM / SECTION) =========
@app.get("/api/analytics/assignment")
async def analytics_assignment(
    course_id: int = Query(...),
    assignment_id: int = Query(...),
    token: str = Query(...),
):
    """
    Compute analytics using grades ONLY, grouped by section (Program).
    """
    headers = get_headers(token)

    sections = get_section_map(course_id, headers)
    roster = get_enrollment_map(course_id, headers)

    subs_url = f"{CANVAS_API_BASE}/courses/{course_id}/assignments/{assignment_id}/submissions"
    submissions = fetch_all_pages(subs_url, headers, params={"per_page": 100})

    stats: Dict[str, Dict[str, float]] = {}
    class_sum = 0.0
    class_graded = 0
    class_count = 0

    for s in submissions:
        user_id = s.get("user_id")
        class_count += 1

        sec_id = roster.get(user_id, {}).get("course_section_id")
        section = sections.get(sec_id, "Unknown Section")

        bucket = stats.setdefault(section, {"count": 0, "graded": 0, "sum": 0.0})
        bucket["count"] += 1

        if s.get("score") is not None:
            score = float(s.get("score") or 0)
            bucket["graded"] += 1
            bucket["sum"] += score
            class_graded += 1
            class_sum += score

    response = []
    for sec, data in stats.items():
        avg = (data["sum"] / data["graded"]) if data["graded"] else None
        response.append(
            {
                "section": sec,
                "total_students": data["count"],
                "graded": data["graded"],
                "average_score": avg,
            }
        )

    class_avg = (class_sum / class_graded) if class_graded else None
    payload = {
        "by_section": response,
        "class": {
            "total_students": class_count,
            "graded": class_graded,
            "average_score": class_avg,
        },
    }
    return JSONResponse(content=payload)


# ========= SINGLE SUBMISSION (FOR GRADING PAGE) =========
@app.get("/api/submission/{user_id}")
async def get_single_submission(
    user_id: int,
    course_id: int = Query(...),
    assignment_id: int = Query(...),
    token: str = Query(...),
):
    """
    Return a single student's submission for the grading page.
    """
    headers = get_headers(token)
    url = f"{CANVAS_API_BASE}/courses/{course_id}/assignments/{assignment_id}/submissions/{user_id}"
    params = {
        "include[]": ["submission_comments", "user"],
    }
    res = requests.get(url, headers=headers, params=params)
    if res.status_code != 200:
        raise HTTPException(res.status_code, res.text)
    return JSONResponse(content=res.json())


# ========= GRADE UPDATE (FOR GRADING PAGE) =========
@app.put("/api/grade")
async def put_grade(
    course_id: int = Query(...),
    assignment_id: int = Query(...),
    user_id: int = Query(...),
    score: float = Query(...),
    comment: Optional[str] = Query(None),
    token: str = Query(...),
):
    """
    Update a student's grade (and optional text comment) for an assignment.
    """
    headers = get_headers(token)
    url = f"{CANVAS_API_BASE}/courses/{course_id}/assignments/{assignment_id}/submissions/{user_id}"

    payload: Dict[str, Any] = {
        "submission": {"posted_grade": score}
    }
    if comment:
        payload["comment"] = {"text_comment": comment}

    res = requests.put(url, headers=headers, json=payload)
    if res.status_code not in (200, 201):
        raise HTTPException(res.status_code, res.text)
    return JSONResponse(content=res.json())


# ========= ROSTER PDF UPLOAD (MAJORS) =========
@app.post("/api/upload_roster")
async def upload_roster(file: UploadFile = File(...)):
    """
    Accept a USF Photo Roster PDF and return a mapping:

    {
      "U12345678": { "name": "Student Name", "major": "Computer Science" },
      ...
    }

    Frontend then merges this with Canvas submissions by sis_user_id (U-number).
    
    Expected PDF format (table):
    Name          SIS ID       Major
    John Doe      U12345678    Computer Science
    """
    filename = file.filename or ""
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF.")

    pdf_bytes = await file.read()

    try:
        roster: Dict[str, Dict[str, str]] = {}
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                lines = text.splitlines()
                
                for raw_line in lines:
                    line = raw_line.strip()
                    if not line:
                        continue

                    # Skip header lines
                    if "Name" in line and "SIS" in line and "ID" in line:
                        continue
                    if "Major" in line and len(line) < 50:
                        continue
                    if line.startswith("USF Photo Roster"):
                        continue

                    parts = line.split()
                    if len(parts) < 3:
                        continue

                    # Look for U-number token: e.g., U91687641
                    uid = None
                    uid_idx = -1
                    for i, token in enumerate(parts):
                        if token.startswith("U") and len(token) > 1 and token[1:].isdigit():
                            uid = token
                            uid_idx = i
                            break

                    if not uid or uid_idx <= 0:
                        continue

                    # Everything before UID is the name
                    name = " ".join(parts[:uid_idx])

                    # Everything after UID is the major
                    # Format: "Zyad Abd-Elrahman U11758077 Computer Engineering"
                    major_parts = parts[uid_idx + 1:]
                    major = " ".join(major_parts).strip() if major_parts else "Unknown Major"

                    # Only add valid entries
                    if uid and name and major and major != "Unknown Major":
                        roster[uid] = {
                            "name": name,
                            "major": major,
                        }

        return JSONResponse(content=roster)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF parsing failed: {e}")


# ========= MAIN =========
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8765)