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

1. Cerebras with `qwen-3-235b-a22b-instruct-2507`
2. DeepInfra with `Qwen/Qwen3-235B-A22B-Instruct-2507`
3. Groq with `llama-3.3-70b-versatile`
4. SambaNova with `Meta-Llama-3.3-70B-Instruct`
5. Gemini with `gemini-3-flash-preview`

## Explicit Model Selection

For testing, the `/api/v1/chat` request accepts an optional `model` field:

```json
{
	"message": "What should I look for when buying a used car?",
	"model": "deepinfra"
}
```

Supported values are `auto`, `cerebras`, `qwen`, `deepinfra`, `qwen_deepinfra`, `Llama_groq`, `Llama_samba`, and `gemini`.

