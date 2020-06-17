// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.7;

contract DynamicMappingInArrays {

    struct OptionalMapping {
        bool hasMapping;
        mapping(string => address) firstMap;
        uint16 someValue;
        mapping(string => address) secondMap;
        bool isDone;
    }

    struct ArrayAndMappings {
        mapping(address => uint256)[3] maps;
        OptionalMapping[] structs;
    }

    FixedStructs temp;
    struct FixedStructs {
        OptionalMapping[10] fix;
    }

    DynamicStructs dynamicTemp;
    struct DynamicStructs {
        OptionalMapping[] fix;
    }

    mapping(address => OptionalMapping[]) dynamicArrayWithStructs;
    mapping(uint256 => ArrayAndMappings)  complexStructs;
    FixedStructs[] rootArrayFixed;
    DynamicStructs[] rootArrayDynamic;

    function pushOptionalMappings(address key, uint amount) public {
        for(uint i = 0; i<amount; i++) {
            dynamicArrayWithStructs[key].push(OptionalMapping(true, 1, false));
        }
    }

    function accessFirstMap(address key, uint index, string memory key2) public view returns (address) {
        return dynamicArrayWithStructs[key][index].firstMap[key2];
    }

    function accessSecondMap(address key, uint index, string memory key2) public view returns (address) {
        return dynamicArrayWithStructs[key][index].secondMap[key2];
    }

    function pushComplexStructs(uint key, uint amount) public {
        for(uint i = 0; i<amount; i++) {
            complexStructs[key].structs.push(OptionalMapping(true, 1, false));
        }
    }

    function accessMappingsInComplexArray(uint key, uint index, address key2) public view returns (uint256) {
        return complexStructs[key].maps[index][key2];
    }

    function accessMappingsInStructArray(uint key, uint index, bool firstMap, string memory key2) public view returns (address) {
        if(firstMap) {
            return complexStructs[key].structs[index].firstMap[key2];
        } else {
            return complexStructs[key].structs[index].secondMap[key2];
        }
    }

    function pushIntoRootArrayFixed(uint amount) public {
        for(uint i = 0; i<amount; i++) {
            rootArrayFixed.push(temp);
        }
    }

    function accessRootArrayMappingFixed(uint index, uint secondIndex, bool firstMap, string memory key) public view returns(address) {
        mapping(string => address) storage map = rootArrayFixed[0].fix[0].firstMap;
        if(firstMap) {
            map = rootArrayFixed[index].fix[secondIndex].firstMap;
        } else {
            map = rootArrayFixed[index].fix[secondIndex].secondMap;
        }

        return map[key];
    }

    function pushIntoRootArrayDynamic(uint amount) public {
        for(uint i = 0; i<amount; i++) {
            dynamicTemp.fix.push(OptionalMapping(true, 1, false));
        }

        for(uint i = 0; i<amount; i++) {
            rootArrayDynamic.push(dynamicTemp);
        }

    }

    function accessRootArrayMappingDynamic(uint index, uint secondIndex, bool firstMap, string memory key) public view returns(address) {
        mapping(string => address) storage map = rootArrayDynamic[0].fix[0].firstMap;
        if(firstMap) {
            map = rootArrayDynamic[index].fix[secondIndex].firstMap;
        } else {
            map = rootArrayDynamic[index].fix[secondIndex].secondMap;
        }

        return map[key];
    }

}
