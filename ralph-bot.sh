#!/bin/bash
# Ralph Wiggum Loop - Bot UI Redesign
# Usage: bash ralph-bot.sh

set -euo pipefail

MAX_ITERATIONS=30
ITERATION=0
PROMPT_FILE="RALPH_PROMPT_BOT.md"

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "ERROR: $PROMPT_FILE not found."
  exit 1
fi

echo "========================================="
echo " Ralph Wiggum Loop - BOT UI"
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

  if [[ $ITERATION -eq 1 ]]; then
    OUTPUT=$(claude --print -p "$(cat "$PROMPT_FILE")" 2>&1)
  else
    OUTPUT=$(claude --print --continue -p "$(cat "$PROMPT_FILE")" 2>&1)
  fi

  echo "$OUTPUT"

  # Check for completion promise
  if echo "$OUTPUT" | grep -q '<promise>'; then
    PROMISE=$(echo "$OUTPUT" | grep -oP '<promise>\K[^<]+' || echo "")
    echo ""
    echo "========================================="
    echo " DONE: $PROMISE"
    echo " Finished at iteration $ITERATION"
    echo "========================================="
    exit 0
  fi

  echo ""
  echo "[Ralph] Iteration $ITERATION done. Next in 5s..."
  sleep 5
done

echo ""
echo "========================================="
echo " MAX ITERATIONS ($MAX_ITERATIONS) REACHED"
echo "========================================="
