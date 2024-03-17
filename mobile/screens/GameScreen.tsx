import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useContext, useLayoutEffect, useState } from "react";
import { Dimensions, StyleSheet, View, Text, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import World from "../components/World";
import { IGame, IWorld, RootStackParamList, Token } from "../types/types";
import { BottomSheet, Dialog } from "@rneui/themed";
import { useFonts } from "expo-font";
import { GameContext } from "../contexts/GameContext";
import { attributes, characters, worlds } from "../shared";

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
import { useFocusEffect } from "@react-navigation/native";

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
      },
    });
  });

  return (
    <View style={{ flex: 1 }}>
      <Game worlds={worlds} navigation={navigation} />
    </View>
  );
};

const Game = ({ worlds, character, navigation }: IGame) => {
  const insets = useSafeAreaInsets();
  const NOTCH_HEIGHT = insets.top; // Notch height (iPhone island) - perhaps other phones have this...
  console.log(`Notch Height: ${NOTCH_HEIGHT}`);

  const { activeWorld, setActiveWorld, setPlayer } = useContext(GameContext);

  const [passkeyID, setPasskeyID] = React.useState('');
  const [walletAddr, setWalletAddr] = React.useState('');
  // const [currWorldID, setWorld] = React.useState(0);


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

  useFocusEffect(
    React.useCallback(() => {
      const checkPasskey = async () => {
        // console.log(isConnected)
        let username = await AsyncStorage.getItem(`loginID`);
        if (username) {
          let loginPasskeyId = await AsyncStorage.getItem(`${username}_passkeyId`);
          console.log("loginPasskeyId", username)
          let wallet = await getAddress((username as string));
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


  const [dialogState, setDialogState] = useState({
    world: activeWorld,
    visible: false,
  });

  console.log(`Dialog State: ${JSON.stringify(dialogState)}`);

  const [status, setStatus] = React.useState('Connecting and processing...');

  const [requestingTransaction, setRequestingTransaction] = React.useState(false);


  const handlePasskey = async () => {
    setRequestingTransaction(true)
    setStatus("Authenticating Passkey")
    console.log("lol")
    try {
      let email = await AsyncStorage.getItem(`loginID`);
      // console.log(api)
      const res = await api.post("/auth-options", {
        email,
        name: "1"
      });

      let options = res.data;
      console.log(options)
      // options.authenticatorSelection.residentKey = "required";
      // options.authenticatorSelection.requireResidentKey = true;
      // options.extensions = {
      //     credProps: true,
      // };

      console.log('options.challenge', options.challenge)
      // console.log(btoa(options.challenge))
      // options.challenge = btoa(options.challenge)

      const isSupported = Passkey.isSupported();
      console.log("isSupported", isSupported)
      const optionsResponse = await Passkey.authenticate(options);
      console.log("optionsResponse", optionsResponse)
      const verifyRes = await api.post("/auth-verify", {
        optionsResponse,
        email,
      });
      await handleSign(optionsResponse)
      if (verifyRes.status === 200) {
        // Alert.alert("All good", "success!");
        // //@todo approve
        // navigation.navigate('Home');
      }
    } catch (error) {
      // console.log("error")
      // Alert.alert("Error", "bad");

      // console.log(JSON.stringify(error));
      // console.log(error.stack);
    }
  };

  const [transactionStatus, setTransactionStatus] = React.useState<'waiting' | 'confirmed' | 'error'>();

  const handleSign = async (passkey: string) => {
    let email = await AsyncStorage.getItem(`loginID`);

    setStatus("Executing Transaction")
    setTransactionStatus('waiting');
    console.log('yo login', email);
    const dialogWorldID = worlds.findIndex(world => dialogState.world.terrain == world.terrain) + 1;
    console.log("dialogWorldID", dialogWorldID)

    const walletAddress = await getAddress((email as string));
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
          [gameAddr], [0], [gameContract.interface.encodeFunctionData('userMoveWorld', [dialogWorldID])]
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
        walletFactoryContract.interface.encodeFunctionData('createAccount(string, uint256)', [email, 0]).slice(2),
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
    console.log('TO SIGN', { userOpHash });

    let loginPasskeyId = await AsyncStorage.getItem(`${email}_passkeyId`);
    // const signature = loginPasskeyId
    //     ? await signUserOp(userOpHash, loginPasskeyId, passkey)
    //     : await signUserOpWithCreate(userOpHash, (address as string), passkey);
    const signature = await signUserOp(userOpHash, loginPasskeyId, passkey)

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
        setStatus("Executing Transaction")
        await receipt.wait();
        setTransactionStatus('confirmed');
        console.log({ receipt });
        // sendTxData()
        //@todo approve
        setActiveWorld(worlds[worlds.findIndex(world => dialogState.world.terrain == world.terrain)]);
        setDialogState((prevState) => ({ ...prevState, visible: false }));
        // navigation.navigate('MainMenu');
        setRequestingTransaction(false);
      })
      .catch((e: any) => {
        setTransactionStatus('error');
        console.error(e);
      });
  }

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
        {
          !requestingTransaction && (
            <Dialog.Title
              title={`Are you sure you want to enter the ${dialogState.world.terrain}?`}
            />
          )
        }
        {
          !requestingTransaction && (
            <Text>
              You will {dialogState.world.title} and earn {dialogState.world.token}.
            </Text>
          )
        }
        {
          requestingTransaction && (
            <Dialog.Title
              title={`Travelling...`}
            />
          )
        }
        {
          requestingTransaction && (
            <ActivityIndicator size="large" />
          )
        }

        {
          !requestingTransaction && (
            <Dialog.Actions>
              <Dialog.Button
                title="Confirm"
                onPress={() => {
                  // TODO: Api Call use loading states.
                  handlePasskey()
                }}
              />
              <Dialog.Button
                title="Cancel"
                onPress={() =>
                  setDialogState((prevState) => ({ ...prevState, visible: false }))
                }
              />
            </Dialog.Actions>
          )
        }
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
