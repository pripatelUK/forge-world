import React, { useContext, useEffect } from 'react';
import { View, Text, ActivityIndicator, SafeAreaView, StyleSheet, TextInput, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from "react-native";

import { Picker } from '@react-native-picker/picker';

import { IUserOperation, Presets, UserOperationBuilder } from 'userop';
import { api } from "../api";
import { getAddress, getGasLimits, getPaymasterData, sendUserOp, signUserOp, signUserOpWithCreate, userOpToSolidity } from "../utils/passkeyUtils";
import { Contract, ethers } from 'ethers';
import { provider } from '../utils/providers';
import { Passkey } from "react-native-passkey";
import gameABI from '../abis/forgeworld.json';
import { entrypointContract, simpleAccountAbi, walletFactoryContract } from '../utils/contracts';
import { VITE_ENTRYPOINT } from '../utils/constants';
import { Button, LinearProgress } from "@rneui/themed";
import { GameContext } from '../contexts/GameContext';

export function ProfileScreen({ navigation }) {
    const { player } = useContext(GameContext); // Assuming your context provides the player object with a level and username
    console.log(player)
    const [status, setStatus] = React.useState('Connecting and processing...');

    const [world, setWorld] = React.useState(1);
    const [requestingTransaction, setRequestingTransaction] = React.useState(true);

    const { attributes } = player;
    const currentLevel = Object.values(attributes).reduce((a, b) => a + b);
    const handlePasskey = async () => {
        setRequestingTransaction(false)
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

    const [transactionHash, setTransactionHash] = React.useState('');
    const [transactionStatus, setTransactionStatus] = React.useState<'waiting' | 'confirmed' | 'error'>();
    const [isSubmitted, setIsSubmitted] = React.useState(false);

    const handleSign = async (passkey: string) => {
        let email = await AsyncStorage.getItem(`loginID`);

        setStatus("Executing Transaction")
        setTransactionStatus('waiting');
        console.log('yo login', email);

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
                    [gameAddr], [0], [gameContract.interface.encodeFunctionData('userMoveWorld', [world])]
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
                setTransactionHash(receipt.hash);
                setTransactionStatus('confirmed');
                console.log({ receipt });
                // sendTxData()
                //@todo approve
                navigation.navigate('Home');
            })
            .catch((e: any) => {
                setTransactionStatus('error');
                console.error(e);
            });
    }

    // if (requestingTransaction) {
    //     return (
    //         <SafeAreaView style={styles.container}>

    //             <Text style={styles.text}>Profile</Text>
    //             {/* <Button
    //                     onPress={async () => {
    //                         navigation.navigate('CreateVirtual');
    //                     }}>
    //                     Create Virtual Card
    //                 </Button> */}
    //             {/* <Button
    //                     onPress={logOut}
    //                 >
    //                     Log Out
    //                 </Button> */}
    //         </SafeAreaView>
    //     );
    // }

    return (
        // <View style={styles.cardContainer} onLayout={onLayoutRootView}>
        <View style={styles.cardContainer}>
            <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { fontFamily: "ToysRUs" }]}>
                    {"username"}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={[styles.cardLevel, { fontFamily: "ToysRUs" }]}>
                        {/* Level {currentLevel} */}
                        Level {"1"}
                    </Text>
                    <LinearProgress
                        style={{
                            marginVertical: 10,
                            width: 75,
                            height: 8,
                            borderRadius: 8,
                            marginHorizontal: 4,
                        }}
                        value={Math.random()}
                        variant="determinate"
                        trackColor="red"
                        color="green"
                    />
                    <Text style={[styles.cardLevel, { fontFamily: "ToysRUs" }]}>
                        {" "}
                        {/* {currentLevel + 1} */}
                        {1 + 1}
                    </Text>
                </View>
            </View>
            <View style={styles.imageContainer}>
                <Image
                    style={styles.cardImage}
                    source={{ uri: "https://i.seadn.io/gae/AU-ip8HlUWOfUYwxbgnbJUcRtSauohPG6Wc7yB2HTXvW76CzclL03E52lOG4ehpPY7Skflhw5sfJecLsh4fInrkhe4MomoseJ2JUQg?auto=format&dpr=1&w=1000" }} // The player's image URL goes here
                />
            </View>
            <View style={styles.attributesContainer}>
                <View style={[styles.column1]}>
                    <Text style={[styles.resourcesHeader, { fontFamily: "ToysRUs" }]}>
                        Attributes
                    </Text>
                    <Text style={[styles.attributeName, { fontFamily: "ToysRUs" }]}>
                        Strength
                    </Text>
                    <Text style={[styles.attributeValue, { fontFamily: "ToysRUs" }]}>
                        {attributes.strength}
                    </Text>
                    <Text style={[styles.attributeName, { fontFamily: "ToysRUs" }]}>
                        Intellect
                    </Text>
                    <Text style={[styles.attributeValue, { fontFamily: "ToysRUs" }]}>
                        {attributes.intellect}
                    </Text>
                    <Text style={[styles.attributeName, { fontFamily: "ToysRUs" }]}>
                        Agility
                    </Text>
                    <Text style={[styles.attributeValue, { fontFamily: "ToysRUs" }]}>
                        {attributes.agility}
                    </Text>
                    <Text style={[styles.attributeName, { fontFamily: "ToysRUs" }]}>
                        Stamina
                    </Text>
                    <Text style={[styles.attributeValue, { fontFamily: "ToysRUs" }]}>
                        {attributes.stamina}
                    </Text>
                </View>

                <View style={styles.resourcesContainer}>
                    <Text style={[styles.resourcesHeader, { fontFamily: "ToysRUs" }]}>
                        Resources
                    </Text>
                    <View
                        style={{
                            flexDirection: "row",
                            justifyContent: "space-around",
                        }}
                    >
                        <View style={styles.column2}>
                            <Text style={[styles.subHeader, { fontFamily: "ToysRUs" }]}>
                                Earned
                            </Text>

                            <Text style={[styles.resourceName, { fontFamily: "ToysRUs" }]}>
                                💎 Rubies
                            </Text>
                            <Text style={[styles.resourceValue, { fontFamily: "ToysRUs" }]}>
                                {/* player.rubies */}135
                            </Text>

                            <Text style={[styles.resourceName, { fontFamily: "ToysRUs" }]}>
                                🫧 Pearls
                            </Text>
                            <Text style={[styles.resourceValue, { fontFamily: "ToysRUs" }]}>
                                {/* player.pearls */}51
                            </Text>
                            <Text style={[styles.resourceName, { fontFamily: "ToysRUs" }]}>
                                🪵 Lumber
                            </Text>
                            <Text style={[styles.resourceValue, { fontFamily: "ToysRUs" }]}>
                                {/* player.lumber */}12
                            </Text>
                        </View>

                        <View style={styles.column3}>
                            <Text style={[styles.subHeader, { fontFamily: "ToysRUs" }]}>
                                Claimable
                            </Text>
                            <Text style={[styles.resourceName, { fontFamily: "ToysRUs" }]}>
                                💎 Rubies
                            </Text>
                            <Text style={[styles.resourceValue, { fontFamily: "ToysRUs" }]}>
                                {/* player.claimableRubies */}12
                            </Text>
                            <Text style={[styles.resourceName, { fontFamily: "ToysRUs" }]}>
                                🫧 Pearls
                            </Text>
                            <Text style={[styles.resourceValue, { fontFamily: "ToysRUs" }]}>
                                {/* player.claimablePearls */}53
                            </Text>
                            <Text style={[styles.resourceName, { fontFamily: "ToysRUs" }]}>
                                🪵 Lumber
                            </Text>
                            <Text style={[styles.resourceValue, { fontFamily: "ToysRUs" }]}>
                                {/* player.claimableLumber */}125
                            </Text>
                        </View>
                    </View>
                    <View style={{ paddingHorizontal: "5%", marginTop: 6 }}>
                        <Button
                            title="Claim"
                            type="outline"
                            titleStyle={{ fontFamily: "ToysRUs", color: "gold" }}
                            buttonStyle={{
                                width: "100%",
                                backgroundColor: "black",
                                borderRadius: 4,
                            }}
                            onPress={() => {
                                /* TODO: Api Call to claim resources. */
                            }}
                        ></Button>
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    cardContainer: {
        margin: 20,
        backgroundColor: "#F8F8F8",
        borderRadius: 10,
        padding: 10,

        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
    },
    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        marginBottom: 6,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: "bold",
        // fontFamily: 'ToysRUs', // Uncomment and set to your custom font if you have it loaded
    },
    cardLevel: {
        fontSize: 16,
        fontWeight: "bold",
    },
    imageContainer: {
        borderWidth: 2,
        width: "100%",
        marginHorizontal: 20,
        justifyContent: "center",
        alignItems: "center",
        padding: 48,
    },
    cardImage: {
        width: 100, // Adjust width as needed
        height: 100, // Adjust height as needed
        borderRadius: 50, // Make it round
        borderWidth: 2,
    },

    attributesContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        width: "100%",
        marginTop: 12,
    },
    column1: {
        alignItems: "flex-start",
        justifyContent: "center",
        flex: 1,
    },
    attributeName: {
        fontSize: 16,
        fontWeight: "bold",
    },
    attributeValue: {
        fontSize: 14,
        borderWidth: 2,
        width: "100%",
        textAlign: "center",
    },
    resourcesContainer: {
        flex: 2,
        justifyContent: "center",
        paddingHorizontal: 8,
    },
    resourcesHeader: {
        fontSize: 18,
        fontWeight: "bold",
        alignSelf: "center",
        marginTop: 16,
        marginBottom: 16,
    },
    subHeader: {
        fontSize: 16,
        width: "100%",
        fontWeight: "bold",
        textDecorationLine: "underline",
        textAlign: "center",
        marginTop: 8,
        marginBottom: 8,
    },
    resourceName: {
        fontSize: 16,
    },
    resourceValue: {
        fontSize: 14,
        width: "100%",
        textAlign: "center",
        borderWidth: 2,
    },
    column2: {
        alignItems: "flex-start",
        marginTop: 4,
    },
    column3: {
        alignItems: "flex-start",
        marginTop: 4,
    },
});
