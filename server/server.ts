import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import userRoutes from './routes/user-routes';
import chatRoutes from './routes/chat-routes';
import messageRoutes from './routes/message-routes';
import { ErrorHandler, NotFound } from './middlewares/error-middleware';
import cors from 'cors';
import { Server } from 'socket.io';
import {
	ChatProps,
	MessageProps,
	SocketEmitNames,
	SocketNames,
	UserProps,
} from './types';
import { RoomTypes } from './types/canvas';
import { addUser, getUser, removeUser } from './utils/user';

dotenv.config();
connectDB();
const app = express();
app.use(express.json());

app.use(
	cors({
		origin: [
			'http://localhost:3000',
			'http://localhost:3001',
			'https://mern-t-chat.vercel.app',
		],
	}),
);

// Routes
app.use('/api/user', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/message', messageRoutes);
app.use(NotFound);
app.use(ErrorHandler);

// Server Listen
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
	console.log(`Server is Running on PORT : ${PORT} 🚀`);
});

// Socket IO
const io: Server = new Server(server, {
	pingTimeout: 60000,
	cors: {
		origin: [
			'http://localhost:3000',
			'http://localhost:3001',
			'https://mern-t-chat.vercel.app',
		],
	},
});

/**
 * SOCKET CONNECTIONS
 */

let roomIdGlobal, imageURLGlobal;

io.on('connection', (socket) => {
	// setup
	socket.on<SocketNames>('setup', (userData: UserProps) => {
		socket.join(userData._id);
		socket.emit<SocketEmitNames>('connected');
	});

	// join chat
	socket.on<SocketNames>('joinChat', (room: ChatProps) => {
		socket.join(room._id);
		console.log('User Joined Room: ' + room);
	});

	// typing
	socket.on<SocketNames>('typing', (room: ChatProps) => {
		socket.in(room._id).emit<SocketNames>('typing');
	});

	// stopTyping
	socket.on<SocketNames>('stopTyping', (room: ChatProps) => {
		socket.in(room._id).emit<SocketNames>('stopTyping');
	});

	// new Message
	socket.on<SocketNames>('newMessage', (newMessageReceived: MessageProps) => {
		var chat = newMessageReceived.chat;
		if (!chat?.users) return console.log('chat.users not defined');

		chat.users.forEach((user) => {
			if (user._id === newMessageReceived.sender._id) return;
			socket
				.in(user._id)
				.emit<SocketEmitNames>('messageReceived', newMessageReceived);
		});
	});

	// socket Off
	socket.off('setup', (userData: UserProps) => {
		socket.leave(userData._id);
	});

	// userJoined (Canvas)
	socket.on<SocketNames>('userJoined', (data: RoomTypes) => {
		const { name, userId, roomId, host, presenter } = data;
		roomIdGlobal = roomId;
		socket.join(roomId);

		const users = addUser({
			name,
			userId,
			roomId,
			host,
			presenter,
			socketId: socket.id,
		});

		// User Is Joined
		socket.emit<SocketEmitNames>('userIsJoined', { success: true, users });

		// user Joined message
		socket.broadcast
			.to(roomId)
			.emit<SocketEmitNames>('userJoinedMessageBoradcasted', name);

		// all joiners
		socket.broadcast.to(roomId).emit<SocketEmitNames>('allUsers', users);
	});

	// Draw (Canvas)
	socket.on<SocketNames>('draw', (data: any) => {
		socket.broadcast.emit<SocketEmitNames>('isDraw', data);
	});

	// Disconnect
	socket.on<SocketNames>('disconnect', () => {
		const user = getUser(socket.id);
		if (user) {
			const removedUser = removeUser(socket.id);
			socket.broadcast
				.to(roomIdGlobal)
				.emit<SocketEmitNames>('userLeftMessageBroadcasted', user.name);
		}
	});
});
