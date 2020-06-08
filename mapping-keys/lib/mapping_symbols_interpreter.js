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

function getRootLabel(slot, symbols) {
    const slotBN = toBN(slot);
    for (const symbol of symbols.storageLayout) {
        const slots = toBN(symbols.storageTypes[symbol.type].numberOfBytes).div(toBN(32));
        if (toBN(symbol.slot).lte(slotBN) && toBN(symbol.slot).add(slots).gt(slotBN)) {
            //This is a root mapping
            return symbol.label;
        }
    }

    //Not a root mapping
    return undefined;
}

function createRootInfo(label, symbols) {
    for (const symbol of symbols.storageLayout) {
        if(symbol.label === label) {
            const type = toCanonicalType(symbol.type);
            if(type === 'mapping') {
                return {
                    keys: {},
                    type: 'mapping',
                    baseSlot: toBN(symbol.slot),
                    completeType: symbol.type
                }
            } else if(type === 'struct') {
                return {
                    type: 'struct',
                    completeType: symbol.type,
                    baseSlot: toBN(symbol.slot),
                }
            } else {
                throw Error("Unidentified root varible" + type);
            }
        }
    }
}

function addToMappingInfo(mappingInfo, slot, key, resultingSlot) {
    if(mappingInfo.type === 'mapping') {
        mappingInfo.keys[key] = resultingSlot;
    }
}

function hasKeys(obj) {
    return !!obj && Object.keys(obj).length > 0;
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

/*
--- mappingInfo:
{
    'mapAsRootVariable': {
        'type': 'mapping'
        'completeType': 't_mapping(t_uint256=>t_uint256)'
        'keys': {
            'key1': resultingSlot1,
            'key2': resultingSlot2,
        },
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
    const mappingInfo = {};
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
            const { keyType, valueType } = getTypes(pc, symbols, deployedBytecode);
            const type = toCanonicalType(keyType);
            let decodedKey;
            if (type === 'string') {
                decodedKey = web3.utils.toAscii(key);
            } else {
                decodedKey = coder.decode([toCanonicalType(keyType)], key).toString();
            }

            if (!slots[slot]) slots[slot] = {};
            slots[slot][decodedKey] = resultingSlot;

            const rootLabel = getRootLabel(slot, symbols);
            if(rootLabel) {
                if (!mappingInfo[rootLabel]) mappingInfo[rootLabel] = createRootInfo(rootLabel, symbols);
                addToMappingInfo(mappingInfo[rootLabel], slot, decodedKey, resultingSlot);
            }
        }
    }

    const recFillMapping = (mapping) => {
        const ret = {};
        let hasValues = false;

        const typeInfo = symbols.storageTypes[mapping.completeType];

        if(mapping.type === 'mapping') {
            hasValues = hasKeys(mapping.keys);
            const canonicalTypeResult = toCanonicalType(typeInfo.value);

            if(canonicalTypeResult === 'mapping') {
                Object.keys(mapping.keys).forEach(k => {
                    ret[k] = recFillMapping({
                        type: canonicalTypeResult,
                        completeType: typeInfo.value,
                        keys: slots[mapping.keys[k]] || {}
                    });
                })
            } else if(canonicalTypeResult === 'struct'){
                Object.keys(mapping.keys).forEach(k => {
                    ret[k] = recFillMapping({
                        type: canonicalTypeResult,
                        completeType: typeInfo.value,
                        baseSlot: toBN(mapping.keys[k])
                    });
                })
            } else {
                Object.keys(mapping.keys).forEach(k => {
                    ret[k] = mapping.keys[k];
                })
            }
        } else if(mapping.type === 'struct') {
           for(let member of typeInfo.members) {
               const memberSlot = "0x" + mapping.baseSlot.add(toBN(member.slot)).toString(16,64);
               const canonicalMemberType = toCanonicalType(member.type);

               if(canonicalMemberType === 'mapping') {
                   if(slots[memberSlot] && hasKeys(slots[memberSlot])) {
                       hasValues = true;
                       const { ret: _ret, hasValues: _hasValues } = recFillMapping({
                           type: canonicalMemberType,
                           completeType: member.type,
                           keys: slots[memberSlot] || {}
                       });
                       if(_hasValues) ret[member.label] = _ret;
                   }
               } else if(canonicalMemberType === 'struct') {
                   const { ret: _ret, hasValues: _hasValues } = recFillMapping({
                       type: canonicalMemberType,
                       completeType: member.type,
                       baseSlot: toBN(memberSlot)
                   });
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
        Object.keys(ret).forEach(k=>
          ans[k] = removeHasValid(ret[k])
        );
        return ans;
    };

    let mappingResult = Object.keys(mappingInfo).reduce((o, m) => {
        o[m] = recFillMapping(mappingInfo[m]);
        return o;
    }, {});

    mappingResult = removeHasValid({ret: mappingResult});
    return mappingResult;
}

module.exports = {
    createTracer,
    retrieveKeysInTrace,
};
