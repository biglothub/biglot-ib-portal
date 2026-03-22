#!/bin/bash
# Git checkpoint/rollback — safety net for each task
# Creates a checkpoint before Claude runs, rolls back if health gates fail.

CHECKPOINT_REF=""
CHECKPOINT_TYPE=""  # "stash" or "tag"

create_checkpoint() {
    local task_id="$1"
    local checkpoint_name="auto-dev-checkpoint-${task_id}-$(date +%s)"

    # Check if working tree has changes
    if ! (cd "$PROJECT_DIR" && git diff --quiet && git diff --cached --quiet); then
        # Dirty tree: use stash
        if (cd "$PROJECT_DIR" && git stash push -m "$checkpoint_name" --include-untracked 2>/dev/null); then
            CHECKPOINT_REF="$checkpoint_name"
            CHECKPOINT_TYPE="stash"
            log "Checkpoint: stashed as '$checkpoint_name'"
        else
            log "WARNING: Failed to create stash checkpoint"
            CHECKPOINT_REF=""
            CHECKPOINT_TYPE=""
        fi
    else
        # Clean tree: use lightweight tag
        if (cd "$PROJECT_DIR" && git tag "$checkpoint_name" 2>/dev/null); then
            CHECKPOINT_REF="$checkpoint_name"
            CHECKPOINT_TYPE="tag"
            log "Checkpoint: tagged as '$checkpoint_name'"
        else
            log "WARNING: Failed to create tag checkpoint"
            CHECKPOINT_REF=""
            CHECKPOINT_TYPE=""
        fi
    fi
}

rollback_to_checkpoint() {
    if [ -z "$CHECKPOINT_REF" ]; then
        log "WARNING: No checkpoint to rollback to"
        return 1
    fi

    log "Rolling back to checkpoint '$CHECKPOINT_REF'..."

    case "$CHECKPOINT_TYPE" in
        stash)
            # Find the stash index by message
            local stash_index
            stash_index=$(cd "$PROJECT_DIR" && git stash list | grep "$CHECKPOINT_REF" | head -1 | cut -d: -f1)
            if [ -n "$stash_index" ]; then
                # First discard any changes Claude made
                (cd "$PROJECT_DIR" && git checkout -- . && git clean -fd 2>/dev/null)
                # Then restore the stash
                (cd "$PROJECT_DIR" && git stash pop "$stash_index" 2>/dev/null)
                log "Rollback: restored stash '$CHECKPOINT_REF'"
            else
                log "WARNING: Stash '$CHECKPOINT_REF' not found"
                return 1
            fi
            ;;
        tag)
            # Reset to the tagged commit, discard all changes since
            (cd "$PROJECT_DIR" && git reset --hard "$CHECKPOINT_REF" 2>/dev/null)
            (cd "$PROJECT_DIR" && git tag -d "$CHECKPOINT_REF" 2>/dev/null)
            log "Rollback: reset to tag '$CHECKPOINT_REF'"
            ;;
        *)
            log "WARNING: Unknown checkpoint type '$CHECKPOINT_TYPE'"
            return 1
            ;;
    esac

    CHECKPOINT_REF=""
    CHECKPOINT_TYPE=""
    return 0
}

clear_checkpoint() {
    if [ -z "$CHECKPOINT_REF" ]; then
        return 0
    fi

    case "$CHECKPOINT_TYPE" in
        stash)
            local stash_index
            stash_index=$(cd "$PROJECT_DIR" && git stash list | grep "$CHECKPOINT_REF" | head -1 | cut -d: -f1)
            if [ -n "$stash_index" ]; then
                (cd "$PROJECT_DIR" && git stash drop "$stash_index" 2>/dev/null)
            fi
            ;;
        tag)
            (cd "$PROJECT_DIR" && git tag -d "$CHECKPOINT_REF" 2>/dev/null)
            ;;
    esac

    log "Checkpoint cleared: $CHECKPOINT_REF"
    CHECKPOINT_REF=""
    CHECKPOINT_TYPE=""
}
