usePlugin("@nomiclabs/buidler-ganache");
usePlugin("@nomiclabs/buidler-truffle5");
usePlugin("@nomiclabs/buidler-web3");

// You have to export an object to set up your config
// This object can have the following optional entries:
// defaultNetwork, networks, solc, and paths.
// Go to https://buidler.dev/config/ to learn more
module.exports = {
    // This is a sample solc configuration that specifies which version of solc to use
    solc: {
        version: "0.6.7",
    },
    defaultNetwork: "ganache",
    networks: {
        ganache: {
            url: "http://localhost:8545",
            seed: "one symbol format to rule them all"
        }
    }
};
