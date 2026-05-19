# AI Backend Setup

The AI player is served by one of two backends, picked at server startup:

| Condition | Active backend |
|---|---|
| `LLM_BACKEND=anthropic` or `=ollama` | Forced |
| `ANTHROPIC_API_KEY` present in env | Anthropic |
| Otherwise | Ollama (local, default) |

See `.env.example` for the full list of env vars. The smoke test (`node hello-ai.js`) prints which backend is active before calling it.

---

## Ollama (default — no API key needed)

### 1. Install

**macOS:**
```bash
brew install ollama
```

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Or download the installer from [ollama.com/download](https://ollama.com/download).

### 2. Start the Ollama server

In its own terminal (leave it running):
```bash
ollama serve
```

Listens on `http://localhost:11434`. If the port is taken, set `OLLAMA_HOST=127.0.0.1:11435` before `ollama serve` and pass `OLLAMA_URL=http://localhost:11435/api/chat` to the app.

### 3. Pull the model

```bash
ollama pull llama3.2:3b
```

~2 GB download, 1–3 min on a normal connection. This is our default — small, fast, decent at casual chat.

### 4. Verify

```bash
node hello-ai.js
```

You should see `Active backend: ollama` followed by a short reply and a latency number. First call after `ollama serve` boots is slow (5–15s) because the model loads into RAM. Warm calls should be 200–800ms on Apple Silicon.

---

## Anthropic (optional — if someone has a key)

If you have a key, drop it in `.env` (copy from `.env.example`):
```
ANTHROPIC_API_KEY=sk-ant-...
```

Run with Node's built-in `--env-file` flag (Node 20.6+) — no `dotenv` package needed:
```bash
node --env-file=.env hello-ai.js
```

Or pass it inline without a file:
```bash
ANTHROPIC_API_KEY=sk-ant-... node hello-ai.js
```

`Active backend: anthropic` confirms it picked up the key. Default model is `claude-sonnet-4-6` — override with `ANTHROPIC_MODEL=<id>` in `.env`.

To force Ollama even when a key is present:
```bash
LLM_BACKEND=ollama node --env-file=.env hello-ai.js
```

**Gotcha:** plain `node hello-ai.js` does **not** read `.env` automatically. Either use `--env-file=.env` or `export` the vars into your shell.

---

## Troubleshooting

**`ECONNREFUSED` / `fetch failed`** — `ollama serve` isn't running. Start it in another terminal.

**`model 'X' not found`** — `ollama pull X` first.

**Warm calls take >3s** — model is too big for your laptop. Try a smaller one:
```bash
ollama pull llama3.2:1b
OLLAMA_MODEL=llama3.2:1b node hello-ai.js
```

**Replies sound robotic / too AI-like** — that's a prompt problem, not a model problem. Tweak the "act human" system prompt in `content.js`. Strong specific instructions help small models a lot ("no markdown", "no greetings", "lowercase only", "one short sentence").

**Out of memory / laptop fan spins up** — close Slack, Zoom, browser tabs. 3B uses ~4 GB RAM, 7B uses ~8 GB.

**Anthropic call returns 401** — bad or expired key. Check `.env`, or unset `ANTHROPIC_API_KEY` to fall back to Ollama.

## Model picks if we want to swap (Ollama)

| Model | Size | Notes |
|---|---|---|
| `llama3.2:1b` | ~1 GB | Fastest, weakest. Last-resort fallback. |
| `llama3.2:3b` | ~2 GB | **Default.** Good balance. |
| `mistral:7b` | ~4 GB | Often more natural in casual chat. |
| `llama3.1:8b` | ~5 GB | Best quality of these. Slower. |

Swap is one `ollama pull` plus the `OLLAMA_MODEL` env var — no code change.

## Who needs to run this

- **Dev 1, Dev 2, Dev 3** — yes, to test integration locally. Ollama is fine; Anthropic only if someone has a key.
- **Teammates 4 & 5** — only if you want to playtest on your own machine. Otherwise just use someone else's running game.
- **Demo machine** — must have Ollama running with the model pre-pulled before the demo starts, even if Anthropic is the primary, as a network-failure backup.
