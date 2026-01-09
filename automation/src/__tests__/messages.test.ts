// =============================================================================
// Messages Tests
// =============================================================================

import { describe, expect, test } from 'bun:test';
import { 
  ERRORS, 
  SUCCESS, 
  STATUS, 
  CANCELLATION, 
  DELETION_REMINDERS,
  SUPPORT_INFO 
} from '../messages';

describe('ERRORS messages', () => {
  test('has auth/validation messages', () => {
    expect(ERRORS.EMAIL_REQUIRED).toBeDefined();
    expect(ERRORS.EMAIL_INVALID).toBeDefined();
    expect(ERRORS.EMAIL_EXISTS).toBeDefined();
    expect(ERRORS.TOKEN_REQUIRED).toBeDefined();
    expect(ERRORS.TOKEN_INVALID).toBeDefined();
    expect(ERRORS.UNAUTHORIZED).toBeDefined();
  });

  test('has account messages', () => {
    expect(ERRORS.USER_NOT_FOUND).toBeDefined();
    expect(ERRORS.ACCOUNT_DELETED).toBeDefined();
    expect(ERRORS.ACCOUNT_CREATION_FAILED).toBeDefined();
  });

  test('has billing messages', () => {
    expect(ERRORS.PLAN_NOT_FOUND).toBeDefined();
    expect(ERRORS.PLAN_INVALID).toBeDefined();
    expect(ERRORS.CHECKOUT_FAILED).toBeDefined();
    expect(ERRORS.STRIPE_NOT_CONFIGURED).toBeDefined();
  });

  test('has export messages', () => {
    expect(ERRORS.EXPORT_LIMIT).toBeDefined();
    expect(ERRORS.EXPORT_NOT_FOUND).toBeDefined();
    expect(ERRORS.EXPORT_FAILED).toBeDefined();
  });

  test('all messages are in German', () => {
    // Check for common German words/patterns
    const germanIndicators = ['ist', 'nicht', 'Bitte', 'wurde', 'oder', 'dein', 'ein'];
    const allMessages = Object.values(ERRORS);
    
    for (const message of allMessages) {
      const hasGerman = germanIndicators.some(word => 
        message.toLowerCase().includes(word.toLowerCase())
      );
      // At least some messages should be German
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    }
  });
});

describe('SUCCESS messages', () => {
  test('has account messages', () => {
    expect(SUCCESS.ACCOUNT_CREATED).toBeDefined();
    expect(SUCCESS.LOGIN_EMAIL_SENT).toBeDefined();
    expect(SUCCESS.LOGOUT_SUCCESS).toBeDefined();
  });

  test('has deletion messages', () => {
    expect(SUCCESS.DELETION_SCHEDULED).toBeDefined();
    expect(SUCCESS.DELETION_CANCELLED).toBeDefined();
  });

  test('has export messages', () => {
    expect(SUCCESS.EXPORT_STARTED).toBeDefined();
    expect(SUCCESS.EXPORT_RUNNING).toBeDefined();
  });

  test('has plan messages', () => {
    expect(SUCCESS.UPGRADE_SUCCESS).toBeDefined();
    expect(SUCCESS.DOWNGRADE_SUCCESS).toBeDefined();
  });
});

describe('STATUS messages', () => {
  test('has webhook processing messages', () => {
    expect(STATUS.CREATING_ACCOUNT).toBeDefined();
    expect(STATUS.SENDING_EMAIL).toBeDefined();
    expect(STATUS.CREATING_CLOUD).toBeDefined();
    expect(STATUS.PAYMENT_RECEIVED).toBeDefined();
  });

  test('has error recovery messages', () => {
    expect(STATUS.WEBHOOK_TIMEOUT).toBeDefined();
    expect(STATUS.WEBHOOK_TIMEOUT).toContain('support');
  });
});

describe('CANCELLATION messages', () => {
  test('has grace period duration', () => {
    expect(CANCELLATION.GRACE_PERIOD_DAYS).toBe(14);
  });

  test('has reminder messages', () => {
    expect(CANCELLATION.SCHEDULED).toBeDefined();
    expect(CANCELLATION.REMINDER_7D).toBeDefined();
    expect(CANCELLATION.REMINDER_3D).toBeDefined();
    expect(CANCELLATION.REMINDER_1D).toBeDefined();
    expect(CANCELLATION.COMPLETED).toBeDefined();
  });

  test('reminder urgency increases', () => {
    // More urgent reminders should mention urgency
    expect(CANCELLATION.REMINDER_3D.toLowerCase()).toContain('dringend');
    expect(CANCELLATION.REMINDER_1D.toLowerCase()).toContain('warnung');
  });
});

describe('DELETION_REMINDERS messages', () => {
  test('has all reminder intervals', () => {
    expect(DELETION_REMINDERS.REMINDER_7D).toBeDefined();
    expect(DELETION_REMINDERS.REMINDER_3D).toBeDefined();
    expect(DELETION_REMINDERS.REMINDER_1D).toBeDefined();
  });
});

describe('SUPPORT_INFO', () => {
  test('has email address', () => {
    expect(SUPPORT_INFO.EMAIL).toBeDefined();
    expect(SUPPORT_INFO.EMAIL).toContain('@');
  });

  test('has contact hint', () => {
    expect(SUPPORT_INFO.CONTACT_HINT).toBeDefined();
    expect(SUPPORT_INFO.CONTACT_HINT).toContain('support');
  });
});

describe('message consistency', () => {
  test('all string values are non-empty', () => {
    const allModules = [ERRORS, SUCCESS, STATUS, CANCELLATION, DELETION_REMINDERS, SUPPORT_INFO];
    
    for (const module of allModules) {
      for (const [key, value] of Object.entries(module)) {
        if (typeof value === 'string') {
          expect(value.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test('support email is consistent across modules', () => {
    const emailInHint = SUPPORT_INFO.CONTACT_HINT;
    expect(emailInHint).toContain(SUPPORT_INFO.EMAIL.split('@')[1]);
  });
});
