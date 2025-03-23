const express = require("express");
const { Server } = require("socket.io");
const http = require("http");

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.get("/", (req, res) => {
    res.send("Socket.io Chat Server Running (Group, Private, and Room Chat)");
});

// Serve static files
app.use(express.static('public'));

// Store users and their socket IDs
let users = {}; // Stores { username: { socketId, active: true, room: null } }

// Store rooms and their members
let rooms = {}; // Stores { roomName: { description, members: [usernames], createdBy, createdAt } }

// Store messages for history
let messages = {
    group: [],
    // private messages will be stored as 'private:user1:user2': []
    // room messages will be stored as 'room:roomName': []
};

io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    // Register username
    socket.on("register_user", (data) => {
        const username = data.username;
        
        // Check if username already exists and is active
        if (users[username] && users[username].active) {
            socket.emit("error_message", `Username ${username} is already taken!`);
            return;
        }

        users[username] = { socketId: socket.id, active: true, room: null };
        socket.username = username; // Store username in socket for easy access on disconnect
        
        console.log(`User Registered: ${username} - Socket ID: ${socket.id}`);
        
        socket.emit("registration_successful", `Welcome ${username}, you are now registered!`);
        io.emit("chat_notification", { message: `${username} joined the chat!`, type: "join" });
        
        // Send updated active users list to all clients
        io.emit("active_users", getActiveUsers());
    });

    // Send group message
    socket.on("send_group_message", (data) => {
        const username = socket.username || Object.keys(users).find(name => users[name].socketId === socket.id);
        
        if (!username) {
            socket.emit("error_message", "You must be registered to send messages!");
            return;
        }
        
        const messageData = {
            sender: username,
            content: data.message,
            timestamp: new Date().toISOString()
        };
        
        // Store message in history
        messages.group.push(messageData);
        
        // Keep history size reasonable
        if (messages.group.length > 100) {
            messages.group.shift();
        }
        
        io.emit("receive_group_message", messageData);
    });

    // Send private message
    socket.on("send_private_message", (data) => {
        const sender = socket.username || Object.keys(users).find(name => users[name].socketId === socket.id);
        const { receiver, message } = data;
        
        if (!sender) {
            socket.emit("error_message", "You must be registered to send messages!");
            return;
        }
        
        if (!users[receiver]) {
            socket.emit("error_message", `User ${receiver} not found!`);
            return;
        }

        if (!users[receiver].active) {
            socket.emit("error_message", `User ${receiver} is currently offline!`);
            return;
        }

        const receiverSocketId = users[receiver].socketId;
        
        const messageData = {
            sender,
            receiver,
            content: message,
            timestamp: new Date().toISOString()
        };
        
        // Store message in history - create sorted key to ensure consistency
        const usernames = [sender, receiver].sort();
        const chatKey = `private:${usernames[0]}:${usernames[1]}`;
        
        if (!messages[chatKey]) {
            messages[chatKey] = [];
        }
        
        messages[chatKey].push(messageData);
        
        // Keep history size reasonable
        if (messages[chatKey].length > 100) {
            messages[chatKey].shift();
        }
        
        io.to(receiverSocketId).to(socket.id).emit("receive_private_message", messageData);
    });
    
    // Create a new chat room
    socket.on("create_room", (data) => {
        const { roomName, description } = data;
        const creator = socket.username || Object.keys(users).find(name => users[name].socketId === socket.id);
        
        if (!creator) {
            socket.emit("error_message", "You must be registered to create rooms!");
            return;
        }
        
        if (rooms[roomName]) {
            socket.emit("error_message", `Room ${roomName} already exists!`);
            return;
        }
        
        rooms[roomName] = {
            description: description || `${roomName} chat room`,
            members: [creator],
            createdBy: creator,
            createdAt: new Date().toISOString()
        };
        
        // Join socket to the room
        socket.join(roomName);
        
        // Update user's current room
        if (users[creator]) {
            users[creator].room = roomName;
        }
        
        // Initialize message history for this room
        messages[`room:${roomName}`] = [];
        
        socket.emit("room_created", { roomName, description });
        io.emit("rooms_list", getRoomsList());
        io.emit("chat_notification", { message: `${creator} created room: ${roomName}`, type: "room" });
    });
    
    // Join a chat room
    socket.on("join_room", (data) => {
        const { roomName } = data;
        const username = socket.username || Object.keys(users).find(name => users[name].socketId === socket.id);
        
        if (!username) {
            socket.emit("error_message", "You must be registered to join rooms!");
            return;
        }
        
        if (!rooms[roomName]) {
            socket.emit("error_message", `Room ${roomName} does not exist!`);
            return;
        }
        
        // Leave current room if in one
        if (users[username] && users[username].room) {
            socket.leave(users[username].room);
            const oldRoom = users[username].room;
            
            if (rooms[oldRoom]) {
                rooms[oldRoom].members = rooms[oldRoom].members.filter(member => member !== username);
                
                // Notify room members about the leave
                io.to(oldRoom).emit("room_notification", {
                    message: `${username} left the room`,
                    room: oldRoom,
                    type: "leave"
                });
            }
        }
        
        // Join new room
        socket.join(roomName);
        users[username].room = roomName;
        
        // Add user to room members if not already there
        if (!rooms[roomName].members.includes(username)) {
            rooms[roomName].members.push(username);
        }
        
        socket.emit("room_joined", { 
            roomName, 
            description: rooms[roomName].description,
            members: rooms[roomName].members 
        });
        
        // Notify room members about the join
        io.to(roomName).emit("room_notification", {
            message: `${username} joined the room`,
            room: roomName,
            type: "join"
        });
        
        // Send updated rooms list to everyone
        io.emit("rooms_list", getRoomsList());
    });
    
    // Leave a chat room
    socket.on("leave_room", (data) => {
        const { roomName } = data;
        const username = socket.username || Object.keys(users).find(name => users[name].socketId === socket.id);
        
        if (!username) {
            socket.emit("error_message", "You must be registered to leave rooms!");
            return;
        }
        
        if (!rooms[roomName]) {
            socket.emit("error_message", `Room ${roomName} does not exist!`);
            return;
        }
        
        socket.leave(roomName);
        
        if (users[username]) {
            users[username].room = null;
        }
        
        // Remove user from room members
        if (rooms[roomName]) {
            rooms[roomName].members = rooms[roomName].members.filter(member => member !== username);
            
            // Delete room if empty and not the general room
            if (rooms[roomName].members.length === 0 && roomName !== "general") {
                delete rooms[roomName];
                io.emit("room_deleted", { roomName });
            } else {
                // Notify room members about the leave
                io.to(roomName).emit("room_notification", {
                    message: `${username} left the room`,
                    room: roomName,
                    type: "leave"
                });
            }
        }
        
        socket.emit("room_left", { roomName });
        io.emit("rooms_list", getRoomsList());
    });
    
    // Send message to a room
    socket.on("send_room_message", (data) => {
        const { room, message } = data;
        const sender = socket.username || Object.keys(users).find(name => users[name].socketId === socket.id);
        
        if (!sender) {
            socket.emit("error_message", "You must be registered to send messages!");
            return;
        }
        
        if (!rooms[room]) {
            socket.emit("error_message", `Room ${room} does not exist!`);
            return;
        }
        
        const messageData = {
            sender,
            room,
            content: message,
            timestamp: new Date().toISOString()
        };
        
        // Store message in history
        const chatKey = `room:${room}`;
        
        if (!messages[chatKey]) {
            messages[chatKey] = [];
        }
        
        messages[chatKey].push(messageData);
        
        // Keep history size reasonable
        if (messages[chatKey].length > 100) {
            messages[chatKey].shift();
        }
        
        io.to(room).emit("receive_room_message", messageData);
    });
    
    // Get group chat history
    socket.on("get_group_history", () => {
        socket.emit("group_history", messages.group);
    });
    
    // Get private chat history
    socket.on("get_private_history", (data) => {
        const { username } = data;
        const currentUser = socket.username || Object.keys(users).find(name => users[name].socketId === socket.id);
        
        if (!currentUser) {
            socket.emit("error_message", "You must be registered to access message history!");
            return;
        }
        
        // Create sorted key to ensure consistency
        const usernames = [currentUser, username].sort();
        const chatKey = `private:${usernames[0]}:${usernames[1]}`;
        
        socket.emit("private_history", {
            username,
            messages: messages[chatKey] || []
        });
    });
    
    // Get room chat history
    socket.on("get_room_history", (data) => {
        const { roomName } = data;
        
        if (!rooms[roomName]) {
            socket.emit("error_message", `Room ${roomName} does not exist!`);
            return;
        }
        
        socket.emit("room_history", {
            roomName,
            messages: messages[`room:${roomName}`] || []
        });
    });
    
    // User typing indicator
    socket.on("user_typing", (data) => {
        const username = socket.username || Object.keys(users).find(name => users[name].socketId === socket.id);
        
        if (!username) return;
        
        if (data.chatType === 'group') {
            // Broadcast to everyone except the sender
            socket.broadcast.emit("user_typing", {
                username,
                chatType: 'group'
            });
        } else if (data.chatType === 'private' && data.receiver) {
            // Send to specific user
            if (users[data.receiver] && users[data.receiver].active) {
                io.to(users[data.receiver].socketId).emit("user_typing", {
                    username,
                    chatType: 'private'
                });
            }
        } else if (data.chatType === 'room' && data.room) {
            // Broadcast to room except the sender
            socket.to(data.room).emit("user_typing", {
                username,
                chatType: 'room',
                room: data.room
            });
        }
    });
    
    // Request for active users
    socket.on("get_active_users", () => {
        socket.emit("active_users", getActiveUsers());
    });
    
    // Request for available rooms
    socket.on("get_rooms_list", () => {
        socket.emit("rooms_list", getRoomsList());
    });
    
    // Logout user
    socket.on("logout", () => {
        const username = socket.username || Object.keys(users).find(name => users[name].socketId === socket.id);
        
        if (username && users[username]) {
            // Leave room if in one
            if (users[username].room) {
                const roomName = users[username].room;
                
                if (rooms[roomName]) {
                    rooms[roomName].members = rooms[roomName].members.filter(member => member !== username);
                    
                    // Notify room members about the leave
                    io.to(roomName).emit("room_notification", {
                        message: `${username} left the room`,
                        room: roomName,
                        type: "leave"
                    });
                }
                
                users[username].room = null;
            }
            
            users[username].active = false;
            delete socket.username;
            
            io.emit("chat_notification", { message: `${username} logged out.`, type: "leave" });
            io.emit("active_users", getActiveUsers());
        }
    });

    // Handle user disconnect
    socket.on("disconnect", () => {
        const username = socket.username || Object.keys(users).find(name => users[name].socketId === socket.id);
        
        if (username && users[username]) {
            users[username].active = false;
            
            // Leave room if in one
            if (users[username].room) {
                const roomName = users[username].room;
                
                if (rooms[roomName]) {
                    rooms[roomName].members = rooms[roomName].members.filter(member => member !== username);
                    
                    // Notify room members about the leave
                    io.to(roomName).emit("room_notification", {
                        message: `${username} disconnected and left the room`,
                        room: roomName,
                        type: "leave"
                    });
                }
                
                users[username].room = null;
            }
            
            console.log(`User ${username} disconnected.`);
            io.emit("chat_notification", { message: `${username} went offline.`, type: "leave" });
            
            // Send updated active users list
            io.emit("active_users", getActiveUsers());
        }
    });
});

// Helper function to get active users
function getActiveUsers() {
    const activeUsers = [];
    for (const username in users) {
        if (users[username].active) {
            activeUsers.push(username);
        }
    }
    return activeUsers;
}

// Helper function to get rooms list
function getRoomsList() {
    const roomsList = [];
    for (const roomName in rooms) {
        roomsList.push({
            name: roomName,
            description: rooms[roomName].description,
            memberCount: rooms[roomName].members.length
        });
    }
    return roomsList;
}

// Create a default general room
rooms["general"] = {
    description: "General chat room for everyone",
    members: [],
    createdBy: "system",
    createdAt: new Date().toISOString()
};

// Initialize message history for general room
messages[`room:general`] = [];

httpServer.listen(5000, () => {
    console.log("Server running on port 5000...");
});