// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {TestUSDC} from "../test/utils/TestUSDC.sol";
import {AnoraPool} from "../src/AnoraPool.sol";

contract Deploy is Script {
    function run() external {
        address riskAgent = vm.envOr("RISK_AGENT", msg.sender);
        address asset = vm.envOr("POOL_ASSET", address(0));
        uint256 depositCap = vm.envOr("DEPOSIT_CAP", uint256(1_000_000_000e6));
        vm.startBroadcast();
        if (asset == address(0)) asset = address(new TestUSDC());
        AnoraPool pool = new AnoraPool(
            asset,
            riskAgent,
            AnoraPool.Policy({
                seniorPerJuniorBps: 22_500,
                minFirstLossBps: 1_000,
                financingFeeBps: 200,
                lateFeePerDayBps: 10,
                seniorFeeShareBps: 6_000,
                depositCap: depositCap
            })
        );
        vm.stopBroadcast();
        console.log("asset", asset);
        console.log("AnoraPool", address(pool));
        console.log("riskAgent", riskAgent);
        console.log("depositCap", depositCap);
    }
}
