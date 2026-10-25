# Keeping the project understandable

The owner follows this project through its documentation and commit history, rather than reading implementation code.

- Make focused commits as work becomes reviewable; do not bundle an entire work session into one commit.
- Use a plain-language title describing the feature, fix, or protection added. Avoid titles such as “updates,” “misc fixes,” or “WIP.”
- Explain why the change matters and what was tested in the commit body.
- Distinguish implemented code, locally tested behavior, and services actually deployed to AWS.
- Update `PROJECT_STATUS.md` and `CHANGELOG.md` when product capabilities or launch blockers change.
- Preserve existing history; do not squash or rewrite pushed commits unless explicitly requested.
- Never commit credentials, private guest links, customer records, generated dependencies, or local deployment caches.
