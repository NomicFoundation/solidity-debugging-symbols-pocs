// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.7;

contract StructOnState {

    struct StructId {
        uint id;
        mapping(uint => uint) mapToId;
    }

    struct NestedMapping {
        mapping(uint => NestedMapping) nested;
    }

    //Struct with random stuff in between
    struct RandomStruct {
        StructId structId;
        uint16 randomValue;
        StructId secondStructId;
        address randomAddress;
        mapping(uint => StructId) manyStructIds;
        uint randomValue2;
        address randomAddress2;
        uint8 randomValue3;
        mapping(uint => address) mapToAddress;
        mapping(uint => mapping(address => uint)) nestedMapOfAddress;
        address[] addresses;
        bytes8 randomValue4;
        bytes7 randomValue5;
        mapping(string => uint) dynamicKeyMapping;
    }

    mapping(uint=> uint) normalMap;

    RandomStruct randomStruct;
    NestedMapping rootMap;

    mapping(uint=> StructId) manyStructIds;
    mapping(uint => RandomStruct) manyRandomStructs;


    function accessFirstStructId(uint id) public view returns(uint) {
        return randomStruct.structId.mapToId[id];
    }

    function accessFirstStructIdInMapping(uint mapId, uint id) public view returns(uint) {
        return manyRandomStructs[mapId].structId.mapToId[id];
    }

    function accessSecondStructId(uint id) public view returns(uint) {
        return randomStruct.secondStructId.mapToId[id];
    }

    function accessSecondStructIdInMapping(uint mapId, uint id) public view returns(uint) {
        return manyRandomStructs[mapId].secondStructId.mapToId[id];
    }

    function accessAddressInStruct(uint id) public view returns(address) {
        return randomStruct.mapToAddress[id];
    }

    function accessDynamicKey(string calldata key) external view returns(uint) {
        return randomStruct.dynamicKeyMapping[key];
    }

    function accessAllMaps(uint id, uint mapToId, string calldata key) external view returns(uint) {
        uint a = randomStruct.structId.mapToId[mapToId];
        uint b = randomStruct.secondStructId.mapToId[mapToId];
        uint c = randomStruct.manyStructIds[id].mapToId[mapToId];
        uint d = randomStruct.nestedMapOfAddress[id][msg.sender];
        uint e = randomStruct.dynamicKeyMapping[key];
        return a + b + c + d + e;
    }

    function accessMultipleNestedMapping(uint id, uint repeat) public view returns(uint) {
        mapping(uint => NestedMapping) storage nested = rootMap.nested;
        for(uint i=0; i<repeat; i++) {
            nested = nested[id + i].nested;
        }
        return 0;
    }


}