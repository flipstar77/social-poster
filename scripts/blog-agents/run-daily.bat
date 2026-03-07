@echo off
REM Blog Agent — Daily Scheduled Task
REM Runs the 4-phase blog pipeline via Claude Code CLI
REM Scheduled via Windows Task Scheduler at 06:00 daily

cd /d "C:\Users\Tobias\social-poster"

REM Log start
echo ========================================= >> "data\pipeline\scheduler-log.txt"
echo   Blog Agent started: %date% %time% >> "data\pipeline\scheduler-log.txt"
echo ========================================= >> "data\pipeline\scheduler-log.txt"

REM Clean previous pipeline data
del /q "data\pipeline\research.json" 2>nul
del /q "data\pipeline\draft.mdx" 2>nul
del /q "data\pipeline\seo-report.json" 2>nul
del /q "data\pipeline\publish-result.json" 2>nul

REM Read the prompt file and run Claude Code
set /p NUL=<nul
call claude -p "Read the file scripts/blog-agents/prompt.md for your instructions. Then execute all 4 phases: Phase 1 (run research.ts), Phase 2 (write the article yourself), Phase 3 (run check-seo.ts and fix issues), Phase 4 (run publish.ts and git commit). Report each phase result." --allowedTools "Bash,Read,Write,Edit,Glob,Grep" >> "data\pipeline\scheduler-log.txt" 2>&1

echo Pipeline finished: %date% %time% >> "data\pipeline\scheduler-log.txt"
