import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect } from 'react';
import { SafeAreaView, StyleSheet, View, Text, TouchableOpacity, Alert, FlatList } from 'react-native';
import NfcManager from 'react-native-nfc-manager';

import { Button } from './Button';

import { provider } from '../utils/providers';
import { ethers } from 'ethers';

import { Linking } from 'react-native';
import { getAddress } from '../utils/passkeyUtils';
import { useFocusEffect } from '@react-navigation/native';
import gameABI from '../abis/forgeworld.json';

export function HomeScreen({ navigation }: any) {

    const [passkeyID, setPasskeyID] = React.useState('');
    const [walletAddr, setWalletAddr] = React.useState('');
    const [world, setWorld] = React.useState(0);

    const gameContract = new ethers.Contract("0xd0483C06D9b48eb45121b3D578B2f8d2000283b5", gameABI.abi, provider);

    const fetchWorld = async () => {
        try {
            if (walletAddr) {
                const currentWorld = await gameContract.userCurrentWorld(walletAddr);
                console.log("currentWorld", currentWorld.toNumber())
                setWorld(currentWorld.toNumber());
            }
        } catch (error) {
            console.error(error);
        }
    };


    useFocusEffect(
        React.useCallback(() => {
            fetchWorld()
        }, [walletAddr, passkeyID])
    );

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

    useEffect(() => {
        NfcManager.start();

        NfcManager.getLaunchTagEvent()
            .then(tag => {
                if (tag) {
                    // Handle the NFC tag data
                    console.log('NFC Tag Found:', tag);
                }
            })
            .catch(err => {
                console.log('Error in NFC Tag Event:', err);
            });

        return () => {
            // NfcManager.stop();
        };
    }, []);

    // useEffect(() => {
    //     const handleDeepLink = async (event) => {
    //         console.log(event.url);
    //         //@todo ensure they have walletconnect added
    //         await AsyncStorage.setItem('@merchantTopic', "/merchant/0xcc0f309170261e186efd9504361b8a963d945338");
    //         navigation.navigate('CustomerTransaction');
    //         // Handle the deep link URL (e.g., navigate to a specific screen)
    //     };

    //     Linking.addEventListener('url', handleDeepLink);

    //     return () => {
    //         Linking.removeEventListener('url', handleDeepLink);
    //     };
    // }, []);

    const logOut = async () => {
        let email = await AsyncStorage.getItem(`loginID`);
        if (email) {
            await AsyncStorage.removeItem(`loginID`);
            await AsyncStorage.removeItem(`${email}_passkeyId`);
        }
        // await AsyncStorage.removeItem(`0x00429a9D2e1102456a90f9110aaA43Fa042cea04_passkeyId`);
        await AsyncStorage.removeItem(passkeyID);
        await AsyncStorage.removeItem('@session_token');
        // disconnect()
        navigation.navigate('CreateVirtual');
    };

    // const renderTransaction = ({ item }) => (
    //     <TouchableOpacity
    //         style={styles.transactionItem}
    //         onPress={() => Alert.alert('Transaction Details', `CCIP: ${item.messageId.toString()}, Amount: ${parseInt(item.amount) / 100}, Asset: USDC, Chain: AVAX Fuji`)}
    //     >
    //         {/* <Text>{`CCIP: ${item.messageId.toString()}`}</Text> */}
    //         <Text>{`Amount: ${parseInt(item.amount) / 100} USDC`}</Text>
    //         <Text>{`Merchant: 0xcc0f309170261e186efd9504361b8a963d945338`}</Text>
    //     </TouchableOpacity>
    // );


    return (
        <SafeAreaView style={styles.container}>
            <Text style={styles.title}>{`Forge World`}</Text>
            <View style={styles.centeredView}>
                <Text style={styles.centeredText}>AA Wallet Address: {walletAddr}</Text>
            </View>
            <View style={styles.centeredView}>
                <Text style={styles.centeredText}>Current World: {world}</Text>
            </View>
            <Button
                onPress={async () => {
                    navigation.navigate('Worlds');
                }}>
                Goto Worlds
            </Button>
            <Button
                onPress={async () => {
                    navigation.navigate('Profile');
                }}>
                Goto Profile
            </Button>
            <Button
                onPress={logOut}
            >
                Log Out
            </Button>
        </SafeAreaView>
    )
    // return (
    //     <SafeAreaView style={styles.container}>
    //         <Text style={styles.title}>
    //             Profile
    //         </Text>
    //         <Text style={styles.text}>View Character here.</Text>
    //         <Button
    //             onPress={async () => {
    //                 navigation.navigate('CreateVirtual');
    //             }}>
    //             Create Virtual Card
    //         </Button>
    //         <Button
    //             onPress={logOut}
    //         >
    //             Log Out
    //         </Button>
    //     </SafeAreaView>
    // );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        marginTop: 20,
        alignItems: 'center',
    },
    phoneNumber: {
        fontSize: 20,
        textAlign: 'center',
        marginVertical: 10,
    },
    transactionItem: {
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
    },
    title: {
        marginBottom: 40,
        fontSize: 30,
        textAlign: 'center',
    },
    text: {
        marginBottom: 40,
        marginLeft: 40,
        marginRight: 40,
        fontSize: 20,
        textAlign: 'center',
    },
    list: {
        width: 400,
    },
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    centeredText: {
        fontSize: 22,
        color: '#000',
        // Other text styles as needed...
    },
    // Add more styles as needed
});