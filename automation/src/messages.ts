// =============================================================================
// Centralized User-Facing Messages (German - Swiss Market)
// =============================================================================
// All user-facing messages should be in German for consistency.
// Internal/admin messages can remain in English.

export const ERRORS = {
  // Auth & Validation
  EMAIL_REQUIRED: 'E-Mail-Adresse ist erforderlich.',
  EMAIL_INVALID: 'Ungültige E-Mail-Adresse.',
  EMAIL_EXISTS: 'Diese E-Mail-Adresse ist bereits registriert. Bitte melde dich an.',
  TOKEN_REQUIRED: 'Token ist erforderlich.',
  TOKEN_INVALID: 'Ungültiger oder abgelaufener Link. Bitte fordere einen neuen Login-Link an.',
  UNAUTHORIZED: 'Nicht autorisiert.',
  
  // Account
  USER_NOT_FOUND: 'Benutzer nicht gefunden.',
  ACCOUNT_DELETED: 'Dieses Konto wurde gelöscht.',
  ACCOUNT_CREATION_FAILED: 'Konto konnte nicht erstellt werden. Bitte versuche es später erneut.',
  SESSION_CREATION_FAILED: 'Sitzung konnte nicht erstellt werden. Bitte versuche es erneut.',
  
  // Plans & Billing
  PLAN_NOT_FOUND: 'Plan nicht erkannt. Bitte kontaktiere support@sphoto.arturf.ch',
  PLAN_INVALID: 'Ungültiger Plan. Muss "basic" oder "pro" sein.',
  ALREADY_ON_PLAN: 'Du bist bereits auf diesem Plan.',
  CHECKOUT_FAILED: 'Checkout konnte nicht gestartet werden. Bitte versuche es später erneut.',
  STRIPE_NOT_CONFIGURED: 'Zahlungssystem nicht konfiguriert.',
  BILLING_SESSION_FAILED: 'Abrechnungssitzung konnte nicht erstellt werden.',
  NO_BILLING_ACCOUNT: 'Kein Abrechnungskonto verknüpft.',
  
  // Subscription
  SUBSCRIPTION_CANCELLED: 'Dein Abo wurde gekündigt.',
  PAYMENT_FAILED: 'Die letzte Zahlung ist fehlgeschlagen.',
  
  // Export
  EXPORT_LIMIT: 'Du kannst nur einmal pro Monat einen Export anfordern.',
  EXPORT_NOT_FOUND: 'Export nicht gefunden.',
  EXPORT_FAILED: 'Export konnte nicht gestartet werden.',
  
  // Deletion
  DELETION_NOT_PENDING: 'Konto ist nicht zur Löschung vorgemerkt.',
  DELETION_ALREADY_REQUESTED: 'Löschung wurde bereits angefordert.',
  
  // Subdomain
  SUBDOMAIN_NOT_AVAILABLE: 'Subdomain nicht verfügbar.',
  
  // Portal
  PORTAL_ONLY_SHARED: 'Portal ist nur im Shared-Modus verfügbar.',
  FREE_TIER_ONLY_SHARED: 'Free-Tier ist nur im Shared-Modus verfügbar.',
  
  // Generic
  GENERIC_ERROR: 'Ein Fehler ist aufgetreten. Bitte versuche es später erneut.',
  NOT_FOUND: 'Nicht gefunden.',
};

export const SUCCESS = {
  // Account
  ACCOUNT_CREATED: 'Konto erstellt! Prüfe deine E-Mails für die Login-Daten.',
  LOGIN_EMAIL_SENT: 'Falls dein Konto existiert, haben wir dir einen Login-Link per E-Mail geschickt.',
  LOGIN_EMAIL_HINT: 'Der Link ist 24 Stunden gültig und kann nur einmal verwendet werden.',
  LOGOUT_SUCCESS: 'Erfolgreich abgemeldet.',
  
  // Deletion
  DELETION_SCHEDULED: 'Kontolöschung geplant.',
  DELETION_CANCELLED: 'Kontolöschung abgebrochen.',
  
  // Export
  EXPORT_STARTED: 'Export gestartet. Je nach Datenmenge kann dies einige Minuten bis Stunden dauern. Du erhältst eine E-Mail, sobald der Download bereit ist.',
  EXPORT_RUNNING: 'Export läuft bereits.',
  
  // Plan
  UPGRADE_SUCCESS: 'Upgrade erfolgreich!',
  DOWNGRADE_SUCCESS: 'Downgrade erfolgreich.',
  
  // Email
  EMAIL_SENT: 'E-Mail wurde gesendet.',
};

export const STATUS = {
  // Webhook processing status
  CREATING_ACCOUNT: 'Erstelle deinen Account...',
  SENDING_EMAIL: 'Sende Willkommens-E-Mail...',
  CREATING_CLOUD: 'Erstelle deine Cloud...',
  STARTING_CONTAINERS: 'Container werden gestartet...',
  WAITING_SSL: 'Warte auf SSL-Zertifikat...',
  PAYMENT_RECEIVED: 'Zahlung erhalten, erstelle Cloud...',
  WAITING_PAYMENT: 'Warte auf Zahlung...',
  SESSION_NOT_FOUND: 'Sitzung nicht gefunden.',
  
  // Webhook errors with recovery
  WEBHOOK_TIMEOUT: 'Die Einrichtung dauert länger als erwartet. Keine Sorge – deine Zahlung wurde empfangen. Falls du in 15 Minuten keine Willkommens-E-Mail erhältst, kontaktiere support@sphoto.arturf.ch',
};

export const CANCELLATION = {
  GRACE_PERIOD_DAYS: 14,
  SCHEDULED: 'Dein Abo wurde gekündigt. Du hast noch 14 Tage Zugriff auf deine Fotos.',
  REMINDER_7D: 'Erinnerung: In 7 Tagen wird dein Konto auf den Free-Plan umgestellt. Sichere jetzt deine Fotos!',
  REMINDER_3D: 'Dringend: In 3 Tagen wird dein Konto auf den Free-Plan umgestellt. Sichere deine Fotos, bevor sie gelöscht werden!',
  REMINDER_1D: 'Letzte Warnung: Morgen wird dein Konto auf den Free-Plan umgestellt. Deine Fotos werden dann gelöscht!',
  COMPLETED: 'Dein Konto wurde auf den Free-Plan umgestellt. Alle bisherigen Fotos wurden gelöscht.',
};

export const DELETION_REMINDERS = {
  REMINDER_7D: 'Erinnerung: In 7 Tagen wird dein Konto endgültig gelöscht.',
  REMINDER_3D: 'Dringend: In 3 Tagen wird dein Konto endgültig gelöscht.',
  REMINDER_1D: 'Letzte Warnung: Morgen wird dein Konto endgültig gelöscht.',
};

export const SUPPORT_INFO = {
  EMAIL: 'support@sphoto.arturf.ch',
  CONTACT_HINT: 'Kontaktiere uns unter support@sphoto.arturf.ch',
};
