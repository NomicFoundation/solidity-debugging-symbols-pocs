// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.7;

contract BaseTest {

    event End();

    constructor(uint myVar, address theOwner) public {

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

    function declareStaticArrayVariable() public pure returns (uint256[3] memory) {
        uint256[3] memory anArray = [ uint256(4), uint256(9), uint256(14) ];
        return anArray;
    }

    struct ExampleStruct {
        uint256 id;
        uint256 someProperty;
    }

    function declareMemoryStruct() public pure returns (uint256) {
        ExampleStruct memory aStruct = ExampleStruct(1, 7475);
        return aStruct.someProperty;
    }

    function inspectCalldata(string calldata aString) external pure returns (string memory) {
        return aString;
    }

    function inspectCalldataArray(uint256[] calldata anArray) external pure returns (uint256[] memory) {
        return anArray;
    }

    uint256[] aStorageNumberArray;

    function inspectStoragePointerToNumbers() public view returns (uint256) {
        uint256[] storage aPointerToNumbers = aStorageNumberArray;
        return aPointerToNumbers.length;
    }

    function pushToStoragePointerToNumbers(uint256 aNumber) public returns (uint256) {
        uint256[] storage aPointerToNumbers = aStorageNumberArray;
        aPointerToNumbers.push(aNumber);
        return aPointerToNumbers.length;
    }
}
