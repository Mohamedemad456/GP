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

    # Test 2: Egyptian Arabic (Ammeya) - General Advice
    print("Test 2: Egyptian Arabic (Ammeya) - General Advice")
    print("-" * 50)
    egyptian_message = "عايز اشتري عربية مستعملة، ايه اللي لازم اخد بالي منه؟"
    print(f"User: {egyptian_message}")
    
    response = await llm_service.generate_response(egyptian_message)
    print(f"Assistant: {response}\n")
    print("-" * 20)

    # Test 3: Specific Terminology Check (Fabrica/Rash)
    print("Test 3: Terminology Check")
    print("-" * 50)
    term_message = "يعني ايه راشة بره نظافة؟ وهل دي حاجة تقلق؟"
    print(f"User: {term_message}")

    response = await llm_service.generate_response(term_message)
    print(f"Assistant: {response}\n")
    print("-" * 20)

    # Test 4: Red Flag Check (Rash Dawahel)
    print("Test 4: Red Flag Check")
    print("-" * 50)
    danger_message = "لقيت عربية لقطة بس صاحبها بيقولي راشة دواخل بسيط، اشتريها؟"
    print(f"User: {danger_message}")

    response = await llm_service.generate_response(danger_message)
    print(f"Assistant: {response}\n")
    print("-" * 20)

    # Test 5: Pricing/Database Limitation Check
    print("Test 5: Pricing Limitation Check")
    print("-" * 50)
    price_message = "سعر كيا سبورتاج 2022 كام دلوقتي عندكم؟"
    print(f"User: {price_message}")

    response = await llm_service.generate_response(price_message)
    print(f"Assistant: {response}\n")
    
    print("✅ All tests completed!")
    print("-" * 20)

if __name__ == "__main__":
    asyncio.run(test_llm_service())