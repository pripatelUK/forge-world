import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState, useEffect } from 'react';
import { Alert, SafeAreaView, StyleSheet, TextInput, View, Text, ActivityIndicator } from 'react-native';
import { Button } from './Button';

import { IUserOperation, Presets, UserOperationBuilder } from 'userop';
import { api } from "../api";
import { getAddress, getGasLimits, getPaymasterData, sendUserOp, signUserOp, signUserOpWithCreate, userOpToSolidity } from "../utils/passkeyUtils";
import { Contract, ethers } from 'ethers';
import { provider } from '../utils/providers';
import { Passkey } from "react-native-passkey";
import gameABI from '../abis/forgeworld.json';
import { entrypointContract, simpleAccountAbi, walletFactoryContract } from '../utils/contracts';
import { VITE_ENTRYPOINT } from '../utils/constants';

export function CreateAccount({ navigation }) {
    const [username, setUsername] = useState('');

    const handleCreate = async () => {
        console.log("lol")
        try {

            const res = await api.post("/register-options", {
                email: username,
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
                email: username,
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

            console.log(JSON.stringify(error));
            // console.log(error.stack);
        }
    };

    const [transactionStatus, setTransactionStatus] = useState<'waiting' | 'confirmed' | 'error'>();

    const handleSign = async (passkey: string) => {

        setTransactionStatus('waiting');
        console.log('yo login', username);

        // okay so this essentially just creates an address using the username
        const walletAddress = await getAddress((username as string));
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
                    [gameAddr], [0], [gameContract.interface.encodeFunctionData('userJoinWorld', [1, 1])]
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
                walletFactoryContract.interface.encodeFunctionData('createAccount(string, uint256)', [username, 0]).slice(2),
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

        let loginPasskeyId = await AsyncStorage.getItem(`${username}_passkeyId`);
        console.log("loginPasskeyId", loginPasskeyId)
        const signature = loginPasskeyId
            ? await signUserOp(userOpHash, loginPasskeyId, passkey)
            : await signUserOpWithCreate(userOpHash, (username as string), passkey);

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
                // let loginPasskeyId = await AsyncStorage.getItem(`${username}_passkeyId`);
                navigation.navigate('Home');
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
            if (email) {
                navigation.navigate('Home');
            }
        };
        goHome();
    }, []);

    if (transactionStatus == "waiting") {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.title}>Entering ForgeVerse...</Text>
                <ActivityIndicator size="large" />
            </SafeAreaView>
        )
    }

    return (
        <SafeAreaView style={[styles.container, styles.dark]}>
            <Text style={styles.title} variant="large-600">
                Create Account & Mint NFT
            </Text>
            {/* <W3mButton balance="show" /> */}
            {/* <FlexView style={styles.inputContainer}> */}
            <Text style={styles.label}>Email</Text>
            <TextInput
                style={styles.input}
                placeholder="Email"
                value={username}
                onChangeText={setUsername}
            />
            {/* </FlexView> */}
            <Button onPress={handleCreate}>
                Join Game
            </Button>
            {/* <FlexView style={styles.buttonContainer}> */}
            {/* <Approve navigation={navigation} /> */}
            {/* </FlexView> */}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        // backgroundColor: '#FFFFFF',
    },
    buttonContainer: {
        gap: 4,
    },
    dark: {
        // backgroundColor: '#588C3C',
    },
    title: {
        marginBottom: 40,
        fontSize: 30,
    },
    inputContainer: {
        width: '100%',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    input: {
        height: 40,
        borderColor: '#47a1ff', // Changed to blue
        borderWidth: 1,
        padding: 10,
        marginBottom: 20,
        borderRadius: 5, // Added to slightly round the edges
    },
    picker: {
        height: 50,
        width: '100%',
        borderColor: 'blue', // Changed to blue
        borderWidth: 1
    },
    label: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000',
        marginBottom: 10,
    },
});
