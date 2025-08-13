'use client';

import React, { useState, useEffect } from 'react';
import herobg from "@/public/heroBg.png";
import Image from 'next/image';
import { Dices, KeyRound } from 'lucide-react';
import { IoIosAddCircle } from 'react-icons/io';
import { TypeAnimation } from 'react-type-animation';
import { useRouter } from 'next/navigation';
import { isWasmSupported, getWasmCapabilities } from '@/utils/wasm-loader';
import { useAccount, useConnect, useDisconnect } from '@starknet-react/core';
import { usePlayerActions } from '@/hooks/usePlayerActions';
import { useGameActions } from '@/hooks/useGameActions';
import { useMovementActions } from '@/hooks/useMovementActions';
import { usePropertyActions } from '@/hooks/usePropertyActions';
import { useTradeActions } from '@/hooks/useTradeActions';
import { shortString, BigNumberish } from 'starknet';
import GameRoomLoading from '@/components/game/game-room-loading';

// TypeScript interfaces (unchanged)
interface RegisterResponse {
  transaction_hash: string;
}

interface CreateGameResponse {
  transaction_hash: string;
}

interface Token {
  name: string;
  emoji: string;
  value: number;
}

interface Game {
  id: number;
  creator: `0x${string}` | undefined;
  players: { address: `0x${string}` | undefined; tokenValue: number }[];
  maxPlayers: number;
  availableTokens: Token[];
  status: { variant: { Pending?: {}; Ongoing?: {} } };
  is_initialised: boolean;
  players_joined: string;
  number_of_players: string;
  dice_face: string;
  hat: string;
  car: string;
  dog: string;
  thimble: string;
  iron: string;
  battleship: string;
  boot: string;
  wheelbarrow: string;
  player_hat: bigint;
  player_car: bigint;
  player_dog: bigint;
  player_thimble: bigint;
  player_iron: bigint;
  player_battleship: bigint;
  player_boot: bigint;
  player_wheelbarrow: bigint;
}

const tokens: Token[] = [
  { name: 'Hat', emoji: '🎩', value: 0 },
  { name: 'Car', emoji: '🚗', value: 1 },
  { name: 'Dog', emoji: '🐕', value: 2 },
  { name: 'Thimble', emoji: '🧵', value: 3 },
  { name: 'Iron', emoji: '🧼', value: 4 },
  { name: 'Battleship', emoji: '🚢', value: 5 },
  { name: 'Boot', emoji: '👞', value: 6 },
  { name: 'Wheelbarrow', emoji: '🛒', value: 7 },
];

const HeroSection = () => {
  const { account, address, connector } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const player = usePlayerActions();
  const game = useGameActions();
  const move = useMovementActions();
  const property = usePropertyActions();
  const trade = useTradeActions();

  const [fields, setFields] = useState({
    username: '',
    addressp: '',
    gameType: '',
    playerSymbol: '',
    numPlayers: '',
    gameId: '',
    amount: '',
    diceRoll: '',
    propertyId: '',
    card: '',
  });

  const [response, setResponse] = useState<RegisterResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [username, setUsername] = useState('');
  const [registrationPending, setRegistrationPending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [gameToken, setGameToken] = useState('');
  const [numPrivatePlayers, setNumPrivatePlayers] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPrivateGameModal, setShowPrivateGameModal] = useState(false);
  const [gameType, setGameType] = useState('');
  const [selectedToken, setSelectedToken] = useState('');
  const [numberOfPlayers, setNumberOfPlayers] = useState('');
  const [isCreatingGame, setIsCreatingGame] = useState(false);

  const router = useRouter();
  const [gamerName, setGamerName] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGamerName(e.target.value);
  };

  const handleTokenChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setGameToken(e.target.value);
  };

  const handleNumPrivatePlayersChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setNumPrivatePlayers(e.target.value);
  };

  const handleRouteToJoinRoom = () => {
    console.log('[handleRouteToJoinRoom] Navigating to /join-room');
    router.push('/join-room');
  };

  const checkRegistration = async () => {
    try {
      console.log('[checkRegistration] Checking registration for address:', address);
      const registered = await player.isRegistered(address!);
      setIsRegistered(registered);
      if (registered) {
        const user = await player.getUsernameFromAddress(address!);
        const decodedUsername = shortString.decodeShortString(user);
        setUsername(decodedUsername || 'Unknown');
        console.log('[checkRegistration] Username:', decodedUsername);
      } else {
        setUsername('');
      }
    } catch (err: any) {
      console.error('[checkRegistration] Error:', err);
      setError(err?.message || 'Failed to check registration status');
    }
  };

  const handleRequest = async (fn: () => Promise<RegisterResponse>, label: string) => {
    setLoading(true);
    setError(null);
    setResponse(null);
    setRegistrationPending(true);
    try {
      console.log(`[handleRequest] Executing ${label}`);
      const res = await fn();
      console.log(`[handleRequest] ${label} response:`, res);
      setResponse(res);

      await new Promise((resolve) => setTimeout(resolve, 5000));

      if (address && label === 'register') {
        await checkRegistration();
      }

      setRegistrationPending(false);
      setSuccess('Registration successful!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error(`[handleRequest] ${label} error:`, err);
      setError(err?.message || 'Failed to register. Please try again.');
      setRegistrationPending(false);
    } finally {
      setLoading(false);
    }
  };

  const waitForLastGameUpdate = async (
    expectedGameId: number,
    maxWait: number = 60000 // Reduced to 60s for faster feedback
  ) => {
    const startTime = Date.now();
    const delay = 2000;
    const maxAttempts = 30; // 60s / 2s per attempt
    let attempts = 0;

    while (attempts < maxAttempts && Date.now() - startTime < maxWait) {
      try {
        const lastGame = Number(await game.lastGame());
        console.log(
          `[waitForLastGameUpdate] Polled lastGame: ${lastGame}, Expected: ${expectedGameId}, Attempt: ${attempts + 1}`
        );
        if (lastGame >= expectedGameId && lastGame > 0) {
          return lastGame;
        }
      } catch (err: any) {
        console.warn(`[waitForLastGameUpdate] Error polling lastGame (Attempt ${attempts + 1}):`, err.message);
      }
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    console.warn(`[waitForLastGameUpdate] lastGame did not update. Last: ${await game.lastGame()}, Expected: ${expectedGameId}`);
    return null; // Trigger fallback
  };

  const waitForGameStatus = async (gid: number, maxAttempts: number = 5, delay: number = 2000) => {
    let attempts = 0;
    while (attempts < maxAttempts) {
      try {
        const gameData = await game.getGame(gid) as Game;
        console.log(`[waitForGameStatus] Game ${gid} data:`, gameData);
        if (!gameData) {
          throw new Error('Game data not found.');
        }
        if (gameData.is_initialised) {
          console.log(`[waitForGameStatus] Game ${gid} is initialized, status:`, gameData.status);
          return gameData;
        }
        console.log(`[waitForGameStatus] Game ${gid} not yet initialized, attempt ${attempts + 1}`);
      } catch (err: any) {
        console.warn(`[waitForGameStatus] Error checking game status, attempt ${attempts + 1}:`, err.message);
      }
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    throw new Error('Game data not available or not initialized after multiple attempts.');
  };

  const handleCreateGame = async () => {
    if (!account || !address) {
      setError('Please connect your wallet');
      console.log('[handleCreateGame] No wallet connected');
      return;
    }
    if (!isRegistered) {
      setError('Please register before creating a game');
      console.log('[handleCreateGame] User not registered');
      return;
    }
    if (!gameType || !selectedToken || !numberOfPlayers) {
      setError('Please select all fields');
      console.log('[handleCreateGame] Missing fields:', { gameType, selectedToken, numberOfPlayers });
      return;
    }

    const gameTypeNum = Number(gameType);
    const numPlayers = Number(numberOfPlayers);
    if (gameType !== '0' && gameType !== '1') {
      setError('Game type must be Public (0) or Private (1)');
      console.log('[handleCreateGame] Invalid game type:', gameType);
      return;
    }
    if (isNaN(numPlayers) || numPlayers < 2 || numPlayers > 8) {
      setError('Number of players must be between 2 and 8');
      console.log('[handleCreateGame] Invalid number of players:', numPlayers);
      return;
    }

    const tokenValue = tokens.find((t) => t.name === selectedToken)?.value;
    if (tokenValue === undefined) {
      setError('Invalid token selected');
      console.log('[handleCreateGame] Invalid token:', selectedToken);
      return;
    }

    setIsCreatingGame(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('[handleCreateGame] Starting game creation');
      const initialLastGame = Number(await game.lastGame()) || 0;
      console.log(`[handleCreateGame] Initial lastGame: ${initialLastGame}`);

      console.log(`[handleCreateGame] Creating game with type: ${gameTypeNum}, token: ${tokenValue}, players: ${numPlayers}, wallet: ${connector?.name || 'unknown'}`);
      const tx = await game.createGame(account, gameTypeNum, tokenValue, numPlayers);
      console.log('[handleCreateGame] Create game transaction:', tx);

      if (!tx?.transaction_hash) {
        throw new Error('No transaction hash returned from createGame');
      }

      const newGameId = initialLastGame + 1;
      console.log(`[handleCreateGame] Assumed new game ID: ${newGameId}`);

      const currentLastGame = await waitForLastGameUpdate(newGameId);
      console.log(`[handleCreateGame] Current lastGame: ${currentLastGame}`);

      if (currentLastGame === null) {
        throw new Error('Game creation not confirmed by lastGame update');
      }

      const gameData = await waitForGameStatus(newGameId);
      console.log('[handleCreateGame] Game data confirmed:', gameData);

      const updatedGames = [...new Set([...JSON.parse(localStorage.getItem('ongoingGames') || '[]'), newGameId])];
      localStorage.setItem('ongoingGames', JSON.stringify(updatedGames));
      setShowModal(false);
      console.log(`[handleCreateGame] Initiating redirect to /game-waiting?gameId=${newGameId}&creator=${address}`);
      setTimeout(() => {
        router.push(`/game-waiting?gameId=${newGameId}&creator=${address}`);
        console.log('[handleCreateGame] Redirect executed');
      }, 2000); // 2-second delay for loading screen
    } catch (err: any) {
      console.error('[handleCreateGame] Error:', err.message);
      setError(err?.message || 'Failed to create game. Please try again.');
    } finally {
      setIsCreatingGame(false);
      console.log('[handleCreateGame] Loading state cleared');
    }
  };

  const handleCreatePrivateGame = async () => {
    if (!account || !gameToken || !numPrivatePlayers) {
      setError('Please connect your wallet, select a token, and select number of players.');
      console.log('[handleCreatePrivateGame] Missing fields:', { gameToken, numPrivatePlayers });
      return;
    }
    const numPlayers = Number(numPrivatePlayers);
    if (isNaN(numPlayers) || numPlayers < 2 || numPlayers > 8) {
      setError('Number of players must be between 2 and 8');
      console.log('[handleCreatePrivateGame] Invalid number of players:', numPlayers);
      return;
    }
    const tokenValue = tokens.find((t) => t.name === gameToken)?.value;
    if (tokenValue === undefined) {
      setError('Invalid token selected');
      console.log('[handleCreatePrivateGame] Invalid token:', gameToken);
      return;
    }
    setIsCreatingGame(true);
    setError(null);
    setSuccess(null);
    try {
      console.log('[handleCreatePrivateGame] Starting private game creation');
      const initialLastGame = Number(await game.lastGame()) || 0;
      console.log(`[handleCreatePrivateGame] Initial lastGame: ${initialLastGame}`);
      const tx = await game.createGame(account, 1, tokenValue, numPlayers);
      console.log('[handleCreatePrivateGame] Create game transaction:', tx);

      if (!tx?.transaction_hash) {
        throw new Error('No transaction hash returned from createGame');
      }

      const newGameId = initialLastGame + 1;
      console.log(`[handleCreatePrivateGame] Assumed new game ID: ${newGameId}`);

      const currentLastGame = await waitForLastGameUpdate(newGameId);
      console.log(`[handleCreatePrivateGame] Current lastGame: ${currentLastGame}`);

      if (currentLastGame === null) {
        throw new Error('Game creation not confirmed by lastGame update');
      }

      const gameData = await waitForGameStatus(newGameId);
      console.log('[handleCreatePrivateGame] Game data confirmed:', gameData);

      const updatedGames = [...new Set([...JSON.parse(localStorage.getItem('ongoingGames') || '[]'), newGameId])];
      localStorage.setItem('ongoingGames', JSON.stringify(updatedGames));
      setSuccess('Private game created successfully!');
      setGameToken('');
      setNumPrivatePlayers('');
      setShowPrivateGameModal(false);
      console.log(`[handleCreatePrivateGame] Initiating redirect to /game-waiting?gameId=${newGameId}&creator=${address}`);
      setTimeout(() => {
        router.push(`/game-waiting?gameId=${newGameId}&creator=${address}`);
        console.log('[handleCreatePrivateGame] Redirect executed');
      }, 2000); // 2-second delay for loading screen
    } catch (err: any) {
      console.error('[handleCreatePrivateGame] Error:', err.message);
      setError(err?.message || 'Failed to create private game. Please try again.');
    } finally {
      setIsCreatingGame(false);
      console.log('[handleCreatePrivateGame] Loading state cleared');
    }
  };

  useEffect(() => {
    console.log('[useEffect] Address changed:', address);
    if (isWasmSupported()) {
      getWasmCapabilities();
    }
    if (address) {
      checkRegistration();
    }
  }, [address, player]);

  useEffect(() => {
    console.log('[useEffect] isCreatingGame:', isCreatingGame);
  }, [isCreatingGame]);

  if (isCreatingGame) {
    console.log('[Render] Showing GameRoomLoading');
    return <GameRoomLoading action="create" />;
  }

  return (
    <section className="w-full lg:h-screen md:h-[calc(100vh-87px)] h-screen relative overflow-x-hidden md:mb-20 mb-10">
      {/* herobg */}
      <div className="w-full h-full overflow-hidden">
        <Image
          src={herobg}
          alt="Hero Background"
          className="w-full h-full object-cover hero-bg-zoom"
          width={1440}
          height={1024}
          priority
          quality={100}
        />
      </div>

      {/* Blockopoly */}
      <div className="w-full h-auto absolute top-0 left-0 flex items-center justify-center">
        <h1 className="text-center uppercase font-kronaOne font-normal text-transparent big-hero-text w-full text-[40px] sm:text-[40px] md:text-[80px] lg:text-[135px] relative before:absolute before:content-[''] before:w-full before:h-full before:bg-gradient-to-b before:from-transparent lg:before:via-[#010F10]/80 before:to-[#010F10] before:top-0 before:left-0 before:z-10">
          BLOCKOPOLY
        </h1>
      </div>

      {/* overlay */}
      <main className="w-full h-full absolute top-0 left-0 z-20 bg-transparent flex flex-col lg:justify-center items-center gap-1">
        {isRegistered && !registrationPending && !success && (
          <div className="mt-20 md:mt-28 lg:mt-0">
            <p className="font-orbitron lg:text-[24px] md:text-[20px] text-[16px] font-[700] text-[#00F0FF] text-center">
              Welcome back, {username}!
            </p>
          </div>
        )}
        {registrationPending && (
          <div className="mt-20 md:mt-28 lg:mt-0">
            <p className="font-orbitron lg:text-[24px] md:text-[20px] text-[16px] font-[700] text-[#00F0FF] text-center">
              Registering... Please wait.
            </p>
          </div>
        )}
        {success && (
          <div className="mt-20 md:mt-28 lg:mt-0">
            <p className="font-orbitron lg:text-[24px] md:text-[20px] text-[16px] font-[700] text-[#00F0FF] text-center">
              {success}
            </p>
          </div>
        )}

        <div className="flex justify-center items-center md:gap-6 gap-3 mt-4 md:mt-6 lg:mt-4">
          <TypeAnimation
            sequence={[
              'Conquer',
              1200,
              'Conquer • Build',
              1200,
              'Conquer • Build • Trade On',
              1800,
              'Conquer • Build',
              1000,
              'Conquer',
              1000,
              '',
              500,
            ]}
            wrapper="span"
            speed={40}
            repeat={Infinity}
            className="font-orbitron lg:text-[40px] md:text-[30px] text-[20px] font-[700] text-[#F0F7F7] text-center block"
          />
        </div>

        <h1 className="block-text font-[900] font-orbitron lg:text-[116px] md:text-[98px] text-[54px] lg:leading-[120px] md:leading-[100px] leading-[60px] tracking-[-0.02em] uppercase text-[#17ffff] relative">
          THE BLOCK
          <span className="absolute top-0 left-[69%] text-[#0FF0FC] font-dmSans font-[700] md:text-[27px] text-[18px] rotate-12 animate-pulse">?</span>
        </h1>

        <p className="w-full px-4 md:w-[70%] lg:w-[55%] text-center font-[400] md:text-[18px] text-[14px] font-dmSans text-[#F0F7F7] -tracking-[2%]">
          Step into Blockopoly — the Web3 twist on the classic game of strategy, ownership, and fortune. Collect tokens, complete quests, and become the ultimate blockchain tycoon.
        </p>

        <div className="w-full flex flex-col justify-center items-center mt-3 gap-3">
          {!isRegistered && !registrationPending && (
            <>
              <input
                type="text"
                name="name"
                id="name"
                value={gamerName}
                onChange={handleInputChange}
                required
                placeholder="input your name"
                className="w-[80%] md:w-[260px] h-[45px] bg-[#0E1415] rounded-[12px] border-[1px] border-[#003B3E] outline-none px-3 text-[#17ffff] font-orbitron font-[400] text-[16px] text-center placeholder:text-[#455A64] placeholder:font-dmSans placeholder:text-[16px]"
              />
              <button
                type="button"
                className="relative group w-[260px] h-[52px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
                disabled={loading || !gamerName || !account}
              >
                <svg
                  width="260"
                  height="52"
                  viewBox="0 0 260 52"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]"
                >
                  <path
                    d="M10 1H250C254.373 1 256.996 6.85486 254.601 10.5127L236.167 49.5127C235.151 51.0646 233.42 52 231.565 52H10C6.96244 52 4.5 49.5376 4.5 46.5V9.5C4.5 6.46243 6.96243 4 10 4Z"
                    fill="#00F0FF"
                    stroke="#0E282A"
                    strokeWidth={1}
                  />
                </svg>
                <span
                  className="absolute inset-0 flex items-center justify-center text-[#010F10] text-[18px] -tracking-[2%] font-orbitron font-[700] z-10"
                  onClick={() =>
                    account &&
                    handleRequest(() => player.register(account, gamerName), 'register')
                  }
                >
                  Let&apos;s Go!
                </span>
              </button>
            </>
          )}
          {error && (
            <p className="text-red-400 text-sm text-center mt-2">{error}</p>
          )}
          {!registrationPending && !isRegistered && success && (
            <p className="text-green-400 text-sm text-center mt-2">{success}</p>
          )}

          {/* join/create room */}
          <div className="flex justify-center items-center mt-2 gap-4">
            {address && isRegistered && (
              <>
                {/* Create Game Button */}
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="relative group w-[227px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
                  disabled={loading}
                >
                  <svg
                    width="227"
                    height="40"
                    viewBox="0 0 227 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute top-0 left-0 w-full h-full transform scale-x-[-1] scale-y-[-1]"
                  >
                    <path
                      d="M6 1H221C225.373 1 227.996 5.85486 225.601 9.5127L207.167 37.5127C206.151 39.0646 204.42 40 202.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                      fill="#003B3E"
                      stroke="#003B3E"
                      strokeWidth={1}
                      className="group-hover:stroke-[#00F0FF] transition-all duration-300 ease-in-out"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[#00F0FF] capitalize text-[12px] font-dmSans font-medium z-10">
                    <IoIosAddCircle className="mr-1.5 w-[16px] h-[16px]" />
                    Create Game
                  </span>
                </button>

                {/* Join Room Button */}
                <button
                  type="button"
                  onClick={handleRouteToJoinRoom}
                  className="relative left-2 group w-[140px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
                >
                  <svg
                    width="140"
                    height="40"
                    viewBox="0 0 140 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute top-0 left-0 w-full h-full"
                  >
                    <path
                      d="M6 1H134C138.373 1 140.996 5.85486 138.601 9.5127L120.167 37.5127C119.151 39.0646 117.42 40 115.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                      fill="#0E1415"
                      stroke="#003B3E"
                      strokeWidth={1}
                      className="group-hover:stroke-[#00F0FF] transition-all duration-300 ease-in-out"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[#0FF0FC] capitalize text-[12px] font-dmSans font-medium z-10">
                    <Dices className="mr-1.5 w-[16px] h-[16px]" />
                    Join Room
                  </span>
                </button>

                {/* Create A Private Game Button */}
                <button
                  type="button"
                  onClick={() => setShowPrivateGameModal(true)}
                  className="relative group w-[227px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
                  disabled={loading}
                >
                  <svg
                    width="227"
                    height="40"
                    viewBox="0 0 227 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute top-0 left-0 w-full h-full transform scale-x-[-1] scale-y-[-1]"
                  >
                    <path
                      d="M6 1H221C225.373 1 227.996 5.85486 225.601 9.5127L207.167 37.5127C206.151 39.0646 204.42 40 202.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                      fill="#003B3E"
                      stroke="#003B3E"
                      strokeWidth={1}
                      className="group-hover:stroke-[#00F0FF] transition-all duration-300 ease-in-out"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[#00F0FF] capitalize text-[12px] font-dmSans font-medium z-10">
                    <KeyRound className="mr-1.5 w-[16px] h-[16px]" />
                    Create A Private Game
                  </span>
                </button>
              </>
            )}
          </div>

          {/* Create Game Modal */}
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-settings bg-cover bg-fixed bg-center bg-opacity-70">
              <div className="bg-[#010F10] border border-[#00F0FF] rounded-xl p-6 w-full max-w-sm text-white relative z-10">
                <h2 className="text-xl font-bold mb-4 text-center font-orbitron text-[#00F0FF]">
                  Create New Game
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm mb-1 font-dmSans text-[#F0F7F7]">Game Type</label>
                    <select
                      value={gameType}
                      onChange={(e) => setGameType(e.target.value)}
                      className="w-full h-[52px] px-4 text-[#73838B] border border-[#0E282A] rounded-[12px] outline-none focus:border-[#00F0FF] bg-transparent"
                      disabled={loading}
                    >
                      <option value="" disabled>Select game type</option>
                      <option value="0">Public</option>
                      <option value="1">Private</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1 font-dmSans text-[#F0F7F7]">Select Token</label>
                    <select
                      value={selectedToken}
                      onChange={(e) => setSelectedToken(e.target.value)}
                      className="w-full h-[52px] px-4 text-[#73838B] border border-[#0E282A] rounded-[12px] outline-none focus:border-[#00F0FF] bg-transparent"
                      disabled={loading}
                    >
                      <option value="" disabled>Select a token</option>
                      {tokens.map((token) => (
                        <option key={token.name} value={token.name}>
                          {token.emoji} {token.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1 font-dmSans text-[#F0F7F7]">Number of Players</label>
                    <select
                      value={numberOfPlayers}
                      onChange={(e) => setNumberOfPlayers(e.target.value)}
                      className="w-full h-[52px] px-4 text-[#73838B] border border-[#0E282A] rounded-[12px] outline-none focus:border-[#00F0FF] bg-transparent"
                      disabled={loading}
                    >
                      <option value="" disabled>Select number of players</option>
                      {[2, 3, 4, 5, 6, 7, 8].map((num) => (
                        <option key={num} value={num}>
                          {num}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleCreateGame}
                    className="w-full bg-[#00F0FF] text-[#010F10] py-2 rounded font-bold"
                    disabled={loading}
                  >
                    Create Game
                  </button>
                  <button
                    onClick={() => setShowModal(false)}
                    className="w-full text-sm mt-2 text-center underline text-[#869298]"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Private Game Modal */}
          {showPrivateGameModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-settings bg-cover bg-fixed bg-center bg-opacity-70">
              <div className="bg-[#010F10] border border-[#00F0FF] rounded-xl p-6 w-full max-w-sm text-white relative z-10">
                <h2 className="text-xl font-bold mb-4 text-center font-orbitron text-[#00F0FF]">
                  Create Private Game
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm mb-1 font-dmSans text-[#F0F7F7]">Select Token</label>
                    <select
                      value={gameToken}
                      onChange={handleTokenChange}
                      className="w-full h-[52px] px-4 text-[#73838B] border border-[#0E282A] rounded-[12px] outline-none focus:border-[#00F0FF] bg-transparent"
                      disabled={loading}
                    >
                      <option value="" disabled>Select a token</option>
                      {tokens.map((token) => (
                        <option key={token.name} value={token.name}>
                          {token.emoji} {token.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm mb-1 font-dmSans text-[#F0F7F7]">Number of Players</label>
                    <select
                      value={numPrivatePlayers}
                      onChange={handleNumPrivatePlayersChange}
                      className="w-full h-[52px] px-4 text-[#73838B] border border-[#0E282A] rounded-[12px] outline-none focus:border-[#00F0FF] bg-transparent"
                      disabled={loading}
                    >
                      <option value="" disabled>Select number of players</option>
                      {[2, 3, 4, 5, 6, 7, 8].map((num) => (
                        <option key={num} value={num}>
                          {num}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleCreatePrivateGame}
                    className="w-full bg-[#00F0FF] text-[#010F10] py-2 rounded font-bold"
                    disabled={loading}
                  >
                    Create Private Game
                  </button>
                  <button
                    onClick={() => {
                      setShowPrivateGameModal(false);
                      setGameToken('');
                      setNumPrivatePlayers('');
                    }}
                    className="w-full text-sm mt-2 text-center underline text-[#869298]"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </section>
  );
};

export default HeroSection;