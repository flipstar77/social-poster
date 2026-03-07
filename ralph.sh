#!/bin/bash
# Ralph Wiggum Loop - Simple Implementation
# Usage: bash ralph.sh

set -euo pipefail

MAX_ITERATIONS=30
ITERATION=0
PROMPT_FILE="RALPH_PROMPT.md"
SESSION_ID=""

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "ERROR: $PROMPT_FILE not found. Create it first."
  exit 1
fi

echo "========================================="
echo " Ralph Wiggum Loop"
echo " Max iterations: $MAX_ITERATIONS"
echo " Prompt: $PROMPT_FILE"
echo " Press Ctrl+C to stop"
echo "========================================="
echo ""

while [[ $ITERATION -lt $MAX_ITERATIONS ]]; do
  ITERATION=$((ITERATION + 1))
  echo ""
  echo "========================================="
  echo " RALPH ITERATION $ITERATION / $MAX_ITERATIONS"
  echo " $(date '+%Y-%m-%d %H:%M:%S')"
  echo "========================================="
  echo ""

  if [[ -z "$SESSION_ID" ]]; then
    # First iteration: start new session, capture session ID
    OUTPUT=$(claude --print --verbose -p "$(cat "$PROMPT_FILE")" 2>&1)
    # Try to extract session ID from verbose output
    SESSION_ID=$(echo "$OUTPUT" | grep -oP 'session[_-]?id["\s:=]+\K[a-f0-9-]+' || echo "")
    echo "$OUTPUT" | grep -v 'session_id'
  else
    # Continue existing session
    OUTPUT=$(claude --print --continue -p "$(cat "$PROMPT_FILE")" 2>&1)
    echo "$OUTPUT" | grep -v 'session_id'
  fi

  # Check for completion promise
  if echo "$OUTPUT" | grep -q '<promise>'; then
    PROMISE=$(echo "$OUTPUT" | grep -oP '<promise>\K[^<]+' || echo "")
    echo ""
    echo "========================================="
    echo " COMPLETION PROMISE DETECTED: $PROMISE"
    echo " Ralph loop finished at iteration $ITERATION"
    echo "========================================="
    exit 0
  fi

  echo ""
  echo "[Ralph] Iteration $ITERATION complete. Sleeping 5s before next..."
  sleep 5
done

echo ""
echo "========================================="
echo " MAX ITERATIONS ($MAX_ITERATIONS) REACHED"
echo " Ralph loop stopped."
echo "========================================="
