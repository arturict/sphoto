// SwissPhoto Branding Configuration
export const SWISSPHOTO_CONFIG = {
  // Brand
  name: 'SwissPhoto',
  tagline: 'Sichere Foto-Speicherung aus der Schweiz',
  domain: 'swissphoto.ch',
  
  // Pricing (CHF)
  plans: [
    { name: 'Basic', storage: 100, price: 3, popular: false },
    { name: 'Standard', storage: 200, price: 5, popular: true },
    { name: 'Pro', storage: 500, price: 7, popular: false },
    { name: 'Power', storage: 1000, price: 12, popular: false },
  ],
  extraTbPrice: 12,
  
  // Features
  features: {
    backup: false,  // No backup included (budget option)
    ml: true,       // Machine learning enabled
    sharing: true,  // Photo sharing enabled
    api: true,      // API access enabled
  },
  
  // Legal
  company: {
    name: 'SwissPhoto',
    country: 'Schweiz',
    dataLocation: 'Schweiz',
  },
  
  // Support
  support: {
    email: 'support@swissphoto.ch',
  },
  
  // Disclaimer
  disclaimer: `
    ⚠️ WICHTIG: SwissPhoto ist ein Budget-Dienst ohne Backup!
    Deine Daten werden auf einem privaten Homelab-Server gespeichert.
    Wir empfehlen dringend, eigene Backups zu erstellen.
    Bei Datenverlust übernehmen wir keine Haftung.
  `,
};

export default SWISSPHOTO_CONFIG;
