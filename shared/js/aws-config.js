// AWS Cognito Configuration - COMPLETE FIXED VERSION
const AWSConfig = {
    region: 'ap-south-1',
    userPoolId: 'ap-south-1_F8XFoOaI8',
    clientId: '2qnqdc4drkavlomc34rva4b0ai',
};

// DynamoDB Configuration
const DynamoDBConfig = {
    region: 'ap-south-1',
    tables: {
        events: 'EventSystem-Events',
        registrations: 'EventSystem-Registrations', 
        users: 'EventSystem-Users'
    }
};

// Global variables
let userPool;
let cognitoUser;
let dynamoDBClient;

// Initialize AWS Cognito when SDK is loaded
function initializeCognito() {
    try {
        if (typeof AmazonCognitoIdentity === 'undefined') {
            console.error('Amazon Cognito Identity SDK not loaded');
            setTimeout(initializeCognito, 1000);
            return;
        }

        console.log('Initializing Cognito with config:', AWSConfig);
        
        userPool = new AmazonCognitoIdentity.CognitoUserPool({
            UserPoolId: AWSConfig.userPoolId,
            ClientId: AWSConfig.clientId
        });
        
        console.log('Cognito User Pool initialized successfully');
        
    } catch (error) {
        console.error('Error initializing Cognito:', error);
        setTimeout(initializeCognito, 1000);
    }
}

// Initialize DynamoDB client
function initializeDynamoDB() {
    try {
        if (typeof AWS === 'undefined') {
            console.error('AWS SDK not loaded for DynamoDB');
            setTimeout(initializeDynamoDB, 1000);
            return;
        }

        AWS.config.region = DynamoDBConfig.region;
        
        dynamoDBClient = new AWS.DynamoDB.DocumentClient({
            region: 'ap-south-1'
        });
        
        console.log('DynamoDB client initialized successfully');
        
    } catch (error) {
        console.error('Error initializing DynamoDB:', error);
        setTimeout(initializeDynamoDB, 1000);
    }
}

// ENHANCED: Configure AWS credentials with proper error handling
function configureDynamoDBCredentials(session) {
    return new Promise((resolve, reject) => {
        if (!session) {
            console.error('No session provided for DynamoDB credentials');
            reject('No session provided');
            return;
        }
        
        try {
            console.log('Configuring DynamoDB credentials...');
            
            AWS.config.region = 'ap-south-1';
            
            AWS.config.credentials = new AWS.CognitoIdentityCredentials({
                IdentityPoolId: 'ap-south-1:929bf910-7ebe-4579-8dc1-f19a45acbd73',
                Logins: {
                    'cognito-idp.ap-south-1.amazonaws.com/ap-south-1_F8XFoOaI8': session.getIdToken().getJwtToken()
                }
            });
            
            AWS.config.credentials.refresh((error) => {
                if (error) {
                    console.error('Error refreshing credentials:', error);
                    reject(error);
                    return;
                }
                
                console.log('DynamoDB credentials configured successfully');
                
                // Initialize DynamoDB client
                try {
                    dynamoDBClient = new AWS.DynamoDB.DocumentClient({
                        region: 'ap-south-1'
                    });
                    console.log('DynamoDB client created after credential refresh');
                    resolve();
                } catch (dbError) {
                    console.error('Error creating DynamoDB client:', dbError);
                    reject(dbError);
                }
            });
            
        } catch (error) {
            console.error('Error configuring DynamoDB credentials:', error);
            reject(error);
        }
    });
}

// Check if user is currently authenticated
function getCurrentUser() {
    if (!userPool) {
        console.error('User pool not initialized yet');
        return null;
    }
    return userPool.getCurrentUser();
}

// Get user groups from JWT token
function getUserGroups(session) {
    try {
        const payload = session.getIdToken().payload;
        return payload['cognito:groups'] || [];
    } catch (error) {
        console.error('Error getting user groups:', error);
        return [];
    }
}

// Enhanced sign up function
function signUpUser(email, password, name, phoneNumber, preferredUsername, callback) {
    if (!userPool) {
        callback('User pool not initialized. Please wait and try again.', null);
        return;
    }

    try {
        const uniqueUsername = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        console.log('=== SIGNUP DEBUG ===');
        console.log('Generated username:', uniqueUsername);
        console.log('Email:', email);
        
        const attributeList = [
            new AmazonCognitoIdentity.CognitoUserAttribute({
                Name: 'email',
                Value: email
            }),
            new AmazonCognitoIdentity.CognitoUserAttribute({
                Name: 'name',
                Value: name
            }),
            new AmazonCognitoIdentity.CognitoUserAttribute({
                Name: 'phone_number',
                Value: phoneNumber
            }),
            new AmazonCognitoIdentity.CognitoUserAttribute({
                Name: 'preferred_username',
                Value: preferredUsername
            })
        ];

        userPool.signUp(uniqueUsername, password, attributeList, null, function(err, result) {
            if (err) {
                console.error('Sign up error:', err);
                callback(err, null);
                return;
            }
            
            console.log('Sign up successful:', result);
            callback(null, {
                ...result,
                generatedUsername: uniqueUsername,
                email: email
            });
        });
        
    } catch (error) {
        console.error('Error in signUpUser:', error);
        callback(error.message || 'Sign up failed', null);
    }
}

// Confirm sign up with verification code
function confirmSignUp(username, verificationCode, callback) {
    if (!userPool) {
        callback('User pool not initialized. Please wait and try again.', null);
        return;
    }

    try {
        const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
            Username: username,
            Pool: userPool
        });

        cognitoUser.confirmRegistration(verificationCode, true, function(err, result) {
            if (err) {
                console.error('Confirmation error:', err);
                callback(err, null);
                return;
            }
            console.log('Email confirmation successful:', result);
            callback(null, result);
        });

    } catch (error) {
        console.error('Error in confirmSignUp:', error);
        callback(error.message || 'Confirmation failed', null);
    }
}

// Resend confirmation code
function resendConfirmationCode(username, callback) {
    if (!userPool) {
        callback('User pool not initialized. Please wait and try again.', null);
        return;
    }

    try {
        const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
            Username: username,
            Pool: userPool
        });

        cognitoUser.resendConfirmationCode(function(err, result) {
            if (err) {
                console.error('Resend confirmation error:', err);
                callback(err, null);
                return;
            }
            console.log('Confirmation code resent:', result);
            callback(null, result);
        });

    } catch (error) {
        console.error('Error in resendConfirmationCode:', error);
        callback(error.message || 'Resend failed', null);
    }
}

// Enhanced sign in function
function signInUser(loginIdentifier, password, callback) {
    if (!userPool) {
        callback('User pool not initialized. Please wait and try again.', null);
        return;
    }

    try {
        const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
            Username: loginIdentifier,
            Password: password
        });

        const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
            Username: loginIdentifier,
            Pool: userPool
        });

        cognitoUser.authenticateUser(authenticationDetails, {
            onSuccess: function(session) {
                console.log('Authentication successful');
                callback(null, {
                    user: cognitoUser,
                    session: session,
                    groups: getUserGroups(session)
                });
            },
            onFailure: function(err) {
                console.error('Authentication failed:', err);
                callback(err, null);
            }
        });
    } catch (error) {
        console.error('Error in signInUser:', error);
        callback(error.message || 'Sign in failed', null);
    }
}

// Sign out user
function signOutUser() {
    try {
        const currentUser = getCurrentUser();
        if (currentUser) {
            currentUser.signOut();
            console.log('User signed out successfully');
        }
    } catch (error) {
        console.error('Error signing out:', error);
    }
}

// ===== ENHANCED DYNAMODB FUNCTIONS =====

// Create a new event with enhanced error handling
function createEvent(eventData, callback) {
    if (!dynamoDBClient) {
        callback('DynamoDB client not initialized', null);
        return;
    }
    
    const eventID = 'event_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const params = {
        TableName: DynamoDBConfig.tables.events,
        Item: {
            EventID: eventID,
            OrganizerID: eventData.organizerID,
            Title: eventData.title,
            Description: eventData.description,
            Date: eventData.date,
            Location: eventData.location,
            MaxAttendees: parseInt(eventData.maxAttendees),
            CreatedAt: new Date().toISOString(),
            CurrentAttendees: 0,
            Category: eventData.category || 'General'
        }
    };
    
    console.log('Creating event:', params);
    
    dynamoDBClient.put(params, (err, data) => {
        if (err) {
            console.error('Error creating event:', err);
            callback(err, null);
        } else {
            console.log('Event created successfully:', data);
            callback(null, { eventID: eventID, ...params.Item });
        }
    });
}

// Get events by organizer with enhanced error handling
function getEventsByOrganizer(organizerID, callback) {
    if (!dynamoDBClient) {
        callback('DynamoDB client not initialized', null);
        return;
    }
    
    const params = {
        TableName: DynamoDBConfig.tables.events,
        FilterExpression: 'OrganizerID = :organizerID',
        ExpressionAttributeValues: {
            ':organizerID': organizerID
        }
    };
    
    console.log('Getting events for organizer:', organizerID);
    
    dynamoDBClient.scan(params, (err, data) => {
        if (err) {
            console.error('Error getting events:', err);
            callback(err, null);
        } else {
            console.log('Events retrieved:', data.Items);
            callback(null, data.Items || []);
        }
    });
}

// Get all available events with enhanced error handling
function getAllEvents(callback) {
    if (!dynamoDBClient) {
        callback('DynamoDB client not initialized', null);
        return;
    }
    
    const params = {
        TableName: DynamoDBConfig.tables.events
    };
    
    console.log('Getting all events');
    
    dynamoDBClient.scan(params, (err, data) => {
        if (err) {
            console.error('Error getting all events:', err);
            callback(err, null);
        } else {
            console.log('All events retrieved:', data.Items);
            callback(null, data.Items || []);
        }
    });
}

// Enhanced register for event with duplicate checking
function registerForEvent(eventID, attendeeID, callback) {
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
                TicketID: ticketID,
                Status: 'CONFIRMED',
                RegisteredAt: new Date().toISOString()
            }
        };
        
        console.log('Creating registration:', params);
        
        dynamoDBClient.put(params, (err, data) => {
            if (err) {
                console.error('Error creating registration:', err);
                callback(err, null);
            } else {
                console.log('Registration created successfully:', data);
                
                // Update event attendee count
                updateEventAttendeeCount(eventID, 1, (updateErr) => {
                    if (updateErr) {
                        console.error('Error updating attendee count:', updateErr);
                    }
                });
                
                callback(null, { ticketID: ticketID, ...params.Item });
            }
        });
    });
}

// Helper function to update event attendee count
function updateEventAttendeeCount(eventID, increment, callback) {
    if (!dynamoDBClient) {
        callback('DynamoDB client not initialized');
        return;
    }
    
    const params = {
        TableName: DynamoDBConfig.tables.events,
        Key: { EventID: eventID },
        UpdateExpression: 'ADD CurrentAttendees :increment',
        ExpressionAttributeValues: {
            ':increment': increment
        },
        ReturnValues: 'UPDATED_NEW'
    };
    
    dynamoDBClient.update(params, (err, data) => {
        if (err) {
            console.error('Error updating event attendee count:', err);
            callback(err);
        } else {
            console.log('Event attendee count updated:', data);
            callback(null, data);
        }
    });
}

// Get registrations for an event
function getEventRegistrations(eventID, callback) {
    if (!dynamoDBClient) {
        callback('DynamoDB client not initialized', null);
        return;
    }
    
    const params = {
        TableName: DynamoDBConfig.tables.registrations,
        FilterExpression: 'EventID = :eventID',
        ExpressionAttributeValues: {
            ':eventID': eventID
        }
    };
    
    dynamoDBClient.scan(params, (err, data) => {
        if (err) {
            console.error('Error getting registrations:', err);
            callback(err, null);
        } else {
            console.log('Registrations retrieved:', data.Items);
            callback(null, data.Items || []);
        }
    });
}

// Get registrations by attendee
function getRegistrationsByAttendee(attendeeID, callback) {
    if (!dynamoDBClient) {
        callback('DynamoDB client not initialized', null);
        return;
    }
    
    const params = {
        TableName: DynamoDBConfig.tables.registrations,
        FilterExpression: 'AttendeeID = :attendeeID',
        ExpressionAttributeValues: {
            ':attendeeID': attendeeID
        }
    };
    
    dynamoDBClient.scan(params, (err, data) => {
        if (err) {
            console.error('Error getting attendee registrations:', err);
            callback(err, null);
        } else {
            console.log('Attendee registrations retrieved:', data.Items);
            callback(null, data.Items || []);
        }
    });
}

// Enhanced validate ticket function
function validateTicket(ticketID, callback) {
    if (!dynamoDBClient) {
        callback('DynamoDB client not initialized', null);
        return;
    }
    
    const params = {
        TableName: DynamoDBConfig.tables.registrations,
        FilterExpression: 'TicketID = :ticketID',
        ExpressionAttributeValues: {
            ':ticketID': ticketID.toUpperCase() // Ensure uppercase for consistency
        }
    };
    
    dynamoDBClient.scan(params, (err, data) => {
        if (err) {
            console.error('Error validating ticket:', err);
            callback(err, null);
        } else if (!data.Items || data.Items.length === 0) {
            callback('Ticket not found', null);
        } else {
            console.log('Ticket found:', data.Items[0]);
            callback(null, data.Items[0]);
        }
    });
}

// Get event details by ID
function getEventById(eventID, callback) {
    if (!dynamoDBClient) {
        callback('DynamoDB client not initialized', null);
        return;
    }
    
    const params = {
        TableName: DynamoDBConfig.tables.events,
        Key: {
            EventID: eventID
        }
    };
    
    dynamoDBClient.get(params, (err, data) => {
        if (err) {
            console.error('Error getting event:', err);
            callback(err, null);
        } else if (!data.Item) {
            callback('Event not found', null);
        } else {
            console.log('Event retrieved:', data.Item);
            callback(null, data.Item);
        }
    });
}

// Enhanced test function
function testDynamoDBConnection() {
    if (!dynamoDBClient) {
        console.error('No DynamoDB client available for testing');
        return false;
    }
    
    const params = {
        TableName: DynamoDBConfig.tables.events,
        Limit: 1
    };
    
    console.log('Testing DynamoDB connection...');
    
    dynamoDBClient.scan(params, (err, data) => {
        if (err) {
            console.error('DynamoDB connection test failed:', err);
            return false;
        } else {
            console.log('DynamoDB connection test successful:', data);
            return true;
        }
    });
}

console.log('Enhanced AWS Config loaded successfully');
console.log('AWS Config:', AWSConfig);
console.log('DynamoDB Config:', DynamoDBConfig);

