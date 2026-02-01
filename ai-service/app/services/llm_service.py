import yaml
import sys
import asyncio
from pathlib import Path
from typing import Optional
from openai import AsyncOpenAI # type: ignore
from openai import OpenAI # type: ignore
service_folder = Path().resolve().parent
sys.path.append(str(service_folder))

from app.core.config import settings

class LLMService:
    """
    Service for generating AI responses using Cerebras LLM API.
    Uses OpenAI SDK for compatibility with multiple providers but starts with Cerebras.
    Loads system prompts and parameters from YAML configuration.
    """
    
    def __init__(self):
        """Initialize the LLM service with API client and load prompts."""
        self.client = AsyncOpenAI(
            base_url=settings.cerebras_base_url,
            api_key=settings.cerebras_api_key,
        )
        
        # Load configuration from YAML prompt templates
        self.config = self._load_config()
        self.system_prompt = self.config["system_prompt"]
        self.model_params = self.config["model_params"]
        self.timeout = self.config["timeout"]
    

    ###########################################################################
    def _load_config(self) -> dict:
        """
        Load chatbot configuration from YAML file.
        Returns:
            dict: Configuration including system prompt and parameters
        """
        # Path to prompts directory
        prompts_dir = Path(__file__).parent.parent / "prompts"
        config_path = prompts_dir / "chatbot_prompts.yaml"
        
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
        
        return config
    
    ###########################################################################

    async def generate_response(
        self, 
        user_message: str,
    ) -> str:
        """
        Generate AI response for user message.
        """

        temp = self.model_params["temperature"]
        max_tok = self.model_params["max_tokens"]

        try:
            # Make API call with timeout
            response = await self.client.chat.completions.create(
                model=settings.cerebras_model,
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": user_message}
                ],
                temperature=temp,
                max_tokens=max_tok,
                top_p=self.model_params["top_p"],
                frequency_penalty=self.model_params["frequency_penalty"],
                presence_penalty=self.model_params["presence_penalty"],
                timeout=self.timeout,  # 5 second timeout from acceptance criteria
            )
            
            # Extract response text
            assistant_message = response.choices[0].message.content
            return assistant_message
            
        except Exception as e:
            print(f"Error generating response: {str(e)}")
            raise


llm_service = LLMService()

if __name__ == "__main__":
    # Simple test to verify service works
    async def test():
        user_msg = "Hello, how are you?"
        response = await llm_service.generate_response(user_msg)
        print(f"Assistant: {response}")
    
    asyncio.run(test())
        