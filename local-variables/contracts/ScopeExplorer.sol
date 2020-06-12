// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.7;

pragma experimental ABIEncoderV2;

contract ScopeExplorer {

    constructor() public {}

    function declareElementaryVariable() public pure returns (uint256, string memory) {
        uint256 aVariable = 10;
        string memory anotherVariable = "a ten";
        return (aVariable, anotherVariable);
    }
}
