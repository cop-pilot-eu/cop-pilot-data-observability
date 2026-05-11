# Guide to run the project

## Setup

### Install uv

curl -LsSf https://astral.sh/uv/install.sh | sh

### Create venv

uv venv --python 3.11.9 .venv

### Install libs

uv pip install .
(or) uv pip install -e .

### Set pre-commit

pre-commit install

## Run service

### Run docker services

docker compose -p cop-pilot up -d

### Run fastapi

fastapi dev main.py

### Run calculate_stats

python calculate_stats.py inputs/dummy_context_data.csv inputs/dummy_reference_set.csv

## Docker

docker buildx build --platform=linux/amd64 -f Dockerfile -t cop-pilot-eu/cop-pilot-data-observability-analytics:0.1.0 --no-cache .
docker run --env-file .env --name cop-pilot-data-observability-analytics -p 8000:8000 cop-pilot-eu/cop-pilot-data-observability-analytics:0.1.0
docker push cop-pilot-eu/cop-pilot-data-observability-analytics:0.1.0
