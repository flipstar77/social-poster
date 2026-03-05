#!/bin/bash
# Blog Pipeline Agent — Daily Article Generation
#
# Runs Claude Code with the 4-phase blog agent prompt.
# Schedule this with Windows Task Scheduler or cron for daily execution.
#
# Usage:
#   ./scripts/blog-agents/run.sh           # Run the full pipeline
#   ./scripts/blog-agents/run.sh --test    # Dry run (just research, no writing)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_DIR"

echo "========================================="
echo "  FlowingPost Blog Agent"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================="
echo ""

# Clean up previous pipeline data
rm -f data/pipeline/research.json
rm -f data/pipeline/draft.mdx
rm -f data/pipeline/seo-report.json
rm -f data/pipeline/publish-result.json

if [ "$1" = "--test" ]; then
  echo "[Test Mode] Running research phase only..."
  npx tsx scripts/blog-agents/helpers/research.ts
  echo ""
  echo "Research output:"
  cat data/pipeline/research.json | head -30
  exit 0
fi

# Run the full agent pipeline via Claude Code
PROMPT=$(cat scripts/blog-agents/prompt.md)

claude -p "$PROMPT

Start now. Run Phase 1 (Researcher), then Phase 2 (Writer), then Phase 3 (Curator), then Phase 4 (Publisher). Report each phase's result before moving to the next." \
  --allowedTools "Bash,Read,Write,Edit,Glob,Grep" \
  2>&1 | tee "data/pipeline/agent-log-$(date '+%Y%m%d').txt"

echo ""
echo "========================================="
echo "  Pipeline complete!"
echo "========================================="

# Show result if available
if [ -f data/pipeline/publish-result.json ]; then
  echo ""
  cat data/pipeline/publish-result.json
fi
