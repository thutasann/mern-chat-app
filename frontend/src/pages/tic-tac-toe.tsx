import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Socket } from 'socket.io-client';
import TicHeader from '../components/tic-tac/tic-header';
import TicScore from '../components/tic-tac/tic-score';
import { ChatState } from '../context/chat-provider';
import SlideDrawer from '../miscellaneous/Drawer';
import { useAppSelector } from '../store/hook';
import {
	MoveProps,
	TicGameDetails,
	TicTacSockets,
	WinPayloadProps,
} from '../types';
import { moves } from '../util/constants';
import {
	Alert,
	AlertIcon,
	AlertTitle,
	AlertDescription,
	useToast,
} from '@chakra-ui/react';

interface TicTacToePageProps {
	socket: Socket;
}

const loadingText: string = 'waiting for another player...';

const TicTacToePage: React.FC<TicTacToePageProps> = ({ socket }) => {
	const navigate = useNavigate();
	const toast = useToast();
	const { user: loggedInUser } = ChatState();
	const { user } = useAppSelector((state) => state.ticUser);
	const params = useParams<{ roomId?: string }>();

	const [roomId, setRoomId] = useState<string>('');
	const [loading, setLoading] = useState<boolean>(false);
	const [loadingValue, setLoadingValue] = useState<string>(loadingText);
	const [userJoined, setUserJoined] = useState<boolean>(false);
	const [userTurn, setUserTurn] = useState<boolean>(false);
	const [oponentName, setOponentName] = useState<string>('');
	const [move, setMove] = useState<MoveProps>({
		move: 0,
		myMove: false,
	});
	const [allMoves, setAllMoves] = useState<MoveProps[]>([]);
	const [winner, setWinner] = useState<string>('');
	const [winnerId, setWinnerId] = useState<string>('');
	const [winPattern, setWinPattern] = useState<any[]>([]);
	const [gameEnd, setGameEnd] = useState<boolean>(false);
	const [leaveRoom, setLeaveRoom] = useState<boolean>(false);
	const [myScore, setMyScroe] = useState<number>(0);
	const [oponentScore, setOponentScore] = useState<number>(0);

	// Setting RoomID
	useEffect(() => {
		setRoomId(params.roomId!);
	}, [params.roomId]);

	// remove Room
	useEffect(() => {
		window.onbeforeunload = function () {
			window.setTimeout(function () {
				window.location.href = '/';
				socket.emit<TicTacSockets>('removeRoom');
			}, 0);
			window.onbeforeunload = null;
		};

		window.history.pushState(null, document.title, window.location.href);
		window.addEventListener('popstate', function () {
			window.history.pushState(null, document.title, this.window.location.href);
		});
	});

	// User Entered
	useEffect(() => {
		if (!user) {
			window.location.href = '/games';
		}
		socket.emit<TicTacSockets>('usersEntered', {
			roomId: params.roomId,
			userId: user.userId,
		});

		socket
			.off<TicTacSockets>('usersEntered')
			.on<TicTacSockets>('usersEntered', (data: TicGameDetails) => {
				if (data.user1.userId !== user.userId) {
					setOponentName(data.user1.username);
				} else {
					setOponentName(data.user2.username);
				}
				setLoading(false);
			});
	}, [socket, user, params.roomId]);

	// Move / Win / Draw
	useEffect(() => {
		socket.on<TicTacSockets>('move', (payload: MoveProps) => {
			setMove({
				move: payload.move,
				myMove: payload.userId === user.userId,
			});
			setAllMoves([...allMoves, move]);

			moves[payload.move].move = 1;
			moves[payload.move].myMove = payload.userId === user.userId;

			if (payload.userId !== user.userId) {
				setUserTurn(false);
			}
		});

		socket.on<TicTacSockets>('win', (payload: WinPayloadProps) => {
			setWinPattern(payload.pattern);
			setGameEnd(true);
			if (payload.userId === user.userId) {
				setWinner('You Won!');
				setMyScroe(myScore + 1);
			} else {
				setWinner(`The winner is ${payload.username}`);
				setOponentScore(oponentScore + 1);
			}
			setWinnerId(payload.userId);
			setUserTurn(false);
		});

		socket.on<TicTacSockets>('draw', () => {
			setWinner('Draw!');
			setGameEnd(true);
			setUserTurn(false);
			setLoadingValue('');
		});
	});

	// Rematch / RemoveRoom
	useEffect(() => {
		socket.on<TicTacSockets>('reMatch', () => {
			moves.forEach((m) => {
				m.move = -1;
				m.myMove = false;
			});
			setWinner('');
			setUserTurn(user.userId !== winnerId);
			setGameEnd(false);
		});

		socket.on<TicTacSockets>('removeRoom', () => {
			setUserJoined(false);
			setLeaveRoom(true);
		});
	});

	// UserLeave
	useEffect(() => {
		socket.on<TicTacSockets>('userLeave', (payload: any) => {
			console.log('userLeave', payload);
			toast({
				title: `${oponentName} left the game`,
				status: 'warning',
				duration: 5000,
				isClosable: true,
				position: 'bottom',
			});
			setLoading(true);
			setUserJoined(false);
		});
	});

	function handleClose() {
		socket.emit<TicTacSockets>('removeRoom', { roomId });
		navigate('/games');
		return true;
	}

	function handleMoveClick(m: number) {
		if (loading && !userJoined) return;
		socket.emit<TicTacSockets>('move', {
			move: m,
			roomId,
			userId: user.userId,
		});

		moves[m].move = 1;
		moves[m].myMove = true;

		setUserTurn(true);
	}

	function handlePlayAgain() {
		socket.emit<TicTacSockets>('reMatch', { roomId });
	}

	return (
		<div>
			{loggedInUser && <SlideDrawer />}
			<div className="mainWrapper">
				<TicHeader roomId={roomId} />
				<TicScore
					myScore={myScore}
					oponentName={oponentName}
					oponentScore={oponentScore}
				/>

				{winner && winner !== 'Draw !' && winner.length > 0 ? (
					<div>
						<h3>{winner}</h3>
						<div className={`line p${winPattern}`}></div>
					</div>
				) : null}

				{userTurn ? (
					<Alert
						status="info"
						width={460}
						mt={7}
						rounded="md"
					>
						<AlertIcon />
						<AlertTitle>Waiting for oponent response!</AlertTitle>
					</Alert>
				) : null}

				{userTurn ? <div className="wait"></div> : null}

				<div className="grid-container">
					{/* Move 1 */}
					<div
						onClick={() => {
							moves[1].move === -1 && !winner && handleMoveClick(1);
						}}
						className={
							moves[1].move === -1
								? `grid-item-hover grid-item bottom right`
								: `grid-item bottom right`
						}
					>
						{moves[1].move !== -1 ? (moves[1].myMove ? '0' : 'X') : null}
					</div>

					{/* Move 2 */}
					<div
						onClick={() => {
							moves[2].move === -1 && !winner && handleMoveClick(2);
						}}
						className={
							moves[2].move === -1
								? `grid-item-hover grid-item bottom right`
								: 'grid-item bottom right'
						}
					>
						{moves[2].move !== -1 ? (moves[2].myMove ? '0' : 'X') : null}
					</div>

					{/* Move 3 */}
					<div
						onClick={() => {
							moves[3].move === -1 && !winner && handleMoveClick(3);
						}}
						className={
							moves[3].move === -1
								? `grid-item-hover grid-item bottom`
								: ` grid-item bottom`
						}
					>
						{moves[3].move !== -1 ? (moves[3].myMove ? '0' : 'X') : null}
					</div>

					{/* Move 4 */}
					<div
						onClick={() => {
							moves[4].move === -1 && !winner && handleMoveClick(4);
						}}
						className={
							moves[4].move === -1
								? `grid-item-hover grid-item bottom right`
								: `grid-item bottom right`
						}
					>
						{moves[4].move !== -1 ? (moves[4].myMove ? '0' : 'X') : null}
					</div>

					{/* Move 5 */}
					<div
						onClick={() => {
							moves[5].move === -1 && !winner && handleMoveClick(5);
						}}
						className={
							moves[5].move === -1
								? `grid-item-hover grid-item bottom right`
								: `grid-item bottom right`
						}
					>
						{moves[5].move === -1 ? (moves[5].myMove ? '0' : 'X') : null}
					</div>

					{/* Move 6 */}
					<div
						onClick={() => {
							moves[6].move === -1 && !winner && handleMoveClick(6);
						}}
						className={
							moves[6].move === -1
								? `grid-item-hover grid-item bottom`
								: `grid-item bottom`
						}
					>
						{moves[6].move !== -1 ? (moves[6].myMove ? '0' : 'X6') : null}
					</div>

					{/* Move 7 */}
					<div
						onClick={() => {
							moves[7].move === -1 && !winner && handleMoveClick(7);
						}}
						className={
							moves[7].move === -1
								? `grid-item-hover grid-item right`
								: `grid-item right`
						}
					>
						{moves[7].move !== -1 ? (moves[7].myMove ? '0' : 'X') : null}
					</div>

					{/* Move 8 */}
					<div
						onClick={() => {
							moves[8].move === -1 && !winner && handleMoveClick(8);
						}}
						className={
							moves[8].move === -1
								? `grid-item-hover grid-item right`
								: `grid-item right`
						}
					>
						{moves[8].move !== -1 ? (moves[8].myMove ? '0' : 'X') : null}
					</div>

					{/* Move 9 */}
					<div
						onClick={() => {
							moves[9].move === -1 && !winner && handleMoveClick(8);
						}}
						className={
							moves[9].move === -1 ? `grid-item-hover grid-item` : `grid-item`
						}
					>
						{moves[9].move !== -1 ? (moves[9].myMove ? '0' : 'X') : null}
					</div>
				</div>

				<div className="flex items-center gap-3 mt-7">
					<form onSubmit={handleClose}>
						<button className="closeBtn">Close</button>
					</form>
					{!leaveRoom ? (
						<button
							onClick={handlePlayAgain}
							className="playAgain"
						>
							Play Again
						</button>
					) : null}
				</div>
			</div>
		</div>
	);
};

export default TicTacToePage;
