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

module.exports = {
    createTracer
}