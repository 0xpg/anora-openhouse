// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "forge-std/interfaces/IERC20.sol";

contract AnoraPool {
    enum Tranche {
        Senior,
        Junior
    }

    enum Status {
        Open,
        Late,
        Defaulted,
        Closed
    }

    struct Policy {
        uint256 seniorPerJuniorBps;
        uint256 minFirstLossBps;
        uint256 financingFeeBps;
        uint256 lateFeePerDayBps;
        uint256 seniorFeeShareBps;
    }

    struct Facility {
        address originator;
        uint256 limit;
        uint256 firstLoss;
        uint256 principal;
        uint256 fee;
        uint256 tenor;
        uint256 grace;
        uint256 dueAt;
        uint256 lateAccruedAt;
        Status status;
        uint256 defaultedAt;
        string defaultReason;
        uint256 lossFirstLoss;
        uint256 lossJunior;
        uint256 lossSenior;
    }

    error SeniorCapacityExceeded();
    error FirstLossTooSmall();
    error LimitExceeded();
    error InsufficientLiquidity();
    error NotOriginator();
    error FacilityNotOpen();
    error NotPastDue();
    error Overpayment();
    error NotRiskAgent();
    error FacilityNotLate();
    error GraceNotElapsed();
    error NothingToRecover();

    uint256 public constant BPS = 10_000;

    IERC20 public immutable asset;
    address public immutable riskAgent;
    Policy public policy;

    uint256 public seniorAssets;
    uint256 public juniorAssets;
    uint256 public seniorTotalShares;
    uint256 public juniorTotalShares;
    mapping(address => uint256) public seniorShares;
    mapping(address => uint256) public juniorShares;

    uint256 public firstLossReserve;
    uint256 public nextFacilityId;
    mapping(uint256 => Facility) internal _facilities;

    event Deposited(address indexed provider, Tranche tranche, uint256 assets, uint256 shares);
    event FacilityOpened(uint256 indexed id, address indexed originator, uint256 limit, uint256 firstLoss);
    event Drawn(uint256 indexed id, uint256 amount, uint256 fee, uint256 dueAt);
    event Repaid(uint256 indexed id, uint256 principal, uint256 fee);
    event MarkedLate(uint256 indexed id, uint256 dueAt, uint256 at);
    event FacilityClosed(uint256 indexed id);
    event DefaultDeclared(
        uint256 indexed id, string reason, uint256 lossFirstLoss, uint256 lossJunior, uint256 lossSenior
    );
    event Recovered(uint256 indexed id, uint256 amount, uint256 toSenior, uint256 toJunior, uint256 toOriginator);

    constructor(address asset_, address riskAgent_, Policy memory policy_) {
        asset = IERC20(asset_);
        riskAgent = riskAgent_;
        policy = policy_;
    }

    function facilities(uint256 id)
        external
        view
        returns (address, uint256, uint256, uint256, uint256, uint256, uint256, Status)
    {
        Facility storage f = _facilities[id];
        return (f.originator, f.limit, f.firstLoss, f.principal, f.fee, f.tenor, f.grace, f.status);
    }

    function principalOf(uint256 id) external view returns (uint256) {
        return _facilities[id].principal;
    }

    function owedOf(uint256 id) public view returns (uint256) {
        Facility storage f = _facilities[id];
        return f.principal + f.fee + _pendingLateFee(f);
    }

    function statusOf(uint256 id) external view returns (Status) {
        return _facilities[id].status;
    }

    function defaultReasonOf(uint256 id) external view returns (string memory) {
        return _facilities[id].defaultReason;
    }

    function defaultedAtOf(uint256 id) external view returns (uint256) {
        return _facilities[id].defaultedAt;
    }

    function lossesOf(uint256 id) external view returns (uint256, uint256, uint256) {
        Facility storage f = _facilities[id];
        return (f.lossFirstLoss, f.lossJunior, f.lossSenior);
    }

    function dueAtOf(uint256 id) external view returns (uint256) {
        return _facilities[id].dueAt;
    }

    function liquidity() public view returns (uint256) {
        uint256 balance = asset.balanceOf(address(this));
        return balance > firstLossReserve ? balance - firstLossReserve : 0;
    }

    function seniorCapacity() public view returns (uint256) {
        uint256 cap = (juniorAssets + firstLossReserve) * policy.seniorPerJuniorBps / BPS;
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

    function openFacility(uint256 limit, uint256 firstLoss, uint256 tenor, uint256 grace)
        external
        returns (uint256 id)
    {
        if (firstLoss < limit * policy.minFirstLossBps / BPS) revert FirstLossTooSmall();
        id = nextFacilityId++;
        Facility storage f = _facilities[id];
        f.originator = msg.sender;
        f.limit = limit;
        f.firstLoss = firstLoss;
        f.tenor = tenor;
        f.grace = grace;
        firstLossReserve += firstLoss;
        asset.transferFrom(msg.sender, address(this), firstLoss);
        emit FacilityOpened(id, msg.sender, limit, firstLoss);
    }

    function drawdown(uint256 id, uint256 amount) external {
        Facility storage f = _facilities[id];
        if (msg.sender != f.originator) revert NotOriginator();
        if (f.status != Status.Open) revert FacilityNotOpen();
        if (f.principal + amount > f.limit) revert LimitExceeded();
        if (amount > liquidity()) revert InsufficientLiquidity();
        uint256 fee = amount * policy.financingFeeBps / BPS;
        if (f.dueAt == 0) f.dueAt = block.timestamp + f.tenor;
        f.principal += amount;
        f.fee += fee;
        asset.transfer(msg.sender, amount);
        emit Drawn(id, amount, fee, f.dueAt);
    }

    function repay(uint256 id, uint256 amount) external {
        Facility storage f = _facilities[id];
        _accrueLateFee(f);
        if (amount > f.principal + f.fee) revert Overpayment();
        uint256 toPrincipal = amount < f.principal ? amount : f.principal;
        uint256 toFee = amount - toPrincipal;
        f.principal -= toPrincipal;
        f.fee -= toFee;
        asset.transferFrom(msg.sender, address(this), amount);
        _distributeFee(toFee);
        emit Repaid(id, toPrincipal, toFee);
        if (f.principal == 0 && f.fee == 0) _close(id, f);
    }

    function markLate(uint256 id) external {
        Facility storage f = _facilities[id];
        if (f.status != Status.Open) revert FacilityNotOpen();
        if (f.principal == 0 || block.timestamp <= f.dueAt) revert NotPastDue();
        f.status = Status.Late;
        f.lateAccruedAt = block.timestamp;
        emit MarkedLate(id, f.dueAt, block.timestamp);
    }

    function declareDefault(uint256 id, string calldata reason) external {
        if (msg.sender != riskAgent) revert NotRiskAgent();
        Facility storage f = _facilities[id];
        if (f.status != Status.Late) revert FacilityNotLate();
        if (block.timestamp < f.lateAccruedAt + f.grace) revert GraceNotElapsed();
        uint256 loss = f.principal;
        f.principal = 0;
        f.fee = 0;
        f.status = Status.Defaulted;
        f.defaultedAt = block.timestamp;
        f.defaultReason = reason;

        uint256 fromFirst = loss < f.firstLoss ? loss : f.firstLoss;
        f.firstLoss -= fromFirst;
        firstLossReserve -= fromFirst;
        loss -= fromFirst;

        uint256 fromJunior = loss < juniorAssets ? loss : juniorAssets;
        juniorAssets -= fromJunior;
        loss -= fromJunior;

        uint256 fromSenior = loss < seniorAssets ? loss : seniorAssets;
        seniorAssets -= fromSenior;

        f.lossFirstLoss = fromFirst;
        f.lossJunior = fromJunior;
        f.lossSenior = fromSenior;
        emit DefaultDeclared(id, reason, fromFirst, fromJunior, fromSenior);
    }

    function recordRecovery(uint256 id, uint256 amount) external {
        Facility storage f = _facilities[id];
        if (f.status != Status.Defaulted) revert NothingToRecover();
        uint256 outstanding = f.lossSenior + f.lossJunior + f.lossFirstLoss;
        if (outstanding == 0 || amount > outstanding) revert NothingToRecover();
        asset.transferFrom(msg.sender, address(this), amount);

        uint256 toSenior = amount < f.lossSenior ? amount : f.lossSenior;
        f.lossSenior -= toSenior;
        seniorAssets += toSenior;
        uint256 rest = amount - toSenior;

        uint256 toJunior = rest < f.lossJunior ? rest : f.lossJunior;
        f.lossJunior -= toJunior;
        juniorAssets += toJunior;
        rest -= toJunior;

        f.lossFirstLoss -= rest;
        if (rest > 0) asset.transfer(f.originator, rest);
        emit Recovered(id, amount, toSenior, toJunior, rest);
    }

    function _pendingLateFee(Facility storage f) internal view returns (uint256) {
        if (f.status != Status.Late) return 0;
        uint256 daysLate = (block.timestamp - f.lateAccruedAt) / 1 days;
        return f.principal * policy.lateFeePerDayBps * daysLate / BPS;
    }

    function _accrueLateFee(Facility storage f) internal {
        uint256 pending = _pendingLateFee(f);
        if (pending == 0) return;
        f.fee += pending;
        f.lateAccruedAt += ((block.timestamp - f.lateAccruedAt) / 1 days) * 1 days;
    }

    function _distributeFee(uint256 fee) internal {
        if (fee == 0) return;
        uint256 toSenior = fee * policy.seniorFeeShareBps / BPS;
        seniorAssets += toSenior;
        juniorAssets += fee - toSenior;
    }

    function _close(uint256 id, Facility storage f) internal {
        f.status = Status.Closed;
        uint256 refund = f.firstLoss;
        f.firstLoss = 0;
        firstLossReserve -= refund;
        asset.transfer(f.originator, refund);
        emit FacilityClosed(id);
    }

    function _toShares(uint256 amount, uint256 assets, uint256 totalShares) internal pure returns (uint256) {
        if (totalShares == 0 || assets == 0) return amount;
        return amount * totalShares / assets;
    }
}
