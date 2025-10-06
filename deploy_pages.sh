#!/usr/bin/env bash
# URL: (save in repository root as deploy_pages.sh)
set -euo pipefail

# Default config
TARGET="gh-pages"   # "gh-pages" or "docs"
BRANCH="main"
BUILD_DIR=""
NO_INSTALL=0
FORCE=0
REMOTE="origin"

usage() {
  cat <<EOF
Usage: $0 [--target gh-pages|docs] [--branch BRANCH] [--build-dir DIR] [--no-install] [--force]
Examples:
  $0                     # build and deploy to gh-pages from main
  $0 --target docs       # deploy build into docs/ on main
  $0 --build-dir build   # use explicit build directory
  $0 --no-install        # skip npm ci/install
EOF
  exit 1
}

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --build-dir) BUILD_DIR="$2"; shift 2 ;;
    --no-install) NO_INSTALL=1; shift ;;
    --force) FORCE=1; shift ;;
    -h|--help) usage ;;
    *) echo "Unknown arg: $1"; usage ;;
  esac
done

# Helpers
msg() { echo ">> $*"; }

# Ensure inside git repo
if [ ! -d .git ]; then
  msg "Error: script must be run from the repository root (where .git exists)."
  exit 2
fi

# Ensure branch exists & checkout
git fetch "$REMOTE" --prune
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  msg "Switching to branch $BRANCH"
  git checkout "$BRANCH"
fi

# Ensure working tree clean unless forced
if [ $FORCE -ne 1 ]; then
  if ! git diff --quiet || ! git diff --staged --quiet; then
    echo "Working tree is not clean. Commit or use --force to proceed." >&2
    exit 3
  fi
fi

# Install deps
if [ $NO_INSTALL -eq 0 ]; then
  if [ -f package-lock.json ]; then
    msg "Installing dependencies with npm ci"
    npm ci
  else
    msg "Installing dependencies with npm install"
    npm install
  fi
else
  msg "Skipping install ( --no-install )"
fi

# Run build
if jq -e .scripts.build package.json >/dev/null 2>&1; then
  msg "Running npm run build"
  npm run build
else
  msg "No 'build' script in package.json — skipping npm run build"
fi

# Auto-detect build directory if not provided
if [ -z "$BUILD_DIR" ]; then
  CANDIDATES=(dist build public out .output)
  for d in "${CANDIDATES[@]}"; do
    if [ -d "$d" ]; then
      BUILD_DIR="$d"
      break
    fi
  done
fi

if [ -z "$BUILD_DIR" ] || [ ! -d "$BUILD_DIR" ]; then
  echo "Build directory not found. Provide it with --build-dir or ensure build created one of: dist, build, public, out, .output" >&2
  exit 4
fi

msg "Using build directory: $BUILD_DIR"

# Deploy
if [ "$TARGET" = "docs" ]; then
  msg "Deploying to docs/ in branch $BRANCH"
  # Clean existing docs (keep .git)
  rm -rf docs || true
  mkdir -p docs
  cp -a "$BUILD_DIR"/. docs/
  git add docs
  git commit -m "chore(pages): deploy site to docs [automated]" || msg "No changes to commit"
  git push "$REMOTE" "$BRANCH"
  msg "Deployed to docs on branch $BRANCH"
  exit 0
fi

if [ "$TARGET" != "gh-pages" ]; then
  echo "Unknown target: $TARGET" >&2
  exit 5
fi

# Deploy to gh-pages using git worktree for atomic update
MSG="chore(pages): deploy to gh-pages [automated]"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Ensure gh-pages branch exists locally (create if necessary)
if git show-ref --verify --quiet refs/heads/gh-pages; then
  msg "gh-pages branch exists locally"
  git fetch "$REMOTE" gh-pages:gh-pages || true
else
  msg "Creating orphan gh-pages branch"
  git checkout --orphan gh-pages
  git rm -rf .
  git commit --allow-empty -m "chore(pages): init gh-pages branch"
  git push "$REMOTE" gh-pages
  git checkout "$BRANCH"
fi

msg "Preparing worktree at $TMPDIR"
git worktree add --detach "$TMPDIR" gh-pages

# Clean worktree and copy build there
msg "Cleaning worktree"
rm -rf "$TMPDIR"/* "$TMPDIR"/.[!.]* "$TMPDIR"/..?* || true
msg "Copying build files to worktree"
cp -a "$BUILD_DIR"/. "$TMPDIR"/

# Optional: create CNAME if you have custom domain - keep commented
# echo "example.com" > "$TMPDIR"/CNAME

cd "$TMPDIR"
git add --all
if git diff --cached --quiet; then
  msg "No changes to publish (gh-pages is up to date)"
else
  git commit -m "$MSG"
  msg "Pushing to $REMOTE/gh-pages"
  git push "$REMOTE" HEAD:gh-pages --force
fi

cd -
git worktree remove "$TMPDIR" --force || true
rm -rf "$TMPDIR"

msg "Published to gh-pages branch"
