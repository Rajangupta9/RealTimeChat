// Connect to Socket.io server
const socket = io('http://localhost:5000');

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const chatInterface = document.getElementById('chatInterface');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const currentUsername = document.getElementById('currentUsername');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const messagesContainer = document.getElementById('messagesContainer');
const activeUsersList = document.getElementById('activeUsersList');
const roomsList = document.getElementById('roomsList');
const chatTitle = document.getElementById('chatTitle');
const chatDescription = document.getElementById('chatDescription');
const chatIcon = document.getElementById('chatIcon');
const chatActions = document.getElementById('chatActions');
const usersTabBtn = document.getElementById('usersTabBtn');
const roomsTabBtn = document.getElementById('roomsTabBtn');
const usersTab = document.getElementById('usersTab');
const roomsTab = document.getElementById('roomsTab');
const createRoomBtn = document.getElementById('createRoomBtn');
const createRoomModal = document.getElementById('createRoomModal');
const createRoomForm = document.getElementById('createRoomForm');
const cancelCreateRoomBtn = document.getElementById('cancelCreateRoomBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const notificationToast = document.getElementById('notificationToast');
const notificationMessage = document.getElementById('notificationMessage');
const notificationIcon = document.getElementById('notificationIcon');
const closeNotificationBtn = document.getElementById('closeNotificationBtn');
const typingIndicator = document.getElementById('typingIndicator');
const typingUser = document.getElementById('typingUser');

// Application State
const state = {
    username: null,
    currentChat: 'group', // 'group', 'room:roomName', or 'private:username'
    currentRoom: null,
    users: [],
    rooms: [],
    messages: {
        group: [],
        // private messages will be stored as 'private:username': []
        // room messages will be stored as 'room:roomName': []
    },
    typingTimeout: null
};

// ===== Socket.io Event Listeners =====

// Connection event
socket.on('connect', () => {
    console.log('Connected to server');
    document.getElementById('onlineStatus').textContent = 'Connected';
});

// Disconnect event
socket.on('disconnect', () => {
    console.log('Disconnected from server');
    document.getElementById('onlineStatus').textContent = 'Disconnected';
    showNotification('Connection lost. Trying to reconnect...', 'error');
});

// Registration response
socket.on('registration_successful', (message) => {
    loginScreen.classList.add('hidden');
    chatInterface.classList.remove('hidden');
    currentUsername.textContent = state.username;
    showNotification(message, 'success');
    
    // Request active users and rooms
    socket.emit('get_active_users');
    socket.emit('get_rooms_list');
});

// Error messages
socket.on('error_message', (message) => {
    if (state.username) {
        showNotification(message, 'error');
    } else {
        loginError.textContent = message;
        loginError.classList.remove('hidden');
    }
});

// Active users list
socket.on('active_users', (users) => {
    state.users = users;
    renderActiveUsers();
});

// Rooms list
socket.on('rooms_list', (rooms) => {
    state.rooms = rooms;
    renderRooms();
});

// Chat notifications
socket.on('chat_notification', (data) => {
    let iconClass = 'fa-info-circle';
    let type = 'info';
    
    switch (data.type) {
        case 'join':
            iconClass = 'fa-user-plus';
            type = 'success';
            break;
        case 'leave':
            iconClass = 'fa-user-minus';
            type = 'warning';
            break;
        case 'room':
            iconClass = 'fa-door-open';
            break;
    }
    
    showNotification(data.message, type, iconClass);
    
    // Add notification to messages if in group chat
    if (state.currentChat === 'group') {
        addSystemMessage(data.message);
    }
});

// Room notifications
socket.on('room_notification', (data) => {
    if (state.currentChat === `room:${data.room}`) {
        addSystemMessage(data.message);
    }
});

// Receive group message
socket.on('receive_group_message', (data) => {
    if (!state.messages.group) {
        state.messages.group = [];
    }
    
    state.messages.group.push(data);
    
    if (state.currentChat === 'group') {
        renderMessage(data, 'group');
        scrollToBottom();
    }
});

// Receive private message
socket.on('receive_private_message', (data) => {
    const chatKey = data.sender === state.username 
        ? `private:${data.receiver}` 
        : `private:${data.sender}`;
    
    if (!state.messages[chatKey]) {
        state.messages[chatKey] = [];
    }
    
    state.messages[chatKey].push(data);
    
    if (state.currentChat === chatKey) {
        renderMessage(data, 'private');
        scrollToBottom();
    } else {
        // If we're not in this chat, show a notification
        const otherUser = data.sender === state.username ? data.receiver : data.sender;
        showNotification(`New message from ${otherUser}`, 'message', 'fa-envelope');
        
        // Highlight the user in the list
        highlightUser(otherUser);
    }
});

// Receive room message
socket.on('receive_room_message', (data) => {
    const chatKey = `room:${data.room}`;
    
    if (!state.messages[chatKey]) {
        state.messages[chatKey] = [];
    }
    
    state.messages[chatKey].push(data);
    
    if (state.currentChat === chatKey) {
        renderMessage(data, 'room');
        scrollToBottom();
    } else {
        // If we're not in this room, show a notification
        showNotification(`New message in ${data.room}`, 'message', 'fa-comment');
        
        // Highlight the room in the list
        highlightRoom(data.room);
    }
});

// Room created
socket.on('room_created', (data) => {
    showNotification(`Room "${data.roomName}" created successfully!`, 'success', 'fa-check-circle');
    switchToRoomsTab();
});

// Room joined
// Room joined
socket.on('room_joined', (data) => {
    state.currentRoom = data.roomName;
    state.currentChat = `room:${data.roomName}`;
    
    if (!state.messages[state.currentChat]) {
        state.messages[state.currentChat] = [];
    }
    
    updateChatUI(data.roomName, 'room');
    showNotification(`You joined room "${data.roomName}"`, 'success', 'fa-door-open');
    socket.emit('get_room_history', { roomName: data.roomName });
});

// Room history
socket.on('room_history', (data) => {
    state.messages[`room:${data.roomName}`] = data.messages;
    renderChatHistory();
    scrollToBottom();
});

// Group history
socket.on('group_history', (messages) => {
    state.messages.group = messages;
    renderChatHistory();
    scrollToBottom();
});

// Room left
socket.on('room_left', (data) => {
    if (state.currentRoom === data.roomName) {
        state.currentRoom = null;
        state.currentChat = 'group';
        updateChatUI('Group Chat', 'group');
    }
    showNotification(`You left room "${data.roomName}"`, 'info', 'fa-sign-out-alt');
});

// User typing
socket.on('user_typing', (data) => {
    if ((state.currentChat === 'group' && data.chatType === 'group') ||
        (state.currentChat === `room:${data.room}` && data.chatType === 'room') ||
        (state.currentChat === `private:${data.username}` && data.chatType === 'private')) {
        
        typingUser.textContent = data.username;
        typingIndicator.classList.remove('hidden');
        
        // Hide typing indicator after 3 seconds
        setTimeout(() => {
            typingIndicator.classList.add('hidden');
        }, 3000);
    }
});

// ===== UI Event Handlers =====

// Login form submission
loginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    
    if (username.length >= 3) {
        state.username = username;
        socket.emit('register_user', { username });
    } else {
        loginError.textContent = 'Username must be at least 3 characters';
        loginError.classList.remove('hidden');
    }
});

// Logout button
logoutBtn.addEventListener('click', () => {
    socket.emit('logout');
    state.username = null;
    state.currentChat = 'group';
    state.currentRoom = null;
    chatInterface.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    document.getElementById('username').value = '';
});

// Send message form
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    
    if (message) {
        if (state.currentChat === 'group') {
            socket.emit('send_group_message', { message });
        } else if (state.currentChat.startsWith('private:')) {
            const receiver = state.currentChat.split(':')[1];
            socket.emit('send_private_message', { receiver, message });
        } else if (state.currentChat.startsWith('room:')) {
            const room = state.currentChat.split(':')[1];
            socket.emit('send_room_message', { room, message });
        }
        
        messageInput.value = '';
        clearTimeout(state.typingTimeout);
    }
});

// User typing event
messageInput.addEventListener('input', () => {
    clearTimeout(state.typingTimeout);
    
    if (messageInput.value.trim()) {
        let data = {};
        
        if (state.currentChat === 'group') {
            data = { chatType: 'group' };
        } else if (state.currentChat.startsWith('private:')) {
            data = { 
                chatType: 'private',
                receiver: state.currentChat.split(':')[1]
            };
        } else if (state.currentChat.startsWith('room:')) {
            data = {
                chatType: 'room',
                room: state.currentChat.split(':')[1]
            };
        }
        
        socket.emit('user_typing', data);
        
        // Stop sending typing event after 2 seconds of inactivity
        state.typingTimeout = setTimeout(() => {
            // Could send 'stopped_typing' event here if needed
        }, 2000);
    }
});

// Tab switching
usersTabBtn.addEventListener('click', switchToUsersTab);
roomsTabBtn.addEventListener('click', switchToRoomsTab);

function switchToUsersTab() {
    usersTabBtn.classList.add('active');
    roomsTabBtn.classList.remove('active');
    usersTab.classList.remove('hidden');
    roomsTab.classList.add('hidden');
}

function switchToRoomsTab() {
    usersTabBtn.classList.remove('active');
    roomsTabBtn.classList.add('active');
    usersTab.classList.add('hidden');
    roomsTab.classList.remove('hidden');
}

// Create room
createRoomBtn.addEventListener('click', () => {
    createRoomModal.classList.remove('hidden');
});

cancelCreateRoomBtn.addEventListener('click', () => {
    createRoomModal.classList.add('hidden');
});

createRoomForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const roomName = document.getElementById('roomName').value.trim();
    const roomDescription = document.getElementById('roomDescription').value.trim();
    
    if (roomName) {
        socket.emit('create_room', { 
            roomName, 
            description: roomDescription 
        });
        createRoomModal.classList.add('hidden');
        document.getElementById('roomName').value = '';
        document.getElementById('roomDescription').value = '';
    }
});

// Leave room
leaveRoomBtn.addEventListener('click', () => {
    if (state.currentRoom) {
        socket.emit('leave_room', { roomName: state.currentRoom });
    }
});

// Close notification
closeNotificationBtn.addEventListener('click', () => {
    notificationToast.classList.add('hidden');
});

// ===== Helper Functions =====

// Show notification toast
function showNotification(message, type = 'info', icon = 'fa-info-circle') {
    notificationMessage.textContent = message;
    notificationIcon.className = `fas ${icon} mr-2`;
    
    // Set toast color based on type
    notificationToast.className = 'fixed top-4 right-4 p-4 rounded shadow-lg flex items-center z-50';
    
    switch (type) {
        case 'success':
            notificationToast.classList.add('bg-green-100', 'text-green-800');
            break;
        case 'error':
            notificationToast.classList.add('bg-red-100', 'text-red-800');
            break;
        case 'warning':
            notificationToast.classList.add('bg-yellow-100', 'text-yellow-800');
            break;
        case 'message':
            notificationToast.classList.add('bg-blue-100', 'text-blue-800');
            break;
        default:
            notificationToast.classList.add('bg-gray-100', 'text-gray-800');
    }
    
    notificationToast.classList.remove('hidden');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        notificationToast.classList.add('hidden');
    }, 5000);
}

// Render active users list
function renderActiveUsers() {
    activeUsersList.innerHTML = '';
    
    state.users.forEach(user => {
        if (user !== state.username) {
            const userItem = document.createElement('div');
            userItem.className = 'flex items-center p-2 hover:bg-gray-100 cursor-pointer user-item';
            
            // Check if there are unread messages
            const hasUnread = state.messages[`private:${user}`]?.some(msg => 
                msg.sender === user && !msg.read);
            
            userItem.innerHTML = `
                <div class="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span>${user}</span>
                ${hasUnread ? '<span class="ml-auto bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">!</span>' : ''}
            `;
            
            userItem.addEventListener('click', () => {
                startPrivateChat(user);
            });
            
            activeUsersList.appendChild(userItem);
        }
    });
}

// Render rooms list
function renderRooms() {
    roomsList.innerHTML = '';
    
    state.rooms.forEach(room => {
        const roomItem = document.createElement('div');
        roomItem.className = 'flex items-center p-2 hover:bg-gray-100 cursor-pointer room-item';
        
        // Check if there are unread messages
        const hasUnread = state.messages[`room:${room.name}`]?.some(msg => 
            msg.sender !== state.username && !msg.read);
        
        roomItem.innerHTML = `
            <div class="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
            <div class="flex flex-col">
                <span class="font-medium">${room.name}</span>
                <span class="text-xs text-gray-500">${room.description || 'No description'}</span>
            </div>
            ${hasUnread ? '<span class="ml-auto bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">!</span>' : ''}
        `;
        
        roomItem.addEventListener('click', () => {
            joinRoom(room.name);
        });
        
        roomsList.appendChild(roomItem);
    });
}

// Start private chat
function startPrivateChat(username) {
    state.currentChat = `private:${username}`;
    state.currentRoom = null;
    
    if (!state.messages[state.currentChat]) {
        state.messages[state.currentChat] = [];
    }
    
    updateChatUI(username, 'private');
    socket.emit('get_private_history', { username });
}

// Join room
function joinRoom(roomName) {
    socket.emit('join_room', { roomName });
}

// Update chat UI
function updateChatUI(name, type) {
    // Update chat header
    switch (type) {
        case 'group':
            chatTitle.textContent = 'Group Chat';
            chatDescription.textContent = 'Public chat room for all users';
            chatIcon.className = 'fas fa-users text-gray-600 mr-2';
            leaveRoomBtn.classList.add('hidden');
            break;
            
        case 'private':
            chatTitle.textContent = name;
            chatDescription.textContent = 'Private conversation';
            chatIcon.className = 'fas fa-user text-blue-600 mr-2';
            leaveRoomBtn.classList.add('hidden');
            break;
            
        case 'room':
            const room = state.rooms.find(r => r.name === name);
            chatTitle.textContent = name;
            chatDescription.textContent = room?.description || 'Chat room';
            chatIcon.className = 'fas fa-door-open text-purple-600 mr-2';
            leaveRoomBtn.classList.remove('hidden');
            break;
    }
    
    renderChatHistory();
    scrollToBottom();
}

// Add system message
function addSystemMessage(message) {
    const systemMessage = {
        type: 'system',
        content: message,
        timestamp: new Date().toISOString()
    };
    
    if (state.currentChat === 'group') {
        state.messages.group.push(systemMessage);
    } else {
        state.messages[state.currentChat].push(systemMessage);
    }
    
    renderMessage(systemMessage, 'system');
    scrollToBottom();
}

// Render chat history
function renderChatHistory() {
    messagesContainer.innerHTML = '';
    
    const messages = state.messages[state.currentChat] || [];
    
    messages.forEach(message => {
        renderMessage(message);
    });
}

// Render a single message
function renderMessage(message, type) {
    const messageEl = document.createElement('div');
    messageEl.className = 'mb-4';
    
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    
    if (message.type === 'system') {
        messageEl.innerHTML = `
            <div class="text-center text-gray-500 text-sm py-2">
                ${message.content}
                <span class="ml-2 text-xs">${timestamp}</span>
            </div>
        `;
    } else if (message.sender === state.username) {
        messageEl.innerHTML = `
            <div class="flex justify-end">
                <div class="bg-blue-500 text-white p-3 rounded-lg max-w-3/4">
                    <div>${message.content}</div>
                    <div class="text-right text-xs text-blue-100 mt-1">${timestamp}</div>
                </div>
            </div>
        `;
    } else {
        messageEl.innerHTML = `
            <div class="flex justify-start">
                <div class="bg-gray-200 p-3 rounded-lg max-w-3/4">
                    <div class="font-medium text-sm text-gray-600">${message.sender}</div>
                    <div>${message.content}</div>
                    <div class="text-right text-xs text-gray-500 mt-1">${timestamp}</div>
                </div>
            </div>
        `;
    }
    
    messagesContainer.appendChild(messageEl);
    
    // Mark as read
    if (message.sender !== state.username) {
        message.read = true;
    }
}

// Highlight user with unread messages
function highlightUser(username) {
    const userItems = document.querySelectorAll('.user-item');
    userItems.forEach(item => {
        if (item.textContent.includes(username)) {
            item.classList.add('bg-blue-50');
            
            // Add notification badge if not exists
            if (!item.querySelector('.ml-auto')) {
                const badge = document.createElement('span');
                badge.className = 'ml-auto bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs';
                badge.textContent = '!';
                item.appendChild(badge);
            }
        }
    });
}

// Highlight room with unread messages
function highlightRoom(roomName) {
    const roomItems = document.querySelectorAll('.room-item');
    roomItems.forEach(item => {
        if (item.textContent.includes(roomName)) {
            item.classList.add('bg-blue-50');
            
            // Add notification badge if not exists
            if (!item.querySelector('.ml-auto')) {
                const badge = document.createElement('span');
                badge.className = 'ml-auto bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs';
                badge.textContent = '!';
                item.appendChild(badge);
            }
        }
    });
}

// Scroll to bottom of chat
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Initialize the app
function init() {
    // Show login screen by default
    loginScreen.classList.remove('hidden');
    chatInterface.classList.add('hidden');
    
    // Set active tab to users by default
    switchToUsersTab();
}

// Start the app
init();