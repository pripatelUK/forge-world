import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, SafeAreaView, StyleSheet, TextInput, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';


import { Button } from './Button';

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


export function WorldsScreen({ navigation }) {
    const [status, setStatus] = React.useState('Connecting and processing...');

    const [world, setWorld] = React.useState(1);
    const [requestingTransaction, setRequestingTransaction] = React.useState(true);


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

    const [transactionStatus, setTransactionStatus] = React.useState<'waiting' | 'confirmed' | 'error'>();

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

    if (requestingTransaction) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.title}>{"Select World"}</Text>
                <View style={styles.inputRow}>
                    <Picker
                        itemStyle={{ height: 44 }}
                        selectedValue={world}
                        style={styles.picker}
                        onValueChange={(itemValue) => setWorld(itemValue)}
                    >
                        <Picker.Item label="Wood" value="1" />
                        <Picker.Item label="Lava" value="2" />
                        <Picker.Item label="Sea" value="3" />
                    </Picker>
                </View>
                <Button onPress={handlePasskey}>
                    Join World
                </Button>
            </SafeAreaView>
        );
    }

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={styles.title}>{status}</Text>
            <ActivityIndicator size="large" />
            <Button onPress={() => navigation.navigate('Home')}>
                HOME
            </Button>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    price: {
        fontSize: 32,
        marginBottom: 10,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '70%',
        marginBottom: 20,
    },
    text: {
        flex: 1,
        marginLeft: 40,
        fontSize: 32,
        // Additional text styling if needed
    },
    picker: {
        flex: 1,
        fontSize: 32,
        height: 60,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        padding: 20,
    },
    title: {
        fontSize: 22,
        marginBottom: 10,
    },
    // ... other styles
});