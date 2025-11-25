// Class Selector Component
class ClassSelector {
    constructor() {
        this.selectedClass = null;
        this.classCards = [];
    }

    // Create a class card element
    createClassCard(classData) {
        const card = document.createElement('div');
        card.className = 'class-card';
        card.dataset.classId = classData.id;
        
        // Set CSS variables for gradient colors
        const color = this.pickColor(classData.id);
        const lighterColor = this.lightenColor(color, 20);
        card.style.setProperty('--card-color', color);
        card.style.setProperty('--card-color-light', lighterColor);
        
        // Extract term and student count
        const term = classData.term?.name || classData.enrollment_term_id || '';
        const students = classData.total_students || 0;
        
        // REMOVED: Book icon - just showing course info directly
        card.innerHTML = `
            <div class="class-header">
                <div>
                    <div class="class-info">
                        <div class="class-name">${this.escapeHtml(classData.name)}</div>
                        <div class="class-code">${this.escapeHtml(classData.course_code || '')}</div>
                    </div>
                </div>
                <div class="class-meta">
                    <div class="class-students">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        ${students} students
                    </div>
                    ${term ? `
                        <div class="class-term">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                            </svg>
                            ${this.escapeHtml(term)}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        card.addEventListener('click', () => this.selectClass(classData, card));
        
        return card;
    }

    // Color palette for course cards
    pickColor(courseId) {
        const palette = [
            "#E91E63", "#2196F3", "#4CAF50", "#FF9800", "#9C27B0", 
            "#795548", "#009688", "#F44336", "#3F51B5", "#00BCD4", 
            "#8BC34A", "#FFC107", "#673AB7", "#607D8B", "#FF5722"
        ];
        return palette[Math.abs(courseId) % palette.length];
    }

    // Helper to lighten a hex color
    lightenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * percent / 100));
        const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * percent / 100));
        const b = Math.min(255, (num & 0xff) + Math.round(255 * percent / 100));
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }

    // Helper to escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Render all class cards
    renderClasses(classes) {
        const grid = document.getElementById('classGrid');
        if (!grid) return;
        
        grid.innerHTML = '';
        grid.style.display = 'grid';

        classes.forEach(classData => {
            const card = this.createClassCard(classData);
            this.classCards.push(card);
            grid.appendChild(card);
        });
    }

    // Handle class selection
    selectClass(classData, cardElement) {
        // Remove previous selection
        this.classCards.forEach(card => card.classList.remove('selected'));
        
        // Add selection to clicked card
        cardElement.classList.add('selected');
        
        // Update selected class
        this.selectedClass = classData;
        
        // Navigate to assignments page
        this.navigateToAssignments(classData);
    }

    // Navigate to roster upload page
    navigateToAssignments(classData) {
        console.log('Navigating to roster upload for:', classData);
        window.location.href = `roster.html?courseId=${classData.id}`;
    }

    // Get currently selected class
    getSelectedClass() {
        return this.selectedClass;
    }
}