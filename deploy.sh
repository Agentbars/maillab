#!/bin/bash
set -e

cd /docker/maillab

echo "Pulling latest code..."
git pull origin master

echo "Building and restarting containers..."
docker compose -f docker-compose.prod.yml up -d --build

echo "Deploy complete!"
