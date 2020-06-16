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
    return sh("lib/compiler/solcDebugSym --bin --storage-layout " + path).then( ({ stdout }) => {
            //Hack for multiple contracts on same file
            const contractName = (/([^/]+)(\.sol)$/).exec(path)[1];
            const lines = stdout.split("\n");
            const contractLineIndex = lines.findIndex((v) => v.includes(":"+contractName));
            const bytecode = "0x" + lines[contractLineIndex + 2];
            const storage = JSON.parse(lines[contractLineIndex + 4]);
            const storageLayout = storage.storage;
            const storageTypes = storage.types;

            //Files created by the debugging symbols rough implementation
            return Promise.all([
                fs.readFile("mappings.json", 'utf8'),
                fs.readFile("mappingsOffset.tsv", 'utf8'),
                fs.readFile("variables.json", 'utf8'),
                fs.readFile("variablesOffset.tsv", 'utf8')
            ]).then( async ([mappingsJson, mappingsOffsetTsv, variablesJson, variablesOffsetTsv]) => {

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
            })

        })
}

module.exports = {
    compile
};