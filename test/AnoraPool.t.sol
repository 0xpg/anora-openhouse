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
        pool = new AnoraPool(
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

    function _seedPool() internal {
        vm.prank(junior1);
        pool.deposit(AnoraPool.Tranche.Junior, 120_000 * USDC);
        vm.prank(senior1);
        pool.deposit(AnoraPool.Tranche.Senior, 270_000 * USDC);
    }

    function _openFacility() internal returns (uint256 id) {
        vm.prank(originator);
        id = pool.openFacility(300_000 * USDC, 30_000 * USDC, 90 days, 30 days);
    }

    function test_openFacilityLocksFirstLoss() public {
        _seedPool();
        uint256 id = _openFacility();

        (address who, uint256 limit, uint256 firstLoss,,,,,) = pool.facilities(id);
        assertEq(who, originator);
        assertEq(limit, 300_000 * USDC);
        assertEq(firstLoss, 30_000 * USDC);
        assertEq(pool.firstLossReserve(), 30_000 * USDC);
        assertEq(pool.juniorAssets(), 120_000 * USDC);
        assertEq(usdc.balanceOf(address(pool)), 420_000 * USDC);
    }

    function test_openFacilityRejectsThinFirstLoss() public {
        vm.prank(originator);
        vm.expectRevert(AnoraPool.FirstLossTooSmall.selector);
        pool.openFacility(300_000 * USDC, 29_999 * USDC, 90 days, 30 days);
    }

    function test_drawdownWithinLimitAndLiquidity() public {
        _seedPool();
        uint256 id = _openFacility();

        vm.prank(originator);
        pool.drawdown(id, 200_000 * USDC);

        assertEq(usdc.balanceOf(originator), 1_000_000 * USDC - 30_000 * USDC + 200_000 * USDC);
        assertEq(pool.principalOf(id), 200_000 * USDC);
        assertEq(pool.owedOf(id), 204_000 * USDC);
        assertEq(pool.dueAtOf(id), block.timestamp + 90 days);
        assertEq(pool.liquidity(), 190_000 * USDC);
    }

    function test_drawdownRejectsBeyondLimit() public {
        _seedPool();
        uint256 id = _openFacility();

        vm.prank(originator);
        vm.expectRevert(AnoraPool.LimitExceeded.selector);
        pool.drawdown(id, 300_001 * USDC);
    }

    function test_drawdownRejectsBeyondLiquidity() public {
        vm.prank(junior1);
        pool.deposit(AnoraPool.Tranche.Junior, 50_000 * USDC);
        uint256 id = _openFacility();

        vm.prank(originator);
        vm.expectRevert(AnoraPool.InsufficientLiquidity.selector);
        pool.drawdown(id, 50_001 * USDC);
    }

    function test_drawdownOnlyByOriginator() public {
        _seedPool();
        uint256 id = _openFacility();

        vm.prank(senior1);
        vm.expectRevert(AnoraPool.NotOriginator.selector);
        pool.drawdown(id, 1 * USDC);
    }
}
