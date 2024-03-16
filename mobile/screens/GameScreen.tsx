import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useContext, useLayoutEffect, useState } from "react";
import { Dimensions, StyleSheet, View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import World from "../components/World";
import { IGame, IWorld, RootStackParamList, Token } from "../types/types";
import { BottomSheet, Dialog } from "@rneui/themed";
import { useFonts } from "expo-font";
import { GameContext } from "../contexts/GameContext";
import { worlds } from "../shared";

type CharacterEntity = {
  position: {
    x: number;
    y: number;
  };
  target: {
    x: number;
    y: number;
  } | null;
};

type GameScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Game">;
};

const window = Dimensions.get("window");

const PEPE_IMAGE: string =
  "https://www.freefavicon.com/freefavicons/objects/pepe-152-270481.png";

export const GameScreen: React.FC<GameScreenProps> = ({ navigation }) => {
  const { activeWorld } = useContext(GameContext);

  console.log(`[GameScreen] - activeWorld: ${JSON.stringify(activeWorld)}`);

  // const [fontsLoaded] = useFonts({
  //   ToysRUs: require("../assets/fonts/toys_r_us.ttf"),
  // });

  // if (!fontsLoaded) {
  //   return null;
  // }

  useLayoutEffect(() => {
    navigation.setOptions({
      headerBackTitle: "Main Menu",
      headerBackTitleStyle: {
        fontFamily: "ToysRUs",
      },
      headerTitle: "FoRgEwOrLd",

      headerTitleStyle: {
        fontFamily: "ToysRUs",
        color: "white",
      },
      headerStyle: { backgroundColor: "black" },
    });
  });

  return (
    <View style={{ flex: 1 }}>
      <Game worlds={worlds} />
    </View>
  );
};

const Game = ({ worlds, character }: IGame) => {
  const insets = useSafeAreaInsets();
  const NOTCH_HEIGHT = insets.top; // Notch height (iPhone island) - perhaps other phones have this...
  console.log(`Notch Height: ${NOTCH_HEIGHT}`);

  const { activeWorld, setActiveWorld } = useContext(GameContext);
  const [dialogState, setDialogState] = useState({
    world: activeWorld,
    visible: false,
  });

  console.log(`Dialog State: ${JSON.stringify(dialogState)}`);

  return (
    <View style={gameStyles.container}>
      {worlds.map((world: IWorld, idx: number) => (
        <View key={idx} style={{ flex: 1 }}>
          <World
            additionalStyle={idx === 0 ? { paddingTop: NOTCH_HEIGHT / 2 } : {}}
            terrain={world.terrain}
            title={world.title}
            color={world.color}
            metadata={world.metadata}
            key={idx}
            isActive={activeWorld.terrain === world.terrain}
            setDialogState={setDialogState}
            token={world.token}
          />
          <Divider />
        </View>
      ))}
      <Dialog
        isVisible={dialogState.visible}
        onBackdropPress={() =>
          setDialogState((prevState) => ({ ...prevState, visible: false }))
        }
        overlayStyle={{ backgroundColor: "white" }}
      >
        <Dialog.Title
          title={`Are you sure you want to enter the ${dialogState.world.terrain}`}
        />

        <Text>
          You will {dialogState.world.title} and earn {dialogState.world.token}.
        </Text>

        <Dialog.Actions>
          <Dialog.Button
            title="Confirm"
            onPress={() => {
              // TODO: Api Call use loading states.
              setActiveWorld(dialogState.world);
              setDialogState((prevState) => ({ ...prevState, visible: false }));
            }}
          />
          <Dialog.Button
            title="Cancel"
            onPress={() =>
              setDialogState((prevState) => ({ ...prevState, visible: false }))
            }
          />
        </Dialog.Actions>
      </Dialog>
    </View>
  );
};

const Divider = () => {
  return <View style={gameStyles.divider}></View>;
};

const gameStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  divider: {
    width: "100%",
    height: 10,
    backgroundColor: "black",
  },
});

const styles = StyleSheet.create({
  gameContainer: {
    zIndex: 2,
    flex: 1,
    position: "relative",
    backgroundColor: "#000",
  },
  character: {
    position: "absolute",
    width: 50,
    height: 50,
  },
});
