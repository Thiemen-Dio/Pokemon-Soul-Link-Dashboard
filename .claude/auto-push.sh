#!/usr/bin/env bash
# Runs after each Claude reply: commits any changed files and pushes to GitHub
# (so graphify always sees the latest code). Log: .git/auto-push.log
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}" || exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
exec >>.git/auto-push.log 2>&1
echo "== $(date '+%F %T')"

git add -A
git diff --cached --quiet && { echo "no changes"; exit 0; }

# Safety net on top of .gitignore: never commit env files.
if git diff --cached --name-only | grep -qE '(^|/)\.env($|\.)'; then
  echo "refusing: .env file staged"; git reset -q; exit 0
fi

files=$(git diff --cached --name-only | head -5 | paste -sd ',' - | sed 's/,/, /g')
git commit -q -m "Auto-update: $files" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"

export GIT_TERMINAL_PROMPT=0
if ! git push -q origin main; then
  # GitHub has newer commits (e.g. from Finn): replay ours on top and retry.
  git pull -q --rebase origin main || { git rebase --abort; echo "pull failed, left commit local"; exit 0; }
  git push -q origin main || echo "push failed, left commit local"
fi
echo "pushed $(git rev-parse --short HEAD)"
