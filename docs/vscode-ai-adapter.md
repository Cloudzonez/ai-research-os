# VS Code AI Adapter Notes

This workspace disables VS Code's built-in AI/Copilot surface through `.vscode/settings.json`.

## What Is Disabled

- `chat.disableAIFeatures`: hides built-in AI features and disables Copilot extensions for this workspace.
- `chat.commandCenter.enabled`: removes the Chat menu from the title bar.
- `workbench.settings.showAISearchToggle`: hides AI search in settings.
- `github.copilot.enable`: disables Copilot suggestions if Copilot is still installed.

## Why Menus Need Command IDs

VS Code context-menu entries such as "Explain" and "Add to Chat" are not generic slots. They call command IDs contributed by the extension that owns them. To make Codex, OpenCode, or Claude Code handle those actions, you need the command IDs exposed by those extensions.

## How To Wire Other AI Extensions

1. Open VS Code Keyboard Shortcuts.
2. Search for `codex`, `opencode`, or `claude`.
3. Right-click the command you want.
4. Choose "Copy Command ID".
5. Open "Preferences: Open Keyboard Shortcuts (JSON)".
6. Copy entries from `.vscode/ai-keybindings-template.json`.
7. Replace each placeholder `command` with the real command ID.

Common mappings:

- Explain selected code: `ctrl+alt+e`
- Add selected code to chat: `ctrl+alt+c`
- Fix selected code: `ctrl+alt+f`
- Generate tests for selected code: `ctrl+alt+t`

## Limitation

Workspace settings can disable Microsoft/Copilot AI here, but VS Code does not let one extension automatically hijack another extension's context-menu entries. If an alternative AI extension does not contribute its own editor menu commands, use keybindings or a small bridge extension that calls that extension's command IDs.
