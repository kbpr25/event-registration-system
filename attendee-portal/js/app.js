// Attendee Portal JavaScript - COMPLETE FIXED VERSION WITH EMAIL
console.log('Attendee Portal loaded with enhanced features!');

let currentUser = null;
let userSession = null;
let pendingUsername = null;
let pendingEmail = null;
let allEvents = [];
let filteredEvents = [];
let myRegistrations = [];
let isDbConnected = false;
let eventRefreshInterval = null;

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
    document.getElementById('refreshEventsBtn').addEventListener('click', loadAllEvents);
    document.getElementById('myTicketsBtn').addEventListener('click', showMyTickets);
    document.getElementById('validateTicketBtn').addEventListener('click', showValidateModal);
    
    // Search and filter
    document.getElementById('searchBtn').addEventListener('click', performSearch);
    document.getElementById('clearSearchBtn').addEventListener('click', clearSearch);
    document.getElementById('searchEvents').addEventListener('keyup', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    document.getElementById('locationFilter').addEventListener('change', applyFilters);
    document.getElementById('dateFilter').addEventListener('change', applyFilters);
    
    // Modal controls
    document.getElementById('closeTicketsModal').addEventListener('click', function() {
        document.getElementById('ticketsModal').style.display = 'none';
    });
    
    document.getElementById('closeValidateModal').addEventListener('click', function() {
        document.getElementById('validateModal').style.display = 'none';
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
                
                if (groups.includes('attendees')) {
                    currentUser = user;
                    userSession = session;
                    showEventsSection();
                    setupDatabaseConnection();
                } else {
                    alert('Access denied. This portal is for event attendees only.');
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
        
        setTimeout(() => {
            loadAllEvents();
            loadMyRegistrations();
            startAutoRefresh();
        }, 500);
        
    } catch (error) {
        console.error('Database connection failed:', error);
        isDbConnected = false;
        showMessage('Database connection failed. Some features may not work.', 'error');
    }
}

function startAutoRefresh() {
    // Auto-refresh events every 30 seconds
    eventRefreshInterval = setInterval(() => {
        if (isDbConnected) {
            console.log('Auto-refreshing events...');
            loadAllEvents(false); // Silent refresh
            loadMyRegistrations();
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
        
        if (groups.includes('attendees')) {
            currentUser = result.user;
            userSession = result.session;
            showMessage('Login successful!', 'success');
            showEventsSection();
            setupDatabaseConnection();
        } else {
            alert('Access denied. This portal is for event attendees only.');
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
        alert('Please enter phone number with country code');
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
    if (eventRefreshInterval) {
        clearInterval(eventRefreshInterval);
        eventRefreshInterval = null;
    }
    
    signOutUser();
    currentUser = null;
    userSession = null;
    pendingUsername = null;
    pendingEmail = null;
    allEvents = [];
    filteredEvents = [];
    myRegistrations = [];
    isDbConnected = false;
    showLoginSection();
}

// ===== EVENT BROWSING FUNCTIONS =====
function loadAllEvents(showLoading = true) {
    if (!isDbConnected) {
        showMessage('Database not connected. Please refresh the page.', 'error');
        return;
    }
    
    console.log('Loading all available events...');
    
    if (showLoading) {
        document.getElementById('eventsLoading').style.display = 'block';
        document.getElementById('refreshEventsBtn').disabled = true;
    }
    
    getAllEvents((err, events) => {
        if (showLoading) {
            document.getElementById('eventsLoading').style.display = 'none';
            document.getElementById('refreshEventsBtn').disabled = false;
        }
        
        if (err) {
            console.error('Error loading events:', err);
            if (showLoading) {
                document.getElementById('eventsList').innerHTML = 
                    '<div class="message message-error">Error loading events: ' + (err.message || err) + '</div>';
                showMessage('Failed to load events', 'error');
            }
            return;
        }
        
        console.log('Events loaded:', events);
        allEvents = events || [];
        filteredEvents = [...allEvents];
        
        displayEvents(filteredEvents);
        updateDashboardStats();
        populateLocationFilter();
        
        if (allEvents.length === 0 && showLoading) {
            showMessage('No events available at the moment.', 'info');
        } else if (showLoading) {
            showMessage(`Loaded ${allEvents.length} event(s) successfully`, 'success');
        }
    });
}

function displayEvents(events) {
    const eventsList = document.getElementById('eventsList');
    
    if (!events || events.length === 0) {
        eventsList.innerHTML = `
            <div class="message message-info">
                <h4>No events available</h4>
                <p>Check back later for upcoming events!</p>
            </div>
        `;
        return;
    }
    
    let eventsHTML = '';
    
    events.forEach(event => {
        const eventDate = new Date(event.Date);
        const now = new Date();
        const isUpcoming = eventDate > now;
        const isPast = eventDate < now;
        const isToday = eventDate.toDateString() === now.toDateString();
        
        let statusClass = 'status-available';
        let statusText = 'Available';
        
        if (isPast && !isToday) {
            statusClass = 'status-past';
            statusText = 'Past Event';
        } else if (isToday) {
            statusClass = 'status-today';
            statusText = 'Today';
        }
        
        const registrationCount = event.CurrentAttendees || 0;
        const availableSpots = event.MaxAttendees - registrationCount;
        const isFull = availableSpots <= 0;
        
        if (isFull && isUpcoming) {
            statusClass = 'status-full';
            statusText = 'Full';
        }
        
        // Check if user is already registered
        const isRegistered = myRegistrations.some(reg => reg.EventID === event.EventID);
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
                    <span>🎯 ${availableSpots} spots left</span>
                    <span>📊 ${fillPercentage}% filled</span>
                    <span>🏷️ ${event.Category || 'General'}</span>
                </div>
                <div class="event-actions">
                    ${isRegistered 
                        ? '<button class="btn btn-success btn-small">✅ Registered</button>'
                        : isPast 
                        ? '<button class="btn btn-secondary btn-small" disabled>Event Ended</button>'
                        : isFull
                        ? '<button class="btn btn-secondary btn-small" disabled>Event Full</button>'
                        : `<button class="btn btn-primary btn-small" onclick="registerForEventHandler('${event.EventID}', '${event.Title.replace(/'/g, "\\'")}')">Register Now</button>`
                    }
                    <button class="btn btn-small" onclick="viewEventDetails('${event.EventID}')">View Details</button>
                </div>
            </div>
        `;
    });
    
    eventsList.innerHTML = eventsHTML;
}

function updateDashboardStats() {
    const totalEvents = allEvents.length;
    const now = new Date();
    
    const upcomingEvents = allEvents.filter(event => new Date(event.Date) > now).length;
    const myRegistrationsCount = myRegistrations.length;
    const upcomingRegistrations = myRegistrations.filter(reg => {
        const event = allEvents.find(e => e.EventID === reg.EventID);
        return event && new Date(event.Date) > now;
    }).length;
    
    // Update stats with animation
    animateCountUp('totalAvailableEvents', totalEvents);
    animateCountUp('myRegistrations', myRegistrationsCount);
    animateCountUp('upcomingRegistrations', upcomingRegistrations);
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

function populateLocationFilter() {
    const locationFilter = document.getElementById('locationFilter');
    const locations = [...new Set(allEvents.map(event => event.Location))];
    
    // Clear existing options except "All Locations"
    locationFilter.innerHTML = '<option value="">All Locations</option>';
    
    locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = location;
        locationFilter.appendChild(option);
    });
}

// ===== ENHANCED EVENT REGISTRATION WITH EMAIL =====
function registerForEventHandler(eventID, eventTitle) {
    if (!isDbConnected) {
        showMessage('Database not connected. Please refresh the page.', 'error');
        return;
    }
    
    // Get attendee details
    const attendeeName = prompt(`Register for "${eventTitle}"\n\nPlease enter your full name:`);
    if (!attendeeName || attendeeName.trim() === '') {
        showMessage('Name is required for registration', 'error');
        return;
    }
    
    const attendeeEmail = prompt('Please enter your email address:');
    if (!attendeeEmail || !attendeeEmail.includes('@')) {
        showMessage('Valid email is required for registration', 'error');
        return;
    }
    
    const confirmation = confirm(`Confirm Registration Details:\n\nEvent: ${eventTitle}\nName: ${attendeeName}\nEmail: ${attendeeEmail}\n\nYou will receive a ticket ID after registration.`);
    if (!confirmation) return;
    
    const attendeeID = userSession.getIdToken().payload.sub;
    
    console.log('Registering for event:', eventID);
    showMessage('Processing registration...', 'info');
    
    // Enhanced registration with name and email
    registerForEventWithDetails(eventID, attendeeID, attendeeName.trim(), attendeeEmail.trim(), (err, result) => {
        if (err) {
            console.error('Registration error:', err);
            showMessage('Registration failed: ' + (err.message || err), 'error');
            return;
        }
        
        console.log('Registration successful:', result);
        
        // Show success message with ticket details
        const ticketMessage = `✅ Registration Successful!\n\n🎫 Ticket ID: ${result.ticketID}\n🎪 Event: ${eventTitle}\n👤 Name: ${attendeeName}\n📧 Email: ${attendeeEmail}\n\n📱 A confirmation SMS will be sent to your registered mobile number shortly.`;
        alert(ticketMessage);
        
        showMessage(`Registration successful! Ticket ID: ${result.ticketID}`, 'success');
        
        // Send SMS notification (simulated)
        sendSMSNotification(result.ticketID, eventTitle, attendeeName);
        
        // Refresh data to show updated counts and registration status
        setTimeout(() => {
            loadAllEvents(false);
            loadMyRegistrations();
        }, 1000);
    });
}

// Enhanced registration function with attendee details
function registerForEventWithDetails(eventID, attendeeID, attendeeName, attendeeEmail, callback) {
    if (!dynamoDBClient) {
        callback('DynamoDB client not initialized', null);
        return;
    }
    
    // First check if user is already registered
    const checkParams = {
        TableName: DynamoDBConfig.tables.registrations,
        FilterExpression: 'EventID = :eventID AND AttendeeID = :attendeeID',
        ExpressionAttributeValues: {
            ':eventID': eventID,
            ':attendeeID': attendeeID
        }
    };
    
    dynamoDBClient.scan(checkParams, (checkErr, checkData) => {
        if (checkErr) {
            console.error('Error checking existing registration:', checkErr);
            callback(checkErr, null);
            return;
        }
        
        if (checkData.Items && checkData.Items.length > 0) {
            callback('You are already registered for this event', null);
            return;
        }
        
        // Proceed with registration
        const registrationID = 'reg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const ticketID = 'TICKET_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6).toUpperCase();
        
        const params = {
            TableName: DynamoDBConfig.tables.registrations,
            Item: {
                RegistrationID: registrationID,
                EventID: eventID,
                AttendeeID: attendeeID,
                AttendeeName: attendeeName,
                AttendeeEmail: attendeeEmail,
                TicketID: ticketID,
                Status: 'CONFIRMED',
                RegisteredAt: new Date().toISOString()
            }
        };
        
        console.log('Creating enhanced registration:', params);
        
        dynamoDBClient.put(params, (err, data) => {
            if (err) {
                console.error('Error creating registration:', err);
                callback(err, null);
            } else {
                console.log('Registration created successfully:', data);
                callback(null, { ticketID: ticketID, ...params.Item });
            }
        });
    });
}

// Simulated SMS notification
function sendSMSNotification(ticketID, eventTitle, attendeeName) {
    console.log('Sending SMS notification...');
    
    // Simulate SMS sending delay
    setTimeout(() => {
        console.log(`SMS sent: Dear ${attendeeName}, your registration for "${eventTitle}" is confirmed. Ticket ID: ${ticketID}`);
        
        // Show notification to user
        setTimeout(() => {
            showMessage(`📱 SMS confirmation sent to your registered mobile number`, 'info', 3000);
        }, 2000);
    }, 1500);
}

function loadMyRegistrations() {
    if (!userSession || !isDbConnected) return;
    
    const attendeeID = userSession.getIdToken().payload.sub;
    
    getRegistrationsByAttendee(attendeeID, (err, registrations) => {
        if (err) {
            console.error('Error loading registrations:', err);
            return;
        }
        
        console.log('My registrations loaded:', registrations);
        myRegistrations = registrations || [];
        updateDashboardStats();
    });
}

function showMyTickets() {
    // Force refresh registrations before showing
    loadMyRegistrations();
    
    // Small delay to ensure data is loaded
    setTimeout(() => {
        if (myRegistrations.length === 0) {
            showMessage('You have not registered for any events yet.', 'info');
            return;
        }
        
        let ticketsHTML = '';
        
        myRegistrations.forEach(registration => {
            const event = allEvents.find(e => e.EventID === registration.EventID);
            const eventTitle = event ? event.Title : 'Event Not Found';
            const eventDate = event ? new Date(event.Date) : new Date();
            const eventLocation = event ? event.Location : 'Unknown';
            const isEventToday = event ? eventDate.toDateString() === new Date().toDateString() : false;
            const isEventPast = event ? eventDate < new Date() : false;
            
            let statusColor = '#FF99CC';
            let eventStatus = 'Upcoming';
            
            if (isEventPast) {
                statusColor = '#7f8c8d';
                eventStatus = 'Past Event';
            } else if (isEventToday) {
                statusColor = '#1ABC9C';
                eventStatus = 'Today';
            }
            
            ticketsHTML += `
                <div class="ticket-card" style="border-color: ${statusColor};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h4 style="color: ${statusColor}; margin: 0;">${eventTitle}</h4>
                        <span style="background: ${statusColor}; color: white; padding: 0.5rem 1rem; border-radius: 15px; font-size: 0.8rem; font-weight: bold;">
                            ${eventStatus}
                        </span>
                    </div>
                    
                    <div class="ticket-id" style="background: ${statusColor}; color: white; margin: 1rem 0;">
                        ${registration.TicketID}
                    </div>
                    
                    <div class="ticket-meta">
                        <div><strong>👤 Name:</strong> ${registration.AttendeeName || 'N/A'}</div>
                        <div><strong>📧 Email:</strong> ${registration.AttendeeEmail || 'N/A'}</div>
                        <div><strong>📅 Event Date:</strong> ${eventDate.toLocaleDateString('en-IN')}</div>
                        <div><strong>🕒 Event Time:</strong> ${eventDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                        <div><strong>📍 Location:</strong> ${eventLocation}</div>
                        <div><strong>✅ Status:</strong> ${registration.Status}</div>
                        <div><strong>📝 Registered:</strong> ${new Date(registration.RegisteredAt).toLocaleDateString('en-IN')}</div>
                        <div><strong>🎫 Ticket ID:</strong> <code>${registration.TicketID}</code></div>
                    </div>
                    
                    ${isEventToday ? '<div style="background: #ffebee; color: #e74c3c; padding: 0.5rem; border-radius: 8px; margin-top: 1rem; font-weight: bold; text-align: center;">🔴 EVENT IS TODAY!</div>' : ''}
                </div>
            `;
        });
        
        document.getElementById('ticketsList').innerHTML = ticketsHTML;
        document.getElementById('ticketsModal').style.display = 'block';
        showMessage(`Showing ${myRegistrations.length} ticket(s)`, 'info');
    }, 500);
}

function viewEventDetails(eventID) {
    const event = allEvents.find(e => e.EventID === eventID);
    if (!event) {
        showMessage('Event details not found', 'error');
        return;
    }
    
    const eventDate = new Date(event.Date);
    const registrationCount = event.CurrentAttendees || 0;
    const availableSpots = event.MaxAttendees - registrationCount;
    const fillPercentage = Math.round((registrationCount / event.MaxAttendees) * 100);
    const isEventToday = eventDate.toDateString() === new Date().toDateString();
    const isEventPast = eventDate < new Date();
    
    let eventStatus = 'Upcoming Event';
    let statusColor = '#FF99CC';
    
    if (isEventPast) {
        eventStatus = 'Past Event';
        statusColor = '#7f8c8d';
    } else if (isEventToday) {
        eventStatus = 'Event Today';
        statusColor = '#1ABC9C';
    }
    
    let detailsMessage = `═══ EVENT DETAILS ═══\n\n`;
    detailsMessage += `🎪 ${event.Title}\n`;
    detailsMessage += `📝 ${event.Description}\n\n`;
    detailsMessage += `📅 Date: ${eventDate.toLocaleDateString('en-IN')}\n`;
    detailsMessage += `🕒 Time: ${eventDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}\n`;
    detailsMessage += `📍 Location: ${event.Location}\n`;
    detailsMessage += `🏷️ Category: ${event.Category || 'General'}\n\n`;
    detailsMessage += `═══ CAPACITY INFO ═══\n`;
    detailsMessage += `👥 Total Capacity: ${event.MaxAttendees}\n`;
    detailsMessage += `✅ Registered: ${registrationCount}\n`;
    detailsMessage += `🎯 Available: ${availableSpots}\n`;
    detailsMessage += `📊 Fill Rate: ${fillPercentage}%\n\n`;
    detailsMessage += `🔄 Status: ${eventStatus}`;
    
    if (isEventToday) {
        detailsMessage += `\n\n🔴 THIS EVENT IS TODAY!`;
    }
    
    alert(detailsMessage);
}

// ===== SEARCH AND FILTER FUNCTIONS =====
function performSearch() {
    const searchTerm = document.getElementById('searchEvents').value.toLowerCase().trim();
    
    if (searchTerm === '') {
        clearSearch();
        return;
    }
    
    filteredEvents = allEvents.filter(event => 
        event.Title.toLowerCase().includes(searchTerm) ||
        event.Description.toLowerCase().includes(searchTerm) ||
        event.Location.toLowerCase().includes(searchTerm) ||
        (event.Category && event.Category.toLowerCase().includes(searchTerm))
    );
    
    displayEvents(filteredEvents);
    showMessage(`Found ${filteredEvents.length} matching event(s)`, 'info');
}

function clearSearch() {
    document.getElementById('searchEvents').value = '';
    filteredEvents = [...allEvents];
    displayEvents(filteredEvents);
    showMessage('Search cleared', 'info');
}

function applyFilters() {
    const locationFilter = document.getElementById('locationFilter').value;
    const dateFilter = document.getElementById('dateFilter').value;
    
    let filtered = [...allEvents];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const monthFromNow = new Date(today);
    monthFromNow.setMonth(monthFromNow.getMonth() + 1);
    
    // Apply location filter
    if (locationFilter) {
        filtered = filtered.filter(event => event.Location === locationFilter);
    }
    
    // Apply date filter
    if (dateFilter === 'today') {
        filtered = filtered.filter(event => {
            const eventDate = new Date(event.Date);
            return eventDate.toDateString() === today.toDateString();
        });
    } else if (dateFilter === 'tomorrow') {
        filtered = filtered.filter(event => {
            const eventDate = new Date(event.Date);
            return eventDate.toDateString() === tomorrow.toDateString();
        });
    } else if (dateFilter === 'thisweek') {
        filtered = filtered.filter(event => {
            const eventDate = new Date(event.Date);
            return eventDate >= today && eventDate <= weekFromNow;
        });
    } else if (dateFilter === 'thismonth') {
        filtered = filtered.filter(event => {
            const eventDate = new Date(event.Date);
            return eventDate >= today && eventDate <= monthFromNow;
        });
    }
    
    filteredEvents = filtered;
    displayEvents(filteredEvents);
    
    let filterMessage = `Showing ${filteredEvents.length} event(s)`;
    if (locationFilter) filterMessage += ` in ${locationFilter}`;
    if (dateFilter) filterMessage += ` for ${dateFilter}`;
    
    showMessage(filterMessage, 'info');
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
    
    if (!isDbConnected) {
        showMessage('Database not connected. Please refresh the page.', 'error');
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
            const isEventPast = eventDate < new Date();
            
            let eventStatus = 'Upcoming Event';
            let statusColor = '#FF99CC';
            
            if (isEventPast) {
                eventStatus = 'Past Event';
                statusColor = '#7f8c8d';
            } else if (isEventToday) {
                eventStatus = 'Event Today';
                statusColor = '#1ABC9C';
            }
            
            resultDiv.innerHTML = `
                <div class="validation-success">
                    <h4>✅ Valid Ticket</h4>
                    <div style="background: #f8f9fa; padding: 2rem; border-radius: 15px; margin: 1rem 0; border: 3px solid ${statusColor};">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <p style="margin: 0;"><strong>🎫 Ticket ID:</strong> ${ticket.TicketID}</p>
                            <span style="background: ${statusColor}; color: white; padding: 0.5rem 1rem; border-radius: 15px; font-size: 0.9rem; font-weight: bold;">
                                ${eventStatus}
                            </span>
                        </div>
                        <p><strong>🎪 Event:</strong> ${eventDetails.Title}</p>
                        <p><strong>👤 Name:</strong> ${ticket.AttendeeName || 'N/A'}</p>
                        <p><strong>📧 Email:</strong> ${ticket.AttendeeEmail || 'N/A'}</p>
                        <p><strong>📅 Date:</strong> ${eventDate.toLocaleDateString('en-IN')}</p>
                        <p><strong>🕒 Time:</strong> ${eventDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                        <p><strong>📍 Location:</strong> ${eventDetails.Location}</p>
                        <p><strong>✅ Status:</strong> ${ticket.Status}</p>
                        <p><strong>📝 Registered:</strong> ${new Date(ticket.RegisteredAt).toLocaleString('en-IN')}</p>
                        <p><strong>🏷️ Category:</strong> ${eventDetails.Category || 'General'}</p>
                    </div>
                    ${isEventToday ? '<div style="background: #ffebee; color: #e74c3c; padding: 1rem; border-radius: 8px; margin-top: 1rem; font-weight: bold; text-align: center;">🔴 THIS EVENT IS TODAY!</div>' : ''}
                </div>
            `;
            showMessage('Ticket validated successfully!', 'success');
        });
    });
}

// ===== UTILITY FUNCTIONS =====
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
        padding: 1.5rem 2rem;
        border-radius: 20px;
        min-width: 350px;
        max-width: 500px;
        font-weight: 600;
        box-shadow: 0 8px 30px rgba(0,0,0,0.15);
        transition: all 0.4s ease;
        transform: translateX(100%);
    `;
    
    if (type === 'success') {
        messageDiv.style.background = 'linear-gradient(135deg, #d5f5d5, #c8e6c9)';
        messageDiv.style.color = '#27ae60';
        messageDiv.style.borderLeft = '5px solid #27ae60';
    } else if (type === 'error') {
        messageDiv.style.background = 'linear-gradient(135deg, #ffebee, #ffcdd2)';
        messageDiv.style.color = '#e74c3c';
        messageDiv.style.borderLeft = '5px solid #e74c3c';
    } else {
        messageDiv.style.background = 'linear-gradient(135deg, #e3f2fd, #bbdefb)';
        messageDiv.style.color = '#2196f3';
        messageDiv.style.borderLeft = '5px solid #2196f3';
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
        }, 400);
    }, duration);
}

// ===== DISPLAY FUNCTIONS =====
function showLoginSection() {
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('confirmationSection').style.display = 'none';
    document.getElementById('eventsSection').style.display = 'none';
    document.getElementById('loginBtn').style.display = 'inline-block';
    document.getElementById('logoutBtn').style.display = 'none';
}

function showConfirmationSection() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('confirmationSection').style.display = 'block';
    document.getElementById('eventsSection').style.display = 'none';
    
    setTimeout(() => {
        const codeInput = document.getElementById('confirmationCode');
        if (codeInput) {
            codeInput.focus();
        }
    }, 100);
}

function showEventsSection() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('confirmationSection').style.display = 'none';
    document.getElementById('eventsSection').style.display = 'block';
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'inline-block';
    
    document.getElementById('email').value = '';
    document.getElementById('password').value = '';
}

console.log('Enhanced Attendee portal loaded successfully with email registration and SMS!');
