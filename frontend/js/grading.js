// Grading Page Logic
const API_BASE_URL = 'http://localhost:8765/api';

class GradingManager {
    constructor() {
        this.courseId = null;
        this.assignmentId = null;
        this.userId = null;
        this.submission = null;
        this.canvasToken = sessionStorage.getItem('canvasToken');

        console.log('GradingManager initialized');
        console.log('Token exists:', !!this.canvasToken);

        this.init();
    }

    init() {
        // Read URL parameters
        const urlParams = new URLSearchParams(window.location.search);

        this.courseId = urlParams.get('courseId') || urlParams.get('courseld');
        this.assignmentId = urlParams.get('assignmentId');
        this.userId = urlParams.get('userId');

        console.log('Grading page params:', {
            courseId: this.courseId,
            assignmentId: this.assignmentId,
            userId: this.userId
        });

        if (!this.courseId || !this.assignmentId || !this.userId) {
            this.showError('Missing required parameters. Please select a student to grade.');
            return;
        }

        if (!this.canvasToken) {
            console.error('No Canvas token found');
            window.location.href = 'index.html';
            return;
        }

        this.setupEventListeners();
        this.loadSubmission();
    }

    setupEventListeners() {
        const backButton = document.getElementById('backButton');
        const submitGradeBtn = document.getElementById('submitGrade');
        const retryButton = document.getElementById('retryButton');

        // ✔ Back returns to submissions page
        if (backButton) {
            backButton.addEventListener('click', () => {
                window.location.href =
                    `submissions.html?courseId=${this.courseId}&assignmentId=${this.assignmentId}`;
            });
        }

        if (submitGradeBtn) {
            submitGradeBtn.addEventListener('click', () => {
                this.submitGrade();
            });
        }

        if (retryButton) {
            retryButton.addEventListener('click', () => {
                this.loadSubmission();
            });
        }
    }

    async loadSubmission() {
        this.showLoading();

        try {
            const url = `${API_BASE_URL}/submission/${this.userId}` +
                `?course_id=${this.courseId}` +
                `&assignment_id=${this.assignmentId}` +
                `&token=${encodeURIComponent(this.canvasToken)}`;

            console.log('Fetching submission from:', url.replace(this.canvasToken, '[TOKEN]'));

            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            this.submission = await response.json();
            console.log('Submission data:', this.submission);

            this.renderSubmission();

        } catch (error) {
            console.error('Failed to load submission:', error);
            this.showError(`Failed to fetch submission data: ${error.message}`);
        }
    }

    renderSubmission() {
        const container = document.getElementById('submissionContent');
        if (!container) return;

        const studentName = document.getElementById('studentName');
        const submittedAt = document.getElementById('submittedAt');
        const attemptNumber = document.getElementById('attemptNumber');

        if (studentName && this.submission.user) {
            studentName.textContent = this.submission.user.name || 'Unknown Student';
        }

        if (submittedAt && this.submission.submitted_at) {
            submittedAt.textContent = this.formatDate(this.submission.submitted_at);
        }

        if (attemptNumber) {
            attemptNumber.textContent = this.submission.attempt || 1;
        }

        // Clear section and rebuild
        container.innerHTML = '';

        const submissionType = this.submission.submission_type;

        // Online text entry
        if (submissionType === 'online_text_entry' && this.submission.body) {
            container.innerHTML = `
                <div class="submission-text">
                    <h3>Submission Text:</h3>
                    <div class="text-content">${this.submission.body}</div>
                </div>
            `;
        }

        // File uploads
        else if (submissionType === 'online_upload' && this.submission.attachments) {
            const attachments = this.submission.attachments.map(att => `
                <div class="attachment-item">
                    <a href="${att.url}" target="_blank">${att.filename || att.display_name}</a>
                </div>
            `).join('');

            container.innerHTML = `
                <div class="submission-attachments">
                    <h3>Attachments:</h3>
                    ${attachments}
                </div>
            `;
        }

        // URL submissions
        else if (submissionType === 'online_url' && this.submission.url) {
            container.innerHTML = `
                <div class="submission-url">
                    <h3>Submitted URL:</h3>
                    <a href="${this.submission.url}" target="_blank">${this.submission.url}</a>
                </div>
            `;
        }

        // Nothing submitted
        else {
            container.innerHTML = `
                <div class="no-submission">
                    <p>No submission content available</p>
                </div>
            `;
        }

        // Pre-fill grade & comments
        const gradeInput = document.getElementById('gradeInput');
        const feedbackInput = document.getElementById('feedbackInput');

        if (gradeInput && this.submission.score !== null) {
            gradeInput.value = this.submission.score;
        }

        if (feedbackInput && this.submission.submission_comments) {
            const lastComment =
                this.submission.submission_comments[this.submission.submission_comments.length - 1];
            if (lastComment) {
                feedbackInput.value = lastComment.comment;
            }
        }

        this.hideLoading();
        document.getElementById('gradingContainer').style.display = 'block';
    }

    async submitGrade() {
        const gradeInput = document.getElementById('gradeInput');
        const feedbackInput = document.getElementById('feedbackInput');

        const score = parseFloat(gradeInput.value);
        const feedback = feedbackInput.value.trim();

        if (isNaN(score)) {
            alert('Please enter a valid score');
            return;
        }

        try {
            const url =
                `${API_BASE_URL}/grade?course_id=${this.courseId}` +
                `&assignment_id=${this.assignmentId}` +
                `&user_id=${this.userId}` +
                `&score=${score}` +
                (feedback ? `&comment=${encodeURIComponent(feedback)}` : '') +
                `&token=${encodeURIComponent(this.canvasToken)}`;

            const response = await fetch(url, { method: 'PUT' });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            alert('Grade submitted successfully!');

            // ✔ Return to new submissions page
            window.location.href =
                `submissions.html?courseId=${this.courseId}&assignmentId=${this.assignmentId}`;

        } catch (error) {
            console.error('Failed to submit grade:', error);
            alert(`Failed to submit grade: ${error.message}`);
        }
    }

    // Helpers
    formatDate(isoDate) {
        if (!isoDate) return '';
        try {
            return new Date(isoDate).toLocaleString();
        } catch {
            return isoDate;
        }
    }

    showLoading() {
        document.getElementById('loadingState').style.display = 'flex';
        document.getElementById('errorState').style.display = 'none';
        document.getElementById('gradingContainer').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loadingState').style.display = 'none';
    }

    showError(message) {
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('errorState').style.display = 'flex';
        document.getElementById('gradingContainer').style.display = 'none';
        document.getElementById('errorMessage').textContent = message;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.gradingManager = new GradingManager();
});
