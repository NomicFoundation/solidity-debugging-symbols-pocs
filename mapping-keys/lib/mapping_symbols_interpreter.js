const { TraceManager } = require("remix-lib").trace;
const {toBN} = web3.utils;
const util = require("util");
const coder = require("@ethersproject/abi").defaultAbiCoder;

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

function readMemory(memory, pointer, size) {
    const value_array = [];
    for (let i = pointer * 2n; i < (pointer + size) * 2n; i++) {
        value_array.push(memory[i]);
    }
    return "0x" + value_array.join("");
}

// Retrieve label of a root variable
function getRootLabel(slot, symbols) {
    const slotBN = toBN(slot);
    for (const symbol of symbols.storageLayout) {
        const slots = toBN(symbols.storageTypes[symbol.type].numberOfBytes).div(toBN(32));
        if (toBN(symbol.slot).lte(slotBN) && toBN(symbol.slot).add(slots).gt(slotBN)) {
            //This is a root mapping
            return symbol.label;
        }
    }

    //Not a root variable
    return undefined;
}

//Creates the initial information for root mappings and structs
function createRootInfo(label, symbols) {
    for (const symbol of symbols.storageLayout) {
        if(symbol.label === label) {
            const type = toCanonicalType(symbol.type);
            if(type === 'mapping') {
                return {
                    type: 'mapping',
                    completeType: symbol.type,
                    baseSlot: toBN(symbol.slot)
                }
            } else if(type === 'struct') {
                return {
                    type: 'struct',
                    completeType: symbol.type,
                    baseSlot: toBN(symbol.slot),
                }
            } else {
                throw Error(`Unidentified root varible ${label}: ${type}`);
            }
        }
    }
}

function toCanonicalType(type) {
    if(type.startsWith("t_")) {
        type = type.replace("t_", "");
    }

    if(type.startsWith("string")) return "string";
    if(type.startsWith("struct")) return "struct";
    if(type.startsWith("mapping")) return "mapping";
    if(type.startsWith("enum")) return "enum";
    if(type.startsWith("array")) return "array";
    return type;
}

function decodeKey(key, keyType) {
    const type = toCanonicalType(keyType);
    if (type === 'string') {
        return web3.utils.toAscii(key);
    } else {
        return coder.decode([toCanonicalType(keyType)], key).toString();
    }
}

function hasKeys(obj) {
    return !!obj && Object.keys(obj).length > 0;
}

function bnToSlot(bn) {
    return "0x" + bn.toString(16,64)
}

/*
--- rootMappingInfo:
{
    'mapAsRootVariable': {
        'type': 'mapping'
        'completeType': 't_mapping(t_uint256=>t_uint256)'
        'baseSlot': 1,
    },
    'structAsRootVariable': {
        'type': struct
        'completeType': 't_struct(MyStruct)_54'
        'baseSlot': 2
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
--- result
{
    'mapAsRootVariable': {
        'key1': resultingSlot1,
        'key2': {
            'key3': resultingSlot3,
            'key4': resultingSlot4
        }
    },
    'structAsRootVariable': {
        'mapMemeberLabel': {
            'key5': {
                'key6': resultingSlot6
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
    const rootMappingInfo = {};
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

            //All slots queried with keys are saved
            if (!slots[slot]) slots[slot] = {};
            slots[slot][key] = resultingSlot;

            //RootMappingInfo works as a starting point to know which mappings where used.
            const rootLabel = getRootLabel(slot, symbols);
            if(rootLabel && !rootMappingInfo[rootLabel]) {
                rootMappingInfo[rootLabel] = createRootInfo(rootLabel, symbols);
            }
        }
    }

    //Recursive function that will fill up the result
    const recFillMapping = (mapping) => {
        //ret: Resulting map of keys or members used
        const ret = {};
        //hasValues: Either there is a meaningful value at this level (a key used) or there is
        //one at a deeper level.
        let hasValues = false;
        const typeInfo = symbols.storageTypes[mapping.completeType];

        if(mapping.type === 'mapping') {
            // If the type is mapping, go through every key used with that slot,
            // check the supposed result type
            const mappingKeys = slots[bnToSlot(mapping.baseSlot)] || {};
            //Unless there are keys in the mapping, dont show it in the result
            hasValues = hasKeys(mappingKeys);
            const canonicalTypeResult = toCanonicalType(typeInfo.value);

            if(canonicalTypeResult === 'mapping' || canonicalTypeResult === 'struct') {
                // If the resultType is a mapping or a struct, recursively call the function
                // Giving the baseSlot as the resulting slot
               for(let k of Object.keys(mappingKeys)) {
                    ret[decodeKey(k, typeInfo.key)] = recFillMapping({
                        type: canonicalTypeResult,
                        completeType: typeInfo.value,
                        baseSlot: toBN(mappingKeys[k])
                    }).ret;
                }
            } else {
                for(let k of Object.keys(mappingKeys)) {
                    ret[decodeKey(k, typeInfo.key)] = mappingKeys[k];
                }
            }
        } else if(mapping.type === 'struct') {
            //If the type is a struct, iterate each member and calculate the member slot
            //based on the baseSlot. If the type is mapping or struct recursively call the
            // function that would check If any key is used with that slot
            for(let member of typeInfo.members) {
               const memberSlot = bnToSlot(mapping.baseSlot.add(toBN(member.slot)));
               const canonicalMemberType = toCanonicalType(member.type);

               if(canonicalMemberType === 'mapping' || canonicalMemberType === 'struct') {
                   const { ret: _ret, hasValues: _hasValues } = recFillMapping({
                       type: canonicalMemberType,
                       completeType: member.type,
                       baseSlot: toBN(memberSlot)
                   });
                   //If no keys were used in that member, dont add it
                   if(_hasValues) ret[member.label] = _ret;
                   hasValues = hasValues || _hasValues;
               }
           }
        } else {
            throw Error("Unkown mapping type")
        }

        return {ret, hasValues};
    };

    const removeHasValid = (obj) => {
        if(!(obj instanceof Object)) return obj;
        let { ret } = obj;
        if(!ret) ret = obj;
        let ans = {};
        for(let k of Object.keys(ret)) ans[k] = removeHasValid(ret[k]);
        return ans;
    };

    let mappingResult = Object.keys(rootMappingInfo).reduce((o, m) => {
        o[m] = recFillMapping(rootMappingInfo[m]);
        return o;
    }, {});

    //Remove ret and hasValid attributes used in the recursive function
    mappingResult = removeHasValid({ret: mappingResult});
    return mappingResult;
}

module.exports = {
    createTracer,
    retrieveKeysInTrace,
};
