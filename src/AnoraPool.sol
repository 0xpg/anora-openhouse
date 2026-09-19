// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "forge-std/interfaces/IERC20.sol";

contract AnoraPool {
    enum Tranche {
        Senior,
        Junior
    }

    error SeniorCapacityExceeded();

    uint256 public constant BPS = 10_000;

    IERC20 public immutable asset;
    address public immutable riskAgent;
    uint256 public immutable seniorPerJuniorBps;

    uint256 public seniorAssets;
    uint256 public juniorAssets;
    uint256 public seniorTotalShares;
    uint256 public juniorTotalShares;
    mapping(address => uint256) public seniorShares;
    mapping(address => uint256) public juniorShares;

    event Deposited(address indexed provider, Tranche tranche, uint256 assets, uint256 shares);

    constructor(address asset_, address riskAgent_, uint256 seniorPerJuniorBps_) {
        asset = IERC20(asset_);
        riskAgent = riskAgent_;
        seniorPerJuniorBps = seniorPerJuniorBps_;
    }

    function seniorCapacity() public view returns (uint256) {
        uint256 cap = juniorAssets * seniorPerJuniorBps / BPS;
        return cap > seniorAssets ? cap - seniorAssets : 0;
    }

    function deposit(Tranche tranche, uint256 amount) external returns (uint256 shares) {
        if (tranche == Tranche.Senior) {
            if (amount > seniorCapacity()) revert SeniorCapacityExceeded();
            shares = _toShares(amount, seniorAssets, seniorTotalShares);
            seniorAssets += amount;
            seniorTotalShares += shares;
            seniorShares[msg.sender] += shares;
        } else {
            shares = _toShares(amount, juniorAssets, juniorTotalShares);
            juniorAssets += amount;
            juniorTotalShares += shares;
            juniorShares[msg.sender] += shares;
        }
        asset.transferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, tranche, amount, shares);
    }

    function _toShares(uint256 amount, uint256 assets, uint256 totalShares) internal pure returns (uint256) {
        if (totalShares == 0 || assets == 0) return amount;
        return amount * totalShares / assets;
    }
}
