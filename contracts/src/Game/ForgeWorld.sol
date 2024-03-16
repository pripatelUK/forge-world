// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import "./ResourceToken.sol";
import "./IForgeWorld.sol";
import {console} from "forge-std/Script.sol";

contract ForgeWorld is IForgeWorld {
    // Global game state
    uint256 public epoch;
    uint256 public lastEpochTimestamp;
    uint256 public worldCounter;
    uint256 public abilityCounter;
    uint256 public characterCounter;
    uint256 public globalPopulation;

    // Cumulative collection mapping for user awarded emissions.
    // epoch => resource => amount
    mapping(uint256 => mapping(address => uint256))
        public cumulativeResourceCollectedPerEpoch;

    // User state
    mapping(address => uint256) public userCurrentWorld;
    mapping(address => uint256) public userLastEpochClaimed;
    mapping(address => mapping(uint256 => uint256)) public userAbilities;

    // Character default starting abilities
    // character -> ability -> value
    mapping(uint256 => mapping(uint256 => uint256)) public characterAbilities;

    // World mappings
    mapping(uint256 => address) public worldToTokenResource;
    mapping(uint256 => uint256) public worldPopulation;
    // World to token rate, etc etc.

    uint256[] public worlds;
    uint256[] public abilities;

    modifier tryIncreaseEpoch() {
        increaseEpoch();
        _;
    }

    modifier requireUserExists(address user) {
        require(userCurrentWorld[user] != 0, "User does not exist");
        _;
    }

    modifier validateWorld(uint256 world) {
        require(world != 0, "Cannot join the 0 start world");
        require(world <= worldCounter, "World does not exist.");
        _;
    }

    modifier validateAbility(uint256 ability) {
        require(ability != 0, "Ability 0 does not exist.");
        require(ability <= abilityCounter, "Ability does not exist.");
        _;
    }

    modifier validateCharacter(uint256 character) {
        require(character != 0, "Character 0 does not exist");
        require(character <= characterCounter, "Character does not exist.");
        _;
    }

    modifier claimRewards() {
        userClaimRewards();
        _;
    }

    constructor() {
        _deployWorld("Rubies", "RUBY");
        _deployWorld("Pearls", "PEARL");
        _deployWorld("Lumber", "LUMBER");

        _deployAbility("Strength");
        _deployAbility("Intellect");
        _deployAbility("Agility");
        _deployAbility("Stamina");

        // Set character abilities
        _setCharacterAbilities(1, 12, 6, 20, 10); // Doge Da Dog
        _setCharacterAbilities(2, 20, 8, 8, 12); // Bober
        _setCharacterAbilities(3, 5, 20, 12, 10); // Pepe
        _setCharacterAbilities(4, 17, 15, 5, 10); // PepePig
        _setCharacterAbilities(5, 10, 15, 10, 12); // Twinky Winky
        _setCharacterAbilities(6, 5, 12, 15, 15); // Cryp-Po

        characterCounter = 6;

        lastEpochTimestamp = block.timestamp;
        // Adjust lastEpochTimestamp to the start of the current hour
        lastEpochTimestamp -= lastEpochTimestamp % 3600;

        // start at epoch 1
        epoch++;
    }

    function _setCharacterAbilities(
        uint256 character,
        uint256 strength,
        uint256 intellect,
        uint256 agility,
        uint256 stamina
    ) internal {
        characterAbilities[character][1] = strength;
        characterAbilities[character][2] = intellect;
        characterAbilities[character][3] = agility;
        characterAbilities[character][4] = stamina;
    }

    function _deployWorld(string memory name, string memory symbol) internal {
        worldCounter++;

        address token = address(new ResourceToken(name, symbol));
        worldToTokenResource[worldCounter] = token;
        worlds.push(worldCounter);

        emit WorldDeployed(worldCounter, token, name, symbol);
    }

    function _deployAbility(string memory name) internal {
        abilityCounter++;
        abilities.push(abilityCounter);

        emit AbilityDeployed(abilityCounter, name);
    }

    function userJoinWorld(
        uint256 world,
        uint256 character
    )
        public
        tryIncreaseEpoch
        validateWorld(world)
        validateCharacter(character)
    {
        require(userCurrentWorld[msg.sender] == 0, "User already joined");

        userCurrentWorld[msg.sender] = world;
        worldPopulation[world]++;
        userLastEpochClaimed[msg.sender] = epoch;

        // Initialize user abilities based on the chosen character
        for (uint256 i = 1; i <= abilityCounter; i++) {
            userAbilities[msg.sender][i] = characterAbilities[character][i];
        }

        for (uint256 i = 1; i <= worldCounter; i++) {
            _mintToken(worldToTokenResource[i], msg.sender, 100e18);
        }

        globalPopulation++;
        emit UserJoinedWorld(msg.sender, world);
    }

    function userLevelUpAbility(
        uint256 ability
    ) public claimRewards validateAbility(ability) {
        for (uint256 i = 1; i <= worldCounter; i++) {
            _burnToken(worldToTokenResource[i], getLevelUpCost(ability, i));
        }
        userAbilities[msg.sender][ability]++;
    }

    function getLevelUpCost(
        uint256 ability,
        uint256 resource
    ) public view returns (uint256) {
        uint256 baseAmount = 5e18 * userAbilities[msg.sender][ability];
        uint256 rand = uint(
            keccak256(
                abi.encodePacked(
                    msg.sender,
                    resource,
                    userAbilities[msg.sender][ability]
                )
            )
        ) % (baseAmount);

        bool shouldAdd = rand & 1 == 1;

        if (shouldAdd) {
            return baseAmount + rand;
        } else {
            return baseAmount - rand;
        }
    }

    // function to move worlds. Moving worlds will forfeit all resources you are collecting this epoch
    function userMoveWorld(
        uint256 world
    ) public validateWorld(world) claimRewards {
        // Could impose cost on user for moving worlds.
        uint256 currentWorld = userCurrentWorld[msg.sender];
        worldPopulation[currentWorld]--;

        userCurrentWorld[msg.sender] = world;
        worldPopulation[world]++;
        userLastEpochClaimed[msg.sender] = epoch;

        emit UserMovedWorld(msg.sender, currentWorld, world);
    }

    function userClaimRewards()
        public
        tryIncreaseEpoch
        requireUserExists(msg.sender)
    {
        uint256 lastEpochClaimed = userLastEpochClaimed[msg.sender];
        if (lastEpochClaimed < epoch) {
            if (epoch - lastEpochClaimed > 12) {
                // can only claim from last 12 epochs
                lastEpochClaimed = epoch - 12;
            }
            address resourceAddress = worldToTokenResource[
                userCurrentWorld[msg.sender]
            ];

            uint256 reward = cumulativeResourceCollectedPerEpoch[epoch][
                resourceAddress
            ] -
                cumulativeResourceCollectedPerEpoch[lastEpochClaimed][
                    resourceAddress
                ];

            _mintToken(resourceAddress, msg.sender, reward);

            userLastEpochClaimed[msg.sender] = epoch;

            emit UserClaimedRewards(msg.sender, epoch, resourceAddress, reward);
        }
    }

    function increaseEpoch() public {
        // Use simple gelato cron job to make sure this is called every hour.
        if (block.timestamp >= lastEpochTimestamp + 3600) {
            lastEpochTimestamp = block.timestamp;
            lastEpochTimestamp -= lastEpochTimestamp % 3600; // quantize to the start of the hour

            epoch++;

            for (uint i = 0; i < worlds.length; i++) {
                uint256 world = worlds[i];

                uint256 psudeoRandomMultipler = (uint(
                    keccak256(
                        abi.encodePacked(
                            block.timestamp,
                            msg.sender,
                            block.prevrandao,
                            i
                        )
                    )
                ) % 9) + 1;

                uint256 incrementAmount = (globalPopulation *
                    psudeoRandomMultipler *
                    100e18) / worldCounter;

                address resourceAddress = worldToTokenResource[world];
                uint256 population = worldPopulation[world];

                if (population == 0) {
                    population = 1; // avoid division by 0
                }

                cumulativeResourceCollectedPerEpoch[epoch][resourceAddress] =
                    cumulativeResourceCollectedPerEpoch[epoch - 1][
                        resourceAddress
                    ] +
                    (incrementAmount / population);
            }
            emit EpochIncreased(epoch);
        }
    }

    function _mintToken(address token, address to, uint256 amount) internal {
        ResourceToken(token).mint(to, amount);
    }

    function _burnToken(address token, uint256 amount) internal {
        ResourceToken(token).burnFrom(msg.sender, amount);
    }
}
