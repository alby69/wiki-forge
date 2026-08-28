# Technical Analysis and Usage Architectures: `wiki-forge` with Local LLMs and From-Scratch Training

This document analyzes the feasibility of integrating the **`wiki-forge`** project with small-scale language models (local LLMs or custom-trained models like Andrej Karpathy's **nanoGPT** / **nanochat**). It provides a theoretical analysis of the problem and details two architectural solutions:
- **Solution A (Production / Real-World Usability)**: Local RAG architecture with pre-trained LLMs and `wiki-forge`.
- **Solution B (Educational Purpose)**: *From-scratch* training pipeline with `nanochat` to understand the internal dynamics of an LLM.

> **Update (v2.3+):** Solution A is no longer only a proposal — `wiki-forge` now
> ships a **built-in multi-provider LLM client** (`[agent.llm]` in `config.toml`)
> and a decoupled agent backend (`src/server/agentServer.ts`) that implement the
> architecture described in §2 and expose it through the bundled Web UI. Sections
> 2 and 5 have been aligned with this implemented reality; Solution B remains the
> educational path with the external `nanochat` codebase.

---

## 1. Technical Feasibility Analysis and Core Concepts

### 1.1 The Underlying Issue: Parametric Memory vs. Non-Parametric Memory

A common misconception when approaching Large Language Models (LLMs) is considering *pre-training* or *fine-tuning* on a custom corpus of documents as creating a "queryable memory" or a searchable database.

- **Parametric Memory (Pre-training & Fine-Tuning)**:
  Knowledge resides within the weights (attention matrices/parameters) of the neural network. Training optimizes the model for Next-Token Prediction. Fine-tuning alters style, formatting, or statistical associations, but does not guarantee precise factual recall.

- **Non-Parametric Memory (RAG & LLM-Wiki)**:
  Knowledge resides in external documents (Markdown files, vector databases). The model acts as a reasoning and synthesis engine: context is supplied at inference time (*in-context learning*), allowing it to extract information without modifying its internal weights.

### 1.2 Why `nanoGPT` / `nanochat` Cannot Act Directly as the Engine for `wiki-forge`

1. **Data Scale**:
   Models like `nanochat` require billions of generic text tokens (e.g., *FineWeb*) just to acquire grammar, basic reasoning, and general world knowledge. A few megabytes of personal documents introduced during pre-training or fine-tuning represent a negligible statistical signal that gets drowned out by the pre-training dataset.

2. **Agentic Capabilities & Instruction-Following**:
   `wiki-forge` requires an LLM with strong agentic capabilities (as outlined in `AGENT.md`): it must understand complex instructions, parse Markdown documents, create interlinked `[[wikilinks]]`, extract entities without hallucinating, and perform routine maintenance (merging, splitting, auditing). Models smaller than ~3B-7B parameters trained from scratch with consumer resources lack the reasoning capacity required to function as a `wiki-forge` agent.

3. **Incompatibility with `wiki-forge` Architecture**:
   `wiki-forge` does not perform training. It is a Markdown-based compiler and knowledge manager. It expects a frontier-class model (or a capable local open-weight model) accessible via API or CLI.

---

## 2. Solution A — Operational & Production: Local RAG + `wiki-forge`

### 2.1 Objective
Build a local, queryable, private, and hallucination-free system that manages personal documents using the `wiki-forge` methodology.

### 2.2 Technology Stack
1. **Local Inference Engine**:
   - **Ollama**, **llama.cpp**, or **LM Studio**.
2. **Recommended Open-Weight Models**:
   - **Llama 3.1 / 3.2 (8B / 3B)**
   - **Qwen 2.5 (7B / 14B)**
   - **Mistral 7B / Phi-4 (14B)**
   *Hardware Requirements*: Consumer GPU with 8-16 GB VRAM (e.g., RTX 3060/4060/4070) or Apple Silicon Mac (M-series with 16GB+ unified memory).
3. **Wiki Compilation & Querying (`wiki-forge`)**:
   - Source conversion (PDF/EPUB/DOCX) via `conv2md.py` into `raw/`.
   - **Built-in multi-provider agent backend** configured in `[agent.llm]`
     (`provider = "opencode" | "anthropic" | "openai_compatible" | "ollama"`).
     The agent reads `AGENT.md` and executes the workflow commands
     (`/compile`, `/consult`, `/audit`, `/trace`, `/reindex`, `/wizard`) to
     build and maintain the interlinked articles in `wiki/`.
   - The **Web UI** (`src/server/agentServer.ts` + `src/components/**`) exposes
     this backend in the browser: streaming chat, direct editing, and a file
     manager (create/rename/move/delete/upload with drag-and-drop).
4. **Indexing & Retrieval Layer (Optional / Advanced)**:
   - Local Embedding Model: `nomic-embed-text` or `bge-m3`.
   - Lightweight Vector Database: **ChromaDB** or **LanceDB**.
   - Compiled `wiki/` articles are chunked and indexed in the Vector DB to accelerate `consult` queries and prevent context window exhaustion.

```
+------------------+     conv2md.py      +--------------+
| Original Docs    |  ---------------->  |  raw/ (.md)  |
| (sources/backup) |                     +--------------+
+------------------+                            |
                                                v
+------------------+    AGENT.md Schema   +--------------+
| Local LLM        |  <---------------->  |  wiki/ (.md) |  <--- Compiled by Agent
| (7B - 14B)       |  ([agent.llm] ~      +--------------+
|  Ollama / ...    |   opencode|anthropic|openai|ollama)
+------------------+                            |
        ^                                       v
        | Vector Search                 +---------------+
        +-----------------------------> | Vector DB     | (Chroma / LanceDB)
                                        +---------------+

Bundled Web UI (Solution A, out of the box):
+------------------+   REST + SSE    +----------------------+
| Browser UI       | <-------------> | Agent Server         |   GET  /api/wiki/notes
| (Chat / Editor / |    /api/chat    | (agentServer.ts)     |   POST /api/chat
|  File manager )  |                 | LLM Client (llmClient)|  POST /api/wiki/*  (save,
+------------------+                 +----------------------+    attach, create, rename,
     (move/delete/upload)                                          move, delete, upload)
```

### 2.3 What Is Already Implemented in `wiki-forge`

The architecture above is not just a design — since v2.3 it exists as working
code inside the template:

- **Multi-Provider LLM Client** (`src/server/llmClient.ts`): one interface for
  OpenCode CLI, Anthropic API, OpenAI-compatible REST endpoints, and local
  Ollama. Selected via `[agent.llm]` in `config.toml`; API keys are referenced by
  environment variable (`api_key_env`) and never stored in the repo. The opencode
  binary path is auto-detected (PATH → `~/.opencode/bin` → known locations) and
  persisted back into `config.toml`.
- **Decoupled Agent Backend** (`src/server/agentServer.ts`):
  - `GET /api/wiki/notes` — real-time vault listing straight from disk;
  - `POST /api/chat` — streaming (SSE) answers with `AGENT.md` injected as the
    system prompt;
  - workflow commands `/compile`, `/audit`, `/trace`, `/reindex` executed on
    disk (real ingestion, broken-link/orphan audit, index generation),
    `/consult` LLM synthesis, and `/wizard <scenario>` scenario workflows;
  - vault filesystem API — `/api/wiki/save`, `/api/wiki/attach`,
    `/api/wiki/folder/create`, `/api/wiki/file/create`, `/api/wiki/rename`,
    `/api/wiki/move`, `/api/wiki/delete`, `/api/wiki/upload` — every path
    validated against traversal (must stay inside `wiki/` or `raw/`).
- **Security Hardening**: path-traversal containment (HTTP 400 on invalid
  paths), XSS sanitization in `renderMarkdown`, input size limits (50,000
  characters), subprocess execution timeouts.
- **Storage Abstraction** (`src/storage/ApiStorage.ts`): `IStorage` calls the
  REST endpoints when online and falls back to static `FileStorage` when offline.
- **Web UI** (Vite + TypeScript): vault explorer with a file manager and
  drag-and-drop, CodeMirror 6 editor (Save & Close / Cancel actions), a
  force-directed graph, a context panel, and a chat drawer with live streaming,
  chat history, **Attach to Wiki**, and the `/wizard` scenario selector.

Practical result for Solution A: install Ollama (or point `[agent.llm]` at your
preferred provider), start the UI (`make ui-docker`), and the local-RAG
architecture of §2.2 is running natively — no glue code required.

### 2.4 Key Benefits of Solution A
- **Instant Updates**: Adding new documents requires running `compile` without re-training the model.
- **Traceability & Zero Hallucination**: Answers cite exact sources using `[[wikilinks]]` referencing raw files.
- **Resource Efficiency**: Runs entirely on standard consumer hardware.

---

## 3. Solution B — Educational Purpose: From-Scratch Training with `nanochat`

### 3.1 Objective
Understand the full lifecycle of training a generative LLM (from tokenization to KV-cache inference) using the [`karpathy/nanochat`](https://github.com/karpathy/nanochat) repository.

### 3.2 The `nanochat` Training Pipeline

The `nanochat` pipeline mirrors modern frontier model training (like ChatGPT) across 6 distinct stages:

```
[1. Tokenization] -> [2. Pretraining] -> [3. Midtraining] -> [4. SFT] -> [5. RL] -> [6. Inference Engine]
```

1. **Tokenization (`tok_train.py`)**:
   Trains a Byte-Pair Encoding (BPE) tokenizer (~65k token vocabulary) on raw text data, compressing text into numerical tokens.

2. **Pre-training (`base_train.py`)**:
   - **Corpus**: *FineWeb* (tens of billions of web tokens).
   - **Objective**: Minimize cross-entropy loss for next-token prediction.
   - **Architecture**: Causal Decoder-Only Transformer (defined in `gpt.py`).
   - **Output**: A "base" model possessing syntax and world knowledge, but unable to converse or follow instructions.

3. **Mid-training**:
   Intermediate stage exposing the base model to structured formats (conversations, tool-use syntax, code) to prepare weight representations for instruction tuning.

4. **Supervised Fine-Tuning - SFT (`chat_sft.py`)**:
   - **Corpus**: *SmolTalk* (curated conversation datasets).
   - **Objective**: Teaches the model chat multi-turn formatting, role usage (`user`, `assistant`, `system`), and conversational tone.

5. **Reinforcement Learning - RL (`chat_rl.py`)**:
   Behavioral alignment using RL algorithms (e.g., PPO / GRPO) on verifiable tasks (such as GSM8K math problems) to enhance reasoning.

6. **Inference Engine (`engine.py`, `chat_cli.py`)**:
   Optimized inference service featuring **KV-Cache** for interactive generation over CLI.

### 3.3 Scaling Hyperparameters: The `--depth` Dial
`nanochat` consolidates model configuration into a single hyperparameter dial: `--depth` (number of Transformer layers). All other variables (matrix width, learning rate, head count, batch size) scale automatically according to compute-optimal laws.

For fast local educational runs:
- `--depth=12` (runs in minutes on a single GPU or Apple Silicon Mac to observe loss convergence).

### 3.4 Hardware and Educational Constraints
- Training a usable speedrun model (~1.6B parameters equivalent) requires ~3 hours on an **8x NVIDIA H100** node (~$100).
- Injecting personal documents into the pre-training/mid-training mix will not create a reliable QA interface for those documents, as factual recall remains low and prone to hallucinations.

---

## 4. Architectural Comparison Matrix

| Feature / Metric | Solution A: `wiki-forge` + Local RAG | Solution B: From-Scratch `nanochat` Training |
| :--- | :--- | :--- |
| **Primary Goal** | Production Knowledge Management | Educational / LLM Architecture Research |
| **Core Technology** | RAG, Interlinked Markdown, `AGENT.md` | Transformer Pre-training, SFT, RL |
| **Knowledge Storage** | Non-parametric (external `wiki/` files) | Parametric (neural network weights `.pt`) |
| **Factual Precision** | High (direct citation of sources) | Low on details (prone to hallucination) |
| **Compute Cost** | Low (local inference on consumer GPU/Mac) | High (requires multi-GPU clusters for full runs) |
| **Data Ingestion** | Instant (add `.md` file and compile) | Slow (requires fine-tuning or full pre-training) |
| **Model Requirement** | Instruction-tuned model (7B+) | Custom model built during training |
| **Out-of-the-box in `wiki-forge`** | ✅ Native (`[agent.llm]` + agent server + Web UI) | ⬜ External repo (`nanochat`) |

---

## 5. Final Recommendation

1. To build a **queryable "LLM-Wiki" for personal documents**, use **Solution A**
   — it is already built into `wiki-forge`. Set `provider = "ollama"` in
   `config.toml` (or choose `anthropic` / `openai_compatible` / `opencode`),
   start the Web UI with `make ui-docker`, and use the `/compile`, `/consult`,
   `/audit`, `/trace`, and `/wizard` commands for compilation and RAG querying.
   Optionally add a local embedding model plus ChromaDB/LanceDB for vector
   retrieval on top of the compiled `wiki/` articles.
2. To **deepen your understanding of LLM engineering**, explore **Solution B** by running `nanochat` scripts (starting with `--depth=12`) to inspect tokenization, loss curves, and pre-training mechanics.
