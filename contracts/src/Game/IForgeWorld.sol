// cast interface -n IForgeWorld ./out/ForgeWorld.sol/ForgeWorld.json
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IForgeWorld {
    event AbilityDeployed(uint256 indexed AbilityId, string name);
    event EpochIncreased(uint256 newEpoch);
    event UserClaimedRewards(address indexed user, uint256 epoch, address resourceAddress, uint256 reward);
    event UserJoinedWorld(address indexed user, uint256 world);
    event UserMovedWorld(address indexed user, uint256 fromWorld, uint256 toWorld);
    event WorldDeployed(uint256 indexed worldId, address tokenResource, string name, string symbol);

    function _ensRegistration(address _resolver, address _registrar, address _priceOracle) external payable;
    function abilities(uint256) external view returns (uint256);
    function abilityCounter() external view returns (uint256);
    function characterAbilities(uint256, uint256) external view returns (uint256);
    function characterCounter() external view returns (uint256);
    function create_pool_and_seed_pool(address token0, address token1) external;
    function cumulativeResourceCollectedPerEpoch(uint256, address) external view returns (uint256);
    function epoch() external view returns (uint256);
    function getLevelUpCost(uint256 ability, uint256 resource, address user) external view returns (uint256);
    function getNamehashForForgeworldEth() external pure returns (bytes32);
    function globalPopulation() external view returns (uint256);
    function increaseEpoch() external;
    function lastEpochTimestamp() external view returns (uint256);
    function userAbilities(address, uint256) external view returns (uint256);
    function userCharacter(address) external view returns (uint256);
    function userClaimRewards() external;
    function userCurrentWorld(address) external view returns (uint256);
    function userJoinWorld(uint256 world, uint256 character, string memory name) external;
    function userLastEpochClaimed(address) external view returns (uint256);
    function userLevelUpAbility(uint256 ability) external;
    function userMoveWorld(uint256 world) external;
    function worldCounter() external view returns (uint256);
    function worldPopulation(uint256) external view returns (uint256);
    function worldToTokenResource(uint256) external view returns (address);
    function worlds(uint256) external view returns (uint256);
}
