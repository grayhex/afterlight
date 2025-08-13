# Модель сущностей (черновик)

- User (owner, verifier, recipient roles)
- Vault (owner_id, title, description, quorum_n=2, quorum_m=3, hb_window_days=365)
- Verifier (user/email, status: invited/accepted/blocked)
- VerificationEvent (type: death/incapacitation, status, votes[], grace_until)
- Block (vault_id, title, encrypted_payload, is_public=false)
- Recipient (block_id, user/email)
- PublicLink (block_id, token, expires_at, captcha_required=true, noindex=true)
- AuditLog (actor, action, entity, time, ip, ua)
- HeartbeatEvent (user_id, last_login_at)

Связи: User 1—N Vault; Vault 1—N Block; Block N—M Recipient; Vault N—M Verifier; Vault 1—N VerificationEvent; Block 1—N PublicLink.
