const Web3 = require("web3");
const mapLayoutExplorerArtifact = require("../artifacts/MapLayoutExplorer.json");
const util = require("util");

async function generateTx() {
    const web3 = new Web3("ws://localhost:8545");
    const accounts = await web3.eth.personal.getAccounts();
    const account = accounts[0];
    return web3.eth.sendTransaction({
        from: account,
        value: 0,
        to: account
    });
}

// @return a contract instance
async function deployContract() {
    const web3 = new Web3("ws://localhost:8545");
    const accounts = await web3.eth.personal.getAccounts();
    const account = accounts[0];
    const mapLayoutExplorer = mapLayoutExplorerArtifact.contracts["contracts/MapLayoutExplorer.sol:MapLayoutExplorer"];
    const contractInterface = new web3.eth.Contract(JSON.parse(mapLayoutExplorer.abi), null, {
        from: account,
        gas: 3 * (10 ** 6),
        gasPrice: 0,
        data: mapLayoutExplorer.bin
    });
    return contractInterface.deploy().send({});
}

function accessTheMap(contract, index) {
    return contract.methods.accessTheMap(index).send({});
}

function accessNestedMap(contract, outerIndex, innerIndex) {
    return contract.methods.accessNestedMap(outerIndex, innerIndex).send({});
}



module.exports = {
    generateTx,
    deployContract,
}
