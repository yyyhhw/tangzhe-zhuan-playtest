// Owner-approved product trial parameters. No host approval or wallet permission is exported.
import { validateConfig } from './config.mjs?v=formal-cards-candidate-7';
export const TRIAL_CONFIG = validateConfig({
  "schemaVersion": 3,
  "configVersion": "owner-formal-39-v2-20261011",
  "purpose": "integration",
  "catalogVersion": "bk-supported39-divine-shield-v7-lab-system-v1",
  "poolVersion": "owner-trial-39-rarity-v1-20261010",
  "drawPriceGold": 5000000,
  "dustBalanceCap": 50000,
  "probabilityScale": 10000,
  "goldDuplicatePolicy": "upgrade-normal-and-dust",
  "pityPolicy": "none",
  "rarities": [
    {
      "id": "common",
      "weight": 6800,
      "duplicateDust": 5,
      "craftDustCost": 40,
      "goldenWeight": 500,
      "goldenDuplicateDust": 20,
      "ownershipCap": 2,
      "deckCap": 2
    },
    {
      "id": "rare",
      "weight": 2200,
      "duplicateDust": 20,
      "craftDustCost": 100,
      "goldenWeight": 500,
      "goldenDuplicateDust": 80,
      "ownershipCap": 2,
      "deckCap": 2
    },
    {
      "id": "epic",
      "weight": 700,
      "duplicateDust": 100,
      "craftDustCost": 400,
      "goldenWeight": 500,
      "goldenDuplicateDust": 400,
      "ownershipCap": 2,
      "deckCap": 2
    },
    {
      "id": "legendary",
      "weight": 300,
      "duplicateDust": 400,
      "craftDustCost": 1600,
      "goldenWeight": 1000,
      "goldenDuplicateDust": 1600,
      "ownershipCap": 1,
      "deckCap": 1
    }
  ],
  "pool": [
    {
      "cardId": "bkVanEx1400",
      "rarity": "rare"
    },
    {
      "cardId": "bkVanCs2106",
      "rarity": "common"
    },
    {
      "cardId": "bkVanNew1011",
      "rarity": "rare"
    },
    {
      "cardId": "bkVanCs2112",
      "rarity": "common"
    },
    {
      "cardId": "bkVanCs2025",
      "rarity": "rare"
    },
    {
      "cardId": "bkVanCs2023",
      "rarity": "common"
    },
    {
      "cardId": "bkVanCs2029",
      "rarity": "common"
    },
    {
      "cardId": "bkVanCs2032",
      "rarity": "epic"
    },
    {
      "cardId": "bkVanCs2091",
      "rarity": "common"
    },
    {
      "cardId": "bkVanCs2089",
      "rarity": "common"
    },
    {
      "cardId": "bkVanCs2093",
      "rarity": "rare"
    },
    {
      "cardId": "bkVanCs2065",
      "rarity": "common"
    },
    {
      "cardId": "bkVanCs2062",
      "rarity": "epic"
    },
    {
      "cardId": "bkVanCs1042",
      "rarity": "common"
    },
    {
      "cardId": "bkVanCs2168",
      "rarity": "common"
    },
    {
      "cardId": "bkVanCs2171",
      "rarity": "common"
    },
    {
      "cardId": "bkVanCs2172",
      "rarity": "common"
    },
    {
      "cardId": "bkVanCs2173",
      "rarity": "common"
    },
    {
      "cardId": "bkVanCs2121",
      "rarity": "common"
    },
    {
      "cardId": "bkVanCs2142",
      "rarity": "rare"
    },
    {
      "cardId": "bkVanCs2120",
      "rarity": "common"
    },
    {
      "cardId": "bkVanEx1582",
      "rarity": "rare"
    },
    {
      "cardId": "bkVanCs2125",
      "rarity": "common"
    },
    {
      "cardId": "bkVanCs2118",
      "rarity": "common"
    },
    {
      "cardId": "bkVanCs2127",
      "rarity": "common"
    },
    {
      "cardId": "bkVanCs2124",
      "rarity": "common"
    },
    {
      "cardId": "bkVanCs2182",
      "rarity": "common"
    },
    {
      "cardId": "bkVanCs2119",
      "rarity": "common"
    },
    {
      "cardId": "bkVanCs2197",
      "rarity": "rare"
    },
    {
      "cardId": "bkVanCs2179",
      "rarity": "common"
    },
    {
      "cardId": "bkVanCs2131",
      "rarity": "rare"
    },
    {
      "cardId": "bkVanCs2187",
      "rarity": "common"
    },
    {
      "cardId": "bkVanCs2155",
      "rarity": "epic"
    },
    {
      "cardId": "bkVanCs2200",
      "rarity": "common"
    },
    {
      "cardId": "bkVanCs2162",
      "rarity": "common"
    },
    {
      "cardId": "bkVanCs2213",
      "rarity": "rare"
    },
    {
      "cardId": "bkVanCs2201",
      "rarity": "legendary"
    },
    {
      "cardId": "bkVanCs2186",
      "rarity": "legendary"
    },
    {
      "cardId": "bkVanEx1371",
      "rarity": "rare"
    }
  ]
});
