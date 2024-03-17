// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { EntryPoint } from "@account-abstraction/contracts/core/EntryPoint.sol";
import { WebAuthn256r1 } from "../src/Lib/WebAuthn256r1.sol";
import { console2 } from "@forge-std/console2.sol";
import { Test } from "@forge-std/Test.sol";
import { WebAuthnAccountFactory } from "../src/Accounts/WebAuthnAccountFactory.sol";
import { Paymaster } from "../src/Paymaster/Paymaster.sol";
import { BaseScript } from "./Base.s.sol";
import { IEntryPoint } from "@account-abstraction/contracts/interfaces/IEntryPoint.sol";
import { IERC20 } from "@chainlink/contracts-ccip/src/v0.8/vendor/openzeppelin-solidity/v4.8.0/token/ERC20/IERC20.sol";
import { ForgeWorld } from "../src/Game/ForgeWorld.sol";

contract DeployAnvil is BaseScript, Test {
    ForgeWorld public forgeWorld;

    function run() external broadcast returns (address[3] memory) {
        // vm.stopBroadcast();
        // vm.startBroadcast(vm.envUint("ANVIL_PK"));
        // address addrAnvil = vm.addr(vm.envUint("ANVIL_PK"));
        // deploy the library contract and return the address
        EntryPoint entryPoint = new EntryPoint();
        console2.log("entrypoint", address(entryPoint));

        address webAuthnAddr = address(new WebAuthn256r1());
        console2.log("WebAuthn256r1", webAuthnAddr);

        Paymaster paymaster = new Paymaster(entryPoint, msg.sender);
        console2.log("paymaster", address(paymaster));
        console2.log("paymaster owner", msg.sender);

        // vm.stopBroadcast();
        // vm.startBroadcast(vm.envUint("ANVIL_PK"));
        paymaster.addStake{ value: 0.1 ether }(60 * 10);
        // paymaster.deposit{ value: 100000 wei }();
        paymaster.deposit{ value: 0.1 ether }();
        console2.log("paymaster deposit", paymaster.getDeposit());

        EntryPoint.DepositInfo memory DepositInfo = entryPoint.getDepositInfo(address(paymaster));
        console2.log("paymaster staked", DepositInfo.staked);
        console2.log("paymaster stake", DepositInfo.stake);
        console2.log("paymaster deposit", DepositInfo.deposit);
        console2.log("paymaster unstakeDelaySec", DepositInfo.unstakeDelaySec);
        console2.log("paymaster withdrawTime", DepositInfo.withdrawTime);

        webAuthnFactory(address(entryPoint), webAuthnAddr);

        // Deploy ForgeWorld
        forgeWorld = new ForgeWorld();
        console2.log("forgeWorld", address(forgeWorld));
        return [address(entryPoint), webAuthnAddr, address(paymaster)];
    }

    function webAuthnFactory(address entryPoint, address webAuthnr1) public {
        address loginService = address(0xa8C9d55b0F734cAadfA2384d553464714b3A6369);
        WebAuthnAccountFactory webAuthnAccountFactory =
            new WebAuthnAccountFactory(IEntryPoint(entryPoint), webAuthnr1, loginService);

        console2.log("webAuthnAccountFactory", address(webAuthnAccountFactory));
    }
}
