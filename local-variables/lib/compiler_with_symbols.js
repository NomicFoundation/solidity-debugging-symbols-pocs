const { exec } = require("child_process");
const fs = require('fs').promises;
const util = require('util');

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
    const { stdout } = await sh("lib/compiler/solcDebugSym --bin --storage-layout " + path);
    //Hack for multiple contracts on same file
    const contractName = (/([^/]+)(\.sol)$/).exec(path)[1];
    const lines = stdout.split("\n");
    const lineIndex = lines.findIndex((v) => v.includes(":"+contractName));
    const bytecode = "0x" + lines[lineIndex + 2];
    const storage = JSON.parse(lines[lineIndex + 4]);
    const storageLayout = storage.storage;
    const storageTypes = storage.types;
    const [ mappingsJson, mappingsOffsetTsv, variablesJson, variablesOffsetTsv ] = await Promise.all([
        fs.readFile("mappings.json", 'utf8'),
        fs.readFile("mappingsOffset.tsv", 'utf8'),
        fs.readFile("variables.json", 'utf8'),
        fs.readFile("variablesOffset.tsv", 'utf8')
    ])

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
        variables,
        mappings
    };

}

// Placeholder utility function until we can output source maps with the rest of the symbols.
async function compileSourceMap(path) {
    const { stdout } = await sh("lib/compiler/solcDebugSym --combined-json srcmap,srcmap-runtime,bin-runtime " + path);
    const srcMap = JSON.parse(stdout);
    // console.log("Compiler output: " + util.inspect(srcMap, { depth: 5 }));
    // FIXME: This supports only a single contract in a file. To support multiple, iterate over the keys instead.
    const fileAndContract = Object.keys(srcMap.contracts)[0];
    // console.log("Source map: " + util.inspect(srcMap.contracts[fileAndContract], { depth: 5 }));

    await Promise.all([
        fs.unlink("mappings.json"),
        fs.unlink("variables.json"),
    ]);
    return srcMap.contracts[fileAndContract];
}


module.exports = {
    compile,
    compileSourceMap
};