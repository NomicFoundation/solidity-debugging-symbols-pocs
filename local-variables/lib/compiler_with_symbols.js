const { exec } = require("child_process");
const fs = require('fs').promises;

async function sh(cmd) {
    return new Promise(function (resolve, reject) {
        exec(cmd, (err, stdout, stderr) => {
            if (err) {
                reject(err);
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

async function compile(path) {
    const { stdout } = await sh("lib/compiler/solcDebugSym --combined-json srcmap,srcmap-runtime,bin-runtime,bin,storage-layout " + path);
    //Hack for multiple contracts on same file
    const contractName = (/([^/]+)(\.sol)$/).exec(path)[1];
    const contractPath = `contracts/${contractName}.sol:${contractName}`;

    const jsonOuput = JSON.parse(stdout);
    const bytecode = jsonOuput.contracts[contractPath].bin;
    const bytecodeRuntime = jsonOuput.contracts[contractPath]['bin-runtime'];
    const storage = JSON.parse(jsonOuput.contracts[contractPath]['storage-layout']);
    const storageLayout = storage.storage;
    const storageTypes = storage.types;
    const srcmap = jsonOuput.contracts[contractPath].srcmap;
    const srcmapRuntime = jsonOuput.contracts[contractPath]['srcmap-runtime'];

    const [ mappingsJson, mappingsOffsetTsv, variablesJson, variablesOffsetTsv ] = await Promise.all([
        fs.readFile("mappings.json", 'utf8'),
        fs.readFile("mappingsOffset.tsv", 'utf8'),
        fs.readFile("variables.json", 'utf8'),
        fs.readFile("variablesOffset.tsv", 'utf8')
    ]);

    const mappingsOffsets = mappingsOffsetTsv.split("\n")
        .map(n => n.split("\t"))
        .reduce((o, v) => {
            o[v[0]] = {};
            o[v[0]].bytecodeOffset = v[1];
            o[v[0]].deployedBytecodeOffset = v[2] === 'null' ? undefined : v[2];
            return o;
        }, {});

    const variablesOffsets = variablesOffsetTsv.split("\n")
        .map(n => n.split("\t"))
        .reduce((o, v) => {
            o[v[0]] = {};
            o[v[0]].bytecodeOffset = v[1];
            o[v[0]].deployedBytecodeOffset = v[2] === 'null' ? undefined : v[2];
            o[v[0]].endBytecodeOffset = v[3];
            o[v[0]].endDeployedBytecodeOffset = v[2] === 'null' ? undefined : v[4];
            return o;
        }, {});

    const mappings = JSON.parse(mappingsJson).map(v => {
        v.bytecodeOffset = mappingsOffsets[v.id].bytecodeOffset;
        v.deployedBytecodeOffset = mappingsOffsets[v.id].deployedBytecodeOffset;
        return v;
    });

    const variables = JSON.parse(variablesJson).map(v => {
        v.bytecodeOffset = variablesOffsets[v.id].bytecodeOffset;
        v.deployedBytecodeOffset = variablesOffsets[v.id].deployedBytecodeOffset;
        return v;
    });

    await Promise.all([
        fs.unlink("mappings.json"),
        fs.unlink("mappingsOffset.tsv"),
        fs.unlink("variables.json"),
        fs.unlink("variablesOffset.tsv")
    ]);

    return {
        storageTypes,
        storageLayout,
        bytecode,
        bytecodeRuntime,
        variables,
        mappings,
        srcmap,
        srcmapRuntime
    };

}

module.exports = {
    compile
};