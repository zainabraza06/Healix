class AppointmentManager {
    static currentAppointmentId = null;
    static currentPatientId = null;
    static currentPatientName = null;

    static init() {
        console.log('Initializing AppointmentManager...');
        
        // Set current date for prescription start date
        const today = new Date().toISOString().split('T')[0];
        if (document.getElementById('startDate')) {
            document.getElementById('startDate').value = today;
        }
        
        // Form event listeners with better error handling
        this.setupForm('prescriptionForm', this.handlePrescriptionSubmit.bind(this));
        this.setupForm('feedbackForm', this.handleFeedbackSubmit.bind(this));
        
        // Complete button listener
        if (document.getElementById('confirmCompleteBtn')) {
            document.getElementById('confirmCompleteBtn').addEventListener('click', this.confirmComplete.bind(this));
        }
        
        // Sidebar toggle
        if (document.getElementById('sidebarToggle')) {
            document.getElementById('sidebarToggle').addEventListener('click', this.toggleSidebar.bind(this));
        }
        
        // Close modal when clicking outside
        window.addEventListener('click', this.handleOutsideClick.bind(this));
        
        console.log('AppointmentManager initialized successfully');
    }
    
    static setupForm(formId, handler) {
        const form = document.getElementById(formId);
        if (!form) {
            console.error(`Form ${formId} not found`);
            return;
        }
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log(`${formId} submit event triggered`);
            await handler(e);
        });
        
        console.log(`Form ${formId} setup complete`);
    }
    
    static toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        
        if (sidebar && mainContent) {
            sidebar.classList.toggle('sidebar-collapsed');
            mainContent.classList.toggle('main-content-expanded');
        }
    }
    
    static openPrescriptionModal(button) {
        this.currentAppointmentId = button.getAttribute('data-appointment-id');
        this.currentPatientId = button.getAttribute('data-patient-id');
        this.currentPatientName = button.getAttribute('data-patient-name');
        
        if (document.getElementById('prescriptionAppointmentId')) {
            document.getElementById('prescriptionAppointmentId').value = this.currentAppointmentId;
        }
        if (document.getElementById('prescriptionPatientId')) {
            document.getElementById('prescriptionPatientId').value = this.currentPatientId;
        }
        if (document.getElementById('patientName')) {
            document.getElementById('patientName').value = this.currentPatientName;
        }
        
        this.showModal('prescriptionModal');
    }
    
    static openFeedbackModal(button) {
        this.currentAppointmentId = button.getAttribute('data-appointment-id');
        this.currentPatientId = button.getAttribute('data-patient-id');
        this.currentPatientName = button.getAttribute('data-patient-name');
        
        if (document.getElementById('feedbackAppointmentId')) {
            document.getElementById('feedbackAppointmentId').value = this.currentAppointmentId;
        }
        if (document.getElementById('feedbackPatientId')) {
            document.getElementById('feedbackPatientId').value = this.currentPatientId;
        }
        if (document.getElementById('feedbackPatientName')) {
            document.getElementById('feedbackPatientName').value = this.currentPatientName;
        }
        
        this.showModal('feedbackModal');
    }
    
    static markAsDone(button) {
        this.currentAppointmentId = button.getAttribute('data-appointment-id');
        this.showModal('completeModal');
    }
    
    static showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }
    
    static closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }
    
    static async handlePrescriptionSubmit(e) {
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        
        if (!submitBtn) {
            console.error('Submit button not found in prescription form');
            return;
        }
        
        const spinner = submitBtn.querySelector('.spinner-border');
        const submitText = submitBtn.querySelector('.submit-text');
        
        try {
            // Show loading state
            submitText.style.display = 'none';
            spinner.style.display = 'inline-block';
            submitBtn.disabled = true;
            
            const formData = new FormData(form);
            const csrfToken = form.querySelector('input[name="_csrf"]')?.value;
            
            if (!csrfToken) {
                throw new Error('CSRF token not found');
            }
            
            console.log('Submitting prescription with data:', Object.fromEntries(formData.entries()));
            
            const response = await fetch(form.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRF-TOKEN': csrfToken
                }
            });
            
            console.log('Response status:', response.status);
            
            if (response.redirected) {
                window.location.href = response.url;
                return;
            }
            
            const result = await response.json();
            console.log('Response data:', result);
            
            if (response.ok) {
                this.showAlert('success', 'Prescription saved successfully');
                this.closeModal('prescriptionModal');
                window.location.reload();
            } else {
                throw new Error(result.message || 'Failed to save prescription');
            }
        } catch (error) {
            console.error('Prescription submission error:', error);
            this.showAlert('error', error.message);
        } finally {
            if (submitText) submitText.style.display = 'inline-block';
            if (spinner) spinner.style.display = 'none';
            submitBtn.disabled = false;
        }
    }
    
    static async handleFeedbackSubmit(e) {
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        
        if (!submitBtn) {
            console.error('Submit button not found in feedback form');
            return;
        }
        
        const spinner = submitBtn.querySelector('.spinner-border');
        const submitText = submitBtn.querySelector('.submit-text');
        
        try {
            // Show loading state
            submitText.style.display = 'none';
            spinner.style.display = 'inline-block';
            submitBtn.disabled = true;
            
            const formData = new FormData(form);
            const csrfToken = form.querySelector('input[name="_csrf"]')?.value;
            
            if (!csrfToken) {
                throw new Error('CSRF token not found');
            }
            
            console.log('Submitting feedback with data:', Object.fromEntries(formData.entries()));
            
            const response = await fetch(form.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRF-TOKEN': csrfToken
                }
            });
            
            console.log('Response status:', response.status);
            
            if (response.redirected) {
                window.location.href = response.url;
                return;
            }
            
            const result = await response.json();
            console.log('Response data:', result);
            
            if (response.ok) {
                this.showAlert('success', 'Feedback submitted successfully');
                this.closeModal('feedbackModal');
                window.location.reload();
            } else {
                throw new Error(result.message || 'Failed to submit feedback');
            }
        } catch (error) {
            console.error('Feedback submission error:', error);
            this.showAlert('error', error.message);
        } finally {
            if (submitText) submitText.style.display = 'inline-block';
            if (spinner) spinner.style.display = 'none';
            submitBtn.disabled = false;
        }
    }
    
    static async confirmComplete() {
        const confirmBtn = document.getElementById('confirmCompleteBtn');
        
        if (!confirmBtn) {
            console.error('Complete button not found');
            return;
        }
        
        const spinner = confirmBtn.querySelector('.spinner-border');
        const submitText = confirmBtn.querySelector('.submit-text');
        
        try {
            // Show loading state
            submitText.style.display = 'none';
            spinner.style.display = 'inline-block';
            confirmBtn.disabled = true;
            
            const csrfToken = document.querySelector('input[name="_csrf"]')?.value;
            
            if (!csrfToken) {
                throw new Error('CSRF token not found');
            }
            
            console.log('Completing appointment:', this.currentAppointmentId);
            
            const response = await fetch(`/doctor/dashboard/appointment/${this.currentAppointmentId}/complete`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    'Content-Type': 'application/json'
                }
                
            });
            
            console.log('Response status:', response.status);
            
            if (response.redirected) {
                window.location.href = response.url;
                return;
            }
            
            const result = await response.json();
            console.log('Response data:', result);
            
            if (response.ok) {
                this.showAlert('success', 'Appointment marked as complete');
                this.closeModal('completeModal');
                window.location.reload();
            } else {
                throw new Error(result.message || 'Failed to complete appointment');
            }
        } catch (error) {
            console.error('Completion error:', error);
            this.showAlert('error', error.message);
        } finally {
            if (submitText) submitText.style.display = 'inline-block';
            if (spinner) spinner.style.display = 'none';
            confirmBtn.disabled = false;
        }
    }
    
    static handleOutsideClick(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }
    
    static showAlert(type, message) {
        const alertEl = type === 'success' 
            ? document.getElementById('successAlert') 
            : document.getElementById('errorAlert');
        
        if (!alertEl) {
            console.error(`${type} alert element not found`);
            return;
        }
        
        const messageEl = type === 'success'
            ? document.getElementById('successMessage')
            : document.getElementById('errorMessage');
        
        if (messageEl) {
            messageEl.textContent = message;
        }
        
        alertEl.style.display = 'flex';
        
        setTimeout(() => {
            alertEl.style.display = 'none';
        }, 5000);
    }
}

// Global functions for button onclick attributes
function openPrescriptionModal(button) {
    AppointmentManager.openPrescriptionModal(button);
}

function openFeedbackModal(button) {
    AppointmentManager.openFeedbackModal(button);
}

function closeModal(modalId) {
    AppointmentManager.closeModal(modalId);
}

function markAsDone(button) {
    AppointmentManager.markAsDone(button);
}

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded');
    AppointmentManager.init();
});