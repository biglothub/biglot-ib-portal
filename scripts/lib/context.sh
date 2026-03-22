#!/bin/bash
# Context persistence between sessions — session-aware tracking
# Provides rich context for Claude's next invocation.

CONTEXT_FILE="$PROJECT_DIR/.dev-context.md"
SESSION_SHA_FILE="$PROJECT_DIR/.dev-session-sha"

init_context() {
    local current_sha
    current_sha=$(cd "$PROJECT_DIR" && git rev-parse HEAD 2>/dev/null || echo "unknown")
    echo "$current_sha" > "$SESSION_SHA_FILE"

    if [ ! -f "$CONTEXT_FILE" ]; then
        cat > "$CONTEXT_FILE" << 'EOF'
# Dev Context (auto-managed)

## Last Session
No previous session.

## Current Phase
BUILD

## Recent Issues
None.

## Page Verification
Not yet verified.

## Recently Modified Files
None.
EOF
    fi
}

update_context() {
    local task_id="$1"
    local phase="$2"
    local status="$3"
    local page_result="$4"
    local error_context="${5:-}"

    # Get session-relative info
    local session_sha
    session_sha=$(cat "$SESSION_SHA_FILE" 2>/dev/null || echo "HEAD~1")
    local recent_files
    recent_files=$(cd "$PROJECT_DIR" && git diff --name-only "$session_sha" HEAD 2>/dev/null | head -20 || echo "unknown")
    local commit_count
    commit_count=$(cd "$PROJECT_DIR" && git rev-list --count "$session_sha"..HEAD 2>/dev/null || echo "0")
    local recent_commits
    recent_commits=$(cd "$PROJECT_DIR" && git log --oneline "$session_sha"..HEAD 2>/dev/null | head -10)
    local uncommitted_diff
    uncommitted_diff=$(cd "$PROJECT_DIR" && git diff --stat 2>/dev/null | tail -5)

    cat > "$CONTEXT_FILE" << EOF
# Dev Context (auto-managed)
Updated: $(date '+%Y-%m-%d %H:%M:%S')

## Last Task
- Task: $task_id
- Phase: $phase
- Result: $status
- Time: $(date '+%H:%M')

## Session Stats
- Commits since start: $commit_count
- Files changed: $(echo "$recent_files" | grep -c '.' || echo "0")

## Recent Commits (this session)
$(if [ -n "$recent_commits" ]; then echo "$recent_commits" | sed 's/^/- /'; else echo "None."; fi)

## Uncommitted Changes
$(if [ -n "$uncommitted_diff" ]; then echo "$uncommitted_diff"; else echo "None."; fi)

$(if [ -n "$error_context" ]; then
cat << ERREOF
## Last Error (use this to avoid repeating the same mistake)
\`\`\`
$error_context
\`\`\`
ERREOF
fi)

## Page Verification
$(if [ "$page_result" = "true" ]; then echo "All pages OK"; elif [ "$page_result" = "unknown" ]; then echo "Not verified"; else echo "Some pages FAILED"; fi)

## Recently Modified Files
$(if [ -n "$recent_files" ]; then echo "$recent_files" | sed 's/^/- /'; else echo "None."; fi)
EOF
}

get_context() {
    if [ -f "$CONTEXT_FILE" ]; then
        cat "$CONTEXT_FILE"
    else
        echo "No previous context."
    fi
}
