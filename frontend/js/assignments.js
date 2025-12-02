const API_BASE_URL = '/api';


class AssignmentsManager {
  constructor() {
    this.courseId = null;
    this.assignments = [];
    this.canvasToken = sessionStorage.getItem("canvasToken");

    // cached HTML for the two tabs
    this.needsHTML = "";
    this.gradedHTML = "";

    this.init();
  }

  init() {
    const params = new URLSearchParams(window.location.search);
    this.courseId = params.get("courseId");

    if (!this.courseId || !this.canvasToken) {
      // No params or token: go to Courses (index.html)
      window.location.href = "index.html";
      return;
    }

    // Events
    document
      .getElementById("tabNeeds")
      .addEventListener("click", () => this.showTab("needs"));
    document
      .getElementById("tabGraded")
      .addEventListener("click", () => this.showTab("graded"));
    document
      .getElementById("backButton")
      .addEventListener("click", () => (window.location.href = "index.html"));

    // Load course name + assignments
    this.loadCourseInfo();
    this.loadAssignments();
  }

  async loadCourseInfo() {
    // Fetch all courses and find this one, just to show name + term
    try {
      const url = `${API_BASE_URL}/courses?token=${encodeURIComponent(
        this.canvasToken
      )}`;
      const res = await fetch(url);
      if (!res.ok) return;

      const courses = await res.json();
      const course = courses.find(
        (c) => String(c.id) === String(this.courseId)
      );
      if (!course) return;

      const el = document.getElementById("courseTitle");
      if (!el) return;

      const termName =
        (course.term && course.term.name) || (course.enrollment_term_id
          ? ""
          : "");
      el.textContent = termName
        ? `${course.name} • ${termName}`
        : course.name;
    } catch (e) {
      // If this fails, we just don't show the course name (no crash)
      console.error("Failed to load course info", e);
    }
  }

  async loadAssignments() {
    this.showLoading();
    try {
      const url = `${API_BASE_URL}/assignments?course_id=${this.courseId}&token=${encodeURIComponent(
        this.canvasToken
      )}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.assignments = await res.json();
      this.buildTabs();
      // CHANGED: Default to "graded" instead of "needs"
      this.showTab("graded");
      this.hideLoading();
    } catch (e) {
      console.error("Error loading assignments:", e);
      this.hideLoading();
      alert("Failed to load assignments. Please try again.");
    }
  }

  buildTabs() {
    const needs = this.assignments.filter(
      (a) => (a.needs_grading_count || 0) > 0
    );
    const graded = this.assignments.filter(
      (a) => (a.needs_grading_count || 0) === 0
    );

    const render = (list) =>
      list
        .map(
          (a) => `
        <div class="assignment-item">
          <div class="assignment-content-simple">
            <h3 class="assignment-title">${this.escape(a.name)}</h3>
            <div class="assignment-details">
              <span class="detail-item">Due: ${
                a.due_at
                  ? new Date(a.due_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "No due date"
              }</span>
              <span class="detail-item points">${
                a.points_possible || 0
              } pts</span>
              ${
                (a.needs_grading_count || 0) > 0
                  ? `<span class="needs-grading-badge">${a.needs_grading_count} need grading</span>`
                  : ""
              }
            </div>
          </div>
          <div class="assignment-actions">
            <button class="action-button" onclick="window.assignmentsManager.openSubmissions(${
              a.id
            })">
              View Submissions
            </button>
          </div>
        </div>`
        )
        .join("");

    this.needsHTML =
      render(needs) || `<p class="muted">Nothing needs grading.</p>`;
    this.gradedHTML =
      render(graded) || `<p class="muted">No graded assignments yet.</p>`;
  }

  showTab(which) {
    const list = document.getElementById("assignmentsList");
    const tabNeeds = document.getElementById("tabNeeds");
    const tabGraded = document.getElementById("tabGraded");

    if (which === "needs") {
      tabNeeds.classList.add("active");
      tabGraded.classList.remove("active");
      list.innerHTML = this.needsHTML;
    } else {
      tabGraded.classList.add("active");
      tabNeeds.classList.remove("active");
      list.innerHTML = this.gradedHTML;
    }
  }

  openSubmissions(assignmentId) {
    window.location.href = `submissions.html?courseId=${this.courseId}&assignmentId=${assignmentId}`;
  }

  // UI helpers
  showLoading() {
    document.getElementById("loadingState").style.display = "flex";
    document.getElementById("assignmentsList").style.display = "none";
  }
  hideLoading() {
    document.getElementById("loadingState").style.display = "none";
    document.getElementById("assignmentsList").style.display = "block";
  }

  escape(s) {
    const el = document.createElement("div");
    el.textContent = s ?? "";
    return el.innerHTML;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.assignmentsManager = new AssignmentsManager();
});