#!/bin/bash
# Context persistence between sessions

CONTEXT_FILE="$PROJECT_DIR/.dev-context.md"

init_context() {
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

    # Get recently modified files from git
    local recent_files
    recent_files=$(cd "$PROJECT_DIR" && git diff --name-only HEAD~1 2>/dev/null | head -10 || echo "unknown")

    cat > "$CONTEXT_FILE" << EOF
# Dev Context (auto-managed)
Updated: $(date '+%Y-%m-%d %H:%M:%S')

## Last Session
- Task: $task_id
- Phase: $phase
- Result: $status
- Time: $(date '+%H:%M')

## Current Phase
$phase

## Recent Issues
$(if [ "$status" = "failure" ]; then echo "- Task $task_id failed"; else echo "None."; fi)
$(if [ "$page_result" = "false" ]; then echo "- Some pages failed verification"; fi)

## Page Verification
$(if [ "$page_result" = "true" ]; then echo "All pages OK"; else echo "Some pages FAILED - check dev server"; fi)

## Recently Modified Files
$(echo "$recent_files" | sed 's/^/- /')
EOF
}

get_context() {
    if [ -f "$CONTEXT_FILE" ]; then
        cat "$CONTEXT_FILE"
    else
        echo "No previous context."
    fi
}
