import { ICharacter, IWorld, Token } from "./types/types";

export const worlds: IWorld[] = [
  {
    terrain: "Volcano",
    title: "Mine Gems 💎",
    color: "red",
    metadata: { activePlayers: 3, token: Token.RUBY },
    token: Token.RUBY,
  },
  {
    terrain: "Forest",
    title: "Harvest Wood 🪵",
    color: "green",
    metadata: { activePlayers: 3, token: Token.LUMBER },
    token: Token.LUMBER,
  },
  {
    terrain: "Ocean",
    title: "Fish for Pearls 🫧",
    color: "cornflowerblue",
    metadata: { activePlayers: 3, token: Token.PEARL },
    token: Token.PEARL,
  },
];

export const CRYPPO_IMAGE_URL =
  "https://i.seadn.io/gae/N3XeQ7vV6dveAW4AGYY5jlVFiMCFdX_0Pny4rR9s0UJPOnCoN0rY5Gpu1L2gRcWcEMM78mEijTeP_gYRrvjtTt4MN9gcSFcCvYYj?auto=format&dpr=1&w=1000";

export const PEPE_PIG_IMAGE_URL =
  "https://i.seadn.io/gae/iXO3RI9Qxu90XGxRwWrFA09qROQRqR1eWQ44LvXZqiBiwVMq4a0rttNriv4vyOFAnyXJRt5coMAELgEUixFUSxkWSjZRsUliFHmOdQM?auto=format&dpr=1&w=1000";

export const PEPE_IMAGE_URL =
  "https://i.seadn.io/gae/xjiFDpUTAijt_wU2So-d11yuq8WKUe7Dr9jOq48wDgsJ8wWgBMqpOnJwo1R3RaZoPtaG4NkAXXI6TBWrf2DWvOSUHIvjyHAWEhjMOv4?auto=format&dpr=1&w=1000";

export const TWINKY_WINKY_IMAGE_URL =
  "https://i.seadn.io/s/raw/files/7f90b629334bcc87c6118650a180e1f5.png?auto=format&dpr=1&w=1000";

export const BO_BEAR_IMAGE_URL =
  "https://i.seadn.io/gae/MMb2rnXkS7m5McXvAB8QnRactpITRDKKayftVxhTyID8nYq_wee1REb_gbSRTl0r2kK3MSDjO2qsNc4U3CDd8GcazgfNkVSNgoxqapI?auto=format&dpr=1&w=1000";

export const DOGE_DOG_IMAGE_URL =
  "https://i.seadn.io/gae/AU-ip8HlUWOfUYwxbgnbJUcRtSauohPG6Wc7yB2HTXvW76CzclL03E52lOG4ehpPY7Skflhw5sfJecLsh4fInrkhe4MomoseJ2JUQg?auto=format&dpr=1&w=1000";

export const characters: ICharacter[] = [
  { name: "Doge Da Dog", imgSrc: DOGE_DOG_IMAGE_URL },
  { name: "Bober", imgSrc: BO_BEAR_IMAGE_URL },
  { name: "Pepe", imgSrc: PEPE_IMAGE_URL },
  { name: "PepePig", imgSrc: PEPE_PIG_IMAGE_URL },
  { name: "Twinky Winky", imgSrc: TWINKY_WINKY_IMAGE_URL },
  {
    name: "Cryp-Po",
    imgSrc: CRYPPO_IMAGE_URL,
  },
];

export const attributes = {
  "Doge Da Dog": {
    strength: 12,
    intellect: 6,
    agility: 20,
    stamina: 10,
  },
  Bober: {
    strength: 20,
    intellect: 8,
    agility: 8,
    stamina: 12,
  },
  Pepe: { strength: 5, intellect: 20, agility: 12, stamina: 10 },
  PepePig: { strength: 17, intellect: 15, agility: 5, stamina: 10 },
  "Twinky Winky": { strength: 10, intellect: 15, agility: 10, stamina: 12 },
  "Crypo-Po": { strength: 5, intellect: 15, agility: 15, stamina: 12 },
};