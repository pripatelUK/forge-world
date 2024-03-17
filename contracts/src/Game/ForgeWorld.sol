// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import "./ResourceToken.sol";
import "./IForgeWorld.sol";
import { console } from "forge-std/Script.sol";
import "ens-contracts/ethregistrar/IETHRegistrarController.sol";
import "ens-contracts/ethregistrar/IPriceOracle.sol";
import "ens-contracts/wrapper/INameWrapper.sol";

import { IPoolManager } from "v4-core/interfaces/IPoolManager.sol";
import { IHooks } from "v4-core/interfaces/IHooks.sol";
import { PoolKey } from "v4-core/types/PoolKey.sol";
import { CurrencyLibrary, Currency } from "v4-core/types/Currency.sol";
import { PoolModifyLiquidityTest } from "v4-core/test/PoolModifyLiquidityTest.sol";

contract ForgeWorld is IForgeWorld {
    using CurrencyLibrary for Currency;

    // Global game state
    uint256 public epoch;
    uint256 public lastEpochTimestamp;
    uint256 public worldCounter;
    uint256 public abilityCounter;
    uint256 public characterCounter;
    uint256 public globalPopulation;

    // Cumulative collection mapping for user awarded emissions.
    // epoch => resource => amount
    mapping(uint256 => mapping(address => uint256)) public cumulativeResourceCollectedPerEpoch;

    // User state
    mapping(address => uint256) public userCurrentWorld;
    mapping(address => uint256) public userLastEpochClaimed;
    mapping(address => uint256) public userCharacter;
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
    )
        internal
    {
        characterAbilities[character][1] = strength;
        characterAbilities[character][2] = intellect;
        characterAbilities[character][3] = agility;
        characterAbilities[character][4] = stamina;
    }

    function _ensRegistration(address _resolver, address _registrar, address _priceOracle) external payable {
        string memory name = "forgeworld";
        uint256 duration = 31_536_000; // 1 year in seconds
        bytes32 secret = 0x0; // No secret required for this example, assume not frontrun.
        address resolver = _resolver; // Change and set resolver
        bytes[] memory data = new bytes[](0); // no DNS records to set initially
        bool reverseRecord = true;
        uint16 ownerControlledFuses = 0; // Assuming no fuses are controlled by the owner

        // Fetch the price for the registration
        IPriceOracle.Price memory price = IPriceOracle(_priceOracle).price(name, 0, duration);
        uint256 totalCost = price.base + price.premium;

        // Ensure the contract has enough balance to cover the registration cost
        require(address(this).balance >= totalCost, "Insufficient balance for registration");

        // Call the register function on the ENS registrar
        IETHRegistrarController(_registrar).register{ value: totalCost }(
            name,
            address(this), // Owner of the domain will be this contract
            duration,
            secret,
            resolver,
            data,
            reverseRecord,
            ownerControlledFuses
        );
    }

    function getNamehashForForgeworldEth() public pure returns (bytes32) {
        bytes32 ethNode = keccak256(abi.encodePacked(bytes32(0), keccak256(abi.encodePacked("eth"))));
        return keccak256(abi.encodePacked(ethNode, keccak256(abi.encodePacked("forgeworld"))));
    }

    function _setSubdomainOwner(
        address nameWrapperContract,
        string memory subdomainLabel,
        address subdomainOwner,
        uint32 fuses,
        uint64 expiry
    )
        internal
    {
        // Call the setSubnodeOwner function on the INameWrapper contract
        // Can only call once "forgeworld.eth" is already wrapped and owned by this contract which happens in
        // _ensRegistration function
        bytes32 subdomainNode = INameWrapper(nameWrapperContract).setSubnodeOwner(
            getNamehashForForgeworldEth(), subdomainLabel, subdomainOwner, fuses, expiry
        );
    }

    function _deployWorld(string memory name, string memory symbol) internal {
        worldCounter++;

        address token = address(new ResourceToken(name, symbol));
        ResourceToken(token).approve(address(lpRouter), type(uint256).max); // approve uni lp router to spend the token

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
        uint256 character,
        string memory name
    )
        public
        tryIncreaseEpoch
        validateWorld(world)
        validateCharacter(character)
    {
        require(userCurrentWorld[msg.sender] == 0, "User already joined");

        userCurrentWorld[msg.sender] = world;
        userCharacter[msg.sender] = character;
        worldPopulation[world]++;
        userLastEpochClaimed[msg.sender] = epoch;

        // Initialize user abilities based on the chosen character
        for (uint256 i = 1; i <= abilityCounter; i++) {
            userAbilities[msg.sender][i] = characterAbilities[character][i];
        }

        for (uint256 i = 1; i <= worldCounter; i++) {
            _mintToken(worldToTokenResource[i], msg.sender, 100e18);
        }

        // once name wrapper is deployed and found on Base
        address nameWrapperAddress = address(0);

        if (nameWrapperAddress != address(0)) {
            _setSubdomainOwner(nameWrapperAddress, name, msg.sender, 0, 0);
        }

        globalPopulation++;
        emit UserJoinedWorld(msg.sender, world);
    }

    function getResources(address person) public view returns (uint256[] memory balances) {
        balances = new uint256[](worldCounter);
        for (uint256 i = 0; i < worldCounter; i++) {
            balances[i] = ResourceToken(worldToTokenResource[i + 1]).balanceOf(person);
        }
        return balances;
    }

    function userLevelUpAbility(uint256 ability) public claimRewards validateAbility(ability) {
        for (uint256 i = 1; i <= worldCounter; i++) {
            _burnToken(worldToTokenResource[i], getLevelUpCost(ability, i, msg.sender));
        }
        userAbilities[msg.sender][ability]++;
    }

    function getLevelUpCost(uint256 ability, uint256 resource, address user) public view returns (uint256) {
        uint256 baseAmount = 5e18 * userAbilities[user][ability];
        uint256 rand = uint256(keccak256(abi.encodePacked(user, resource, userAbilities[user][ability]))) % (baseAmount);

        bool shouldAdd = rand & 1 == 1;

        if (shouldAdd) {
            return baseAmount + rand;
        } else {
            return baseAmount - rand;
        }
    }

    // function to move worlds. Moving worlds will forfeit all resources you are collecting this epoch
    function userMoveWorld(uint256 world) public validateWorld(world) claimRewards {
        // Could impose cost on user for moving worlds.
        uint256 currentWorld = userCurrentWorld[msg.sender];
        worldPopulation[currentWorld]--;

        userCurrentWorld[msg.sender] = world;
        worldPopulation[world]++;
        userLastEpochClaimed[msg.sender] = epoch;

        emit UserMovedWorld(msg.sender, currentWorld, world);
    }

    function userClaimRewards() public tryIncreaseEpoch requireUserExists(msg.sender) {
        uint256 lastEpochClaimed = userLastEpochClaimed[msg.sender];
        if (lastEpochClaimed < epoch) {
            if (epoch - lastEpochClaimed > 12) {
                // can only claim from last 12 epochs
                lastEpochClaimed = epoch - 12;
            }
            address resourceAddress = worldToTokenResource[userCurrentWorld[msg.sender]];

            uint256 reward = cumulativeResourceCollectedPerEpoch[epoch][resourceAddress]
                - cumulativeResourceCollectedPerEpoch[lastEpochClaimed][resourceAddress];

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

            for (uint256 i = 0; i < worlds.length; i++) {
                uint256 world = worlds[i];

                uint256 psudeoRandomMultipler =
                    (uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, block.prevrandao, i))) % 9) + 1;

                uint256 incrementAmount = (globalPopulation * psudeoRandomMultipler * 100e18) / worldCounter;

                address resourceAddress = worldToTokenResource[world];
                uint256 population = worldPopulation[world];

                if (population == 0) {
                    population = 1; // avoid division by 0
                }

                cumulativeResourceCollectedPerEpoch[epoch][resourceAddress] =
                    cumulativeResourceCollectedPerEpoch[epoch - 1][resourceAddress] + (incrementAmount / population);
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

    IPoolManager manager = IPoolManager(address(0x01));
    PoolModifyLiquidityTest lpRouter = PoolModifyLiquidityTest(address(0x02));

    function create_pool_and_seed_pool(address token0, address token1) external {
        // sort tokens
        if (token0 > token1) {
            (token0, token1) = (token1, token0);
        }

        address hook = address(0x80); // prefix indicates the hook only has a beforeInitialize() function

        uint24 swapFee = 3000; // 0.30% fee tier
        int24 tickSpacing = 60;

        // floor(sqrt(1) * 2^96)
        uint160 sqrtPriceX96 = 79_228_162_514_264_337_593_543_950_336;

        // Assume the custom hook requires a timestamp when initializing it
        bytes memory hookData = abi.encode(block.timestamp);

        PoolKey memory pool = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: swapFee,
            tickSpacing: tickSpacing,
            hooks: IHooks(hook)
        });
        manager.initialize(pool, sqrtPriceX96, hookData);

        // mint tokens
        _mintToken(token0, address(this), 10e30);
        _mintToken(token1, address(this), 10e30);

        // then add liquidity (approval already given to router when token created)
        int24 tickLower = -1000;
        int24 tickUpper = 1000;
        int256 liquidity = 10e27;
        lpRouter.modifyLiquidity(
            pool,
            IPoolManager.ModifyLiquidityParams({ tickLower: tickLower, tickUpper: tickUpper, liquidityDelta: liquidity }),
            new bytes(0)
        );
    }
}
