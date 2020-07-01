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
    const bareGetCallDataAt = util.promisify(tracer.getCallDataAt);
    const getCallDataAt = bareGetCallDataAt.bind(tracer);
    const bareGetCurrentCalledAddressAt = util.promisify(tracer.getCurrentCalledAddressAt);
    const getCurrentCalledAddressAt = bareGetCurrentCalledAddressAt.bind(tracer);
    const bareAccumulateStorageChanges = util.promisify(tracer.accumulateStorageChanges);
    const accumulateStorageChanges = bareAccumulateStorageChanges.bind(tracer);
    // The step parameter may be relative to the step in which the call frame was created.
    // We're testing with the first call frame for now.
    const getStorageAt = (step, address) => accumulateStorageChanges(step, address, {});
    return {
        tracer,
        resolveTrace,
        getCurrentCalledAddressAt,
        getLength,
        getCurrentPC,
        getStackAt,
        getCallDataAt,
        getStorageAt,
        getMemoryAt
    };
}

async function traceTransaction(tracer, tx) {
    const success = await tracer.resolveTrace(tx);
    if (!success) throw new Error("Tracing unsuccessful?");
    // The trace was successfully retrieved and analysed.
    // The analysis can be queried through the TraceManager API.
}

module.exports = {
    createTracer,
    traceTransaction
}