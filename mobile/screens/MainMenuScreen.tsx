import React, {
  useLayoutEffect,
  useState,
  useEffect,
  useContext,
  useCallback,
} from "react";
import {
  StyleSheet,
  View,
  Text,
  ImageBackground,
  Image,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Contract, ethers } from 'ethers';
import { Button } from "@rneui/themed";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/types";
import { GameContext } from "../contexts/GameContext";
import { useFonts } from "expo-font";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAddress } from "../utils/passkeyUtils";
import { attributes, characters, worlds } from "../shared";
import { provider } from "../utils/providers";
import gameABI from '../abis/forgeworld.json';
// import * as SplashScreen from "expo-splash-screen";

export type MainMenuScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "MainMenu">;
};

export const MainMenuScreen: React.FC<MainMenuScreenProps> = ({ navigation }) => {
  const { player, activeWorld, setActiveWorld, setPlayer } = useContext(GameContext);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const glowAnim = new Animated.Value(1);

  const [passkeyID, setPasskeyID] = React.useState('');
  const [walletAddr, setWalletAddr] = React.useState('');

  const [fontsLoaded] = useFonts({
    ToysRUs: require("../assets/fonts/toys_r_us.ttf"),
  });

  const MAIN_MENU_OPTIONS: string[] = [
    "Enter The Forge",
    "Hero's Hall",
    "Market Place",
    "Champion's Ranking",
  ];

  // const onLayoutRootView = useCallback(async () => {
  //   if (fontsLoaded) {
  //     await SplashScreen.hideAsync();
  //   }
  // }, [fontsLoaded]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  });

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.8,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const checkPasskey = async () => {
        // console.log(isConnected)
        let email = await AsyncStorage.getItem(`loginID`);
        if (email) {
          let loginPasskeyId = await AsyncStorage.getItem(`${email}_passkeyId`);
          console.log("loginPasskeyId", email)
          let wallet = await getAddress((email as string));
          // console.log(wallet)
          setWalletAddr(wallet);
          if (loginPasskeyId) {
            setPasskeyID(loginPasskeyId)
          } else {
            logOut()
          }
        }
      };
      checkPasskey();

      return () => {
        // Optional cleanup
      };
    }, [passkeyID])
  );

  const fetchWorld = async () => {
    try {
      const gameContract = new ethers.Contract("0xd0483C06D9b48eb45121b3D578B2f8d2000283b5", gameABI.abi, provider);
      let username = await AsyncStorage.getItem(`loginID`);
      if (walletAddr && username) {
        const currentWorld = await gameContract.userCurrentWorld(walletAddr);
        const userChar = await gameContract.userCharacter(walletAddr);
        console.log("currentWorld", currentWorld.toNumber())
        console.log("userChar", userChar.toNumber())
        // setWorld(currentWorld.toNumber());
        setActiveWorld(worlds[currentWorld.toNumber() - 1]);
        let char = characters[userChar.toNumber() - 1];
        setPlayer({
          username,
          imgSrc: char.imgSrc,
          name: char.name,
          epochsAccrued: undefined,
          attributes: attributes[char.name],
          resources: undefined,
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchWorld()
    }, [walletAddr, passkeyID, activeWorld])
  );

  const logOut = async () => {
    let email = await AsyncStorage.getItem(`loginID`);
    if (email) {
      await AsyncStorage.removeItem(`loginID`);
      await AsyncStorage.removeItem(`${email}_passkeyId`);
    }
    await AsyncStorage.removeItem(passkeyID);
    await AsyncStorage.removeItem('@session_token');
    navigation.navigate('CharacterSelect');
  };


  const handleConfirm = () => {
    if (selectedOption) {
      console.log("Confirmed option:", selectedOption);
    }

    switch (selectedOption) {
      case MAIN_MENU_OPTIONS[0]:
        console.log(`Navigating to the forge...`);
        navigation.navigate("Game");
        break;
      case MAIN_MENU_OPTIONS[1]:
        console.log(`Navigating to the marketplace...`);
        // navigation.navigate("MarketPlace");
        break;
      case MAIN_MENU_OPTIONS[2]:
        console.log(`Navigating to the guild...`);
        navigation.navigate("Profile");
        break;
      case MAIN_MENU_OPTIONS[3]:
        console.log(`Navigating to the leaderboard...`);
        // navigation.navigate("Leaderboard");
        break;
      default:
        console.log(`Error: Navigating to the unknown: ${selectedOption}`);
    }
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ImageBackground
      // onLayout={onLayoutRootView}
      source={require("../assets/medieval-main-menu-bg.png")}
      style={styles.background}
    >
      <View style={styles.userInfoContainer}>
        <Image source={{ uri: player.imgSrc }} style={styles.characterIcon} />
        <View
          style={{
            marginLeft: 8,
            padding: 4,
            backgroundColor: "rgba(0,0,0,0.5)",
            borderRadius: 8,
          }}
        >
          <Text
            style={[styles.userName, { fontFamily: "ToysRUs", color: "gold" }]}
          >
            {player.username}
          </Text>
        </View>
      </View>
      <Text style={[styles.header, { fontFamily: "ToysRUs" }]}>
        Forge World
      </Text>
      <View style={styles.menuContainer}>
        {MAIN_MENU_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option}
            style={styles.menuItem}
            onPress={() => setSelectedOption(option)}
          >
            <Animated.View
              style={[styles.glowContainer, { opacity: glowAnim }]}
            >
              <View style={styles.optionBackground}>
                <Text
                  style={[styles.menuItemText, { fontFamily: "ToysRUs" }]}
                >{`${selectedOption === option ? "⚡ " : ""}${option} ${selectedOption === option ? " ⚡" : ""
                  }`}</Text>
              </View>
            </Animated.View>
          </TouchableOpacity>
        ))}
      </View>
      {selectedOption && (
        <View style={styles.confirmButtonContainer}>
          <Button
            title="Confirm"
            onPress={handleConfirm}
            type="clear"
            titleStyle={{ fontFamily: "ToysRUs", fontSize: 20, color: "gold" }}
          />
        </View>
      )}

      <Text
        style={[styles.trademark, { fontFamily: "ToysRUs", marginBottom: 60 }]}
        onPress={logOut}
      >
        ETH London 2024
      </Text>
      <Text style={[styles.trademark, { fontFamily: "ToysRUs" }]}>
        Forge World ™
      </Text>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
  },
  userInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    position: "absolute",
    top: 60,
    left: 20,
  },
  userName: {
    fontSize: 20,
    color: "#FFF",

    borderRadius: 8,
  },
  characterIcon: {
    width: 50,
    height: 50,
    borderRadius: 30,
  },
  header: {
    color: "black",
    fontSize: 50,
    fontWeight: "bold",
    marginTop: 160, // Adjusted to a lower position
    marginBottom: 20,
  },
  menuContainer: {
    marginTop: 20,
    alignItems: "center",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  glowContainer: {},
  optionBackground: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 10,
    borderRadius: 5,
  },
  menuItemText: {
    color: "#FFF",
    fontSize: 22,
    textAlign: "center",
  },
  selectedIndicator: {
    color: "gold",
    fontSize: 22,
  },
  confirmButtonContainer: {
    marginTop: 30,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 20,
    paddingVertical: 10,

    borderRadius: 5,
  },
  trademark: {
    color: "#FFF",
    fontSize: 18,
    position: "absolute",
    bottom: 20,
    textAlign: "center",
  },
});
