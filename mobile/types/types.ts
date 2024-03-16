import { NavigatorScreenParams } from "@react-navigation/native";

// Navigation Types
export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  MainMenu: undefined;
  Game: undefined;
  Profile: undefined;
  CharacterSelect: undefined;
};

// Entity Types

export interface IGame {
  worlds: IWorld[];
  character?: ICharacter; // TODO: Change to mandatory soon
}

export interface ICharacter {
  name: string;
  imgSrc: string;
}

export interface IPlayer extends ICharacter {
  epochsAccrued: number | undefined;
  username: string;
  attributes: {
    strength: number;
    intellect: number;
    agility: number;
    stamina: number;
  };
  resources: {
    earned: {
      rubies: number;
      pearls: number;
      lumber: number;
    };
    claimable: {
      rubies: number;
      pearls: number;
      lumber: number;
    };
  };
}

export interface IWorld {
  title: string;
  color: string;
  terrain: string;
  metadata: {
    activePlayers: number;
    token: Token;
  };
  additionalStyle?: any;
  isActive?: boolean;
  yPosition?: number;
  setDialogState?: any;
  token: Token;
}

export enum Token {
  RUBY = "Ruby",
  LUMBER = "Lumber",
  PEARL = "Pearl",
}
