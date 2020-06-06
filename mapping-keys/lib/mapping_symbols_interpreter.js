const { TraceManager } = require("remix-lib").trace;
const {toBN} = web3.utils;
const util = require("util");
const coder = require("@ethersproject/abi").defaultAbiCoder;

const slot_size = 32n;

function createTracer(web3) {
    const tracer = new TraceManager({ web3 });
    const bareResolveTrace = util.promisify(tracer.resolveTrace);
    const resolveTrace = bareResolveTrace.bind(tracer);
    const bareGetLength = util.promisify(tracer.getLength);
    const getLength = bareGetLength.bind(tracer);
    const bareGetCurrentPC = util.promisify(tracer.getCurrentPC);
    const getCurrentPC = bareGetCurrentPC.bind(tracer);
    const bareGetStackAt = util.promisify(tracer.getStackAt);
    const getStackAt = bareGetStackAt.bind(tracer);
    const bareGetMemoryAt = util.promisify(tracer.getMemoryAt);
    const getMemoryAt = bareGetMemoryAt.bind(tracer);
    return {
        tracer,
        resolveTrace,
        getLength,
        getCurrentPC,
        getStackAt,
        getMemoryAt
    }
}

function getMappingLabel(slot, symbols, parentReference) {
    if (parentReference) {
        if (parentReference.type == "struct") return getStructFieldLabel(parentReference);
        if (parentReference.type == "mapping") return parentReference.key;
        throw new Error("Unknown reference type " + parentReference.type);
    }

    // This is a root mapping.
    for (const symbol of symbols.storageLayout) {
        if (toBN(symbol.slot).eq(toBN(slot))) {
            return symbol.label;
        }
    }
    throw new Error("Couldn't retrieve the label for mapping.");
}

function getStructFieldLabel(structFieldInfo) {
    const fields = structFieldInfo.parent.fields;
    const fieldLabel = fields[structFieldInfo.offset];
    return fieldLabel;
}

function createMappingInfo(valueTypename, valueType) {
    const mappingInfo = { canonicalSlotsMap: {} };
    if (valueTypename == "struct") {
        const fields = {};
        // Beware: we assume mappings are always on reserved whole slots.
        for (const member of valueType.members) {
            if (toCanonicalType(member.type) == "mapping") {
                fields[member.slot] = member.label;
            }
        }
        mappingInfo.fields = fields;
    }
    const numberOfBytes = BigInt(valueType.numberOfBytes);
    mappingInfo.numberOfSlots = numberOfBytes / slot_size + (numberOfBytes % slot_size > 0n ? 1n : 0n);
    mappingInfo.valueType = valueTypename;
    return mappingInfo;
}

function populateGeneratedSlotsWithMappingParentInformation(thisMapping, mappingParent, generatedSlot, valueTypename, decodedKey) {
    for (let i = 0n; i < thisMapping.numberOfSlots; i++) {
        const valueSlot = BigInt(generatedSlot) + i;
        // TODO: The generated slot is lacking padding here.
        const normalizedValueSlot = "0x" + valueSlot.toString(16);
        mappingParent[normalizedValueSlot] = { parent: thisMapping, offset: i.toString(), key: decodedKey, type: valueTypename };
    }
}

function readMemory(memory, pointer, size) {
    const value_array = [];
    for (let i = pointer * 2n; i < (pointer + size) * 2n; i++) {
        value_array.push(memory[i]);
    }
    return "0x" + value_array.join("");
}

function getTypes(pc, symbols, deployedBytecode) {
    const bytecode = deployedBytecode ? "deployedBytecodeOffset" : "bytecodeOffset";
    for (let i = 0; i < symbols.mappings.length; i++) {
        // TODO: check if this is reliable
        // Perhaps some assumption is being made about the type of expressions?
        if (symbols.mappings[i][bytecode] === pc.toString()) {
            return { keyType: symbols.mappings[i].key, valueType: symbols.mappings[i].value };
        }
    }
    return null;
}

function toCanonicalType(type) {
    switch (type) {
        case 'uint256':
        case 't_uint256':
            return 'uint256';
        case 't_bytes6':
            return 'bytes6';
        case 'string':
        case 't_string_memory_ptr':
            return 'string';
        case 'address':
        case 't_address':
            return 'address';
        case 't_bool':
        case 'bool':
            return 'bool';
        default: {
            // This covers both 't_mapping' and 'mapping' prefixes
            const mapping_identifier_index = String.prototype.indexOf.call(type, 'mapping');
            if (mapping_identifier_index == 0 || mapping_identifier_index == 2) return 'mapping';
            if (String.prototype.indexOf.call(type, 'struct') == 0) return 'struct';
            throw new Error('Unknown type ' + type);
        }
    }
}


// @param tx is of the form { hash: <tx hash> } where the tx hash is the one whose trace should be observed.
// @param symbols is a list of bytecode offsets for position calculations for a given map.
// @param tracer is the object that retrieves traces and allows observation of individual steps in them.
// @returns an array of pair {slot,key} used in the transaction
// Later on we could add some information to the values in the returned dictionary if warranted.
/*

--- mappingInfo:
{
    'theMap': {
        'canonicalSlotsMap': {
            'key1': resultingSlot1,
            'key2': resultingSlot2,
        },
        'numberOfSlots': 1,
        'valueType': nonStructType
    },
    'severalMaybeMaps': {
        'canonicalSlotsMap': {
            'key1': resultingSlot1,
            'key2': resultingSlot2,
        },
        // Fields in the struct that correspond to a mapping
        'fields': {
            1: labelSecondSlot
        }
        'numberOfSlots': 2
        // This could potentially be replaced with the value type information itself if it proves to be necessary.
        'valueType': 'struct',
        // This field contains nested mappings. This object can have one or two levels of indirection.
        // When the value type is a struct, this object has one entry per decoded key and then each of those can have one entry per struct field.
        // When the value type is not a struct, this object has one entry per decoded key.
        // Each of these entries at the deepest level has the same model as a root mapping like 'theMap' or 'severalMaybeMaps'.
        'nestedMaps': [Object]
    },

}
---- slots:
{
    'slot': {
        'key2': resultingSlot2
    },
    'resultingSlot2': {
        'key3': resultingSlot3,
        'key4': resultingSlot4
    }
}
---- mappingParent:
// This map has references to mappings found within mappingInfo.
// The key is a slot and the value is a minimal wrapper to maintain the information of the corresponding struct field and/or recovered key.
{
    'slot': {
        'parent': mappingReference,
        // This is the offset from the mapping slot. It can be higher than zero for structs.
        'offset': 0,
        // This is the decoded key that produces this slot in the parent mapping
        'key': someKey,
        // This is the value typename of the parent mapping.
        'type': someTypename
    }
}
--- result
{
    'theMap': {
        'key1': resultingSlot1,
        'key2': {
            'key3': resultingSlot3,
            'key4': resultingSlot4
        }
    },
    'severalMaybeMaps': {
        'key5': {
            // This is a struct field label where labelSecondSlot could be something like 'maybeMap'
            labelSecondSlot: {
                'key6': resultingSlot5
            },
        }
    }

}
 */


async function retrieveKeysInTrace(tx, symbols, tracer, deployedBytecode = true) {
    const success = await tracer.resolveTrace(tx);
    if (!success) throw new Error("Tracing unsuccessful?");

    // The trace was successfully retrieved and analysed
    const sha3_offsets = {};
    for (const symbol of symbols.mappings) {
        if (deployedBytecode) {
            sha3_offsets[symbol.deployedBytecodeOffset] = true;
        } else {
            sha3_offsets[symbol.bytecodeOffset] = true;
        }
    }

    const number_of_steps = await tracer.getLength();
    const mappingInfo = {};
    const mappingParent = {};
    const slots = {};
    for (let step = 0; step < number_of_steps; step++) {
        const pc = await tracer.getCurrentPC(step);
        if (sha3_offsets[pc]) {
            const memory_blocks = await tracer.getMemoryAt(step);
            const stack = await tracer.getStackAt(step);
            const resultingSlot = "0x" + (await tracer.getStackAt(step + 1))[0];
            const uint256_size = 32n;

            // All data is represented in big endian
            const memory = memory_blocks.join("");
            // Remember that, unlike the storage, the memory is byte addressable.
            const buffer_pointer = BigInt("0x" + stack[0]);
            const buffer_length = BigInt("0x" + stack[1]);
            const key_length = buffer_length - uint256_size;
            const slot_pointer = buffer_pointer + key_length;

            const key = readMemory(memory, buffer_pointer, key_length);
            const slot = readMemory(memory, slot_pointer, uint256_size);

            // console.log("Key: " + util.inspect(key));
            // console.log("Slot: " + util.inspect(slot));
            // console.log("Resulting slot: " + util.inspect(resultingSlot));

            const { keyType, valueType } = getTypes(pc, symbols, deployedBytecode);
            const type = toCanonicalType(keyType);
            const valueTypename = toCanonicalType(valueType.label);
            // console.log("Key type: " + util.inspect(keyType));
            // console.log("Value type: " + util.inspect(valueType));
            // console.log("Canonical key type: " + util.inspect(type));
            // console.log("Canonical value type: " + util.inspect(valueTypename));
            let decodedKey;
            if (type === 'string') {
                decodedKey = web3.utils.toAscii(key);
            } else {
                decodedKey = coder.decode([toCanonicalType(keyType)], key).toString();
            }
            // The label may be part of the contract variable identifiers or it may be a member field label in a struct
            // FIXME: This looks like it could break with nested structs. Write a test for that too.
            const label = getMappingLabel(slot, symbols, mappingParent[slot]);
            // console.log("Label: " + util.inspect(label));

            if (!slots[slot]) slots[slot] = {};
            slots[slot][decodedKey] = resultingSlot;

            const parentReference = mappingParent[slot];
            if (parentReference) {
                // This is a nested mapping.
                const parentMapping = parentReference.parent;
                if (!parentMapping.nestedMaps) parentMapping.nestedMaps = {};
                let thisMapping;
                if (parentMapping.valueType == "struct") {
                    const fieldMapping = parentMapping.nestedMaps[parentReference.key];
                    if (!fieldMapping) {
                        thisMapping = createMappingInfo(valueTypename, valueType);
                        parentMapping.nestedMaps[parentReference.key] = { [label]: thisMapping };
                    } else if (!fieldMapping[label]) {
                        thisMapping = createMappingInfo(valueTypename, valueType);
                        fieldMapping[label] = thisMapping;
                    } else {
                        thisMapping = fieldMapping[label];
                    }
                } else {
                    if (!parentMapping.nestedMaps[parentReference.key]) {
                        thisMapping = createMappingInfo(valueTypename, valueType);
                        parentMapping.nestedMaps[parentReference.key] = thisMapping;
                    } else {
                        thisMapping = parentMapping.nestedMaps[key];
                    }
                }
                populateGeneratedSlotsWithMappingParentInformation(thisMapping, mappingParent, resultingSlot, valueTypename, decodedKey);
                thisMapping.canonicalSlotsMap[decodedKey] = resultingSlot;
            } else {
                // This is a root mapping.
                let thisMapping
                if (!mappingInfo[label]) {
                    thisMapping = createMappingInfo(valueTypename, valueType);
                    mappingInfo[label] = thisMapping;
                } else {
                    thisMapping = mappingInfo[label];
                }
                populateGeneratedSlotsWithMappingParentInformation(thisMapping, mappingParent, resultingSlot, valueTypename, decodedKey);
                thisMapping.canonicalSlotsMap[decodedKey] = resultingSlot;
            }

            // console.log("Mapping info: " + util.inspect(mappingInfo, { depth: 5 }));
            // console.log("Slots: " + util.inspect(slots));
            // console.log("Mapping parents: " + util.inspect(mappingParent, { depth: 5 }));
        }
    }

    const recFillMapping = (mapping) => {
        const ret = {};
        const nestedMaps = mapping.nestedMaps;
        // Nested accesses override raw slots printing to show deep keys.
        if (nestedMaps) {
            Object.keys(nestedMaps).forEach(keyOrField => {
                const value = nestedMaps[keyOrField];
                // Check whether it is a mapping or not.
                if (mapping.valueType == "struct") {
                    const fieldValue = {};
                    Object.keys(nestedMaps[keyOrField]).forEach((key) => {
                        fieldValue[key] = recFillMapping(nestedMaps[keyOrField][key]);
                    });
                    ret[keyOrField] = fieldValue;
                } else if (value.canonicalSlotsMap) {
                    ret[keyOrField] = recFillMapping(nestedMaps[keyOrField]);
                } else {
                    ret[keyOrField] = nestedMaps[keyOrField];
                }
            });
        }
        Object.keys(mapping.canonicalSlotsMap).forEach(key => {
            // TODO: this might not work as intended with structs?
            // Check whether it is already present or not.
            if (!ret[key]) {
                ret[key] = mapping.canonicalSlotsMap[key];
            }
        });
        return ret;
    };

    const mappingResult = Object.keys(mappingInfo).reduce((o, m) => {
        o[m] = recFillMapping(mappingInfo[m]);
        return o;
    }, {});
    // console.log("Mapping result: " + util.inspect(mappingResult, { depth: 5 }));
    return mappingResult;
}

module.exports = {
    createTracer,
    retrieveKeysInTrace,
};
