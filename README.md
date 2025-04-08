# RealTimeChat

A real-time chat application that enables users to connect and communicate instantly with friends, colleagues, and communities.

## Overview

RealTimeChat is a lightweight, browser-based chat application built with Node.js, Express, and Socket.io. It allows users to join chat rooms, send public messages in global chat, and communicate privately with other users in real-time.

## Features

- **User Authentication**: Simple username-based login system
- **Global Chat Room**: Public chat space for all connected users
- **Private Messaging**: One-on-one conversations between users
- **Active User List**: Shows all currently connected users
- **Real-time Updates**: Instant message delivery and user status updates
- **Responsive Design**: Works on both desktop and mobile devices

## Technical Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js, Express
- **Real-time Communication**: Socket.io
- **Development Tools**: Nodemon

## Project Structure

```
realtimechat/
├── .gitignore           # Git ignore file
├── README.md            # Project documentation
├── package.json         # Project dependencies
├── package-lock.json    # Dependency lock file
├── server.js            # Main server file with Socket.io setup
├── app.js               # Client-side Socket.io implementation
├── index.html           # Main entry page with login form
├── favicon.png          # Website favicon
```

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/realtimechat.git
   ```

2. Navigate to the project directory:
   ```
   cd realtimechat
   ```

3. Install dependencies:
   ```
   npm install
   ```

4. Start the development server:
   ```
   npm start
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Usage

1. Enter a username on the login page
2. Join the global chat room automatically
3. View active users in the sidebar
4. Click on a user's name to start a private conversation
5. Type messages in the input field and press Enter or click the send button

## Deployment

The application is currently deployed on Vercel at:
[https://real-time-chat-anyone.vercel.app/](https://real-time-chat-anyone.vercel.app/)

## Development

To contribute to this project:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Acknowledgments

- Socket.io for the powerful real-time engine
- Express.js for the web server framework
- Node.js community for incredible tools and support
