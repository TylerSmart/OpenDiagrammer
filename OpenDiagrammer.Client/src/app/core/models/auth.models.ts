export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  id: string;
  email: string;
  username: string;
  expiresAt: string;
}

export interface CurrentUserDto {
  id: string;
  email: string;
  username: string;
}

export interface AuthProviderDto {
  id: string;
  name: string;
  authorizationUrl?: string;
}
