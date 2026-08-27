# Makefile — convenience shortcuts (works on Linux/macOS).
# On Windows without `make`, use the equivalent commands shown in the README.
#
#   make convert          Convert sources -> raw/ (local Python + pandoc)
#   make convert-docker   Convert sources -> raw/ (Docker, no local install)
#   make build            Build the Docker image
#   make shell            Open a shell inside the Docker environment

convert:
	bash run_convert.sh

convert-docker:
	docker compose run --rm wiki convert

build:
	docker compose build

shell:
	docker compose run --rm wiki shell

.PHONY: convert convert-docker build shell
