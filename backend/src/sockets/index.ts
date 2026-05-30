import { Server, Socket } from 'socket.io';
import { SocketEvents, Player } from 'shared';
import { prisma } from '../prisma';
import { getAuctionState, getCleanState, startTimer, pauseTimer, stopTimer, sellPlayer } from './state';

export const setupSockets = (io: Server) => {
  const broadcastViewers = async (auctionId: string) => {
    try {
      const sockets = await io.in(auctionId).fetchSockets();
      const count = sockets.length;
      const emails = new Set<string>();
      sockets.forEach(s => {
        if (s.data.email) emails.add(s.data.email);
      });
      io.to(auctionId).emit('VIEWERS_COUNT_UPDATE', count);
      io.to(auctionId).emit('VIEWERS_UPDATE', Array.from(emails));
    } catch (err) {
      console.error(err);
    }
  };

  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on(SocketEvents.JOIN_AUCTION, (payload: any) => {
      let auctionId = '';
      if (typeof payload === 'string') {
        auctionId = payload;
      } else {
        auctionId = payload.auctionId;
        if (payload.email) socket.data.email = payload.email;
        if (payload.isHost) {
          socket.data.isHost = true;
          socket.data.auctionId = auctionId;
        }
      }

      socket.join(auctionId);
      console.log(`Socket ${socket.id} joined auction ${auctionId} with email ${socket.data.email || 'unknown'}`);
      socket.emit(SocketEvents.AUCTION_STATE_UPDATE, getCleanState(auctionId));
      broadcastViewers(auctionId);
    });

    // PLACE BID
    socket.on(SocketEvents.PLACE_BID, async (data: { auctionId: string, playerId: string, teamId: string, teamName: string, amount: number }) => {
      const state = getAuctionState(data.auctionId);
      
      if (state.status !== 'ACTIVE' && state.status !== 'EDITING' || !state.currentPlayer) {
        return socket.emit(SocketEvents.ERROR, { message: 'Bidding is not active' });
      }

      const previousBidAmount = state.status === 'EDITING' && state.bidHistory.length > 1 
        ? state.bidHistory[1].amount 
        : 0;

      if (state.status === 'EDITING' && data.amount <= previousBidAmount) {
        return socket.emit(SocketEvents.ERROR, { message: 'Edited bid must be higher than the previous bid' });
      } else if (state.status !== 'EDITING' && data.amount <= state.currentBid) {
        return socket.emit(SocketEvents.ERROR, { message: 'Bid must be higher than current bid' });
      }

      if (data.amount < state.currentPlayer.basePrice) {
        return socket.emit(SocketEvents.ERROR, { message: 'Bid must be at least the base price' });
      }

      const team = await prisma.team.findUnique({ where: { id: data.teamId } });
      if (!team) {
        return socket.emit(SocketEvents.ERROR, { message: 'Team not found' });
      }
      if (data.amount > team.remainingPurse) {
        return socket.emit(SocketEvents.ERROR, { message: `Exceeds budget! ${team.shortName} only has ₹${team.remainingPurse} remaining` });
      }

      state.currentBid = data.amount;
      state.highestBiddingTeamId = data.teamId;
      state.highestBiddingTeamName = data.teamName;

      const bidEntry = {
        teamId: data.teamId,
        teamName: data.teamName,
        amount: data.amount,
      };

      if (state.status === 'EDITING') {
        state.bidHistory[0] = bidEntry;
        state.status = 'ACTIVE';
        io.to(data.auctionId).emit(SocketEvents.AUCTION_STATE_UPDATE, getCleanState(data.auctionId));
      } else {
        state.bidHistory.unshift(bidEntry);
        io.to(data.auctionId).emit(SocketEvents.BID_UPDATED, bidEntry);
        io.to(data.auctionId).emit(SocketEvents.AUCTION_STATE_UPDATE, getCleanState(data.auctionId));
      }
    });

    socket.on(SocketEvents.EDIT_BID_START, ({ auctionId }: { auctionId: string }) => {
      const state = getAuctionState(auctionId);
      if (state.status === 'ACTIVE' && state.bidHistory.length > 0) {
        state.status = 'EDITING';
        io.to(auctionId).emit(SocketEvents.AUCTION_STATE_UPDATE, getCleanState(auctionId));
      }
    });

    socket.on(SocketEvents.EDIT_BID_CANCEL, ({ auctionId }: { auctionId: string }) => {
      const state = getAuctionState(auctionId);
      if (state.status === 'EDITING') {
        state.status = 'ACTIVE';
        io.to(auctionId).emit(SocketEvents.AUCTION_STATE_UPDATE, getCleanState(auctionId));
      }
    });

    socket.on(SocketEvents.REMOVE_BID, ({ auctionId }: { auctionId: string }) => {
      const state = getAuctionState(auctionId);
      if (state.status === 'EDITING' && state.bidHistory.length > 0) {
        state.bidHistory.shift();
        const prevBid = state.bidHistory[0];
        if (prevBid) {
          state.currentBid = prevBid.amount;
          state.highestBiddingTeamId = prevBid.teamId;
          state.highestBiddingTeamName = prevBid.teamName;
        } else {
          state.currentBid = 0;
          state.highestBiddingTeamId = null;
          state.highestBiddingTeamName = null;
        }
        state.status = 'ACTIVE';
        io.to(auctionId).emit(SocketEvents.AUCTION_STATE_UPDATE, getCleanState(auctionId));
      }
    });

    socket.on(SocketEvents.RESET_CURRENT_BIDS, ({ auctionId }: { auctionId: string }) => {
      const state = getAuctionState(auctionId);
      if (state.currentPlayer) {
        state.currentBid = 0;
        state.highestBiddingTeamId = null;
        state.highestBiddingTeamName = null;
        state.bidHistory = [];
        io.to(auctionId).emit(SocketEvents.AUCTION_STATE_UPDATE, getCleanState(auctionId));
      }
    });

    socket.on(SocketEvents.NEXT_PLAYER, async ({ auctionId }: { auctionId: string }) => {
      console.time(`NEXT_PLAYER_${auctionId}`);
      const state = getAuctionState(auctionId);
      if (state.currentPlayer) {
        return socket.emit(SocketEvents.ERROR, { message: 'You must complete the current bid (Sell or Unsold) first' });
      }

      // Check if all teams have filled their quota
      const teamStats = await prisma.team.aggregate({ where: { auctionId }, _sum: { maxPlayers: true } });
      const totalMax = teamStats._sum.maxPlayers || 0;
      
      if (totalMax > 0) {
        const soldPlayers = await prisma.player.count({ where: { auctionId, status: 'SOLD' } });
        if (soldPlayers >= totalMax) {
          await prisma.auction.update({ where: { id: auctionId }, data: { status: 'COMPLETED' } });
          state.status = 'COMPLETED';
          stopTimer(auctionId);
          io.to(auctionId).emit(SocketEvents.AUCTION_ENDED);
          console.timeEnd(`NEXT_PLAYER_${auctionId}`);
          return;
        }
      }

      const pendingCount = await prisma.player.count({ where: { status: 'PENDING', auctionId } });
      let nextPlayer;

      if (pendingCount > 0) {
        const randomSkip = Math.floor(Math.random() * pendingCount);
        nextPlayer = await prisma.player.findFirst({ 
          where: { status: 'PENDING', auctionId },
          skip: randomSkip 
        });
      } else {
        let unsoldCount = await prisma.player.count({ where: { status: 'UNSOLD', auctionId, isRecalled: false } });
        if (unsoldCount === 0) {
          const totalUnsold = await prisma.player.count({ where: { status: 'UNSOLD', auctionId } });
          if (totalUnsold > 0) {
             await prisma.player.updateMany({ where: { status: 'UNSOLD', auctionId }, data: { isRecalled: false } });
             unsoldCount = totalUnsold;
          } else {
             console.timeEnd(`NEXT_PLAYER_${auctionId}`);
             return socket.emit(SocketEvents.NO_PLAYERS_LEFT);
          }
        }
        const randomSkip = Math.floor(Math.random() * unsoldCount);
        nextPlayer = await prisma.player.findFirst({ 
          where: { status: 'UNSOLD', auctionId, isRecalled: false },
          skip: randomSkip 
        });
        
        if (nextPlayer) {
          await prisma.player.update({
            where: { id: nextPlayer.id },
            data: { isRecalled: true }
          });
        }
      }

      if (!nextPlayer) {
        console.timeEnd(`NEXT_PLAYER_${auctionId}`);
        return socket.emit(SocketEvents.NO_PLAYERS_LEFT);
      }

      state.currentPlayer = nextPlayer as Player;
      state.currentBid = 0;
      state.highestBiddingTeamId = null;
      state.highestBiddingTeamName = null;
      state.timer = 0;
      state.bidHistory = [];
      
      if (state.status !== 'ACTIVE') {
        await prisma.auction.update({ where: { id: auctionId }, data: { status: 'ACTIVE' } });
      }

      
      startTimer(io, auctionId);
      io.to(auctionId).emit(SocketEvents.AUCTION_STATE_UPDATE, getCleanState(auctionId));
      console.timeEnd(`NEXT_PLAYER_${auctionId}`);
    });

    socket.on(SocketEvents.PAUSE_AUCTION, ({ auctionId }: { auctionId: string }) => {
      pauseTimer(auctionId);
      io.to(auctionId).emit(SocketEvents.AUCTION_STATE_UPDATE, getCleanState(auctionId));
    });

    socket.on(SocketEvents.RESUME_AUCTION, ({ auctionId }: { auctionId: string }) => {
      const state = getAuctionState(auctionId);
      state.status = 'ACTIVE';
      io.to(auctionId).emit(SocketEvents.AUCTION_STATE_UPDATE, getCleanState(auctionId));
    });

    socket.on(SocketEvents.PLAYER_SOLD, async ({ auctionId }: { auctionId: string }) => {
      await sellPlayer(io, auctionId);
    });

    socket.on(SocketEvents.END_AUCTION, async ({ auctionId }: { auctionId: string }) => {
      await prisma.auction.update({ where: { id: auctionId }, data: { status: 'COMPLETED' } });
      const state = getAuctionState(auctionId);
      state.status = 'COMPLETED';
      stopTimer(auctionId);
      io.to(auctionId).emit(SocketEvents.AUCTION_ENDED);
    });

    socket.on(SocketEvents.UNDO_BID, ({ auctionId }: { auctionId: string }) => {
      const state = getAuctionState(auctionId);
      if (state.bidHistory.length > 0) {
        state.bidHistory.shift();
        const prevBid = state.bidHistory[0];
        if (prevBid) {
          state.currentBid = prevBid.amount;
          state.highestBiddingTeamId = prevBid.teamId;
          state.highestBiddingTeamName = prevBid.teamName;
        } else {
          state.currentBid = 0;
          state.highestBiddingTeamId = null;
          state.highestBiddingTeamName = null;
        }
        io.to(auctionId).emit(SocketEvents.AUCTION_STATE_UPDATE, getCleanState(auctionId));
      }
    });

    socket.on(SocketEvents.REVERT_LAST_PLAYER, async ({ auctionId }: { auctionId: string }) => {
      const state = getAuctionState(auctionId);
      if (state.currentPlayer) {
        return socket.emit(SocketEvents.ERROR, { message: 'Must clear current player or wait until IDLE to revert' });
      }

      // Find the last sold or unsold player
      const lastPlayer = await prisma.player.findFirst({
        where: { auctionId, status: { in: ['SOLD', 'UNSOLD'] } },
        orderBy: { updatedAt: 'desc' }
      });

      if (!lastPlayer) {
        return socket.emit(SocketEvents.ERROR, { message: 'No sold/unsold players to revert' });
      }

      // Revert player status
      await prisma.player.update({
        where: { id: lastPlayer.id },
        data: {
          status: 'PENDING',
          soldPrice: null,
          teamId: null,
        }
      });

      // Refund the team purse if sold
      if (lastPlayer.status === 'SOLD' && lastPlayer.teamId && lastPlayer.soldPrice) {
        await prisma.team.update({
          where: { id: lastPlayer.teamId },
          data: { remainingPurse: { increment: lastPlayer.soldPrice } }
        });
      }

      // Make this player the current player
      state.currentPlayer = { ...lastPlayer, status: 'PENDING', soldPrice: undefined, teamId: undefined } as unknown as Player;
      state.currentBid = 0;
      state.highestBiddingTeamId = null;
      state.highestBiddingTeamName = null;
      state.timer = 0;
      state.bidHistory = [];
      state.status = 'ACTIVE';

      startTimer(io, auctionId);
      io.to(auctionId).emit(SocketEvents.AUCTION_STATE_UPDATE, getCleanState(auctionId));
    });



    socket.on('disconnecting', () => {
      // broadcast viewers update after this socket leaves
      socket.rooms.forEach((room) => {
        if (room !== socket.id) {
          setTimeout(() => broadcastViewers(room), 100);
        }
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      if (socket.data.isHost && socket.data.auctionId) {
        const state = getAuctionState(socket.data.auctionId);
        if (state.status === 'ACTIVE' || state.status === 'EDITING') {
          pauseTimer(socket.data.auctionId);
          io.to(socket.data.auctionId).emit(SocketEvents.AUCTION_STATE_UPDATE, getCleanState(socket.data.auctionId));
        }
      }
    });
  });
};
