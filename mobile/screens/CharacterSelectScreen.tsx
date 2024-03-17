import React, {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Button } from "@rneui/themed";
import { SafeAreaView } from "react-native-safe-area-context";
import { ICharacter, RootStackParamList } from "../types/types";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { GameContext } from "../contexts/GameContext";
import { useFonts } from "expo-font";
// import * as SplashScreen from "expo-splash-screen";
import { attributes, characters, worlds } from "../shared";
import { Dialog } from "@rneui/base";


import AsyncStorage from '@react-native-async-storage/async-storage';
import { IUserOperation, Presets, UserOperationBuilder } from 'userop';
import { api } from "../api";
import { getAddress, getGasLimits, getPaymasterData, sendUserOp, signUserOp, signUserOpWithCreate, userOpToSolidity } from "../utils/passkeyUtils";
import { Contract, ethers } from 'ethers';
import { provider } from '../utils/providers';
import { Passkey } from "react-native-passkey";
import gameABI from '../abis/forgeworld.json';
import { entrypointContract, simpleAccountAbi, walletFactoryContract } from '../utils/contracts';
import { VITE_ENTRYPOINT } from '../utils/constants';

export type CharacterSelectScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "CharacterSelect">;
};

export const CharacterSelectScreen: React.FC<CharacterSelectScreenProps> = ({
  navigation,
}) => {
  const [selectedCharacter, setSelectedCharacter] = useState<
    ICharacter | undefined
  >(undefined);

  const [userName, setUserName] = useState("");
  const { player, setPlayer, setActiveWorld } = useContext(GameContext);

  // const [fontsLoaded] = useFonts({
  //   ToysRUs: require("../assets/fonts/toys_r_us.ttf"),
  // });

  // const onLayoutRootView = useCallback(async () => {
  //   if (fontsLoaded) {
  //     await SplashScreen.hideAsync();
  //   }
  // }, [fontsLoaded]);


  /** Set the active world by default here for the user, can move this if necessary to a better location */
  useEffect(() => {
    setActiveWorld(worlds[0]);
    return () => {
      // Tear down logic ..
    };
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  });

  // if (!fontsLoaded) {
  //   return null;
  // }
  const handleConfirmSelection = () => {
    if (userName.trim() && selectedCharacter) {
      console.log(
        "Character selected:",
        selectedCharacter?.name,
        "by",
        userName
      );

      setPlayer({
        username: userName,
        imgSrc: selectedCharacter.imgSrc,
        name: selectedCharacter.name,
        epochsAccrued: undefined,
        attributes: attributes[selectedCharacter.name],
        resources: undefined,
      });

      handleCreate(selectedCharacter.name);
    } else {
      alert("Please enter your name and select a character.");
    }
  };


  const handleCreate = async (charName: string) => {
    console.log("lol")
    try {

      const res = await api.post("/register-options", {
        email: userName,
        name: "1"
      });

      let options = res.data;
      console.log(options)
      options.authenticatorSelection.residentKey = "required";
      options.authenticatorSelection.requireResidentKey = true;
      options.extensions = {
        credProps: true,
      };

      console.log('options.challenge', options.challenge)
      // console.log(btoa(options.challenge))
      // options.challenge = btoa(options.challenge)

      const isSupported = Passkey.isSupported();
      console.log("isSupported", isSupported)
      const optionsResponse = await Passkey.register(options);
      console.log("optionsResponse", optionsResponse)
      const verifyRes = await api.post("/register-verify", {
        optionsResponse,
        email: userName,
      });
      await handleSign(optionsResponse, charName)
      if (verifyRes.status === 200) {
        // Alert.alert("All good", "success!");
        // //@todo approve
        // navigation.navigate('Home');
      }
    } catch (error) {
      // console.log("error")
      // Alert.alert("Error", "bad");

      console.log(JSON.stringify(error));
      // console.log(error.stack);
    }
  };

  const [transactionStatus, setTransactionStatus] = useState<'waiting' | 'confirmed' | 'error'>();

  const handleSign = async (passkey: string, charName: string) => {

    setTransactionStatus('waiting');
    console.log('yo login', userName);
    const charIndex = characters.findIndex(char => char.name == charName) + 1;
    console.log("selected char index", charIndex)
    // okay so this essentially just creates an address using the userName
    const walletAddress = await getAddress((userName as string));
    const gameAddr = "0xd0483C06D9b48eb45121b3D578B2f8d2000283b5";
    const gameContract = new Contract(gameAddr, gameABI.abi, provider);
    console.log('yo walletAddress', walletAddress);
    const userOpBuilder = new UserOperationBuilder()
      .useDefaults({
        sender: walletAddress,
      })
      .useMiddleware(Presets.Middleware.getGasPrice(provider))
      .setCallData(
        simpleAccountAbi.encodeFunctionData('executeBatch', [
          [gameAddr], [0], [gameContract.interface.encodeFunctionData('userJoinWorld', [1, charIndex, userName])]
        ]),
      )
      .setNonce(await entrypointContract.getNonce(walletAddress, 0));

    const walletCode = await provider.getCode(walletAddress);
    console.log('yo walletCode', walletCode);
    const walletExists = walletCode !== '0x';
    console.log('yo walletExists', walletExists);
    console.log({ walletExists });

    if (!walletExists) {
      userOpBuilder.setInitCode(
        walletFactoryContract.address +
        walletFactoryContract.interface.encodeFunctionData('createAccount(string, uint256)', [userName, 0]).slice(2),
      );
    }

    const { chainId } = await provider.getNetwork();
    const userOpToEstimateNoPaymaster = await userOpBuilder.buildOp(VITE_ENTRYPOINT, chainId);
    const paymasterAndData = await getPaymasterData(userOpToEstimateNoPaymaster);
    const userOpToEstimate = {
      ...userOpToEstimateNoPaymaster,
      paymasterAndData,
    };
    console.log({ userOpToEstimate });
    console.log('estimated userop', userOpToSolidity(userOpToEstimate));

    const [gasLimits, baseUserOp] = await Promise.all([
      getGasLimits(userOpToEstimate),
      userOpBuilder.buildOp(VITE_ENTRYPOINT, chainId),
    ]);
    console.log({
      gasLimits: Object.fromEntries(
        Object.entries(gasLimits).map(([key, value]) => [key, ethers.BigNumber.from(value).toString()]),
      ),
    });
    const userOp: IUserOperation = {
      ...baseUserOp,
      callGasLimit: gasLimits.callGasLimit,
      preVerificationGas: gasLimits.preVerificationGas,
      verificationGasLimit: gasLimits.verificationGasLimit,
      paymasterAndData,
    };

    console.log({ userOp });
    // console.log('to sign', userOpToSolidity(userOp));
    const userOpHash = await entrypointContract.getUserOpHash(userOp);
    // const userOpHash = "0x711a19f8418ca174fc7e215419af62c6097d8fa23bb8894cc55a090a1738d6d9";
    // console.log("guardian count:", await keypassContract.guardianCount())
    console.log('TO SIGN', { userOpHash });

    let loginPasskeyId = await AsyncStorage.getItem(`${userName}_passkeyId`);
    console.log("loginPasskeyId", loginPasskeyId)
    const signature = loginPasskeyId
      ? await signUserOp(userOpHash, loginPasskeyId, passkey)
      : await signUserOpWithCreate(userOpHash, (userName as string), passkey);

    if (!signature) throw new Error('Signature failed');
    const signedUserOp: IUserOperation = {
      ...userOp,
      // paymasterAndData: await getPaymasterData(userOp),
      signature,
    };
    console.log({ signedUserOp });
    console.log('signed', userOpToSolidity(signedUserOp));
    // console.log("guardian count:", await keypassContract.guardianCount())

    sendUserOp(signedUserOp)
      .then(async (receipt: any) => {
        await receipt.wait();
        setTransactionStatus('confirmed');
        console.log({ receipt });
        //@todo approve
        // let loginPasskeyId = await AsyncStorage.getItem(`${userName}_passkeyId`);
        navigation.navigate('MainMenu');
      })
      .catch((e: any) => {
        setTransactionStatus('error');
        console.error(e);
      });
  }

  useEffect(() => {
    // Logic to retrieve and set the session token, e.g., from AsyncStorage
    const goHome = async () => {
      let email = await AsyncStorage.getItem(`loginID`);
      console.log("email", email)
      if (email) {
        //@todo
        // setSelectedCharacter(characters[0])
        let char = characters[1];
        // @todo get all character stats
        setPlayer({
          username: email,
          imgSrc: char.imgSrc,
          name: char.name,
          epochsAccrued: undefined,
          attributes: attributes[char.name],
          resources: undefined,
        });
        navigation.navigate('MainMenu');
      }
    };
    goHome();
  }, []);

  return (
    // <SafeAreaView style={{ flex: 1 }} onLayout={onLayoutRootView}>
    <SafeAreaView style={{ flex: 1 }}>
      {transactionStatus == "waiting" && (
        <Dialog
          isVisible={transactionStatus == "waiting"}
          overlayStyle={{ backgroundColor: "white" }}
        // onBackdropPress={() => {
        //   setIsLevelUpDialogVisible(false);
        // }}
        >
          <Dialog.Title
            title={`Creating Your Character...`}
            titleStyle={{ fontFamily: "ToysRUs" }}
          />
          <Dialog.Loading />
        </Dialog>
      )}
      <ScrollView contentContainerStyle={styles.charactersContainer}>
        <Text
          style={[
            { fontFamily: "ToysRUs", marginTop: 20 },
            styles.selectCharacterText,
          ]}
        >
          Enter Your Name
        </Text>
        <TextInput
          style={[styles.nameInput, { fontFamily: "ToysRUs" }]}
          placeholder="Enter your username"
          value={userName}
          onChangeText={setUserName}
        />
        <Text
          style={[
            styles.selectCharacterText,
            { fontFamily: "ToysRUs", marginTop: 10 },
          ]}
        >
          Select Character
        </Text>
        {characters.map((character: ICharacter, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.characterRow,
              selectedCharacter?.name === character.name
                ? styles.selectedCharacter
                : {},
            ]}
            onPress={() => setSelectedCharacter(character)}
          >
            <Image
              source={{ uri: character.imgSrc }}
              style={styles.characterImage}
            />
            <Text style={[styles.characterName, { fontFamily: "ToysRUs" }]}>
              {character.name}
            </Text>
          </TouchableOpacity>
        ))}
        {selectedCharacter && userName.trim() && (
          <View style={styles.confirmButtonContainer}>
            <Button
              title="Confirm"
              onPress={handleConfirmSelection}
              type="clear"
              titleStyle={{
                fontFamily: "ToysRUs",
                fontSize: 20,
                color: "gold",
              }}
              buttonStyle={{ width: "100%" }}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  confirmButtonContainer: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 4,
    borderRadius: 5,
  },
  selectCharacterText: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",

    marginBottom: 10,
  },
  charactersContainer: {
    alignItems: "center",
    paddingBottom: 20,
  },
  characterRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "lightgray",
    borderRadius: 10,
    padding: 10,
    marginVertical: 5,
    width: "90%",
  },
  selectedCharacter: {
    borderColor: "#007bff",
  },
  characterImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
  },
  characterName: {
    fontSize: 18,
  },
  nameInput: {
    height: 40,
    marginVertical: 12,
    borderWidth: 1,
    padding: 10,
    width: "90%",
    alignSelf: "center",
    borderColor: "gray",
    borderRadius: 5,
  },
});