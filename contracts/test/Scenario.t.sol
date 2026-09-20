// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {TestUSDC} from "./utils/TestUSDC.sol";
import {AnoraPool} from "../src/AnoraPool.sol";

contract ScenarioTest is Test {
    uint256 constant USDC = 1e6;

    TestUSDC usdc;
    AnoraPool pool;

    address riskAgent = makeAddr("riskAgent");
    address seniorLender = makeAddr("seniorLender");
    address juniorLender = makeAddr("juniorLender");
    address originator = makeAddr("originator");

    function setUp() public {
        usdc = new TestUSDC();
        pool = new AnoraPool(
            address(usdc),
            riskAgent,
            AnoraPool.Policy({
                seniorPerJuniorBps: 22_500,
                minFirstLossBps: 1_000,
                financingFeeBps: 200,
                lateFeePerDayBps: 10,
                seniorFeeShareBps: 6_000,
                depositCap: 10_000_000 * USDC
            })
        );
        address[3] memory who = [seniorLender, juniorLender, originator];
        for (uint256 i = 0; i < who.length; i++) {
            usdc.mint(who[i], 500_000 * USDC);
            vm.prank(who[i]);
            usdc.approve(address(pool), type(uint256).max);
        }
    }

    function test_originatorLifecycleFromFacilityToRecovery() public {
        vm.prank(originator);
        uint256 id = pool.openFacility(300_000 * USDC, 30_000 * USDC, 90 days, 30 days);
        assertEq(pool.firstLossReserve(), 30_000 * USDC);

        vm.prank(juniorLender);
        pool.deposit(AnoraPool.Tranche.Junior, 90_000 * USDC);
        assertEq(pool.seniorCapacity(), 270_000 * USDC);
        vm.prank(seniorLender);
        pool.deposit(AnoraPool.Tranche.Senior, 270_000 * USDC);

        vm.prank(originator);
        pool.drawdown(id, 300_000 * USDC);
        assertEq(pool.liquidity(), 60_000 * USDC);
        assertEq(pool.owedOf(id), 306_000 * USDC);

        vm.warp(block.timestamp + 91 days);
        pool.markLate(id);
        vm.prank(originator);
        vm.expectRevert(AnoraPool.FacilityNotOpen.selector);
        pool.drawdown(id, 1 * USDC);

        vm.warp(block.timestamp + 30 days);
        assertEq(pool.owedOf(id), 315_000 * USDC);

        vm.prank(riskAgent);
        pool.declareDefault(id, "buyer failed to pay; restructuring refused");
        (uint256 lossFirst, uint256 lossJunior, uint256 lossSenior) = pool.lossesOf(id);
        assertEq(lossFirst, 30_000 * USDC);
        assertEq(lossJunior, 90_000 * USDC);
        assertEq(lossSenior, 180_000 * USDC);
        assertEq(pool.seniorAssets(), 90_000 * USDC);
        assertEq(pool.juniorAssets(), 0);

        vm.prank(originator);
        pool.recordRecovery(id, 200_000 * USDC);
        assertEq(pool.seniorAssets(), 270_000 * USDC);
        assertEq(pool.juniorAssets(), 20_000 * USDC);

        vm.prank(seniorLender);
        pool.withdraw(AnoraPool.Tranche.Senior, 270_000 * USDC);
        assertEq(usdc.balanceOf(seniorLender), 500_000 * USDC);
        vm.prank(juniorLender);
        pool.withdraw(AnoraPool.Tranche.Junior, 90_000 * USDC);
        assertEq(usdc.balanceOf(juniorLender), 430_000 * USDC);
    }
}
