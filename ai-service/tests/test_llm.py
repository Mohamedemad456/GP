import asyncio
from app.services.llm_service import llm_service


async def test_llm_service():
    """Test the LLM service with sample messages."""
        
    # Test 1: English message
    print("Test 1: English Query")
    print("-" * 50)
    english_message = "What should I look for when buying a used car?"
    print(f"User: {english_message}")
    
    response = await llm_service.generate_response(english_message)
    print(f"Assistant: {response}\n")
    print("-" * 20)
    
    # Test 2: Arabic message (Fusha)
    print("Test 2: Arabic Query (Fusha)")
    print("-" * 50)
    arabic_message = "ما هي أهم النصائح عند شراء سيارة مستعملة؟"
    print(f"User: {arabic_message}")
    
    response = await llm_service.generate_response(arabic_message)
    print(f"Assistant: {response}\n")
    print("-" * 20)
    


    # Test 3: Egyptian Arabic (Ammeya)
    print("Test 3: Egyptian Arabic (Ammeya)")
    print("-" * 50)
    egyptian_message = "عايز اشتري عربية مستعملة، ايه اللي لازم اخد بالي منه؟"
    print(f"User: {egyptian_message}")
    
    response = await llm_service.generate_response(egyptian_message)
    print(f"Assistant: {response}\n")
    
    print("✅ All tests completed!")
    print("-" * 20)

if __name__ == "__main__":
    asyncio.run(test_llm_service())