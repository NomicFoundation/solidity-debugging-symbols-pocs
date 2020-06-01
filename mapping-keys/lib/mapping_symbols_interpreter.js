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


// @param tx is of the form { hash: <tx hash> } where the tx hash is the one whose trace should be observed.
// @param symbols is a list of bytecode offsets for position calculations for a given map.
// @param tracer is the object that retrieves traces and allows observation of individual steps in them.
// @returns an array of pair {slot,key} used in the transaction
// Later on we could add some information to the values in the returned dictionary if warranted.
//TODO use deployedBytecodeOffset and bytecodeOffset depending on the case
async function retrieveKeysInTrace(tx, symbols, tracer) {
    const success = await tracer.resolveTrace(tx);
    if (!success) throw "Tracing unsuccessful?";

    // The trace was successfully retrieved and analysed
    const sha3_offsets = {};
    for (const symbol of symbols.mappings) {
            // TODO: check if the symbol offset needs any adjustment
            sha3_offsets[symbol.deployedBytecodeOffset] = true;
    }

    const number_of_steps = await tracer.getLength();
    const keys = [];
    for (let step = 0; step < number_of_steps; step++) {
        const pc = await tracer.getCurrentPC(step);
        if (sha3_offsets[pc]) {
            const memory = await tracer.getMemoryAt(step);
            keys.push({slot: "0x" + memory[1], key: "0x" + memory[0]});
        }
    }
    return keys;
}

module.exports = {
    createTracer,
    retrieveKeysInTrace,
};
