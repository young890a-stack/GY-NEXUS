export type OAuthToken = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number | string;
  token_type?: string;
  scope?: string;
  created_at: number;
};

export type ConnectionId =
  | "youtube"
  | "blogger"
  | "naver"
  | "search-console"
  | "coupang"
  | "temu";

export type ConnectionState = {
  id: ConnectionId;
  name: string;
  connected: boolean;
  configured: boolean;
  detail: string;
  account?: string;
  limitation?: string;
};
