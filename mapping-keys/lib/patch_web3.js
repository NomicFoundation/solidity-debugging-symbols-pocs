
function patch_web3(web3) {
    let id = 0;
    // TODO: cleanup so it is compatible with geth too?
    // Monkey-patch web3 debug module for ganache
    web3.debug = {
        traceTransaction: (txHash, options, callback) => {
            // console.log("txHash: " + txHash);
            // console.log("options: " + util.inspect(options));
            web3.currentProvider.send({
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
}

module.exports = {
    patch_web3
}