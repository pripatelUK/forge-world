import "fast-text-encoding";
import '@walletconnect/react-native-compat';
import '@ethersproject/shims';
import process from 'process';
global.process = process;
import { WagmiConfig } from 'wagmi'
import {
  arbitrum,
  mainnet,
  polygon,
  avalanche,
  bsc,
  optimism,
  gnosis,
  zkSync,
  zora,
  base,
  celo,
  aurora,
} from 'wagmi/chains';
import { createWeb3Modal, defaultWagmiConfig, Web3Modal, W3mButton } from '@web3modal/wagmi-react-native'
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { FlexView, Text } from '@web3modal/ui-react-native';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';

import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';

// import { HomeScreen } from './components/HomeScreen';
// import { CreateAccount } from './components/CreateAccount';
// import { CustomerTransactionScreen } from './components/CustomerTransactionScreen';
import { GameContextProvider } from "./contexts/GameContext";
import { HomeScreen } from './components/HomeScreen';
import { CreateAccount } from './components/CreateAccount';
import { WorldsScreen } from './components/WorldsScreen';
import { ProfileScreen } from "./components/ProfileScreen";
import { MainMenuScreen } from "./screens/MainMenuScreen";
import { CharacterSelectScreen } from "./screens/CharacterSelectScreen";
import { GameScreen } from "./screens/GameScreen";
import LeaderboardScreen from "./screens/LeaderboardScreen";

const Stack = createStackNavigator();

// 1. Get projectId
const projectId = '49a082ffca38748d2ef8acceca12a92e'

// 2. Create config
const metadata = {
  name: 'Forge World',
  description: 'Forge World',
  url: 'https://crosspay.xyz',
  icons: ['https://avatars.githubusercontent.com/u/37784886'],
  redirect: {
    native: 'crosspay://',
    // universal: 'YOUR_APP_UNIVERSAL_LINK.com'
  },
};


const chains = [
  mainnet,
  polygon,
  avalanche,
  arbitrum,
  bsc,
  optimism,
  gnosis,
  zkSync,
  zora,
  base,
  celo,
  aurora,
];

const wagmiConfig = defaultWagmiConfig({ chains, projectId, metadata })

// 3. Create modal
createWeb3Modal({
  projectId,
  chains,
  wagmiConfig
})

// initialize NfcManager on application's startup
NfcManager.start();

export default function App() {

  const isDarkMode = useColorScheme() === 'dark';
  const [initialized, setInitialized] = useState(false);
  const [sessionToken, setSessionToken] = useState(null);

  useEffect(() => {
    (async () => {
      const storedToken = await AsyncStorage.getItem('@session_token');

      if (storedToken) {
        setSessionToken(storedToken);
      }

      setInitialized(true);
    })();
  }, []);

  if (!initialized) {
    return null;
  }



  return (
    <WagmiConfig config={wagmiConfig}>
      <GameContextProvider>
        <NavigationContainer>
          <StatusBar barStyle={isDarkMode ? 'dark-content' : 'dark-content'} />
          <Stack.Navigator
            initialRouteName={sessionToken ? 'Home' : 'CharacterSelectScreen'}
            screenOptions={{ headerShown: false }}>
            <Stack.Screen name="CreateVirtual" component={CharacterSelectScreen} />
            <Stack.Screen name="Home" component={HomeScreen} />
            {/* <Stack.Screen name="ArxRegister" component={ArxRegisterScreen} /> */}
            <Stack.Screen name="Worlds" component={WorldsScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name={"MainMenu"} component={MainMenuScreen} />
            <Stack.Screen
              name={"CharacterSelect"}
              component={CharacterSelectScreen}
            />
            <Stack.Screen name={"Game"} component={GameScreen} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </GameContextProvider>
    </WagmiConfig>
  )
}