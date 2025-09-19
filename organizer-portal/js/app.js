// Organizer Portal JavaScript - COMPLETE FIXED VERSION
console.log('Organizer Portal loaded with enhanced features!');

let currentUser = null;
let userSession = null;
let pendingUsername = null;
let pendingEmail = null;
let organizerEvents = [];
let filteredEvents = [];
let isDbConnected = false;
let eventStatsInterval = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - initializing authentication...');
    
    setTimeout(function() {
        initializeCognito();
        setTimeout(checkAuthStatus, 1000);
    }, 500);
    
    setupEventListeners();
});

function setupEventListeners() {
    console.log('Setting up enhanced event listeners...');
    
    // Authentication forms
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    const confirmationForm = document.getElementById('confirmationForm');
    if (confirmationForm) {
        confirmationForm.addEventListener('submit', handleConfirmation);
    }
    
    // Navigation buttons
    document.getElementById('loginBtn').addEventListener('click', showLoginSection);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('signupLink').addEventListener('click', function(e) {
        e.preventDefault();
        handleSignup();
    });
    
    // Confirmation links
    const resendLink = document.getElementById('resendCodeLink');
    const backLink = document.getElementById('backToLoginLink');
    
    if (resendLink) {
        resendLink.addEventListener('click', function(e) {
            e.preventDefault();
            handleResendCode();
        });
    }
    
    if (backLink) {
        backLink.addEventListener('click', function(e) {
            e.preventDefault();
            showLoginSection();
        });
    }
    
    // Dashboard action buttons
    document.getElementById('createEventBtn').addEventListener('click', showCreateEventForm);
    document.getElementById('refreshEventsBtn').addEventListener('click', loadOrganizerEvents);
    document.getElementById('validateTicketBtn').addEventListener('click', showValidateModal);
    document.getElementById('exportDataBtn').addEventListener('click', exportEventData);
    
    // Form buttons
    document.getElementById('cancelEventBtn').addEventListener('click', hideCreateEventForm);
    document.getElementById('closeFormBtn').addEventListener('click', hideCreateEventForm);
    
    // Event form
    const eventForm = document.getElementById('createEventForm');
    if (eventForm) {
        eventForm.addEventListener('submit', handleCreateEvent);
    }
    
    // Search and filter
    document.getElementById('searchBtn').addEventListener('click', performSearch);
    document.getElementById('clearSearchBtn').addEventListener('click', clearSearch);
    document.getElementById('searchEvents').addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    document.getElementById('sortBy').addEventListener('change', applySorting);
    
    // Modal controls
    document.getElementById('closeValidateModal').addEventListener('click', function() {
        document.getElementById('validateModal').style.display = 'none';
    });
    
    document.getElementById('closeDetailsModal').addEventListener('click', function() {
        document.getElementById('eventDetailsModal').style.display = 'none';
    });
    
    // Validation form
    document.getElementById('validateForm').addEventListener('submit', handleTicketValidation);
    
    console.log('All enhanced event listeners set up successfully');
}

// ===== AUTHENTICATION FUNCTIONS =====
function checkAuthStatus() {
    const user = getCurrentUser();
    if (user) {
        user.getSession((err, session) => {
            if (err) {
                console.log('No valid session found');
                showLoginSection();
                return;
            }
            
            if (session.isValid()) {
                const groups = getUserGroups(session);
                console.log('User groups:', groups);
                
                if (groups.includes('organizers')) {
                    currentUser = user;
                    userSession = session;
                    showDashboard();
                    setupDatabaseConnection();
                } else {
                    alert('Access denied. This portal is for event organizers only.');
                    handleLogout();
                }
            } else {
                showLoginSection();
            }
        });
    } else {
        showLoginSection();
    }
}

async function setupDatabaseConnection() {
    try {
        showMessage('Setting up database connection...', 'info');
        await configureDynamoDBCredentials(userSession);
        isDbConnected = true;
        showMessage('Database connected successfully!', 'success');
        
        // Load events immediately after connection
        setTimeout(() => {
            loadOrganizerEvents();
            startRealTimeUpdates();
        }, 500);
        
    } catch (error) {
        console.error('Database connection failed:', error);
        isDbConnected = false;
        showMessage('Database connection failed. Please try manual setup.', 'error');
    }
}

function startRealTimeUpdates() {
    // Update event stats every 30 seconds
    eventStatsInterval = setInterval(() => {
        if (isDbConnected && organizerEvents.length > 0) {
            console.log('Updating event registration counts...');
            updateEventRegistrationCounts();
        }
    }, 30000);
}

function handleLogin(event) {
    event.preventDefault();
    
    const loginIdentifier = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!loginIdentifier || !password) {
        alert('Please enter your login identifier and password');
        return;
    }
    
    showMessage('Signing in...', 'info');
    
    signInUser(loginIdentifier, password, (err, result) => {
        if (err) {
            if (err.code === 'UserNotConfirmedException') {
                alert('Your account is not confirmed yet. Please check your email for the verification code.');
                pendingUsername = loginIdentifier;
                pendingEmail = loginIdentifier;
                showConfirmationSection();
                return;
            }
            
            showMessage('Login failed: ' + (err.message || err), 'error');
            return;
        }
        
        const groups = result.groups;
        
        if (groups.includes('organizers')) {
            currentUser = result.user;
            userSession = result.session;
            showMessage('Login successful!', 'success');
            showDashboard();
            setupDatabaseConnection();
        } else {
            alert('Access denied. This portal is for event organizers only.');
            signOutUser();
        }
    });
}

function handleSignup() {
    const name = prompt('Enter your full name:');
    if (!name) return;
    
    const email = prompt('Enter your email address:');
    if (!email || !email.includes('@')) {
        alert('Please enter a valid email address');
        return;
    }
    
    const phoneNumber = prompt('Enter your phone number (with country code, e.g., +919876543210):');
    if (!phoneNumber || !phoneNumber.startsWith('+')) {
        alert('Please enter phone number with country code (e.g., +919876543210)');
        return;
    }
    
    const preferredUsername = prompt('Choose a preferred username:');
    if (!preferredUsername || preferredUsername.length < 3) {
        alert('Preferred username must be at least 3 characters long');
        return;
    }
    
    const password = prompt('Enter your password (minimum 8 characters):');
    if (!password || password.length < 8) {
        alert('Password must be at least 8 characters long');
        return;
    }
    
    showMessage('Creating account...', 'info');
    
    signUpUser(email, password, name, phoneNumber, preferredUsername, (err, result) => {
        if (err) {
            showMessage('Sign up failed: ' + (err.message || err), 'error');
            return;
        }
        
        pendingUsername = result.generatedUsername;
        pendingEmail = email;
        showMessage('Sign up successful! Check your email for verification code.', 'success');
        showConfirmationSection();
    });
}

function handleConfirmation(event) {
    event.preventDefault();
    
    const verificationCode = document.getElementById('confirmationCode').value;
    
    if (!verificationCode || verificationCode.length !== 6) {
        alert('Please enter the 6-digit verification code');
        return;
    }
    
    showMessage('Confirming account...', 'info');
    
    confirmSignUp(pendingUsername, verificationCode, (err, result) => {
        if (err) {
            showMessage('Confirmation failed: ' + (err.message || err), 'error');
            return;
        }
        
        showMessage('Email confirmed successfully! You can now sign in.', 'success');
        
        document.getElementById('confirmationCode').value = '';
        pendingUsername = null;
        pendingEmail = null;
        showLoginSection();
    });
}

function handleResendCode() {
    if (!pendingUsername) {
        alert('No pending confirmation. Please sign up first.');
        return;
    }
    
    showMessage('Resending verification code...', 'info');
    
    resendConfirmationCode(pendingUsername, (err, result) => {
        if (err) {
            showMessage('Failed to resend code: ' + (err.message || err), 'error');
            return;
        }
        showMessage('Verification code sent to your email!', 'success');
    });
}

function handleLogout() {
    // Clear intervals
    if (eventStatsInterval) {
        clearInterval(eventStatsInterval);
        eventStatsInterval = null;
    }
    
    signOutUser();
    currentUser = null;
    userSession = null;
    pendingUsername = null;
    pendingEmail = null;
    organizerEvents = [];
    filteredEvents = [];
    isDbConnected = false;
    showLoginSection();
}

// ===== EVENT MANAGEMENT FUNCTIONS =====
function showCreateEventForm() {
    document.getElementById('eventForm').style.display = 'block';
    document.getElementById('createEventBtn').disabled = true;
    
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('eventDate').setAttribute('min', today);
    
    document.getElementById('eventForm').scrollIntoView({ behavior: 'smooth' });
}

function hideCreateEventForm() {
    document.getElementById('eventForm').style.display = 'none';
    document.getElementById('createEventBtn').disabled = false;
    document.getElementById('createEventForm').reset();
}

function handleCreateEvent(event) {
    event.preventDefault();
    
    if (!isDbConnected || !dynamoDBClient) {
        showMessage('Database not connected. Please try manual setup first.', 'error');
        return;
    }
    
    const title = document.getElementById('eventTitle').value.trim();
    const description = document.getElementById('eventDescription').value.trim();
    const date = document.getElementById('eventDate').value;
    const time = document.getElementById('eventTime').value;
    const location = document.getElementById('eventLocation').value.trim();
    const maxAttendees = document.getElementById('maxAttendees').value;
    const category = document.getElementById('eventCategory').value;
    
    if (!title || !description || !date || !time || !location || !maxAttendees) {
        showMessage('Please fill in all required fields', 'error');
        return;
    }
    
    if (parseInt(maxAttendees) < 1) {
        showMessage('Maximum attendees must be at least 1', 'error');
        return;
    }
    
    const eventDateTime = `${date}T${time}:00.000Z`;
    const organizerID = userSession.getIdToken().payload.sub;
    
    const eventData = {
        organizerID: organizerID,
        title: title,
        description: description,
        date: eventDateTime,
        location: location,
        maxAttendees: parseInt(maxAttendees),
        category: category
    };
    
    // Disable form during creation
    const createBtn = event.target.querySelector('button[type="submit"]');
    const originalText = createBtn.textContent;
    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';
    
    showMessage('Creating event...', 'info');
    
    createEvent(eventData, (err, result) => {
        createBtn.disabled = false;
        createBtn.textContent = originalText;
        
        if (err) {
            console.error('Error creating event:', err);
            showMessage('Failed to create event: ' + (err.message || err), 'error');
            return;
        }
        
        console.log('Event created successfully:', result);
        showMessage('Event created successfully!', 'success');
        hideCreateEventForm();
        
        // Immediately reload events to show the new event
        setTimeout(() => {
            loadOrganizerEvents();
        }, 500);
    });
}

function loadOrganizerEvents(showLoading = true) {
    if (!isDbConnected || !dynamoDBClient) {
        showMessage('Database not connected. Please try manual setup.', 'error');
        return;
    }
    
    console.log('Loading organizer events...');
    
    if (showLoading) {
        document.getElementById('eventsLoading').style.display = 'block';
        document.getElementById('refreshEventsBtn').disabled = true;
    }
    
    const organizerID = userSession.getIdToken().payload.sub;
    
    getEventsByOrganizer(organizerID, (err, events) => {
        if (showLoading) {
            document.getElementById('eventsLoading').style.display = 'none';
            document.getElementById('refreshEventsBtn').disabled = false;
        }
        
        if (err) {
            console.error('Error loading events:', err);
            document.getElementById('eventsList').innerHTML = 
                '<div class="message message-error">Error loading events: ' + (err.message || err) + '</div>';
            showMessage('Failed to load events: ' + (err.message || err), 'error');
            return;
        }
        
        console.log('Events loaded:', events);
        organizerEvents = events || [];
        filteredEvents = [...organizerEvents];
        
        // Update display and stats
        displayEvents(filteredEvents);
        updateDashboardStats();
        updateEventCount(filteredEvents.length);
        
        if (organizerEvents.length === 0) {
            if (showLoading) {
                showMessage('No events found. Create your first event!', 'info');
            }
        } else {
            if (showLoading) {
                showMessage(`Loaded ${organizerEvents.length} event(s) successfully`, 'success');
            }
        }
        
        // Load registration counts for each event
        updateEventRegistrationCounts();
    });
}

function updateEventRegistrationCounts() {
    if (!organizerEvents || organizerEvents.length === 0) return;
    
    let updatedEvents = [...organizerEvents];
    let completedUpdates = 0;
    
    organizerEvents.forEach((event, index) => {
        getEventRegistrations(event.EventID, (err, registrations) => {
            if (!err && registrations) {
                updatedEvents[index] = {
                    ...updatedEvents[index],
                    CurrentAttendees: registrations.length
                };
            }
            
            completedUpdates++;
            
            // When all updates are complete, refresh the display
            if (completedUpdates === organizerEvents.length) {
                organizerEvents = updatedEvents;
                filteredEvents = [...organizerEvents];
                displayEvents(filteredEvents);
                updateDashboardStats();
            }
        });
    });
}

function displayEvents(events) {
    const eventsList = document.getElementById('eventsList');
    
    if (!events || events.length === 0) {
        eventsList.innerHTML = `
            <div class="message message-info">
                <h4>No events found</h4>
                <p>Create your first event using the "Create New Event" button above!</p>
            </div>
        `;
        return;
    }
    
    let eventsHTML = '';
    
    events.forEach(event => {
        const eventDate = new Date(event.Date);
        const now = new Date();
        const isUpcoming = eventDate > now;
        const isToday = eventDate.toDateString() === now.toDateString();
        
        let statusClass = 'status-past';
        let statusText = 'Past';
        
        if (isToday) {
            statusClass = 'status-today';
            statusText = 'Today';
        } else if (isUpcoming) {
            statusClass = 'status-upcoming';
            statusText = 'Upcoming';
        }
        
        const registrationCount = event.CurrentAttendees || 0;
        const availableSpots = event.MaxAttendees - registrationCount;
        const fillPercentage = Math.round((registrationCount / event.MaxAttendees) * 100);
        
        eventsHTML += `
            <div class="event-card">
                <div class="event-status ${statusClass}">${statusText}</div>
                <h4>${event.Title}</h4>
                <p class="event-description">${event.Description}</p>
                <div class="event-meta">
                    <span>📅 ${eventDate.toLocaleDateString('en-IN')}</span>
                    <span>🕒 ${eventDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span>📍 ${event.Location}</span>
                    <span>👥 ${registrationCount}/${event.MaxAttendees} registered</span>
                    <span>🎯 ${availableSpots} spots available</span>
                    <span>📊 ${fillPercentage}% filled</span>
                    <span>🏷️ ${event.Category || 'General'}</span>
                </div>
                <div class="event-actions">
                    <button class="btn btn-primary btn-small" onclick="viewEventDetails('${event.EventID}')">
                        View Details
                    </button>
                    <button class="btn btn-success btn-small" onclick="viewEventRegistrations('${event.EventID}')">
                        Registrations (${registrationCount})
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="editEvent('${event.EventID}')">
                        Edit
                    </button>
                    <button class="btn btn-danger btn-small" onclick="deleteEvent('${event.EventID}', '${event.Title}')">
                        Delete
                    </button>
                </div>
            </div>
        `;
    });
    
    eventsList.innerHTML = eventsHTML;
}

function updateDashboardStats() {
    const totalEvents = organizerEvents.length;
    const now = new Date();
    
    let totalRegistrations = 0;
    let upcomingEvents = 0;
    let pastEvents = 0;
    
    organizerEvents.forEach(event => {
        const eventDate = new Date(event.Date);
        totalRegistrations += (event.CurrentAttendees || 0);
        
        if (eventDate > now) {
            upcomingEvents++;
        } else {
            pastEvents++;
        }
    });
    
    // Update dashboard stats with animation
    animateCountUp('totalEvents', totalEvents);
    animateCountUp('totalRegistrations', totalRegistrations);
    animateCountUp('upcomingEvents', upcomingEvents);
    animateCountUp('pastEvents', pastEvents);
}

function animateCountUp(elementId, targetValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const currentValue = parseInt(element.textContent) || 0;
    
    if (currentValue === targetValue) return;
    
    const increment = targetValue > currentValue ? 1 : -1;
    const stepTime = Math.abs(Math.floor(100 / Math.abs(targetValue - currentValue) + 1));
    
    const timer = setInterval(() => {
        const newValue = parseInt(element.textContent) + increment;
        element.textContent = newValue;
        
        if (newValue === targetValue) {
            clearInterval(timer);
        }
    }, stepTime);
}

function updateEventCount(count) {
    const eventCountElement = document.getElementById('eventCount');
    if (eventCountElement) {
        eventCountElement.textContent = `${count} event${count !== 1 ? 's' : ''}`;
    }
}

// ===== SEARCH AND FILTER FUNCTIONS =====
function performSearch() {
    const searchTerm = document.getElementById('searchEvents').value.toLowerCase().trim();
    
    if (searchTerm === '') {
        clearSearch();
        return;
    }
    
    filteredEvents = organizerEvents.filter(event => 
        event.Title.toLowerCase().includes(searchTerm) ||
        event.Description.toLowerCase().includes(searchTerm) ||
        event.Location.toLowerCase().includes(searchTerm) ||
        (event.Category && event.Category.toLowerCase().includes(searchTerm))
    );
    
    displayEvents(filteredEvents);
    updateEventCount(filteredEvents.length);
    showMessage(`Found ${filteredEvents.length} matching event(s)`, 'info');
}

function clearSearch() {
    document.getElementById('searchEvents').value = '';
    filteredEvents = [...organizerEvents];
    displayEvents(filteredEvents);
    updateEventCount(filteredEvents.length);
    showMessage('Search cleared', 'info');
}

function applyFilters() {
    const statusFilter = document.getElementById('statusFilter').value;
    let filtered = [...organizerEvents];
    const now = new Date();
    
    if (statusFilter === 'upcoming') {
        filtered = filtered.filter(event => new Date(event.Date) > now);
    } else if (statusFilter === 'past') {
        filtered = filtered.filter(event => new Date(event.Date) < now);
    } else if (statusFilter === 'today') {
        filtered = filtered.filter(event => 
            new Date(event.Date).toDateString() === now.toDateString()
        );
    }
    
    filteredEvents = filtered;
    displayEvents(filteredEvents);
    updateEventCount(filteredEvents.length);
    
    if (statusFilter) {
        showMessage(`Filtered to ${filteredEvents.length} ${statusFilter} event(s)`, 'info');
    }
}

function applySorting() {
    const sortBy = document.getElementById('sortBy').value;
    
    if (sortBy === 'date') {
        filteredEvents.sort((a, b) => new Date(a.Date) - new Date(b.Date));
    } else if (sortBy === 'title') {
        filteredEvents.sort((a, b) => a.Title.localeCompare(b.Title));
    } else if (sortBy === 'registrations') {
        filteredEvents.sort((a, b) => (b.CurrentAttendees || 0) - (a.CurrentAttendees || 0));
    }
    
    displayEvents(filteredEvents);
    showMessage(`Events sorted by ${sortBy}`, 'info');
}

// ===== EVENT DETAIL FUNCTIONS =====
function viewEventDetails(eventID) {
    const event = organizerEvents.find(e => e.EventID === eventID);
    if (!event) {
        showMessage('Event not found', 'error');
        return;
    }
    
    const eventDate = new Date(event.Date);
    const registrationCount = event.CurrentAttendees || 0;
    const availableSpots = event.MaxAttendees - registrationCount;
    const fillPercentage = Math.round((registrationCount / event.MaxAttendees) * 100);
    
    const detailsHTML = `
        <div class="event-details">
            <div style="text-align: center; margin-bottom: 2rem;">
                <h4 style="color: #2E4053; margin-bottom: 1rem;">${event.Title}</h4>
                <div style="display: inline-block; padding: 0.5rem 1rem; background: linear-gradient(135deg, #FFC107, #F39C12); color: #2E4053; border-radius: 20px; font-weight: bold;">
                    ${fillPercentage}% Filled
                </div>
            </div>
            
            <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem;">
                <h5 style="color: #2E4053; margin-bottom: 1rem;">📝 Description</h5>
                <p>${event.Description}</p>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem;">
                <div style="background: white; padding: 1rem; border-radius: 8px; border-left: 4px solid #FFC107;">
                    <strong>📅 Date & Time</strong><br>
                    ${eventDate.toLocaleDateString('en-IN')}<br>
                    ${eventDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style="background: white; padding: 1rem; border-radius: 8px; border-left: 4px solid #2E4053;">
                    <strong>📍 Location</strong><br>
                    ${event.Location}
                </div>
                <div style="background: white; padding: 1rem; border-radius: 8px; border-left: 4px solid #f39c12;">
                    <strong>🏷️ Category</strong><br>
                    ${event.Category || 'General'}
                </div>
                <div style="background: white; padding: 1rem; border-radius: 8px; border-left: 4px solid #27ae60;">
                    <strong>👥 Capacity</strong><br>
                    ${event.MaxAttendees} max attendees
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div style="text-align: center; background: linear-gradient(135deg, #27ae60, #2ecc71); color: white; padding: 1rem; border-radius: 8px;">
                    <h3 style="margin: 0; color: white;">${registrationCount}</h3>
                    <p style="margin: 0; opacity: 0.9;">Registered</p>
                </div>
                <div style="text-align: center; background: linear-gradient(135deg, #f39c12, #e67e22); color: white; padding: 1rem; border-radius: 8px;">
                    <h3 style="margin: 0; color: white;">${availableSpots}</h3>
                    <p style="margin: 0; opacity: 0.9;">Available</p>
                </div>
                <div style="text-align: center; background: linear-gradient(135deg, #FFC107, #F39C12); color: #2E4053; padding: 1rem; border-radius: 8px;">
                    <h3 style="margin: 0; color: #2E4053;">${fillPercentage}%</h3>
                    <p style="margin: 0; opacity: 0.9;">Filled</p>
                </div>
            </div>
            
            <div style="background: #ecf0f1; padding: 1rem; border-radius: 8px; font-size: 0.9rem; color: #7f8c8d;">
                <strong>📝 Created:</strong> ${new Date(event.CreatedAt).toLocaleString('en-IN')}<br>
                <strong>🆔 Event ID:</strong> ${event.EventID}
            </div>
        </div>
    `;
    
    document.getElementById('modalEventTitle').textContent = event.Title;
    document.getElementById('eventDetailsContent').innerHTML = detailsHTML;
    document.getElementById('eventDetailsModal').style.display = 'block';
}

function viewEventRegistrations(eventID) {
    if (!isDbConnected) {
        showMessage('Database not connected. Please try manual setup.', 'error');
        return;
    }
    
    console.log('Loading registrations for event:', eventID);
    showMessage('Loading registrations...', 'info');
    
    getEventRegistrations(eventID, (err, registrations) => {
        if (err) {
            showMessage('Error loading registrations: ' + (err.message || err), 'error');
            return;
        }
        
        if (registrations.length === 0) {
            showMessage('No registrations yet for this event.', 'info');
            return;
        }
        
        let message = `Event Registrations (${registrations.length}):\n\n`;
        registrations.forEach((reg, index) => {
            message += `${index + 1}. Ticket ID: ${reg.TicketID}\n`;
            message += `   Name: ${reg.AttendeeName || 'N/A'}\n`;
            message += `   Email: ${reg.AttendeeEmail || 'N/A'}\n`;
            message += `   Registered: ${new Date(reg.RegisteredAt).toLocaleString('en-IN')}\n`;
            message += `   Status: ${reg.Status}\n\n`;
        });
        
        alert(message);
        showMessage(`Showing ${registrations.length} registration(s)`, 'success');
    });
}

function editEvent(eventID) {
    showMessage('Edit functionality will be implemented in a future update!', 'info');
}

function deleteEvent(eventID, eventTitle) {
    if (confirm(`Are you sure you want to delete "${eventTitle}"?\n\nThis action cannot be undone and will delete all registrations for this event.`)) {
        showMessage('Delete functionality will be implemented in a future update!', 'info');
    }
}

// ===== TICKET VALIDATION =====
function showValidateModal() {
    document.getElementById('validateModal').style.display = 'block';
    document.getElementById('ticketID').focus();
}

function handleTicketValidation(event) {
    event.preventDefault();
    
    const ticketID = document.getElementById('ticketID').value.trim().toUpperCase();
    
    if (!ticketID) {
        showMessage('Please enter a ticket ID', 'error');
        return;
    }
    
    if (!isDbConnected || !dynamoDBClient) {
        showMessage('Database not connected. Please try manual setup.', 'error');
        return;
    }
    
    showMessage('Validating ticket...', 'info');
    
    validateTicket(ticketID, (err, ticket) => {
        const resultDiv = document.getElementById('validationResult');
        
        if (err) {
            resultDiv.innerHTML = `
                <div class="validation-error">
                    <h4>❌ Invalid Ticket</h4>
                    <p><strong>Ticket ID:</strong> ${ticketID}</p>
                    <p><strong>Error:</strong> ${err.message || err}</p>
                    <p>This ticket was not found in our system.</p>
                </div>
            `;
            showMessage('Ticket validation failed', 'error');
            return;
        }
        
        // Get event details
        getEventById(ticket.EventID, (eventErr, eventDetails) => {
            if (eventErr) {
                resultDiv.innerHTML = `
                    <div class="validation-error">
                        <h4>❌ Error Loading Event Details</h4>
                        <p>${eventErr.message || eventErr}</p>
                    </div>
                `;
                showMessage('Error loading event details', 'error');
                return;
            }
            
            const eventDate = new Date(eventDetails.Date);
            const isEventToday = eventDate.toDateString() === new Date().toDateString();
            const eventStatus = eventDate < new Date() ? 'Past Event' : eventDate > new Date() ? 'Upcoming Event' : 'Event Today';
            
            resultDiv.innerHTML = `
                <div class="validation-success">
                    <h4>✅ Valid Ticket</h4>
                    <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
                        <p><strong>🎫 Ticket ID:</strong> ${ticket.TicketID}</p>
                        <p><strong>🎪 Event:</strong> ${eventDetails.Title}</p>
                        <p><strong>👤 Name:</strong> ${ticket.AttendeeName || 'N/A'}</p>
                        <p><strong>📧 Email:</strong> ${ticket.AttendeeEmail || 'N/A'}</p>
                        <p><strong>📅 Date:</strong> ${eventDate.toLocaleDateString('en-IN')}</p>
                        <p><strong>🕒 Time:</strong> ${eventDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                        <p><strong>📍 Location:</strong> ${eventDetails.Location}</p>
                        <p><strong>✅ Status:</strong> ${ticket.Status}</p>
                        <p><strong>📝 Registered:</strong> ${new Date(ticket.RegisteredAt).toLocaleString('en-IN')}</p>
                        <p><strong>🎯 Event Status:</strong> <span style="color: ${isEventToday ? '#e74c3c' : '#27ae60'};">${eventStatus}</span></p>
                    </div>
                    ${isEventToday ? '<p style="color: #e74c3c; font-weight: bold;">🔴 This event is today!</p>' : ''}
                </div>
            `;
            showMessage('Ticket validated successfully!', 'success');
        });
    });
}

// ===== MANUAL SETUP FUNCTION =====
function manuallyConfigureCredentials() {
    if (!userSession) {
        showMessage('Please login first', 'error');
        return;
    }
    
    showMessage('Manually configuring database connection...', 'info');
    
    try {
        AWS.config.region = 'ap-south-1';
        
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: 'ap-south-1:929bf910-7ebe-4579-8dc1-f19a45acbd73',
            Logins: {
                'cognito-idp.ap-south-1.amazonaws.com/ap-south-1_F8XFoOaI8': userSession.getIdToken().getJwtToken()
            }
        });
        
        AWS.config.credentials.refresh((error) => {
            if (error) {
                console.error('Manual credential refresh error:', error);
                showMessage('Credential setup failed: ' + error.message, 'error');
                return;
            }
            
            try {
                dynamoDBClient = new AWS.DynamoDB.DocumentClient({
                    region: 'ap-south-1'
                });
                
                isDbConnected = true;
                showMessage('DynamoDB setup successful!', 'success');
                
                setTimeout(() => {
                    loadOrganizerEvents();
                    startRealTimeUpdates();
                }, 500);
                
            } catch (dbError) {
                console.error('Error creating DynamoDB client manually:', dbError);
                showMessage('DynamoDB client creation failed: ' + dbError.message, 'error');
            }
        });
        
    } catch (setupError) {
        console.error('Error in manual setup:', setupError);
        showMessage('Manual setup failed: ' + setupError.message, 'error');
    }
}

// ===== UTILITY FUNCTIONS =====
function exportEventData() {
    if (organizerEvents.length === 0) {
        showMessage('No events to export', 'info');
        return;
    }
    
    showMessage('Preparing export...', 'info');
    
    const csvContent = convertToCSV(organizerEvents);
    const filename = `organizer-events-${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csvContent, filename);
    showMessage(`Exported ${organizerEvents.length} events to ${filename}`, 'success');
}

function convertToCSV(events) {
    const headers = [
        'Title', 'Description', 'Date', 'Time', 'Location', 
        'Max Attendees', 'Current Attendees', 'Available Spots', 
        'Fill Percentage', 'Category', 'Event ID', 'Created At'
    ];
    
    const rows = events.map(event => {
        const eventDate = new Date(event.Date);
        const registrationCount = event.CurrentAttendees || 0;
        const availableSpots = event.MaxAttendees - registrationCount;
        const fillPercentage = Math.round((registrationCount / event.MaxAttendees) * 100);
        
        return [
            event.Title,
            event.Description,
            eventDate.toLocaleDateString('en-IN'),
            eventDate.toLocaleTimeString('en-IN'),
            event.Location,
            event.MaxAttendees,
            registrationCount,
            availableSpots,
            fillPercentage + '%',
            event.Category || 'General',
            event.EventID,
            new Date(event.CreatedAt).toLocaleString('en-IN')
        ];
    });
    
    return [headers, ...rows].map(row => 
        row.map(field => `"${field}"`).join(',')
    ).join('\n');
}

function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function showMessage(message, type, duration = 5000) {
    const existingMessages = document.querySelectorAll('.floating-message');
    existingMessages.forEach(msg => msg.remove());
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `floating-message message-${type}`;
    messageDiv.textContent = message;
    
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        min-width: 300px;
        max-width: 500px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transition: all 0.3s ease;
        transform: translateX(100%);
    `;
    
    if (type === 'success') {
        messageDiv.style.background = 'linear-gradient(135deg, #d5f5d5, #c8e6c9)';
        messageDiv.style.color = '#27ae60';
        messageDiv.style.borderLeft = '4px solid #27ae60';
    } else if (type === 'error') {
        messageDiv.style.background = 'linear-gradient(135deg, #ffebee, #ffcdd2)';
        messageDiv.style.color = '#e74c3c';
        messageDiv.style.borderLeft = '4px solid #e74c3c';
    } else {
        messageDiv.style.background = 'linear-gradient(135deg, #e3f2fd, #bbdefb)';
        messageDiv.style.color = '#2196f3';
        messageDiv.style.borderLeft = '4px solid #2196f3';
    }
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.transform = 'translateX(0)';
    }, 10);
    
    setTimeout(() => {
        messageDiv.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 300);
    }, duration);
}

// ===== DISPLAY FUNCTIONS =====
function showLoginSection() {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('confirmationSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'none';
    document.getElementById('loginBtn').style.display = 'inline-block';
    document.getElementById('logoutBtn').style.display = 'none';
}

function showConfirmationSection() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('confirmationSection').style.display = 'block';
    document.getElementById('dashboardSection').style.display = 'none';
    
    setTimeout(() => {
        const codeInput = document.getElementById('confirmationCode');
        if (codeInput) {
            codeInput.focus();
        }
    }, 100);
}

function showDashboard() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('confirmationSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'inline-block';
    
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
}

console.log('Enhanced Organizer portal loaded successfully with all fixes!');
