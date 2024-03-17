import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Image } from "@rneui/themed";
import React, { useLayoutEffect, useState } from "react";
import {
  FlatList,
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { RootStackParamList } from "../types/types";
import { PEPE_IMAGE_URL, PEPE_PIG_IMAGE_URL } from "./CharacterSelectScreen";

export type LeaderboardScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Leaderboard">;
};

const COLOR_MAP = new Map([
  [0, "gold"],
  [1, "silver"],
  [2, "#CD7F32"],
]);
const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({
  navigation,
}) => {
  // Set type based on what Blockchain smart contract endpoint returns
  const [players, setPlayers] = useState([
    { username: "james.forgeworld.eth", imgSrc: PEPE_IMAGE_URL, level: 54 },
    { username: "Pri.forgeworld.eth", imgSrc: PEPE_PIG_IMAGE_URL, level: 19 },
    { username: "jonjon.forgeworld.eth", imgSrc: PEPE_PIG_IMAGE_URL, level: 14 },
    { username: "raman.forgeworld.eth", imgSrc: PEPE_PIG_IMAGE_URL, level: 12 },
    { username: "tester.forgeworld.eth", imgSrc: PEPE_PIG_IMAGE_URL, level: 12 },
    { username: "new.forgeworld.eth", imgSrc: PEPE_PIG_IMAGE_URL, level: 12 },
    { username: "test2.forgeworld.eth", imgSrc: PEPE_PIG_IMAGE_URL, level: 12 },
    { username: "test22.forgeworld.eth", imgSrc: PEPE_PIG_IMAGE_URL, level: 12 },
    { username: "test1.forgeworld.eth", imgSrc: PEPE_PIG_IMAGE_URL, level: 12 },
    { username: "test2.forgeworld.eth", imgSrc: PEPE_PIG_IMAGE_URL, level: 12 },
    // { username: "PlaceHolder", imgSrc: PEPE_PIG_IMAGE_URL, level: 12 },
    // { username: "PlaceHolder", imgSrc: PEPE_PIG_IMAGE_URL, level: 12 },
  ]);

  useLayoutEffect(() => {
    navigation.setOptions({
      //   headerLeft: () => <Text style={{ fontFamily: "ToysRUs" }}>Main Men</Text>,

      headerBackTitleStyle: {
        fontFamily: "ToysRUs",
      },
      headerTitle: "Leaderboard",
      headerTitleStyle: {
        fontFamily: "ToysRUs",
      },
    });
  });

  // Set return type based on state and blockchain end point
  const fetchLeaderboardData = async () => {
    // TODO: Fill out};
  };

  return (
    <ImageBackground
      source={require("../assets/leaderboard-bg.png")}
      style={{ flex: 1, justifyContent: "center", padding: 0, margin: 0 }}
    >
      <View
        style={{
          flex: 1,
          borderWidth: 1,
          width: "100%",

          borderColor: "gold",
          padding: 16,
        }}
      >
        <FlatList
          data={players}
          scrollEnabled
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item, index, separators }) => (
            <LeaderboardItem
              imgSrc={item.imgSrc}
              username={item.username}
              level={item.level}
              idx={index}
            />
          )}
        />
      </View>
    </ImageBackground>
  );
};

const LeaderboardItem = ({
  idx,
  imgSrc,
  username,
  level,
}: {
  idx: number;
  imgSrc: string;
  username: string;
  level: number;
}) => {
  return (
    <View style={styles.leaderboardItemContainer}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            backgroundColor: COLOR_MAP.get(idx) || "black",
            borderRadius: 20,
            padding: 4,
            borderWidth: 2,
            marginRight: 4,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              color: "white",
              fontWeight: "bold",
              padding: 4,
            }}
          >
            #{idx}
          </Text>
        </View>
        <Image source={{ uri: imgSrc }} width={40} height={40} />
        <Text style={{ fontSize: 20, color: "white" }}>{username}</Text>
      </View>
      <View>
        <Text style={{ fontSize: 20, fontWeight: "bold", color: "white" }}>
          Lv {level}
        </Text>
      </View>
    </View>
  );
};

export default LeaderboardScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  leaderboardItemContainer: {
    backgroundColor: "rgba(0,0,0,0.5)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 16,
  },
});
