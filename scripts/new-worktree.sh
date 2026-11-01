#!/usr/bin/env bash
# Makes a sibling worktree for a parallel agent: ../Larp-<name> on branch <branch>, off main, with .env linked.
# Usage: scripts/new-worktree.sh <name> <branch>
set -euo pipefail
cd "$(dirname "$0")/.."
name=$1 branch=$2 dir="../Larp-$name"
git worktree add -b "$branch" "$dir" main
ln -s "$(pwd)/.env" "$dir/.env"
(cd "$dir" && npm install --silent)
echo "ready: $dir ($branch)"
