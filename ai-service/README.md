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

The chat service uses this default fallback order:

1. **Gemini** — `gemini-3-flash-preview` (fastest, most reliable)
2. **DeepInfra** — `anthropic/claude-sonnet-4-6` (highest quality)
3. **DeepInfra** — `anthropic/claude-opus-4-7`
4. **DeepInfra** — `Qwen/Qwen3-235B-A22B-Instruct-2507`
5. **DeepInfra** — `google/gemini-3.1-pro`
6. **SambaNova** — `Meta-Llama-3.3-70B-Instruct` (final fallback)

> **Note:** Cerebras and Groq are temporarily disabled (API keys expired / model not available). They remain in the codebase commented out for easy re-enablement.

## Explicit Model Selection

For testing, the `/api/v1/chat` request accepts an optional `model` field:

```json
{
	"message": "What should I look for when buying a used car?",
	"model": "sonnet"
}
```

Supported values are `auto`, `sonnet`/`claude_sonnet`, `opus`/`claude_opus`, `gemini_pro`, `deepinfra`/`qwen_deepinfra`, `llama_samba`, and `gemini`.

## Testing Results (2026-05-29)

All active providers were tested via explicit `model` selection on `/api/v1/chat` with the prompt: *"What does فابريكا mean in the Egyptian used car market? Keep it short."*

| # | Provider | Model | Status | Response Time |
|---|----------|-------|--------|---------------|
| 1 | **DeepInfra Sonnet** | `anthropic/claude-sonnet-4-6` | ✅ HTTP 200 | 6.69s |
| 2 | **DeepInfra Opus** | `anthropic/claude-opus-4-7` | ✅ HTTP 200 | 2.43s |
| 3 | **DeepInfra Gemini Pro** | `google/gemini-3.1-pro` | ✅ HTTP 200 | 5.18s |
| 4 | **DeepInfra Qwen** | `Qwen/Qwen3-235B-A22B-Instruct-2507` | ✅ HTTP 200 | 3.99s |
| 5 | **SambaNova Llama** | `Meta-Llama-3.3-70B-Instruct` | ✅ HTTP 200 | 2.46s |
| 6 | **Gemini Flash** | `gemini-3-flash-preview` | ✅ HTTP 200 | 18.40s |
| — | **Auto fallback** | Sonnet → Opus → Gemini Pro → Qwen | ✅ HTTP 200 | ~7s |

### Disabled Providers

| Provider | Reason |
|----------|--------|
| **Cerebras Qwen** | API key expired / model not available (404) |
| **Groq Llama** | API key expired (401) |

Both providers are commented out in the codebase and can be re-enabled by uncommenting the relevant config, client initialization, and fallback blocks.

