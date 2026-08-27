# Technical Analysis and Usage Architectures: `wiki-forge` with Local LLMs and From-Scratch Training

This document analyzes the feasibility of integrating the **`wiki-forge`** project with small-scale language models (local LLMs or custom-trained models like Andrej Karpathy's **nanoGPT** / **nanochat**). It provides a theoretical analysis of the problem and details two architectural solutions:
- **Solution A (Production / Real-World Usability)**: Local RAG architecture with pre-trained LLMs and `wiki-forge`.
- **Solution B (Educational Purpose)**: *From-scratch* training pipeline with `nanochat` to understand the internal dynamics of an LLM.

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
3. **Wiki Compilation (`wiki-forge`)**:
   - Source conversion (PDF/EPUB/DOCX) via `conv2md.py` into `raw/`.
   - Local agent (via OpenCode, Claude Code, or an Ollama wrapper script) reads `AGENT.md` and executes the `compile` workflow to produce interlinked articles in `wiki/`.
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
| Ollama / Local   |  <---------------->  |  wiki/ (.md) |  <--- Compiled by Agent
| LLM (7B - 14B)   |  (OpenCode / CLI)    +--------------+
+------------------+                            |
        ^                                       v
        | Vector Search                 +---------------+
        +-----------------------------> | Vector DB     | (Chroma / LanceDB)
                                        +---------------+
```

### 2.3 Key Benefits of Solution A
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

---

## 5. Final Recommendation

1. To build a **queryable "LLM-Wiki" for personal documents**, implement **Solution A**. Use `wiki-forge` alongside Ollama (running a 7B-14B model like Qwen 2.5 or Llama 3.1) for compilation and RAG querying.
2. To **deepen your understanding of LLM engineering**, explore **Solution B** by running `nanochat` scripts (starting with `--depth=12`) to inspect tokenization, loss curves, and pre-training mechanics.
