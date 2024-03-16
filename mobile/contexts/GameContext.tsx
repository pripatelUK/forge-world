import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  SetStateAction,
  Dispatch,
} from "react";
import { IWorld, IPlayer } from "../types/types"; // Ensure you define these types according to your game's needs

export interface GameContextType {
  isBottomSheetVisible: boolean;
  setIsBottomSheetVisible: Dispatch<SetStateAction<boolean | undefined>>;
  selectedWorld: IWorld | null;
  setSelectedWorld: Dispatch<SetStateAction<IWorld | undefined>>;
  activeWorld: IWorld | null;
  setActiveWorld: Dispatch<SetStateAction<IWorld | undefined>>;
  player: IPlayer | null;
  setPlayer: (player: IPlayer | null) => void;
}

export const GameContext = createContext<GameContextType>({
  isBottomSheetVisible: false,
  setIsBottomSheetVisible: () => { },
  selectedWorld: undefined,
  setSelectedWorld: () => { },
  activeWorld: undefined,
  setActiveWorld: () => { },
  player: undefined,
  setPlayer: () => { },
});

type GameContextProps = {
  children: ReactNode;
};

export const GameContextProvider: React.FC<GameContextProps> = ({
  children,
}) => {
  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);
  const [selectedWorld, setSelectedWorld] = useState<IWorld | undefined>(
    undefined
  );
  const [activeWorld, setActiveWorld] = useState<IWorld | undefined>(undefined);
  const [character, setCharacter] = useState<IPlayer | undefined>(undefined);

  return (
    <GameContext.Provider
      value={{
        isBottomSheetVisible,
        setIsBottomSheetVisible,
        selectedWorld,
        setSelectedWorld,
        activeWorld,
        setActiveWorld,
        player: character,
        setPlayer: setCharacter,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};
