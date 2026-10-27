# apps/admin-web rules

Same rules as `apps/clinic-web/CLAUDE.md` (read it), plus:
- This console is for platform staff only (Super Admin, Internal Admin). Platform roles see patient fields masked unless a support session is active; the UI must show a clear "support session active, expires at ..." banner and never cache unmasked data after it ends.
- Every destructive or sensitive action (deactivate clinic, reset password, start support session) asks for confirmation and a reason where the API requires one.
- Show integration health (failed webhooks, failed jobs, provider errors) with the request ID so support can trace logs.
- Skills: `frontend-react-standards`, `ui-design-system`, `tenant-security-phi`.
