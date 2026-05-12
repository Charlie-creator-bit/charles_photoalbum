# Security Specification - Memora

## 1. Data Invariants
- **Owner-Only Access**: All data (albums and photos) is private to the user who created it. No public sharing in this version.
- **Relational Integrity**: A photo can optionally belong to an album. If an `albumId` is provided, the album must exist and belong to the same user.
- **Immutable Fields**: `userId` and `createdAt` cannot be changed after creation.
- **Strict Format**: URLs must be valid URIs. Titles and descriptions have size limits.

## 2. The "Dirty Dozen" Payloads

1. **Payload 01: Shadow Admin Update**
   - Attempt: `update` photo with `{ "isAdmin": true }`
   - Expect: `PERMISSION_DENIED` (affectedKeys().hasOnly() violation)

2. **Payload 02: Resource Poisoning**
   - Attempt: `create` photo with `title` of size 2MB.
   - Expect: `PERMISSION_DENIED` (size enforcement)

3. **Payload 03: Identity Spoofing**
   - Attempt: `create` photo with `userId: "OTHER_USER_ID"`
   - Expect: `PERMISSION_DENIED` (auth.uid match violation)

4. **Payload 04: Orphaned Photo**
   - Attempt: `create` photo with `albumId: "NON_EXISTENT_ID"`
   - Expect: `PERMISSION_DENIED` (relational exists() check if albumId provided)

5. **Payload 05: Timestamp Manipulation**
   - Attempt: `create` photo with `createdAt: "2000-01-01"`
   - Expect: `PERMISSION_DENIED` (server timestamp violation)

6. **Payload 06: Cross-User Read**
   - Attempt: `get` a photo document belonging to another user.
   - Expect: `PERMISSION_DENIED` (resource.data.userId != request.auth.uid)

7. **Payload 07: Bulk Scraping**
   - Attempt: `list` all photos without a user filter.
   - Expect: `PERMISSION_DENIED` (Insecure list query guard)

8. **Payload 08: Missing Required Key**
   - Attempt: `create` photo without `url`.
   - Expect: `PERMISSION_DENIED` (Schema violation)

9. **Payload 09: Immortality Breach**
   - Attempt: `update` a photo's `userId`.
   - Expect: `PERMISSION_DENIED` (Immutable field check)

10. **Payload 10: State Shortcut**
    - Attempt: No status field yet, but if I added `isDeleted`, skip logic... N/A yet, but placeholder.

11. **Payload 11: Tag Explosion**
    - Attempt: `create` photo with 10,000 tags.
    - Expect: `PERMISSION_DENIED` (Tag array size limit)

12. **Payload 12: Invalid ID Ingestion**
    - Attempt: `set` doc at `photos/!!!!INVALID!!!!`
    - Expect: `PERMISSION_DENIED` (isValidId regex match)

## 3. Test Runner Concept
The `firestore.rules.test.ts` will verify these payloads.
