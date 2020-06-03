const { exec } = require("child_process");
const fs = require('fs').promises

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
            const bytecode = "0x" + stdout.split("\n")[3];
            const storageLayout = JSON.parse(stdout.split("\n")[5]).storage;
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