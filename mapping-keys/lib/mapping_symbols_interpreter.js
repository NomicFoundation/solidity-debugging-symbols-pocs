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

function getMappingLabel(slot, symbols) {
    let name = undefined;
    symbols.storageLayout.forEach(s=> {
        if(!name && toBN(s.slot).eq(toBN(slot))) {
            name = s.label;
        }
    });
    return name;
}

function readMemory(memory, pointer, size) {
    const value_array = [];
    for (let i = pointer * 2n; i < (pointer + size) * 2n; i++) {
        value_array.push(memory[i]);
    }
    return "0x" + value_array.join("");
}

function getTypes(pc, symbols, deployedBytecode) {
    let bytecode = deployedBytecode ? "deployedBytecodeOffset" : "bytecodeOffset";
    for (let i = 0; i < symbols.mappings.length; i++){
        if (symbols.mappings[i][bytecode] === pc.toString()) {
            return {keyType: symbols.mappings[i].key ,valueType: symbols.mappings[i].value};
        }
    }
    return undefined;
}

function toCanonicalType(type) {
    switch (type) {
        case 't_uint256': return 'uint256';
        case 't_string_memory_ptr': return 'string';
        case 't_address': return 'address';
        default: throw 'Unknown type ' + type
    }
}


// @param tx is of the form { hash: <tx hash> } where the tx hash is the one whose trace should be observed.
// @param symbols is a list of bytecode offsets for position calculations for a given map.
// @param tracer is the object that retrieves traces and allows observation of individual steps in them.
// @returns an array of pair {slot,key} used in the transaction
// Later on we could add some information to the values in the returned dictionary if warranted.
/*

--- mappingResult:
{
    'theMap': {
        'key1': resultingSlot1,
        'key2': resultingSlot2,
    }

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
    'theMap': {
        'key1': resultingSlot1,
        'key2': {
            'key3': resultingSlot3,
            'key4': resultingSlot4
        }
    }

}
 */

async function retrieveKeysInTrace(tx, symbols, tracer, deployedBytecode = true) {
    const success = await tracer.resolveTrace(tx);
    if (!success) throw "Tracing unsuccessful?";

    // The trace was successfully retrieved and analysed
    const sha3_offsets = {};
    for (const symbol of symbols.mappings) {
        if(deployedBytecode) {
            sha3_offsets[symbol.deployedBytecodeOffset] = true;
        } else {
            sha3_offsets[symbol.bytecodeOffset] = true;
        }
    }

    const number_of_steps = await tracer.getLength();
    const mappingResult = {};
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

            const label = getMappingLabel(slot, symbols);
            const { keyType } = getTypes(pc, symbols, deployedBytecode);
            const type = toCanonicalType(keyType);
            let decodedKey;
            if(type === 'string') {
               decodedKey =  web3.utils.toAscii(key);
            } else {
                decodedKey = coder.decode([toCanonicalType(keyType)], key).toString();
            }

            if(!slots[slot]) slots[slot] = {};
            slots[slot][decodedKey] = resultingSlot;

            if(label) {
                if(!mappingResult[label]) mappingResult[label] = {};
                mappingResult[label][decodedKey] = resultingSlot;
            }
        }
    }

    const recFillMapping = (mapping) => {
        const ret = {};
        Object.keys(mapping).forEach(k => {
            if(slots[mapping[k]]) {
                ret[k] = recFillMapping(slots[mapping[k]]);
            } else {
                ret[k] = mapping[k];
            }
        });
        return ret;
    };

    return Object.keys(mappingResult).reduce((o, m)=> {
        o[m] = recFillMapping(mappingResult[m]);
        return o;
    }, {});
}

module.exports = {
    createTracer,
    retrieveKeysInTrace,
};
