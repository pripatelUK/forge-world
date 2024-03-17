import { Image, StyleSheet, View, Text } from "react-native";
import { useContext } from "react";
import { GameContext } from "../contexts/GameContext";
import { useFonts } from "expo-font";

const Avatar = () => {
  const { player } = useContext(GameContext);

  if (!player || !player.imgSrc) {
    return null;
  }

  const [fontsLoaded] = useFonts({
    ToysRUs: require("../assets/fonts/toys_r_us.ttf"),
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={{ flexDirection: "row" }}>
      <View
        style={{
          borderRadius: 10,
          backgroundColor: "rgba(0,0,0,0.5)",
          padding: 8,
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "row",
        }}
      >
        <Image style={styles.avatarImage} source={{ uri: player.imgSrc }} />
        <Text style={{ marginLeft: 10, color: "white", fontFamily: "ToysRUs" }}>
          {player.username}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 50,
    // Add styles to position your avatar within the World component
  },
});

export default Avatar;
