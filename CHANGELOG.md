# Changelog

All notable changes to this project are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] - 2026-05-26

### Changed

- Align default state resolution with `cursor-goal@0.3.2`: state now lives under the user state directory by default.
- Keep legacy workspace `.goal/` state available with `--state-dir .goal`, `GOAL_STATE_SCOPE=workspace`, or `CURSOR_GOAL_STATE_SCOPE=workspace`.
- Ship `@nikomohr/goal-cli` with the `goal` binary only, avoiding collision with the standalone `cursor-goal` package.

### Added

- `goal --json` and `goal status --json` expose raw state for Pi and other wrapper integrations.
- Plugin hook smoke script for release verification without a live LLM run.
