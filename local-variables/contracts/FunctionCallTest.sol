// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.7;

contract FunctionCallTest {

    function firstFunction(uint var1) public pure returns (uint256) {
        uint myVariable = 1;
        uint resultVariable = secondFunction(var1);
        return resultVariable + myVariable;
    }

    function secondFunction(uint requiredVar) private pure returns (uint256) {
        uint result = 11;
        if(requiredVar < 10) {
            result -= requiredVar;
        } else {
            result += requiredVar;
        }
        return result;
    }

    function passArray(uint number, uint indexSet, uint toChange) public pure returns(uint) {
        uint[5] memory arrayToGive = [number, number, number, number, number];
        uint[5] memory newArray = changeArray(arrayToGive, indexSet, toChange);
        return number;
    }

    function changeArray(uint[5] memory arr, uint index, uint value) private pure returns(uint[5] memory) {
        arr[index] = value;
        return arr;
    }

    function callDataArray(uint[3] calldata calldataArr) external pure returns(uint) {
        uint[3] memory memoryArry = calldataArr;
        memoryArry[2] = 5;
        bool areEqual = checkEquality(calldataArr, memoryArry);
        return areEqual ? 1 : 0;
    }

    function checkEquality(uint[3] memory arr1, uint[3] memory arr2) private pure returns(bool) {
        for(uint i=0; i<3; i++) {
            if(arr1[i] != arr2[i]) {
                return false;
            }
            arr1[i] = 0;
        }
        return true;
    }

    uint256[3] theArray = [ 1, 2, 3 ];

    function readModifiedArray() public returns (uint256[3] memory) {
        uint256[3] storage array = getArray();
        modifyArray(array);
        return array;
    }

    function getArray() private view returns (uint256[3] storage) {
        uint256[3] storage arrayReference = theArray;
        return arrayReference;
    }

    function modifyArray(uint256[3] storage clobberedArray) private {
        clobberedArray[0] = 324;
        clobberedArray[1] = 453;
        clobberedArray[2] = 753;
    }

}
