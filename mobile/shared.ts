import { IWorld, Token } from "./types/types";

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
