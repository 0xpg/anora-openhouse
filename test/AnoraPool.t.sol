// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {TestUSDC} from "./utils/TestUSDC.sol";
import {AnoraPool} from "../src/AnoraPool.sol";

contract AnoraPoolTest is Test {
    uint256 constant USDC = 1e6;

    TestUSDC usdc;
    AnoraPool pool;

    address riskAgent = makeAddr("riskAgent");
    address senior1 = makeAddr("senior1");
    address junior1 = makeAddr("junior1");
    address originator = makeAddr("originator");

    function setUp() public {
        usdc = new TestUSDC();
        pool = new AnoraPool(address(usdc), riskAgent, 22500);
        _fund(senior1, 1_000_000 * USDC);
        _fund(junior1, 1_000_000 * USDC);
        _fund(originator, 1_000_000 * USDC);
    }

    function _fund(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(pool), type(uint256).max);
    }

    function test_juniorDepositMintsShares() public {
        vm.prank(junior1);
        pool.deposit(AnoraPool.Tranche.Junior, 120_000 * USDC);

        assertEq(pool.juniorShares(junior1), 120_000 * USDC);
        assertEq(pool.juniorAssets(), 120_000 * USDC);
        assertEq(usdc.balanceOf(address(pool)), 120_000 * USDC);
    }

    function test_seniorClosedWhileJuniorEmpty() public {
        vm.prank(senior1);
        vm.expectRevert(AnoraPool.SeniorCapacityExceeded.selector);
        pool.deposit(AnoraPool.Tranche.Senior, 1 * USDC);
    }

    function test_seniorOpensInProportionToJunior() public {
        vm.prank(junior1);
        pool.deposit(AnoraPool.Tranche.Junior, 30_000 * USDC);

        assertEq(pool.seniorCapacity(), 67_500 * USDC);

        vm.prank(senior1);
        pool.deposit(AnoraPool.Tranche.Senior, 67_500 * USDC);
        assertEq(pool.seniorShares(senior1), 67_500 * USDC);

        vm.prank(senior1);
        vm.expectRevert(AnoraPool.SeniorCapacityExceeded.selector);
        pool.deposit(AnoraPool.Tranche.Senior, 1 * USDC);
    }
}
