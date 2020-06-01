const { TraceManager } = require("remix-lib").trace;
const util = require("util");


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


// @param tx is of the form { hash: <tx hash> }
// @param symbols is a list of bytecode offsets for position calculations.
// @returns a dictionary of keys and their raw values at the end of execution.
async function retrieveKeysInTrace(tx, symbols, tracer_glob) {
    const success = await tracer_glob.resolveTrace(tx);
    if (!success) {
        console.warn("Tracing unsuccessful?");
        return []
    }

    // The trace was successfully retrieved and analysed
    const sha3_offsets = {};
    for (const symbol of symbols) {
        for (const sha3_offset of symbol.bytecodeOffset) {
            // TODO: check if the symbol offset needs any adjustment
            sha3_offsets[sha3_offset] = true;
        }
    }
    const number_of_steps = await tracer_glob.getLength();
    const keys = {};
    for (let step = 0; step < number_of_steps; step++) {
        const pc = await tracer_glob.getCurrentPC(step);
        if (sha3_offsets[pc]) {
            const uint256_size = 32n;
            const stack = await tracer_glob.getStackAt(step);
            const memory_blocks = await tracer_glob.getMemoryAt(step);
            const memory_block_size = 32n;
            console.log("Stack: " + util.inspect(stack));
            console.log("Memory in blocks: " + util.inspect(memory_blocks));
            // All data is represented in big endian
            const memory = memory_blocks.join("");
            console.log("Memory: " + util.inspect(memory));
            // Remember that, unlike the storage, the memory is byte addressable.
            const buffer_pointer = BigInt("0x" + stack[0]);
            const buffer_length = BigInt("0x" + stack[1]);
            const key_length = buffer_length - uint256_size;
            // TODO: write the rest of the logic
            // const memory_block_start_index = buffer_pointer / memory_block_size;
            // const memory_block_start_offset = buffer_pointer % memory_block_size;
            // const memory_block_end_index = ((buffer_pointer + key_length) / memory_block_size) +
            //     ((buffer_pointer + key_length) % memory_block_size > 0n ? 1n : 0n)
            // const memory_block_end_offset = ((buffer_pointer + key_length) / memory_block_size) +
            //     ((buffer_pointer + key_length) % memory_block_size > 0n ? 1n : 0n)
            // const memory_buffer_blocks = memory_blocks.slice();
            const key_array = [];
            for (let i = buffer_pointer * 2n; i < (buffer_pointer + key_length) * 2n; i++) {
                key_array.push(memory[i]);
            }
            const key = key_array.join("");
            keys[key] = true;
        }
    }
    return keys;
}

module.exports = {
    createTracer,
    retrieveKeysInTrace,
};
