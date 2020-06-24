// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.7;

contract BaseTest {

    event Start(); event End();

    constructor(uint myVar, address theOwner) public {
        emit Start();
        uint changingVar = 1;
        if(msg.sender == theOwner) {
            changingVar = myVar / 2;
        } else {
            changingVar = myVar * 100;
        }
        emit End();
    }

    function declareElementaryVariable() public pure returns (uint256, string memory) {
        uint256 aVariable = 10;
        uint256 bVariable = 14;
        uint256 cVariable = 19;
        string memory anotherVariable = "a ten";
        return (aVariable, anotherVariable);
    }
}
