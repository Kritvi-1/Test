// Main Application Logic
// API Configuration
const API_BASE_URL = 'http://localhost:8765/api';

// Get Canvas token from sessionStorage (clears when browser closes)
let canvasToken = sessionStorage.getItem('canvasToken');

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('🎓 AI Grader Dashboard initialized');
    
    // Get all elements
    const tokenModal = document.getElementById('tokenModal');
    const tokenButton = document.getElementById('tokenButton');
    const tokenButtonRibbon = document.getElementById('tokenButtonRibbon');
    const tokenInput = document.getElementById('tokenInput');
    const connectTokenBtn = document.getElementById('connectTokenBtn');
    const cancelTokenBtn = document.getElementById('cancelTokenBtn');
    const retryButton = document.getElementById('retryButton');
    const classGrid = document.getElementById('classGrid');
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const errorMessage = document.getElementById('errorMessage');
    
    // New elements for ribbon/box toggle
    const mainHeader = document.getElementById('mainHeader');
    const topRibbon = document.getElementById('topRibbon');
    const pageTitle = document.getElementById('pageTitle');
    const contentWrapper = document.getElementById('contentWrapper');

    // Check if elements exist
    if (!tokenModal) {
        console.error('Token modal not found!');
        return;
    }

    function showTokenModal() {
        tokenModal.style.display = 'flex';
        if (tokenInput) {
            tokenInput.value = '';
            tokenInput.focus();
        }
    }

    function hideTokenModal() {
        tokenModal.style.display = 'none';
    }
    
    function showRibbonMode() {
        // Hide welcome box, show ribbon
        if (mainHeader) mainHeader.classList.add('hide');
        if (topRibbon) topRibbon.classList.add('show');
        if (pageTitle) pageTitle.classList.add('show');
        if (contentWrapper) contentWrapper.classList.add('with-ribbon');
    }
    
    function showWelcomeMode() {
        // Show welcome box, hide ribbon
        if (mainHeader) mainHeader.classList.remove('hide');
        if (topRibbon) topRibbon.classList.remove('show');
        if (pageTitle) pageTitle.classList.remove('show');
        if (contentWrapper) contentWrapper.classList.remove('with-ribbon');
    }

    function saveToken() {
        const token = tokenInput.value.trim();
        if (token) {
            canvasToken = token;
            sessionStorage.setItem('canvasToken', canvasToken);
            hideTokenModal();
            showRibbonMode(); // Switch to ribbon mode after login
            loadCourses();
        } else {
            alert('Please enter a valid Canvas API token');
        }
    }

    // Event Listeners for both token buttons
    if (tokenButton) {
        tokenButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Token button clicked');
            showTokenModal();
        });
    }
    
    if (tokenButtonRibbon) {
        tokenButtonRibbon.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Ribbon token button clicked');
            showTokenModal();
        });
    }

    if (connectTokenBtn) {
        connectTokenBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Connect button clicked');
            saveToken();
        });
    }

    if (cancelTokenBtn) {
        cancelTokenBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Cancel button clicked');
            hideTokenModal();
        });
    }

    if (retryButton) {
        retryButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Retry button clicked');
            loadCourses();
        });
    }

    // Allow Enter key to submit
    if (tokenInput) {
        tokenInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveToken();
            }
        });
    }

    function showError(message) {
        if (loadingState) loadingState.style.display = 'none';
        if (classGrid) classGrid.style.display = 'none';
        if (errorState) errorState.style.display = 'block';
        if (errorMessage) errorMessage.textContent = message;
    }

    function showLoading() {
        if (errorState) errorState.style.display = 'none';
        if (classGrid) classGrid.style.display = 'none';
        if (loadingState) loadingState.style.display = 'block';
    }

    function hideLoading() {
        if (loadingState) loadingState.style.display = 'none';
    }

    async function loadCourses() {
        if (!canvasToken) {
            // FIXED: Don't show error when no token exists - just wait for user to enter token
            console.log('No token found - waiting for user to enter token');
            showWelcomeMode(); // Show welcome box
            return;
        }

        showLoading();
        console.log('Loading courses...');
        
        try {
            const response = await fetch(`${API_BASE_URL}/courses?token=${encodeURIComponent(canvasToken)}`);
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    sessionStorage.removeItem('canvasToken');
                    canvasToken = null;
                    showWelcomeMode(); // Go back to welcome mode
                    // FIXED: Only show error when token is INVALID
                    throw new Error('Invalid Canvas token. Please enter a valid token.');
                }
                throw new Error(`Failed to load courses: ${response.statusText}`);
            }
            
            const courses = await response.json();
            console.log(`Loaded ${courses.length} courses:`, courses);
            
            hideLoading();
            
            if (courses.length === 0) {
                showError('No courses found. Make sure you are enrolled in at least one course.');
                return;
            }
            
            // Initialize class selector and render courses
            if (typeof ClassSelector !== 'undefined') {
                const classSelector = new ClassSelector();
                classSelector.renderClasses(courses);
                console.log('✅ Courses rendered successfully');
            } else {
                console.error('ClassSelector not found!');
                showError('Failed to initialize class selector');
            }
            
        } catch (error) {
            console.error('Error loading courses:', error);
            showError(error.message || 'Failed to load courses. Please check your connection and try again.');
        }
    }

    // Initialize - check if token exists
    if (canvasToken) {
        console.log('Token found, loading courses...');
        showRibbonMode(); // Show ribbon since user is logged in
        loadCourses();
    } else {
        console.log('No token found - showing welcome box');
        showWelcomeMode(); // Show welcome box
    }
});