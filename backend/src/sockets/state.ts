import { Server } from 'socket.io';
import { prisma } from '../prisma';
import { SocketEvents, Player } from 'shared';

interface AuctionState {
  auctionId: string;
  currentPlayer: Player | null;
  currentBid: number;
  highestBiddingTeamId: string | null;
  highestBiddingTeamName: string | null;
  timer: number;
  status: 'IDLE' | 'ACTIVE' | 'PAUSED' | 'EDITING' | 'COMPLETED';
  bidHistory: { teamId: string; teamName: string; amount: number }[];
  intervalId?: NodeJS.Timeout;
}

const states: Record<string, AuctionState> = {};

export const getAuctionState = (auctionId: string): AuctionState => {
  if (!states[auctionId]) {
    states[auctionId] = {
      auctionId,
      currentPlayer: null,
      currentBid: 0,
      highestBiddingTeamId: null,
      highestBiddingTeamName: null,
      timer: 0,
      status: 'IDLE',
      bidHistory: [],
    };
  }
  return states[auctionId];
};

export const getCleanState = (auctionId: string) => {
  const { intervalId, ...cleanState } = getAuctionState(auctionId);
  return cleanState;
};

export const startTimer = (io: Server, auctionId: string) => {
  const state = getAuctionState(auctionId);
  if (state.intervalId) clearInterval(state.intervalId);
  state.status = 'ACTIVE';
  state.timer = 0;
  
  // Count-up timer (just for display, no auto-sell)
  state.intervalId = setInterval(() => {
    if (state.status === 'PAUSED') return;
    state.timer += 1;
    io.to(auctionId).emit(SocketEvents.TIMER_UPDATE, state.timer);
  }, 1000);
};

export const pauseTimer = (auctionId: string) => {
  const state = getAuctionState(auctionId);
  state.status = 'PAUSED';
};

export const stopTimer = (auctionId: string) => {
  const state = getAuctionState(auctionId);
  if (state.intervalId) clearInterval(state.intervalId);
};

export const sellPlayer = async (io: Server, auctionId: string) => {
  const state = getAuctionState(auctionId);
  stopTimer(auctionId);
  state.status = 'IDLE';

  let soldInfo: any = null;

  if (state.currentPlayer && state.highestBiddingTeamId && state.currentBid > 0) {
    // 1. Mark player as SOLD
    await prisma.player.update({
      where: { id: state.currentPlayer.id },
      data: {
        status: 'SOLD',
        soldPrice: state.currentBid,
        teamId: state.highestBiddingTeamId,
      }
    });

    // 2. Deduct from team purse
    await prisma.team.update({
      where: { id: state.highestBiddingTeamId },
      data: {
        remainingPurse: { decrement: state.currentBid }
      }
    });

    soldInfo = {
      playerName: state.currentPlayer.name,
      playerPhoto: state.currentPlayer.photoUrl,
      teamId: state.highestBiddingTeamId,
      teamName: state.highestBiddingTeamName,
      amount: state.currentBid,
    };

    io.to(auctionId).emit(SocketEvents.PLAYER_SOLD, soldInfo);
  } else if (state.currentPlayer) {
    // Unsold — no bids placed
    await prisma.player.update({
      where: { id: state.currentPlayer.id },
      data: { status: 'UNSOLD' }
    });
    io.to(auctionId).emit(SocketEvents.PLAYER_UNSOLD, { 
      playerName: state.currentPlayer.name,
      playerPhoto: state.currentPlayer.photoUrl
    });
  }

  // Clear state for next player
  state.currentPlayer = null;
  state.currentBid = 0;
  state.highestBiddingTeamId = null;
  state.highestBiddingTeamName = null;
  state.timer = 0;
  state.bidHistory = [];
  
  io.to(auctionId).emit(SocketEvents.AUCTION_STATE_UPDATE, getCleanState(auctionId));

  return soldInfo;
};
