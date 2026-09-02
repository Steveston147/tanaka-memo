# Tanaka External Memory

This directory is designed as a long-term external memory store that ChatGPT can search and read when needed.

## Purpose

- Keep long-term context outside ChatGPT memory.
- Preserve decisions, rationale, project status, and working principles.
- Allow selective retrieval instead of loading everything into every conversation.
- Keep a durable history through Git.

## Operating model

1. ChatGPT memory stores only stable preferences and high-level pointers.
2. This repository stores durable, non-sensitive working knowledge.
3. Microsoft 365 or other approved systems remain the system of record for official documents and personal data.
4. ChatGPT retrieves only the relevant files when the user refers to a project, decision, or prior context.

## Safety boundary

Do not store student personal data, passport data, health information, passwords, secrets, authentication tokens, or confidential personnel information here.

This repository should be private before real personal or internal working memory is added.

## Structure

- `INDEX.md` — retrieval map and current-memory overview
- `work/` — principles, staffing, recurring operating rules
- `programs/` — programme summaries and current status
- `dx/` — architecture, AI rules, project decisions
- `personal/` — optional non-sensitive personal planning
- `decisions/` — concise decision log
- `archive/` — completed or superseded context
- `_templates/` — templates for consistent updates

## Retrieval convention

When asked about a prior decision or project, ChatGPT should first search this repository by project name, programme name, date, or decision keyword, then fetch the smallest relevant file or section.

## Update convention

Keep current-state files short. Move outdated detail to `archive/` rather than allowing active files to grow indefinitely.
