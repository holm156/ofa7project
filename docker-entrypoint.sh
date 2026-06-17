#!/bin/sh
set -e

echo "Waiting for database to be ready..."
# Attempt to connect to database for up to 30 seconds
RETRY_COUNT=0
while ! npx prisma@5.19.1 db push --skip-generate > /dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT+1))
  if [ $RETRY_COUNT -gt 30 ]; then
    echo "Error: Database is not responding after 30 seconds."
    exit 1
  fi
  echo "Database not ready yet... retrying ($RETRY_COUNT/30)"
  sleep 2
done

echo "Database schema pushed successfully!"

echo "Starting Next.js server..."
exec node server.js
