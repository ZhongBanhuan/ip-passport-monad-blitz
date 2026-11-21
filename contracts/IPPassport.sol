// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice One reviewed issuer per registry. Entries are append-only.
contract IPPassport {
    address public immutable issuer;

    struct Version { bytes32 parent; uint256 registeredAtBlock; }
    struct Offer { bytes32 workId; bytes32 version; bytes32 termsHash; uint256 price; address payable recipient; bool active; }
    struct Grant { bytes32 offerId; address buyer; bytes32 projectHash; uint256 blockNumber; uint256 timestamp; }

    mapping(bytes32 => mapping(bytes32 => Version)) public versions;
    mapping(bytes32 => Offer) public offers;
    mapping(bytes32 => Grant) public grants;

    event VersionRegistered(bytes32 indexed workId, bytes32 indexed version, bytes32 parent);
    event OfferPublished(bytes32 indexed offerId, bytes32 indexed workId, bytes32 version);
    event OfferClosed(bytes32 indexed offerId);
    event GrantIssued(bytes32 indexed id, bytes32 indexed offerId, address indexed buyer, bytes32 projectHash);

    error Unauthorized();
    error InvalidInput();
    error UnknownVersion();
    error MismatchedParent();
    error OfferUnavailable();
    error AlreadyPurchased(bytes32 id);
    error PaymentFailed();

    constructor() { issuer = msg.sender; }

    modifier onlyIssuer() {
        if (msg.sender != issuer) revert Unauthorized();
        _;
    }

    function registerVersion(bytes32 workId, bytes32 version, bytes32 parent) public onlyIssuer {
        if (workId == 0 || version == 0 || version == parent) revert InvalidInput();
        Version storage existing = versions[workId][version];
        if (existing.registeredAtBlock != 0) {
            if (existing.parent != parent) revert MismatchedParent();
            return;
        }
        if (parent != 0 && versions[workId][parent].registeredAtBlock == 0) revert UnknownVersion();
        versions[workId][version] = Version(parent, block.number);
        emit VersionRegistered(workId, version, parent);
    }

    function publishOffer(bytes32 workId, bytes32 version, bytes32 parent, bytes32 termsHash, uint256 price, address payable recipient)
        external onlyIssuer returns (bytes32 id)
    {
        if (termsHash == 0 || recipient == address(0) || price == 0) revert InvalidInput();
        registerVersion(workId, version, parent);
        id = keccak256(abi.encode(workId, version, termsHash, price, recipient));
        if (offers[id].recipient != address(0)) revert InvalidInput();
        offers[id] = Offer(workId, version, termsHash, price, recipient, true);
        emit OfferPublished(id, workId, version);
    }

    function closeOffer(bytes32 offerId) external onlyIssuer {
        if (!offers[offerId].active) revert OfferUnavailable();
        offers[offerId].active = false;
        emit OfferClosed(offerId);
    }

    function buy(bytes32 offerId, bytes32 projectHash) external payable returns (bytes32 id) {
        if (projectHash == 0) revert InvalidInput();
        id = keccak256(abi.encode(offerId, msg.sender, projectHash));
        if (grants[id].buyer != address(0)) revert AlreadyPurchased(id);
        Offer storage offer = offers[offerId];
        if (!offer.active) revert OfferUnavailable();
        if (msg.value != offer.price) revert InvalidInput();
        grants[id] = Grant(offerId, msg.sender, projectHash, block.number, block.timestamp);
        emit GrantIssued(id, offerId, msg.sender, projectHash);
        (bool ok,) = offer.recipient.call{value: msg.value}("");
        if (!ok) revert PaymentFailed();
    }
}

