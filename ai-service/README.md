# AI Service Documentation

## Provider Order

The chat service now uses this default fallback order:

1. Groq with `llama-3.3-70b-versatile`
2. SambaNova with `Meta-Llama-3.3-70B-Instruct`
3. Gemini with `gemini-3-flash-preview`

## Explicit Model Selection

For testing, the `/api/v1/chat` request accepts an optional `model` field:

```json
{
	"message": "What should I look for when buying a used car?",
	"model": "Llama_samba"
}
```

Supported values are `auto`, `Llama_groq`, `Llama_samba`, and `gemini`.

