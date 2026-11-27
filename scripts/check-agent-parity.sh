#!/usr/bin/env sh

set -eu

fail() {
    echo "agent parity check failed: $*" >&2
    exit 1
}

ROLES="architect developer integrator reviewer"

for role in $ROLES; do
    for path in \
        ".agents/agents/$role.md" \
        ".opencode/agents/$role.md" \
        ".claude/agents/$role.md" \
        ".codex/agents/$role.toml"; do
        [ -f "$path" ] || fail "missing $path"
    done

    grep -q "^name: $role$" ".agents/agents/$role.md" || fail "Antigravity $role name mismatch"
    grep -q "^name: $role$" ".claude/agents/$role.md" || fail "Claude $role name mismatch"
    grep -q "^name = \"$role\"$" ".codex/agents/$role.toml" || fail "Codex $role name mismatch"
    grep -q "\`$role\`" AGENT_DIRECTORY.md || fail "$role is missing from the roster"
done

for path in .agents/agents/*.md .opencode/agents/*.md .claude/agents/*.md; do
    role=$(basename "$path" .md)
    case " $ROLES " in
        *" $role "*) ;;
        *) fail "unexpected role definition $path" ;;
    esac

    grep -q "graphify affected" "$path" || fail "$path lacks the graph-first rule"
    grep -qi "skill" "$path" || fail "$path has no skill coverage"
done

for path in .codex/agents/*.toml; do
    role=$(basename "$path" .toml)
    case " $ROLES " in
        *" $role "*) ;;
        *) fail "unexpected role definition $path" ;;
    esac

    grep -q "graphify affected" "$path" || fail "$path lacks the graph-first rule"
    grep -qi "skill" "$path" || fail "$path has no skill coverage"
done

for directory in .agents/skills/*/; do
    [ -d "$directory" ] || continue
    skill=$(basename "$directory")
    [ "$skill" = "graphify" ] && continue

    grep -qF "$skill" AGENT_DIRECTORY.md || fail "skill $skill is not documented in AGENT_DIRECTORY.md"
    grep -qF "$skill" SKILL.md || fail "skill $skill is not documented in SKILL.md"
done

for unsupported in .agent .continue .cursor .gemini .pi .roo .windsurf; do
    [ ! -e "$unsupported" ] || fail "unsupported agent platform directory: $unsupported"
done

echo "agents: 4 roles across OpenCode, Antigravity, Claude Code, and Codex"
