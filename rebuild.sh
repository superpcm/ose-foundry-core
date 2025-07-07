#!/bin/bash
#
# This script automates the process of rebuilding the system and restarting
# the application server. It ensures that the server is only restarted if
# the build process completes successfully.

set -e

echo "Ensuring dependencies are up to date..."
npm install

echo "Building the system..."
npm run build

echo "Build complete. Restarting the application..."
pm2 restart narlington