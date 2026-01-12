#!/usr/bin/env bash
# Render build script

set -o errexit  # Exit on error

echo "Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "Build complete!"
