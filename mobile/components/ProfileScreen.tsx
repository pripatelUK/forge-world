import React, {
    Dispatch,
    SetStateAction,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useState,
} from "react";
import { StyleSheet, Text, View, Image, FlatList } from "react-native";
import { GameContext } from "../contexts/GameContext";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList, Token } from "../types/types";
// import { useFonts } from "expo-font";
// import * as SplashScreen from "expo-splash-screen";
import { Button, LinearProgress } from "@rneui/themed";
import { CheckBox, Dialog, Divider } from "@rneui/base";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { Contract, ethers } from 'ethers';
import { provider } from '../utils/providers';
import { Passkey } from "react-native-passkey";
import gameABI from '../abis/forgeworld.json';
import { characters, worlds } from "../shared";


import { IUserOperation, Presets, UserOperationBuilder } from 'userop';
import { api } from "../api";
import { getAddress, getGasLimits, getPaymasterData, sendUserOp, signUserOp, signUserOpWithCreate, userOpToSolidity } from "../utils/passkeyUtils";
import { entrypointContract, simpleAccountAbi, walletFactoryContract } from '../utils/contracts';
import { VITE_ENTRYPOINT } from '../utils/constants';

export type ProfileScreenProps = {
    navigation: NativeStackNavigationProp<RootStackParamList, "Profile">;
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ navigation }) => {
    const { player } = useContext(GameContext); // Assuming your context provides the player object with a level and username
    console.log(`[ProfileScreen]: ${JSON.stringify(player)}`);
    const [isClaimableDialogVisible, setIsClaimableDialogVisible] =
        useState(false);
    const [isLevelUpDialogVisible, setIsLevelUpDialogVisible]: [
        boolean,
        Dispatch<SetStateAction<boolean>>
    ] = useState(false);
    const [requestingTransaction, setRequestTransaction]: [
        boolean,
        Dispatch<SetStateAction<boolean>>
    ] = useState(false);

    // checkedAttribuet
    const [checkedAttribute, setCheckedAttribute] = useState(1);
    const ATTRIBUTES_LIST: string[] = [
        "Strength",
        "Intellect",
        "Agility",
        "Stamina",
    ];

    const handlePasskey = async (ability: number) => {
        setRequestTransaction(true);
        // setStatus("Authenticating Passkey")
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
            await handleSign(optionsResponse, ability)
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

    const handleSign = async (passkey: string, ability: number) => {
        let email = await AsyncStorage.getItem(`loginID`);

        // setStatus("Executing Transaction")
        setTransactionStatus('waiting');
        console.log('yo login', email);
        // const dialogWorldID = worlds.findIndex(world => dialogState.world.terrain == world.terrain) + 1;
        // console.log("dialogWorldID", dialogWorldID)

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
                    [gameAddr], [0], [gameContract.interface.encodeFunctionData('userLevelUpAbility', [ability])]
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
                // setStatus("Executing Transaction")
                await receipt.wait();
                setTransactionStatus('confirmed');
                console.log({ receipt });
                // sendTxData()
                //@todo approve
                // setActiveWorld(worlds[worlds.findIndex(world => dialogState.world.terrain == world.terrain)]);
                // setDialogState((prevState) => ({ ...prevState, visible: false }));
                // navigation.navigate('MainMenu');
                await fetchWorld()
                setRequestTransaction(false);
            })
            .catch((e: any) => {
                setTransactionStatus('error');
                console.error(e);
            });
    }

    // const [fontsLoaded] = useFonts({
    //     ToysRUs: require("../assets/fonts/toys_r_us.ttf"),
    // });

    // if (!fontsLoaded) {
    //     return null;
    // }

    // useEffect(() => {
    //     let isMounted = true;
    //     const fetchResources = async () => {
    //         // Make fetch  call to blockchain [existing player resources] (if data is not undefined and isMounted) - setResources.
    //         if (isMounted) {
    //         }
    //     };

    //     const fetchClaimableResources = async () => {
    //         // Make fetch call to blockchain [claimable Resources](if data is not undefined and isMounted) - setClaimableResources.
    //         if (isMounted) {
    //         }
    //     };
    //     // await fetchResources();
    //     return () => {
    //         isMounted = false;
    //     };
    // }, []);

    // NOTE: PRI use setResources to update the resources when you make your call to the BlOCKACHAIN
    const [resources, setResources] = useState({
        rubies: 0,
        lumber: 0,
        pearls: 0,
    });

    const [claimableResources, setClaimableResources] = useState({
        rubies: 12,
        lumber: 3,
        pearls: 8,
    });
    const [agiLvlUp, setAgiLvlup] = useState({
        rubies: "",
        lumber: "",
        pearls: "",
    });
    const [strLvlUp, setStrLvlup] = useState({
        rubies: "",
        lumber: "",
        pearls: "",
    });
    const [stamLvlUp, setStamLvlup] = useState({
        rubies: "",
        lumber: "",
        pearls: "",
    });
    const [intLvlUp, setIntLvlup] = useState({
        rubies: "",
        lumber: "",
        pearls: "",
    });

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
                const str = await gameContract.userAbilities(walletAddr, 1);
                const int = await gameContract.userAbilities(walletAddr, 2);
                const agi = await gameContract.userAbilities(walletAddr, 3);
                const stam = await gameContract.userAbilities(walletAddr, 4);
                const lvlstr_ruby = await gameContract.getLevelUpCost(1, 1, walletAddr);
                const lvlstr_lumber = await gameContract.getLevelUpCost(1, 2, walletAddr);
                const lvlstr_pearl = await gameContract.getLevelUpCost(1, 3, walletAddr);
                const lvlint_ruby = await gameContract.getLevelUpCost(2, 1, walletAddr);
                const lvlint_lumber = await gameContract.getLevelUpCost(2, 2, walletAddr);
                const lvlint_pearl = await gameContract.getLevelUpCost(2, 3, walletAddr);
                const lvlagi_ruby = await gameContract.getLevelUpCost(3, 1, walletAddr);
                const lvlagi_lumber = await gameContract.getLevelUpCost(3, 2, walletAddr);
                const lvlagi_pearl = await gameContract.getLevelUpCost(3, 3, walletAddr);
                const lvlstam_ruby = await gameContract.getLevelUpCost(4, 1, walletAddr);
                const lvlstam_lumber = await gameContract.getLevelUpCost(4, 2, walletAddr);
                const lvlstam_pearl = await gameContract.getLevelUpCost(4, 3, walletAddr);
                setIntLvlup({ rubies: (+ethers.utils.formatUnits(lvlint_ruby, 18)).toFixed(4), lumber: (+ethers.utils.formatUnits(lvlint_lumber, 18)).toFixed(4), pearls: (+ethers.utils.formatUnits(lvlint_pearl, 18)).toFixed(4) })
                setStamLvlup({ rubies: (+ethers.utils.formatUnits(lvlstam_ruby, 18)).toFixed(4), lumber: (+ethers.utils.formatUnits(lvlstam_lumber, 18)).toFixed(4), pearls: (+ethers.utils.formatUnits(lvlstam_pearl, 18)).toFixed(4) })
                setStrLvlup({ rubies: (+ethers.utils.formatUnits(lvlstr_ruby, 18)).toFixed(4), lumber: (+ethers.utils.formatUnits(lvlstr_lumber, 18)).toFixed(4), pearls: (+ethers.utils.formatUnits(lvlstr_pearl, 18)).toFixed(4) })
                setAgiLvlup({ rubies: (+ethers.utils.formatUnits(lvlagi_ruby, 18)).toFixed(4), lumber: (+ethers.utils.formatUnits(lvlagi_lumber, 18)).toFixed(4), pearls: (+ethers.utils.formatUnits(lvlagi_pearl, 18)).toFixed(4) })
                // function getLevelUpCost(uint256 ability, uint256 resource, address user)
                const [rubies, pearls, lumber] = (await gameContract.getResources(walletAddr)).map(x => (+ethers.utils.formatUnits(x, 18)).toFixed(2));
                setResources({ rubies, pearls, lumber })
                // console.log(str, int, agi, stam)
                // attributes: {
                //     strength: number;
                //     intellect: number;
                //     agility: number;
                //     stamina: number;
                // };
                // characterAbilities[character][1] = strength;
                // characterAbilities[character][2] = intellect;
                // characterAbilities[character][3] = agility;
                // characterAbilities[character][4] = stamina;
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
                    attributes: {
                        strength: str.toNumber(),
                        intellect: int.toNumber(),
                        agility: agi.toNumber(),
                        stamina: stam.toNumber()
                    },
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


    useLayoutEffect(() => {
        navigation.setOptions({
            headerBackTitle: "Main Menu",
            headerBackTitleStyle: {
                fontFamily: "ToysRUs",
            },
            headerTitle: "Guild",
            headerTitleStyle: {
                fontFamily: "ToysRUs",
            },
            headerStyle: { backgroundColor: "transparent" },
        });
    });

    // const onLayoutRootView = useCallback(async () => {
    //     if (fontsLoaded) {
    //         await SplashScreen.hideAsync();
    //     }
    // }, [fontsLoaded]);

    const { attributes } = player;
    // const currentLevel = attributes ? Object.values(attributes).reduce((a, b) => a + b) : 0;
    const currentLevel = 19;

    const ActionButtons = ({
        setIsClaimableDialogVisible,
        setIsLevelUpDialogVisible,
    }) => {
        return (
            <View style={styles.container}>
                <View style={styles.buttonContainer}>
                    <Button
                        titleStyle={styles.titleStyle}
                        buttonStyle={styles.buttonStyle}
                        onPress={() => setIsClaimableDialogVisible(true)}
                        title="Claim"
                    />
                </View>
                <View style={styles.buttonContainer}>
                    <Button
                        titleStyle={styles.titleStyle}
                        buttonStyle={styles.buttonStyle}
                        onPress={() => setIsLevelUpDialogVisible(true)}
                        title="Level Up"
                    />
                </View>
            </View>
        );
    };

    return (
        <View style={styles.cardContainer}>
            <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { fontFamily: "ToysRUs" }]}>
                    {player.username}
                </Text>
                <Text style={[styles.cardTitle, { fontFamily: "ToysRUs" }]}>
                    {player.name}
                </Text>
            </View>
            <View style={{ width: "100%", alignItems: "center" }}>
                <View style={styles.imageContainer}>
                    <Image
                        style={styles.cardImage}
                        source={{ uri: player.imgSrc }} // The player's image URL goes here
                    />
                </View>
                <LevelSection currentLevel={currentLevel} />
            </View>

            <AttributeSection
                agility={attributes?.agility}
                intellect={attributes?.intellect}
                strength={attributes?.strength}
                stamina={attributes?.stamina}
            />
            <Divider
                style={{ height: 4, borderWidth: 4, marginVertical: 16 }}
                orientation="vertical"
            />
            <ResourceSection
                lumber={resources.lumber}
                pearls={resources.pearls}
                ruby={resources.rubies}
            />
            <ActionButtons
                setIsClaimableDialogVisible={setIsClaimableDialogVisible}
                setIsLevelUpDialogVisible={setIsLevelUpDialogVisible}
            />
            {isClaimableDialogVisible && (
                <Dialog
                    isVisible={isClaimableDialogVisible}
                    overlayStyle={{ backgroundColor: "white" }}
                    onBackdropPress={() => {
                        setIsClaimableDialogVisible(false);
                    }}
                >
                    <Dialog.Title
                        title={`Claim Tokens`}
                        titleStyle={{ fontFamily: "ToysRUs" }}
                    />

                    <Text>
                        {Object.entries(claimableResources).map(([key, value], idx) => {
                            console.log(key);
                            console.log(value);

                            return (
                                <Text key={key} style={{ fontFamily: "ToysRUs", fontSize: 18 }}>
                                    {"\n"}
                                    {key}: {value}
                                </Text>
                            );
                        })}
                    </Text>

                    <Dialog.Actions>
                        <Dialog.Button
                            title="Confirm"
                            onPress={() => {
                                // TODO: Api Call use loading states.
                                setRequestTransaction(true);
                            }}
                        />
                        <Dialog.Button
                            title="Cancel"
                            onPress={() => setIsClaimableDialogVisible(false)}
                        />
                    </Dialog.Actions>
                </Dialog>
            )}
            {isLevelUpDialogVisible && (
                <Dialog
                    isVisible={isLevelUpDialogVisible}
                    overlayStyle={{ backgroundColor: "white" }}
                    onBackdropPress={() => {
                        setIsLevelUpDialogVisible(false);
                    }}
                >
                    {!requestingTransaction ? (
                        <>
                            <Text style={{ fontFamily: "ToysRUs", fontSize: 18 }}>
                                Level Up Your Skill
                            </Text>
                            {/* Should be using enums but its a hackathon so fuck it*/}
                            {ATTRIBUTES_LIST.map((l, i) => (
                                <CheckBox
                                    key={i}
                                    title={l}
                                    containerStyle={{ backgroundColor: "white", borderWidth: 0 }}
                                    checkedIcon="dot-circle-o"
                                    uncheckedIcon="circle-o"
                                    checked={checkedAttribute === i}
                                    onPress={() => setCheckedAttribute(i)}
                                />
                            ))}

                            <Text style={{ fontFamily: "ToysRUs" }}>
                                {_determineSkillPaymentAmount(
                                    ATTRIBUTES_LIST[checkedAttribute] as
                                    | "Agility"
                                    | "Stamina"
                                    | "Strength"
                                    | "Intellect",
                                    intLvlUp,
                                    strLvlUp, stamLvlUp, agiLvlUp
                                )}
                            </Text>

                            <Dialog.Actions>
                                <Dialog.Button
                                    title="Confirm"
                                    onPress={() => {
                                        // TODO: Api Call use loading states.
                                        handlePasskey(checkedAttribute + 1)
                                        setRequestTransaction(true);
                                    }}
                                />
                                <Dialog.Button
                                    title="Cancel"
                                    onPress={() => setIsLevelUpDialogVisible(false)}
                                />
                            </Dialog.Actions>
                        </>
                    ) : (
                        <Dialog.Loading />
                    )}
                </Dialog>
            )}
        </View>
    );
};

// some bullshit helper functino to calculate fake values
const _determineSkillPaymentAmount = (
    skill: "Agility" | "Stamina" | "Strength" | "Intellect",
    int: any,
    str: any,
    stam: any,
    agi: any
) => {
    let requiredAmount = "Required Amount: \n";
    switch (skill) {
        case "Agility":
            requiredAmount += agi.rubies + ` Rubies\n${agi.lumber} Lumber\n${agi.pearls} Pearls`;
            return requiredAmount;
        case "Stamina":
            requiredAmount += stam.rubies + ` Rubies\n${stam.lumber} Lumber\n${stam.pearls} Pearls`;
            return requiredAmount;
        case "Strength":
            requiredAmount += str.rubies + ` Rubies\n${str.lumber} Lumber\n${str.pearls} Pearls`;
            return requiredAmount;
        case "Intellect":
            requiredAmount += int.rubies + ` Rubies\n${int.lumber} Lumber\n${int.pearls} Pearls`;
            return requiredAmount;
        default:
            console.error(`unknwon skill bruh wtf... ${skill}`);
    }
};

const LevelSection = ({ currentLevel }: { currentLevel: number }) => {
    return (
        <View
            style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 4,
                width: "100%",
            }}
        >
            <Text style={[styles.cardLevel, { fontFamily: "ToysRUs" }]}>
                Level {currentLevel}
            </Text>
            <LinearProgress
                style={{
                    flex: 1,
                    marginVertical: 10,
                    width: 70,
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
                {currentLevel + 1}
            </Text>
        </View>
    );
};

const AttributeSection = ({
    strength,
    intellect,
    agility,
    stamina,
}: {
    strength: number;
    intellect: number;
    agility: number;
    stamina: number;
}) => {
    return (
        <View style={{ width: "100%" }}>
            <View
                style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 20,
                }}
            >
                <Text style={{ fontSize: 18, fontFamily: "ToysRUs" }}>
                    💪 Strength: {strength}
                </Text>
                <Text style={{ fontSize: 18, fontFamily: "ToysRUs" }}>
                    🏃‍♂️ Stamina: {stamina}
                </Text>
            </View>
            <View
                style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: 20,
                }}
            >
                <Text style={{ fontSize: 18, fontFamily: "ToysRUs" }}>
                    🤸‍♂️ Agility: {agility}
                </Text>
                <Text style={{ fontSize: 18, fontFamily: "ToysRUs" }}>
                    🧠 Intellect: {intellect}
                </Text>
            </View>
        </View>
    );
};

const ResourceSection = ({ ruby, pearls, lumber }) => {
    const ResourceItem = ({
        token,
        amount,
    }: {
        token: Token;
        amount: number;
    }) => {
        const iconMap = new Map([
            [Token.RUBY, "💎"],
            [Token.LUMBER, "🪵"],
            [Token.PEARL, "🫧"],
        ]);

        return (
            <View style={{ alignItems: "center" }}>
                <Text style={{ fontFamily: "ToysRUs", fontSize: 20 }}>{token}</Text>
                <Text style={{ fontFamily: "ToysRUs", fontSize: 20, marginTop: 16 }}>
                    {iconMap.get(token)} {amount}
                </Text>
            </View>
        );
    };

    return (
        <View style={{ width: "100%" }}>
            <View
                style={{
                    padding: 16,
                    justifyContent: "space-evenly",
                    alignItems: "center",
                    flexDirection: "row",
                }}
            >
                <ResourceItem token={Token.RUBY} amount={ruby} />
                <ResourceItem token={Token.LUMBER} amount={lumber} />
                <ResourceItem token={Token.PEARL} amount={pearls} />
            </View>
        </View>
    );
};

// NOTE FOR PRI: When you click these buttons (define a state above in the ProfileScreen and pass it as a prop to the ResourceSection component to update the displayed )

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

    container: {
        width: "100%",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    buttonContainer: {
        flex: 1, // This ensures that the button's container takes up equal space
        paddingHorizontal: 5, // Optional: Adds some spacing between the buttons
    },
    buttonStyle: {
        backgroundColor: "black",
        borderRadius: 4,
    },
    titleStyle: {
        fontFamily: "ToysRUs",
        color: "gold",
    },
});
