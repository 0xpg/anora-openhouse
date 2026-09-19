// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {TestUSDC} from "../test/utils/TestUSDC.sol";
import {AnoraPool} from "../src/AnoraPool.sol";

contract Deploy is Script {
    function run() external {
        address riskAgent = vm.envOr("RISK_AGENT", msg.sender);
        vm.startBroadcast();
        TestUSDC usdc = new TestUSDC();
        AnoraPool pool = new AnoraPool(
            address(usdc),
            riskAgent,
            AnoraPool.Policy({
                seniorPerJuniorBps: 22_500,
                minFirstLossBps: 1_000,
                financingFeeBps: 200,
                lateFeePerDayBps: 10,
                seniorFeeShareBps: 6_000
            })
        );
        vm.stopBroadcast();
        console.log("TestUSDC", address(usdc));
        console.log("AnoraPool", address(pool));
        console.log("riskAgent", riskAgent);
    }
}
