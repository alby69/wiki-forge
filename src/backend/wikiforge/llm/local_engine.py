"""Lazy llama-cpp reasoning engine with streaming token generation."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Iterator

DEFAULT_SYSTEM_PROMPT = (
    "Sei un esperto Knowledge Engineer e revisore accademico. "
    "Usa sempre un blocco <think>...</think> per analizzare passo per passo la coerenza logica, "
    "i wikilink e le fonti. Dopo </think> restituisci solo la risposta finale richiesta in Markdown. "
    "Non inventare fonti o collegamenti assenti dal contesto."
)


class LocalReasoningError(RuntimeError):
    """Raised when the local GGUF model cannot be configured or invoked."""


class LocalReasoningEngine:
    def __init__(
        self,
        config: dict[str, Any] | None = None,
        repo_root: Path | str | None = None,
    ) -> None:
        self.config = dict(config or {})
        self.repo_root = Path(repo_root).resolve() if repo_root else Path.cwd().resolve()
        self.enabled = bool(self.config.get("enabled", False))
        self.model_path = self._resolve_model_path()
        self.n_ctx = int(self.config.get("n_ctx", 8192))
        self.n_threads = int(self.config.get("n_threads", 8))
        self.n_batch = int(self.config.get("n_batch", 512))
        self.temperature = float(self.config.get("temperature", 0.2))
        self._llm: Any | None = None

    def _resolve_model_path(self) -> Path:
        raw = str(self.config.get("model_path", "") or "")
        if not raw:
            return self.repo_root / "models" / "model.gguf"
        candidate = Path(raw).expanduser()
        return candidate.resolve() if candidate.is_absolute() else (self.repo_root / candidate).resolve()

    def _load_model(self) -> Any:
        if self._llm is not None:
            return self._llm
        if not self.enabled:
            raise LocalReasoningError("Il provider LLM locale non è abilitato in config.toml.")
        if not self.model_path.is_file():
            raise LocalReasoningError(
                f"File GGUF del modello non trovato: {self.model_path}. "
                "Scarica un modello quantizzato Q4_K_M e aggiorna [llm.local].model_path."
            )
        try:
            from llama_cpp import Llama
        except ImportError as exc:
            raise LocalReasoningError(
                "llama-cpp-python non è installato. Esegui 'pip install -r requirements.txt'."
            ) from exc

        try:
            self._llm = Llama(
                model_path=str(self.model_path),
                n_ctx=self.n_ctx,
                n_threads=self.n_threads,
                n_batch=self.n_batch,
                n_gpu_layers=0,
                verbose=False,
            )
        except Exception as exc:
            raise LocalReasoningError(
                f"Impossibile inizializzare il modello locale {self.model_path}: {exc}"
            ) from exc
        return self._llm

    def build_prompt(self, prompt: str, context: str | None = None) -> str:
        if not context:
            return prompt.strip()
        return f"Contesto:\n{context.strip()}\n\nRichiesta:\n{prompt.strip()}".strip()

    def generate_stream(self, prompt: str, max_tokens: int = 512, context: str | None = None) -> Iterator[str]:
        llm = self._load_model()
        messages = [
            {"role": "system", "content": DEFAULT_SYSTEM_PROMPT},
            {"role": "user", "content": self.build_prompt(prompt, context)},
        ]
        try:
            stream = llm.create_chat_completion(
                messages=messages,
                max_tokens=max(1, int(max_tokens)),
                temperature=self.temperature,
                stream=True,
            )
            for chunk in stream:
                choices = chunk.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta") or {}
                token = delta.get("content") or ""
                if token:
                    yield token
        except LocalReasoningError:
            raise
        except Exception as exc:
            raise LocalReasoningError(f"Errore durante la generazione locale: {exc}") from exc


def build_review_prompt(note_content: str, focus: str = "", instructions: str = "") -> str:
    parts = [
        "Sei un esperto Knowledge Engineer. Valuta la seguente nota secondo lo standard OKF v0.2.",
        f"Nota:\n{note_content}",
        "Istruzioni:",
        "1. Usa il tag <think> per analizzare passo dopo passo la coerenza logica, i wikilink e le fonti.",
        "2. Dopo </think>, fornisci la tua critica strutturata in Markdown.",
    ]
    if focus:
        parts.append(f"Focus richiesto: {focus}.")
    if instructions:
        parts.append(f"Istruzioni aggiuntive: {instructions}")
    return "\n\n".join(parts)
