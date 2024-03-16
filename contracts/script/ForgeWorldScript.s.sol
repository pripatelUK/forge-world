// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {ForgeWorld} from "../src/Game/ForgeWorld.sol";
import {ResourceToken} from "../src/Game/ResourceToken.sol";

contract ForgeWorldScript is Script {
    function setUp() public {}

    ForgeWorld public forgeWorld;

    function run() external {
        // Deploy ForgeWorld
        forgeWorld = new ForgeWorld();
        console.log("ForgeWorld deployed at:", address(forgeWorld));

        // Define user addresses
        address user1 = address(0x1);
        address user2 = address(0x2);
        address user3 = address(0x3);

        // Simulate user1 joining world 1
        vm.prank(user1);
        forgeWorld.userJoinWorld(1, 1);
        console.log("User1 joined world 1");

        // Simulate user2 joining world 2
        vm.prank(user2);
        forgeWorld.userJoinWorld(2, 1);
        console.log("User2 joined world 2");

        // Simulate time passage and epoch increment
        vm.warp(block.timestamp + 3600);
        forgeWorld.increaseEpoch();
        console.log("Epoch increased");

        // Simulate user1 claiming rewards
        vm.prank(user1);
        forgeWorld.userClaimRewards();
        console.log("User1 claimed rewards");

        // Simulate user2 claiming rewards
        vm.prank(user2);
        forgeWorld.userClaimRewards();
        console.log("User2 claimed rewards");
    }
}
