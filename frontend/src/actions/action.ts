import { api } from "@/lib/api";

const AI_BASE_URL =
  import.meta.env.VITE_AI_API_URL ?? "http://localhost:8000";

export const chatWithAI = async (message: string) => {
  try {
    const response = await api.post(`${AI_BASE_URL}/api/v1/chat`, { message });
    return response.data;
  } catch (error) {
    throw new Error("Failed to chat with AI", { cause: error });
  }
};
