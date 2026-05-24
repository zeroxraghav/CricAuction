export enum Role {
  ADMIN = 'ADMIN',
  OWNER = 'OWNER',
}

export interface User {
  id: string;
  email: string;
  role: Role;
  teamId?: string; // If owner, they are associated with a team
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  logoUrl?: string;
  budget: number;
  remainingPurse: number;
  ownerId?: string;
}

export enum PlayerRole {
  BATSMAN = 'BATSMAN',
  BOWLER = 'BOWLER',
  ALLROUNDER = 'ALLROUNDER',
  WICKETKEEPER = 'WICKETKEEPER',
}

export enum PlayerStatus {
  UNSOLD = 'UNSOLD',
  SOLD = 'SOLD',
  PENDING = 'PENDING',
}

export interface Player {
  id: string;
  name: string;
  photoUrl?: string;
  country: string;
  role: PlayerRole;
  basePrice: number;
  soldPrice?: number;
  category?: string;
  status: PlayerStatus;
  teamId?: string; // null if unsold/pending
  stats?: any; // could be structured more strictly later
}

export interface Bid {
  id: string;
  auctionId: string;
  playerId: string;
  teamId: string;
  amount: number;
  timestamp: string;
}

// Socket Events
export enum SocketEvents {
  JOIN_AUCTION = 'JOIN_AUCTION',
  PLACE_BID = 'PLACE_BID',
  BID_UPDATED = 'BID_UPDATED',
  PLAYER_SOLD = 'PLAYER_SOLD',
  PLAYER_UNSOLD = 'PLAYER_UNSOLD',
  NEXT_PLAYER = 'NEXT_PLAYER',
  TIMER_UPDATE = 'TIMER_UPDATE',
  ERROR = 'ERROR',
  PAUSE_AUCTION = 'PAUSE_AUCTION',
  RESUME_AUCTION = 'RESUME_AUCTION',
  AUCTION_STATE_UPDATE = 'AUCTION_STATE_UPDATE',
  AUCTION_DELETED = 'AUCTION_DELETED',
  EDIT_BID_START = 'EDIT_BID_START',
  EDIT_BID_CANCEL = 'EDIT_BID_CANCEL',
  REMOVE_BID = 'REMOVE_BID',
  NO_PLAYERS_LEFT = 'NO_PLAYERS_LEFT',
  END_AUCTION = 'END_AUCTION',
  AUCTION_ENDED = 'AUCTION_ENDED',
  UNDO_BID = 'UNDO_BID',
  REVERT_LAST_PLAYER = 'REVERT_LAST_PLAYER',
  TOGGLE_STATS_VIEW = 'TOGGLE_STATS_VIEW',
  RESET_CURRENT_BIDS = 'RESET_CURRENT_BIDS',
}

export interface AuctionState {
  auctionId: string;
  currentPlayerId: string | null;
  currentBidAmount: number;
  highestBiddingTeamId: string | null;
  biddingActive: boolean;
  timer: number;
  isPaused: boolean;
}
