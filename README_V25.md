# SkillUp v25 — Telegram cloud synchronization (beta)

Deploy these files to the EXISTING frontend GitHub repository, replacing its old files. Deploy the updated API first.

The original v24 interface is unchanged. Cloud sync activates only when the app is opened from Telegram and Telegram provides signed `initData`. Plain web browser retains local-only mode.

Behavior: On first authenticated visit, existing server documents take precedence; if none exist, existing localStorage data is uploaded. Subsequent changes to development, finance operations and progress-history localStorage keys are saved to PostgreSQL. Server `revision` prevents silent overwrite on write conflicts. Changes on another device require reloading this app.

Limitations: Beta sync. It does NOT migrate all financial analysis/preferences or implement real PRO payment, server push, or AI. If another session changes the same document while open, sync pauses on conflict; reload to fetch the latest version. Do not clear browser storage before verifying data in Telegram.

API endpoint: https://skillup-api-production-3d6c.up.railway.app
