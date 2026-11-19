# Security Specification — Portal Penilaian Madrasah Diniyah Ma'hadul Muta'allimin I

## 1. Data Invariants
1. **Default-Deny Catch-All**: Every path not explicitly matched is denied (`match /{document=**} { allow read, write: if false; }`).
2. **PII & Credential Isolation**:
   - `ustaz_public/{ustazId}` stores ONLY non-PII portal attributes (`name`, `isActive`, `linkedUid`).
   - `ustaz_private/{ustazId}` stores WhatsApp numbers and salted SHA-256 `pinHash` + `pinSalt` and is strictly restricted to `isAdmin()`.
   - `admin_security/{docId}` stores salted SHA-256 `passwordHash` + `passwordSalt` and is strictly restricted to `isAdmin()`.
3. **RBAC & Verified Auth**:
   - Every write requires `request.auth != null && request.auth.token.email_verified == true`.
   - `isAdmin()` validates `request.auth.token.email == 'aripsyaifudin11@gmail.com'` OR `exists(/databases/$(database)/documents/admins/$(request.auth.uid))`.
   - Non-admin users cannot self-assign admin privileges (`/admins/{uid}` is writable only by an existing admin).
4. **Assignment Ownership & Query Enforcement**:
   - `allow list` on `assignments` requires `isAdmin() || resource.data.assignedUid == request.auth.uid`.
   - Ustaz can only read/write grades under `assignments/{assignmentId}/grades/{studentId}` if the parent assignment's `assignedUid == request.auth.uid` (Master Gate via `get()`) AND the parent assignment is NOT locked (`status != 'terkunci'`).
5. **Terminal State Locking**:
   - Once an assignment reaches `status == 'terkunci'` (or `status == 'terkirim'`), non-admin users cannot update the assignment or any grade under it.
   - Only `isAdmin()` can unlock (`status: 'dalam_proses'`) and must record an immutable `grade_audit_logs` entry with `reason`.
6. **Immutable Audit Logs**:
   - `grade_audit_logs` allows create only when schema-valid and `changedById == request.auth.uid` (or admin), and strictly denies `update` and `delete`.
7. **Temporal & Structural Integrity**:
   - All `createdAt` on create and `updatedAt` on create/update must equal `request.time`.
   - All document IDs must satisfy `^[a-zA-Z0-9_\\-]+$` and length `<= 128`.
   - Every string field has strict `.size()` bounds; every array has `.size() <= 50`.
   - `score` in `grades` must be either `null` or `int`/`number` within `0 <= score <= 100`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Write**: `create` on `/students/s1` with `request.auth == null` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: `create` on `/settings/public` with `email == 'aripsyaifudin11@gmail.com'` and `email_verified == false` -> `PERMISSION_DENIED`.
3. **Self-Assigned Admin Privilege Escalation**: Non-admin user attempts `create` on `/admins/{myUid}` -> `PERMISSION_DENIED`.
4. **Shadow Ghost Field Injection**: Admin or Ustaz attempts `create` on `/students/s1` with extra key `isVerified: true` -> `PERMISSION_DENIED` (`hasOnly` check).
5. **ID Poisoning (1.5KB Document ID)**: Attempt `create` on `/students/{1500_char_id}` -> `PERMISSION_DENIED` (`isValidId` check).
6. **PII Leak (Read `ustaz_private` as Non-Admin)**: Authenticated non-admin attempts `get` or `list` on `/ustaz_private/u1` -> `PERMISSION_DENIED`.
7. **Cross-Ustaz Assignment Query**: Non-admin Ustaz A attempts `list` on `/assignments` without filtering to `assignedUid == request.auth.uid` -> `PERMISSION_DENIED`.
8. **Score Out of Bounds (> 100 or < 0)**: Ustaz attempts `set` on `/assignments/a1/grades/s1` with `score: 105` or `score: -5` -> `PERMISSION_DENIED`.
9. **Locked Assignment Tampering**: After assignment `a1` has `status: 'terkunci'`, Ustaz attempts `update` on `/assignments/a1/grades/s1` -> `PERMISSION_DENIED`.
10. **Status Shortcutting on Grade Update**: Ustaz attempts `update` on `/assignments/a1` setting `status: 'terkunci'` while changing `ustazId` to another ustaz -> `PERMISSION_DENIED` (`affectedKeys().hasOnly(...)` & immutable ownership).
11. **Timestamp Forgery**: Client sends `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> `PERMISSION_DENIED`.
12. **Audit Log Deletion / Tampering**: Even an Admin attempts `update` or `delete` on `/grade_audit_logs/log1` -> `PERMISSION_DENIED`.
