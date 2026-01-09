# UX/Product Improvements Tracker

## Status Legend
- [ ] Not started
- [~] In progress
- [x] Completed

---

## P0 - Critical (User Data/Money at Risk)

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| 1 | Cancellation = immediate data loss | [~] | Added types, messages, need stripe.ts + email + shared-users |
| 2 | Payment failed email is empty | [ ] | Need CTA button, timeline, instructions |
| 3 | No webhook failure recovery | [ ] | Need timeout message on success page |
| 4 | Mixed language errors (DE/EN) | [~] | messages.ts created, need to integrate |

---

## P1 - High Priority

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| 5 | No deletion reminder emails (7d, 3d, 1d) | [ ] | Item #6 from user request |
| 6 | Export time expectations not set | [ ] | Update index.ts:574 message |
| 7 | i18n inconsistency | [ ] | Item #7 from user request |
| 8 | Portal token never expires after use | [ ] | Item #8 from user request |

---

## Current Session Progress

### Completed:
1. Created `/automation/src/messages.ts` with centralized German messages
2. Added `CANCELLATION` and `DELETION_REMINDERS` message constants
3. Updated `SharedUser` type with `cancellationScheduledAt` and `cancellationGracePeriodEnd` fields

### In Progress:
- P0 #1: Cancellation grace period implementation
  - [x] Update types.ts with new fields
  - [x] Update messages.ts with cancellation messages
  - [ ] Update stripe.ts to schedule cancellation instead of immediate migration
  - [ ] Add sendCancellationScheduledEmail to email.ts
  - [ ] Add sendCancellationReminderEmail to email.ts  
  - [ ] Add processScheduledCancellations to shared-users.ts
  - [ ] Add cron job or endpoint to process scheduled cancellations

### Next:
- P0 #2: Improve payment failed email
- P0 #3: Webhook timeout recovery UX
- P0 #4: Standardize error messages to German
- P1 #5: Deletion reminder emails
- P1 #7: i18n consistency
- P1 #8: Portal token single-use

---

## Files Modified

| File | Changes |
|------|---------|
| automation/src/types.ts | Added cancellation fields to SharedUser |
| automation/src/messages.ts | Added CANCELLATION, DELETION_REMINDERS constants |
| automation/src/stripe.ts | (pending) Grace period logic |
| automation/src/email.ts | (pending) Cancellation emails, improved payment failed |
| automation/src/shared-users.ts | (pending) Process scheduled cancellations |
| automation/src/index.ts | (pending) German error messages |
| web/src/app/success/page.tsx | (pending) Timeout fallback message |
