export const MERCHANTS = {
  keychron_in: {
    id: 'keychron_in',
    name: 'Keychron India Official',
    domain: 'keychron.in',
    rating: 4.8,
    trustScore: 0.98,
    isAuthorized: true,
    verifiedMerchantBadge: true
  },
  mechkeys_in: {
    id: 'mechkeys_in',
    name: 'MechKeys Hub',
    domain: 'mechkeys.in',
    rating: 4.6,
    trustScore: 0.94,
    isAuthorized: true,
    verifiedMerchantBadge: true
  },
  genesis_pc: {
    id: 'genesis_pc',
    name: 'Genesis PC Store',
    domain: 'genesispc.in',
    rating: 4.5,
    trustScore: 0.92,
    isAuthorized: true,
    verifiedMerchantBadge: true
  },
  sonyindia: {
    id: 'sonyindia',
    name: 'Sony India Official',
    domain: 'sony.co.in',
    rating: 4.7,
    trustScore: 0.97,
    isAuthorized: true,
    verifiedMerchantBadge: true
  },
  lgelectronics: {
    id: 'lgelectronics',
    name: 'LG Electronics India',
    domain: 'lg.com/in',
    rating: 4.6,
    trustScore: 0.96,
    isAuthorized: true,
    verifiedMerchantBadge: true
  },
  logitech_in: {
    id: 'logitech_in',
    name: 'Logitech India Store',
    domain: 'logitech.com/in',
    rating: 4.7,
    trustScore: 0.97,
    isAuthorized: true,
    verifiedMerchantBadge: true
  },
  dell_india: {
    id: 'dell_india',
    name: 'Dell India Official',
    domain: 'dell.com/en-in',
    rating: 4.5,
    trustScore: 0.96,
    isAuthorized: true,
    verifiedMerchantBadge: true
  },
  samsung_in: {
    id: 'samsung_in',
    name: 'Samsung India Official',
    domain: 'samsung.com/in',
    rating: 4.6,
    trustScore: 0.97,
    isAuthorized: true,
    verifiedMerchantBadge: true
  },
  primetech_in: {
    id: 'primetech_in',
    name: 'PrimeTech India',
    domain: 'primetech.in',
    rating: 4.4,
    trustScore: 0.90,
    isAuthorized: true,
    verifiedMerchantBadge: true
  },
  unauthorized_deals: {
    id: 'unauthorized_deals',
    name: 'Shady Deals Hub',
    domain: 'shadydealshub.biz',
    rating: 2.1,
    trustScore: 0.20,
    isAuthorized: false,
    verifiedMerchantBadge: false
  }
};

export const AUTHORIZED_MERCHANT_IDS = Object.values(MERCHANTS)
  .filter(m => m.isAuthorized)
  .map(m => m.id);
