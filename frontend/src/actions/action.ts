import axios from "axios";

export const chatWithAI = async (message: string) => {
  try {
    const response = await axios.post("http://localhost:8000/api/v1/chat", {
        "message": message,
    });
    return response.data;
  } catch (error) {
    console.error(error);
    throw new Error("Failed to chat with AI");
  }
};
