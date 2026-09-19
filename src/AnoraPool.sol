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
        Status status;
    }

    error SeniorCapacityExceeded();
    error FirstLossTooSmall();
    error LimitExceeded();
    error InsufficientLiquidity();
    error NotOriginator();
    error FacilityNotOpen();

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
        return f.principal + f.fee;
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

    function _toShares(uint256 amount, uint256 assets, uint256 totalShares) internal pure returns (uint256) {
        if (totalShares == 0 || assets == 0) return amount;
        return amount * totalShares / assets;
    }
}
