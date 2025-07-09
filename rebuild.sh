#!/bin/bash
#
# This script automates the process of rebuilding and restarting the application.
# It ensures that the application is only restarted if the build process completes successfully.

# Exit immediately if a command exits with a non-zero status.
# This prevents the 'pm2 restart' from running if 'npm run build' fails.
set -e

# --- Build Step ---
echo "Building project... (npm run build)"
npm run build
echo "Build complete."

# --- Restart Step ---
echo "Restarting PM2 process 'narlington'..."
pm2 restart narlington
echo "Application 'narlington' has been successfully restarted."
