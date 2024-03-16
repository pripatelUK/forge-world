// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {ForgeWorld} from "../src/Game/ForgeWorld.sol";
import {ResourceToken} from "../src/Game/ResourceToken.sol";

contract ForgeWorldTest is Test {
    ForgeWorld public forgeWorld;

    function setUp() public {
        forgeWorld = new ForgeWorld();
    }

    function testInitialEpoch() public {
        assertEq(forgeWorld.epoch(), 1, "Initial epoch should be 1");
    }

    function testUserJoinWorld() public {
        address user = address(1);
        vm.prank(user);
        forgeWorld.userJoinWorld(1, 1);
        assertEq(
            forgeWorld.userCurrentWorld(user),
            1,
            "User should be in world 1"
        );
    }

    function testUserClaimRewards() public {
        // User joins world 1
        address user = address(2);
        vm.prank(user);
        forgeWorld.userJoinWorld(1, 1);

        // Simulate time passage and epoch increment
        vm.warp(block.timestamp + 3600);
        forgeWorld.increaseEpoch();

        // User claims rewards
        vm.prank(user);
        forgeWorld.userClaimRewards();

        address token = forgeWorld.worldToTokenResource(1);
        uint256 userBalance = ResourceToken(token).balanceOf(user);
        console.log("User balance:", userBalance);
        assertTrue(userBalance > 0, "User should have received rewards");
    }
}
