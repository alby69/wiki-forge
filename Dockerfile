# Dockerfile — reproducible environment for the LLM Wiki converter.
#
# What it installs:
#   * Python 3.12 (slim Debian)
#   * pandoc  (system package, for .docx / .epub)
#   * pymupdf4llm (pip, for .pdf)
#
# The project directory is mounted at /wiki at runtime (see docker-compose.yml),
# so your sources and outputs stay on the host machine — the container is
# stateless and only provides the toolchain.
FROM python:3.12-slim

# Install pandoc (no recommended packages, keep the image small).
RUN apt-get update \
    && apt-get install -y --no-install-recommends pandoc build-essential cmake \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /wiki

RUN useradd --uid 10001 --create-home node \
    && mkdir -p /wiki/output /wiki/raw /wiki/projects /wiki/.wiki-forge/state \
    && chown -R node:node /wiki/output /wiki/raw /wiki/projects /wiki/.wiki-forge

# Install Python dependencies first (better layer caching).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

USER node

# Copy the converter and helpers (the rest is mounted from the host).
COPY scripts/conv2md.py entrypoint.sh ./
COPY config/ config/

# Run via `sh` so we don't depend on the exec bit (which Windows may strip).
# Dispatch subcommands: `convert` runs conv2md, `shell` drops into a prompt.
ENTRYPOINT ["sh", "/wiki/entrypoint.sh"]
CMD ["shell"]
