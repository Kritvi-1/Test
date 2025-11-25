const API_BASE_URL = "http://localhost:8765/api";

class SubmissionsManager {
  constructor() {
    const p = new URLSearchParams(window.location.search);
    this.courseId = p.get("courseId");
    this.assignmentId = p.get("assignmentId");
    this.token = sessionStorage.getItem("canvasToken");

    this.assignment = null;
    this.analytics = null;
    this.submissions = [];
    this.roster = null;
    this.courseInfo = null; // Store full course info for CSV
    
    // Tabulator instances
    this.submissionsTable = null;
    this.majorAnalyticsTable = null;

    console.log("✅ SubmissionsManager constructed");
  }

  init() {
    console.log("🚀 Initializing SubmissionsManager...");

    // Back button
    const backBtn = document.getElementById("backButton");
    if (backBtn) {
      backBtn.onclick = () => {
        window.location.href = `assignments.html?courseId=${this.courseId}`;
      };
    }

    // Load roster from sessionStorage if available
    const rosterKey = `roster_${this.courseId}`;
    const storedRoster = sessionStorage.getItem(rosterKey);
    if (storedRoster) {
      try {
        this.roster = JSON.parse(storedRoster);
        console.log("✅ Loaded roster from sessionStorage:", Object.keys(this.roster).length, "students");
      } catch (e) {
        console.error("Failed to parse stored roster:", e);
      }
    }

    if (!this.courseId || !this.assignmentId || !this.token) {
      alert("Missing course / assignment / token.");
      return;
    }

    this.load();
  }

  // ---------- LOAD BASE DATA ----------
  async load() {
    this.showLoading();
    try {
      // FIXED: Also load course info for proper CSV course code
      const [a, an, subs, courses] = await Promise.all([
        fetch(
          `${API_BASE_URL}/assignment?course_id=${this.courseId}&assignment_id=${this.assignmentId}&token=${encodeURIComponent(
            this.token
          )}`
        ),
        fetch(
          `${API_BASE_URL}/analytics/assignment?course_id=${this.courseId}&assignment_id=${this.assignmentId}&token=${encodeURIComponent(
            this.token
          )}`
        ),
        fetch(
          `${API_BASE_URL}/submissions?course_id=${this.courseId}&assignment_id=${this.assignmentId}&token=${encodeURIComponent(
            this.token
          )}`
        ),
        fetch(
          `${API_BASE_URL}/courses?token=${encodeURIComponent(this.token)}`
        )
      ]);

      if (!a.ok) throw new Error("Failed to load assignment");
      if (!an.ok) throw new Error("Failed to load analytics");
      if (!subs.ok) throw new Error("Failed to load submissions");

      this.assignment = await a.json();
      this.analytics = await an.json();
      this.submissions = await subs.json();
      
      // Get course info
      if (courses.ok) {
        const courseList = await courses.json();
        this.courseInfo = courseList.find(c => String(c.id) === String(this.courseId));
      }

      // If roster already uploaded, merge it
      if (this.roster) {
        this.mergeRosterIntoSubmissions();
      }

      this.renderAssignment();
      this.renderAnalytics();
      this.renderSubmissionsTable();
      this.renderMajorAnalyticsTable();
      this.hideLoading();
    } catch (e) {
      console.error("Error loading data:", e);
      this.hideLoading();
      alert("Failed to load data: " + e.message);
    }
  }

  // ---------- ROSTER / MAJOR HANDLING ----------

  mergeRosterIntoSubmissions() {
    if (!this.roster || !Array.isArray(this.submissions)) return;

    this.submissions.forEach((s) => {
      const uid = s.sis_user_id;
      if (!uid) {
        s.major = "Unknown Program";
        return;
      }

      const info = this.roster[uid];
      if (info) {
        s.major = info.major || "Unknown Program";
      } else {
        s.major = "Unknown Program";
      }
    });
  }

  // FIXED: Better normalization for all majors including Cybersecurity, Biomedical Sciences, Data Intelligence
  normalizeProgram(major) {
    if (!major || major === "Unknown Program" || major === "Unknown Major") return "Unknown Program";
    
    // Remove ALL prefixes: course codes, section codes, brackets
    // Examples: "COT4400.001F24 [6M]Cybersecurity" → "Cybersecurity"
    //          "[4R]Computer Science" → "Computer Science"
    let normalized = major;
    
    // Remove course codes like "COT4400.001F24 "
    normalized = normalized.replace(/^[A-Z]{3}\d{4}\.\d+[A-Z]\d+\s+/g, "").trim();
    
    // Remove bracket codes like "[6M]", "[4R]", "[GD]", etc.
    normalized = normalized.replace(/^\[.*?\]\s*/g, "").trim();
    
    // Group similar programs (case-insensitive matching)
    const lowerProgram = normalized.toLowerCase();
    
    if (lowerProgram.includes("computer science")) {
      return "Computer Science";
    }
    if (lowerProgram.includes("computer engineering")) {
      return "Computer Engineering";
    }
    if (lowerProgram.includes("mechanical engineering")) {
      return "Mechanical Engineering";
    }
    if (lowerProgram.includes("cybersecurity")) {
      return "Cybersecurity";
    }
    if (lowerProgram.includes("biomedical science")) {
      return "Biomedical Sciences";
    }
    if (lowerProgram.includes("data intelligence")) {
      return "Data Intelligence";
    }
    if (lowerProgram.includes("economics")) {
      return "Economics";
    }
    
    // Return the cleaned version
    return normalized;
  }

  // ---------- UI RENDERING ----------

  renderAssignment() {
    const info = document.getElementById("assignmentInfo");
    const t = document.getElementById("assignTitle");
    const due = document.getElementById("assignDue");
    const pts = document.getElementById("assignPts");

    if (!info || !t || !due || !pts) return;

    t.textContent = this.assignment?.name || "Assignment";
    due.textContent = this.assignment?.due_at
      ? new Date(this.assignment.due_at).toLocaleString()
      : "—";
    pts.textContent = this.assignment?.points_possible ?? "—";

    info.style.display = "block";
  }

  renderAnalytics() {
    const cards = document.getElementById("analyticsCards");
    const classStats = document.getElementById("classStats");
    if (!cards || !classStats) return;

    cards.innerHTML = "";

    const bySec = this.analytics?.by_section || [];
    // FIXED: Filter out "Unknown Section"
    bySec.forEach((g) => {
      if (g.section === "Unknown Section") {
        return; // Skip Unknown Section
      }
      
      const div = document.createElement("div");
      div.className = "analytics-card";
      div.innerHTML = `
        <div style="font-weight:700">${this.escape(g.section)}</div>
        <div>Students: ${g.total_students}</div>
        <div>Graded: ${g.graded}</div>
        <div>Average: ${
          g.average_score == null ? "—" : Number(g.average_score).toFixed(2)
        }</div>
      `;
      cards.appendChild(div);
    });

    // FIXED: Remove the duplicate class stats line
    classStats.innerHTML = "";
  }

  renderMajorAnalyticsTable() {
    const container = document.getElementById("majorAnalytics");
    if (!container) return;

    if (!this.roster) {
      container.innerHTML =
        '<span class="muted">Upload a roster PDF to see analytics by program.</span>';
      return;
    }

    // Group by normalized program
    const stats = {};
    this.submissions.forEach((s) => {
      const rawMajor = s.major || "Unknown Program";
      const program = this.normalizeProgram(rawMajor);
      
      // FIXED: Skip Unknown Program entirely
      if (program === "Unknown Program") {
        return;
      }
      
      if (!stats[program]) {
        stats[program] = { count: 0, graded: 0, sum: 0 };
      }
      stats[program].count += 1;
      if (s.score != null) {
        stats[program].graded += 1;
        stats[program].sum += Number(s.score) || 0;
      }
    });

    // Convert to array for Tabulator
    const tableData = Object.entries(stats).map(([program, st]) => ({
      program: program,
      students: st.count,
      graded: st.graded,
      average: st.graded ? (st.sum / st.graded).toFixed(2) : "—"
    }));

    // Create Tabulator table
    if (this.majorAnalyticsTable) {
      this.majorAnalyticsTable.destroy();
    }

    // FIXED: Removed emoji, button gets CSS styling for proper spacing
    container.innerHTML = '<button id="downloadCSV">Download CSV</button><div id="majorAnalyticsTableDiv"></div>';

    // FIXED: Added REPORT column as last column
    this.majorAnalyticsTable = new Tabulator("#majorAnalyticsTableDiv", {
      data: tableData,
      layout: "fitColumns",
      columns: [
        { title: "PROGRAM", field: "program", sorter: "string", headerSort: true },
        { title: "STUDENTS", field: "students", sorter: "number", headerSort: true },
        { title: "GRADED", field: "graded", sorter: "number", headerSort: true },
        { title: "AVERAGE SCORE", field: "average", sorter: "number", headerSort: true },
        { 
          title: "REPORT", 
          field: "report",
          headerSort: false,
          formatter: (cell) => {
            return '<button class="report-btn" style="padding: 6px 16px; background: #1a73e8; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;">Report</button>';
          },
          cellClick: (e, cell) => {
            const program = cell.getRow().getData().program;
            this.openReportPage(program);
          }
        }
      ],
      initialSort: [
        { column: "program", dir: "asc" }
      ]
    });

    // Add CSV download functionality
    document.getElementById("downloadCSV").addEventListener("click", () => {
      this.downloadAnalyticsCSV(tableData);
    });
  }

  // FIXED: Navigate to report page with program data
  openReportPage(program) {
    // Store program data for report page
    sessionStorage.setItem('reportProgram', program);
    sessionStorage.setItem('reportCourseId', this.courseId);
    sessionStorage.setItem('reportAssignmentId', this.assignmentId);
    
    window.location.href = `report.html?courseId=${this.courseId}&assignmentId=${this.assignmentId}&program=${encodeURIComponent(program)}`;
  }

  // FIXED: Proper CSV format with correct course code and assignment points
  downloadAnalyticsCSV(tableData) {
    // Get proper course code from courseInfo
    const courseCode = this.courseInfo?.course_code || this.courseInfo?.name || "Course";
    const assignmentName = this.assignment?.name || "Assignment";
    const assignmentPoints = this.assignment?.points_possible || 100;
    const year = new Date().getFullYear();
    const semester = this.getSemester();
    
    // FIXED: Create CSV with metadata at the top including assignment points
    let csv = `Year: ${year}\nSemester: ${semester}\nCourse: ${courseCode}\nAssignment: ${assignmentName}\nAssignment Total Points: ${assignmentPoints}\n\n`;
    csv += "Program,Students,Graded,Average Score,70%,80%\n";
    
    tableData.forEach(row => {
      // Calculate 70% and 80% thresholds based on actual assignment points
      const threshold70 = assignmentPoints * 0.7;
      const threshold80 = assignmentPoints * 0.8;
      
      // Get submissions for this program
      const programSubmissions = this.submissions.filter(s => {
        const rawMajor = s.major || "Unknown Program";
        const normalized = this.normalizeProgram(rawMajor);
        return normalized === row.program;
      });
      
      const graded = programSubmissions.filter(s => s.score != null);
      const above70 = graded.filter(s => s.score >= threshold70).length;
      const above80 = graded.filter(s => s.score >= threshold80).length;
      
      const percent70 = graded.length > 0 ? ((above70 / graded.length) * 100).toFixed(0) + '%' : '0%';
      const percent80 = graded.length > 0 ? ((above80 / graded.length) * 100).toFixed(0) + '%' : '0%';
      
      csv += `${row.program},${row.students},${row.graded},${row.average},${percent70},${percent80}\n`;
    });
    
    // Create filename: Year-Semester-CourseCode-AssignmentName.csv
    const safeAssignmentName = assignmentName.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
    const filename = `${year}-${semester}-${courseCode}-${safeAssignmentName}.csv`;
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  getSemester() {
    const month = new Date().getMonth() + 1;
    if (month >= 1 && month <= 5) return "Spring";
    if (month >= 6 && month <= 7) return "Summer";
    return "Fall";
  }

  renderSubmissionsTable() {
    const container = document.getElementById("submissionsContainer");
    if (!container) return;

    // Include PROGRAM column
    const tableData = this.submissions.map((s) => {
      const status =
        s.workflow_state === "graded"
          ? "Graded"
          : s.submitted
          ? "Submitted"
          : "Pending";
      const score = s.score != null ? s.score : "—";
      const program = s.major || "Unknown Program";

      return {
        student_name: s.user_name || "Unknown",
        program: program,
        status: status,
        score: score
      };
    });

    // Create Tabulator table
    if (this.submissionsTable) {
      this.submissionsTable.destroy();
    }

    const tableDiv = document.getElementById("submissionsTable");
    if (!tableDiv) return;

    this.submissionsTable = new Tabulator("#submissionsTable", {
      data: tableData,
      layout: "fitDataStretch",
      columns: [
        { 
          title: "STUDENT", 
          field: "student_name", 
          sorter: "string", 
          headerSort: true,
          minWidth: 200
        },
        { 
          title: "PROGRAM", 
          field: "program", 
          sorter: "string", 
          headerSort: true,
          minWidth: 180
        },
        { 
          title: "STATUS", 
          field: "status", 
          sorter: "string", 
          headerSort: true,
          minWidth: 120
        },
        { 
          title: "SCORE", 
          field: "score", 
          sorter: "number", 
          headerSort: true,
          minWidth: 100
        }
      ],
      initialSort: [
        { column: "student_name", dir: "asc" }
      ]
    });

    container.style.display = "block";
    
    // Add download button handlers
    const downloadBtn = document.getElementById("downloadSubmissionsCSV");
    const downloadNoNamesBtn = document.getElementById("downloadSubmissionsCSVNoNames");
    
    if (downloadBtn) {
      downloadBtn.onclick = () => this.downloadSubmissionsCSV(false);
    }
    
    if (downloadNoNamesBtn) {
      downloadNoNamesBtn.onclick = () => this.downloadSubmissionsCSV(true);
    }
  }
  
  // Download Student Submissions as CSV
  downloadSubmissionsCSV(withoutNames) {
    const courseCode = this.courseInfo?.course_code || this.courseInfo?.name || "Course";
    const assignmentName = this.assignment?.name || "Assignment";
    const year = new Date().getFullYear();
    const semester = this.getSemester();
    
    let csv = `Year: ${year}\nSemester: ${semester}\nCourse: ${courseCode}\nAssignment: ${assignmentName}\n\n`;
    
    if (withoutNames) {
      // Without names - use Student No column
      csv += "Student No,Program,Status,Score\n";
      this.submissions.forEach((s, index) => {
        const status = s.workflow_state === "graded" ? "Graded" : s.submitted ? "Submitted" : "Pending";
        const score = s.score != null ? s.score : "";
        const program = this.normalizeProgram(s.major || "Unknown Program");
        csv += `${index + 1},${program},${status},${score}\n`;
      });
    } else {
      // With names
      csv += "Student,Program,Status,Score\n";
      this.submissions.forEach((s) => {
        const status = s.workflow_state === "graded" ? "Graded" : s.submitted ? "Submitted" : "Pending";
        const score = s.score != null ? s.score : "";
        const program = this.normalizeProgram(s.major || "Unknown Program");
        const name = s.user_name || "Unknown";
        csv += `"${name}",${program},${status},${score}\n`;
      });
    }
    
    const safeAssignmentName = assignmentName.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
    const suffix = withoutNames ? '-NoNames' : '';
    const filename = `${year}-${semester}-${courseCode}-${safeAssignmentName}-Submissions${suffix}.csv`;
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // ---------- helpers ----------

  showLoading() {
    const l = document.getElementById("loadingState");
    const sub = document.getElementById("submissionsContainer");
    const info = document.getElementById("assignmentInfo");
    if (l) l.style.display = "block";
    if (sub) sub.style.display = "none";
    if (info) info.style.display = "none";
  }

  hideLoading() {
    const l = document.getElementById("loadingState");
    if (l) l.style.display = "none";
  }

  escape(t) {
    const d = document.createElement("div");
    d.textContent = t ?? "";
    return d.innerHTML;
  }
}

// Wait for DOM to be fully loaded
document.addEventListener("DOMContentLoaded", () => {
  const manager = new SubmissionsManager();
  manager.init();
  window.submissionsManager = manager;
});