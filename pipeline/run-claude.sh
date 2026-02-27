#!/bin/bash
# Wrapper to run claude -p outside of a Claude Code session
unset CLAUDECODE
exec claude "$@"
