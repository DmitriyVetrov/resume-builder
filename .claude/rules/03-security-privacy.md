# Security and privacy

- Enforce owner authorization on every resume, photo, export and account-data operation.
- Never log resume body, contact details, passwords, tokens, photo bytes or export contents.
- Password storage must use a modern adaptive password hashing scheme; do not invent cryptography.
- Validate and re-encode uploaded images; strip EXIF metadata including GPS.
- Apply size/type limits and safe storage keys; do not trust client MIME types.
- Keep secrets outside the repository; `.env.example` contains placeholders only.
- GDPR requirements in source spec: EU data storage, account deletion, user data export, no third-party trackers in editor. EU *processing* is suspended for the MVP (ADR-012 Amendment 1): only CV import sends the extracted CV text to Anthropic (ADR-055); the file and photo never leave the browser.
- Threat-model authentication, guest-to-account claim, object storage access and export endpoints.
