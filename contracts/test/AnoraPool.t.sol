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
                seniorFeeShareBps: 6_000,
                depositCap: 1_000_000 * USDC
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

    function _drawn() internal returns (uint256 id) {
        _seedPool();
        id = _openFacility();
        vm.prank(originator);
        pool.drawdown(id, 200_000 * USDC);
    }

    function test_repayPaysPrincipalBeforeFee() public {
        uint256 id = _drawn();

        vm.prank(originator);
        pool.repay(id, 100_000 * USDC);

        assertEq(pool.principalOf(id), 100_000 * USDC);
        assertEq(pool.owedOf(id), 104_000 * USDC);
        assertEq(pool.seniorAssets(), 270_000 * USDC);
    }

    function test_fullRepaySplitsFeeAndClosesFacility() public {
        uint256 id = _drawn();
        uint256 before = usdc.balanceOf(originator);

        vm.prank(originator);
        pool.repay(id, 204_000 * USDC);

        assertEq(pool.owedOf(id), 0);
        assertEq(uint8(pool.statusOf(id)), uint8(AnoraPool.Status.Closed));
        assertEq(pool.seniorAssets(), 272_400 * USDC);
        assertEq(pool.juniorAssets(), 121_600 * USDC);
        assertEq(pool.firstLossReserve(), 0);
        assertEq(usdc.balanceOf(originator), before - 204_000 * USDC + 30_000 * USDC);
    }

    function test_markLateNeedsPastDue() public {
        uint256 id = _drawn();

        vm.expectRevert(AnoraPool.NotPastDue.selector);
        pool.markLate(id);
    }

    function test_lateFacilityPausesDrawdown() public {
        uint256 id = _drawn();
        vm.warp(block.timestamp + 90 days + 1);

        pool.markLate(id);

        assertEq(uint8(pool.statusOf(id)), uint8(AnoraPool.Status.Late));
        vm.prank(originator);
        vm.expectRevert(AnoraPool.FacilityNotOpen.selector);
        pool.drawdown(id, 1 * USDC);
    }

    function test_lateFeeAccruesPerDay() public {
        uint256 id = _drawn();
        vm.warp(block.timestamp + 90 days + 1);
        pool.markLate(id);

        vm.warp(block.timestamp + 10 days);

        assertEq(pool.owedOf(id), 206_000 * USDC);
    }

    function test_repayWhileLateClearsWithLateFee() public {
        uint256 id = _drawn();
        vm.warp(block.timestamp + 90 days + 1);
        pool.markLate(id);
        vm.warp(block.timestamp + 10 days);

        vm.prank(originator);
        pool.repay(id, 206_000 * USDC);

        assertEq(pool.owedOf(id), 0);
        assertEq(uint8(pool.statusOf(id)), uint8(AnoraPool.Status.Closed));
        assertEq(pool.seniorAssets() + pool.juniorAssets(), 396_000 * USDC);
    }

    function _late(uint256 graceDays) internal returns (uint256 id) {
        id = _drawn();
        vm.warp(block.timestamp + 90 days + 1);
        pool.markLate(id);
        vm.warp(block.timestamp + graceDays * 1 days);
    }

    function test_defaultOnlyByRiskAgent() public {
        uint256 id = _late(30);

        vm.prank(originator);
        vm.expectRevert(AnoraPool.NotRiskAgent.selector);
        pool.declareDefault(id, "buyer insolvent");
    }

    function test_defaultNeedsGracePeriodElapsed() public {
        uint256 id = _late(29);

        vm.prank(riskAgent);
        vm.expectRevert(AnoraPool.GraceNotElapsed.selector);
        pool.declareDefault(id, "buyer insolvent");
    }

    function test_defaultRecordsReasonAndConsumesFirstLossThenJuniorThenSenior() public {
        uint256 id = _late(30);

        vm.prank(riskAgent);
        pool.declareDefault(id, "buyer insolvent, invoice disputed");

        assertEq(uint8(pool.statusOf(id)), uint8(AnoraPool.Status.Defaulted));
        assertEq(pool.defaultReasonOf(id), "buyer insolvent, invoice disputed");
        assertEq(pool.defaultedAtOf(id), block.timestamp);
        assertEq(pool.firstLossReserve(), 0);
        assertEq(pool.juniorAssets(), 0);
        assertEq(pool.seniorAssets(), 220_000 * USDC);
        assertEq(pool.owedOf(id), 0);
        (uint256 lossFirst, uint256 lossJunior, uint256 lossSenior) = pool.lossesOf(id);
        assertEq(lossFirst, 30_000 * USDC);
        assertEq(lossJunior, 120_000 * USDC);
        assertEq(lossSenior, 50_000 * USDC);
    }

    function test_smallDefaultStopsAtFirstLoss() public {
        _seedPool();
        uint256 id = _openFacility();
        vm.prank(originator);
        pool.drawdown(id, 20_000 * USDC);
        vm.warp(block.timestamp + 90 days + 1);
        pool.markLate(id);
        vm.warp(block.timestamp + 30 days);

        vm.prank(riskAgent);
        pool.declareDefault(id, "late beyond grace");

        assertEq(pool.firstLossReserve(), 10_000 * USDC);
        assertEq(pool.juniorAssets(), 120_000 * USDC);
        assertEq(pool.seniorAssets(), 270_000 * USDC);
    }

    function test_recoveryRestoresSeniorThenJuniorThenFirstLoss() public {
        uint256 id = _late(30);
        vm.prank(riskAgent);
        pool.declareDefault(id, "buyer insolvent");
        uint256 before = usdc.balanceOf(originator);

        vm.prank(originator);
        pool.recordRecovery(id, 60_000 * USDC);
        assertEq(pool.seniorAssets(), 270_000 * USDC);
        assertEq(pool.juniorAssets(), 10_000 * USDC);

        vm.prank(originator);
        pool.recordRecovery(id, 140_000 * USDC);
        assertEq(pool.juniorAssets(), 120_000 * USDC);
        assertEq(usdc.balanceOf(originator), before - 200_000 * USDC + 30_000 * USDC);

        vm.prank(originator);
        vm.expectRevert(AnoraPool.NothingToRecover.selector);
        pool.recordRecovery(id, 1 * USDC);
    }

    function test_withdrawProRataWithinLiquidity() public {
        _seedPool();
        uint256 id = _openFacility();
        vm.prank(originator);
        pool.drawdown(id, 300_000 * USDC);

        vm.prank(senior1);
        pool.withdraw(AnoraPool.Tranche.Senior, 90_000 * USDC);
        assertEq(usdc.balanceOf(senior1), 1_000_000 * USDC - 180_000 * USDC);
        assertEq(pool.seniorAssets(), 180_000 * USDC);

        vm.prank(senior1);
        vm.expectRevert(AnoraPool.InsufficientLiquidity.selector);
        pool.withdraw(AnoraPool.Tranche.Senior, 1 * USDC);
    }

    function test_withdrawAfterFeeReturnsMoreThanDeposited() public {
        uint256 id = _drawn();
        vm.prank(originator);
        pool.repay(id, 204_000 * USDC);

        vm.prank(senior1);
        pool.withdraw(AnoraPool.Tranche.Senior, 270_000 * USDC);
        assertEq(usdc.balanceOf(senior1), 1_000_000 * USDC + 2_400 * USDC);

        vm.prank(junior1);
        pool.withdraw(AnoraPool.Tranche.Junior, 120_000 * USDC);
        assertEq(usdc.balanceOf(junior1), 1_000_000 * USDC + 1_600 * USDC);
    }

    function test_lateSinceIsExposedAndFixedAtMarkLate() public {
        uint256 id = _late(0);
        uint256 markedAt = block.timestamp;
        vm.warp(block.timestamp + 5 days);

        vm.prank(originator);
        pool.repay(id, 1_000 * USDC);

        assertEq(pool.lateSinceOf(id), markedAt);
    }

    function test_graceMeasuredFromMarkLateEvenAfterPartialRepay() public {
        uint256 id = _late(0);
        vm.warp(block.timestamp + 20 days);
        vm.prank(originator);
        pool.repay(id, 1_000 * USDC);
        vm.warp(block.timestamp + 10 days);

        vm.prank(riskAgent);
        pool.declareDefault(id, "grace elapsed");

        assertEq(uint8(pool.statusOf(id)), uint8(AnoraPool.Status.Defaulted));
    }

    function test_riskAgentCanHandOver() public {
        address next = makeAddr("nextAgent");

        vm.prank(originator);
        vm.expectRevert(AnoraPool.NotRiskAgent.selector);
        pool.setRiskAgent(next);

        vm.prank(riskAgent);
        pool.setRiskAgent(next);
        assertEq(pool.riskAgent(), next);

        uint256 id = _late(30);
        vm.prank(next);
        pool.declareDefault(id, "by new agent");
        assertEq(uint8(pool.statusOf(id)), uint8(AnoraPool.Status.Defaulted));
    }

    function test_depositCapCountsTranchesAndFirstLoss() public {
        AnoraPool capped = new AnoraPool(
            address(usdc),
            riskAgent,
            AnoraPool.Policy({
                seniorPerJuniorBps: 22_500,
                minFirstLossBps: 1_000,
                financingFeeBps: 200,
                lateFeePerDayBps: 10,
                seniorFeeShareBps: 6_000,
                depositCap: 1_000 * USDC
            })
        );
        vm.prank(junior1);
        usdc.approve(address(capped), type(uint256).max);
        vm.prank(originator);
        usdc.approve(address(capped), type(uint256).max);

        vm.prank(junior1);
        capped.deposit(AnoraPool.Tranche.Junior, 900 * USDC);

        vm.prank(originator);
        vm.expectRevert(AnoraPool.DepositCapExceeded.selector);
        capped.openFacility(1_010 * USDC, 101 * USDC, 90 days, 30 days);

        vm.prank(originator);
        capped.openFacility(1_000 * USDC, 100 * USDC, 90 days, 30 days);

        vm.prank(junior1);
        vm.expectRevert(AnoraPool.DepositCapExceeded.selector);
        capped.deposit(AnoraPool.Tranche.Junior, 1 * USDC);
    }
}
