# AI Service Documentation

## Chat Memory (In-Memory, Dev)

The chat endpoint keeps **in-memory** conversation history (RAM only) so consecutive calls to `/api/v1/chat` are contextual.

- This memory is **process-local** and resets when the container/server restarts.
- During development, the service uses a single global conversation (no `conversation_id` yet).
- History is capped by a max number of turns (default: 20) to avoid prompt blow-up.

### Reset Memory (Dev Utility)

To clear the in-memory chat history without restarting the server:

`POST /api/v1/chat/reset`

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

