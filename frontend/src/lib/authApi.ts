import { api } from "./api";

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type UserDto = {
  userId: string;
  name: string;
  userName: string;
  email: string;
  whatsAppNumber: string | null;
  phoneNumber: string | null;
  isActive: boolean;
  createdAt: string;
  roles: string[];
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  name: string;
  email: string;
  phoneNumber: string;
  whatsAppNumber?: string;
  password: string;
  confirmPassword: string;
};

export type ChangePasswordRequest = {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type UpdateProfileRequest = {
  name: string;
  userName: string;
  phoneNumber: string;
  whatsAppNumber?: string;
};

export const loginUser = (data: LoginRequest) =>
  api
    .post<ApiResponse<{ accessToken: string; refreshToken: string; expiration: string }>>(
      "/api/auth/login",
      data,
    )
    .then((r) => r.data);

export const registerUser = (data: RegisterRequest) =>
  api
    .post<ApiResponse<{ accessToken: string; refreshToken: string; expiration: string }>>(
      "/api/auth/register",
      data,
    )
    .then((r) => r.data);

export const logoutUser = () =>
  api
    .post<{ success: boolean; message: string }>("/api/auth/logout")
    .then((r) => r.data);

export const logoutFromAllDevices = () =>
  api
    .post<{ success: boolean; message: string }>("/api/auth/logout-all")
    .then((r) => r.data);

export const getProfile = () =>
  api.get<ApiResponse<UserDto>>("/api/user/profile").then((r) => r.data);

export const updateProfile = (data: UpdateProfileRequest) =>
  api
    .put<ApiResponse<UserDto>>("/api/user/update-profile", data)
    .then((r) => r.data);

export const changePassword = (data: ChangePasswordRequest) =>
  api
    .post<{ success: boolean; message: string }>("/api/auth/change-password", data)
    .then((r) => r.data);
