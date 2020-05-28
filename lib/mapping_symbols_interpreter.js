const Web3 = require("web3");
const { TraceManager } = require("remix-lib").trace;
const util = require("util");

const web3 = new Web3("ws://localhost:8545");

let id = 0;

// TODO: cleanup so it is compatible with geth too?
// Monkey-patch web3 debug module for ganache
web3.debug = {
    traceTransaction: (txHash, options, callback) => {
        // console.log("txHash: " + txHash);
        // console.log("options: " + util.inspect(options));
        my_debugger.tracer.web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "debug_traceTransaction",
            params: [ txHash, options ],
            id
        }, (error, result) => {
            // console.log(error);
            // console.log(result);
            callback(error, result.result);
        });
        id += 1;
    }
}

const tracer = new TraceManager({ web3 });

// @param tx is of the form { hash: <tx hash> }
function retrieveKeysInTrace(tx, symbols) {
    tracer.resolveTrace(tx, (error, success) => {
        if (error) console.error(error);
        else if (!success) console.warn("Tracing unsuccessful?");
        else {
            // The trace was successfully retrieved and analysed

        }
    });
}

module.exports = {
    tracer,
    retrieveKeysInTrace,
};