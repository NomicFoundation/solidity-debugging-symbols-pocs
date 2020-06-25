const { decodeInstructions: buidlerEVMDecodeInstructions } = require("../node_modules/@nomiclabs/buidler/internal/buidler-evm/stack-traces/source-maps");
const coder = require("@ethersproject/abi").defaultAbiCoder;
const { readValue } = require("./decoder");
const fs = require('fs').promises;

function decodeInstructions(bytecode, sourceMap) {
    const bytecodeBuffer = Buffer.from(bytecode.replace("0x", ""), "hex");
    return buidlerEVMDecodeInstructions(bytecodeBuffer, sourceMap, new Map());
}

async function mapLinesToFileOffsets(filePath) {
    const file = await fs.readFile(filePath, 'utf8');
    const lines = file.split('\n');
    let sum = 0;
    const fileOffsetByLine = [];
    for (const line of lines) {
        // Add an extra character to account for each subtracted newline.
        fileOffsetByLine.push({ start: sum, end: sum + line.length + 1 });
        sum += line.length + 1;
    }
    return fileOffsetByLine;
}

/* Returns line -> bytecode offsets dictionary. The lists of instructions are ordered by program counter.
 */
function instructionsByLine(lines, decodedInstructions, fileOffsetByLine) {
    const instructionsByLineMap = {};
    for (const line of lines) {
        instructionsByLineMap[line] = [];
        for (const instruction of decodedInstructions) {
            if (instruction.location) {
                const {start, end} = fileOffsetByLine[line - 1];
                if (start <= instruction.location.offset && instruction.location.offset <= end) {
                    instructionsByLineMap[line].push(instruction);
                }
            }
        }
    }

    return instructionsByLineMap;
}

/*
 */
async function retrieveLiveVariablesInTrace(trace, symbols, instructionsByLine, deployedBytecode = true) {
    const symbolsByOffset = {};
    for (const symbol of symbols.variables) {
        const bytecodeOffset = deployedBytecode ? symbol.deployedBytecodeOffset : symbol.bytecodeOffset;
        if (!symbolsByOffset[bytecodeOffset]) symbolsByOffset[bytecodeOffset] = [];
        symbolsByOffset[bytecodeOffset].push(symbol);
    }

    const liveVariablesInTrace = {};
    for (const [line, instructions] of Object.entries(instructionsByLine)) {
        const stopBytecodeOffset = instructions[0].pc;
        const variablesByIteration = await traceLiveVariablesStackLocations(trace, stopBytecodeOffset, symbolsByOffset);
        const variablesValueByIteration = await Promise.all(variablesByIteration.map((liveVariables) => readVariableValues(trace, liveVariables, instructions)));
        liveVariablesInTrace[line] = variablesValueByIteration.map(it => it.reduce((o,v) => Object.assign(o, {[v.symbol.label]: v.value}), {}));
    }

    return liveVariablesInTrace;
}

// TODO: restrict liveVariables to a certain scope.
async function traceLiveVariablesStackLocations(trace, stopBytecodeOffset, symbolsByOffset) {
    const numberOfSteps = await trace.getLength();
    const liveVariablesByIteration = [];
    let liveVariables = [];
    let step = 0;
    for (; step < numberOfSteps; step++) {
        const pc = await trace.getCurrentPC(step);
        const offsetSymbols = symbolsByOffset[pc];
        const stack = await trace.getStackAt(step);

        // FIXME: This should use the end of scope markers too.
        liveVariables = liveVariables.filter((variable) => {
            return variable.stackPointer < stack.length;
        });

        if (pc === stopBytecodeOffset) {
            liveVariablesByIteration.push({
                liveVariables: liveVariables.slice(),
                step
            });
        }

        if (offsetSymbols) {
            for (const symbol of offsetSymbols) {
                // console.log(`Found variable ${symbol.label}`);
                // This position should use a common frame of reference: the bottom of the stack.
                // Since this is a push instruction, its position is outside the current stack.
                const stackPointer = stack.length - symbol.stackOffset;
                liveVariables.push({
                    stackPointer,
                    symbol
                });
            }
        }
    }
    return liveVariablesByIteration;
}

async function readVariableValues(trace, variables, bytecodeRange) {
    let finalStep = variables.step;
    const stack = await trace.getStackAt(finalStep);
    const memoryBlocks = await trace.getMemoryAt(finalStep);
    const memory = memoryBlocks.join("");
    const calldata = (await trace.getCallDataAt(finalStep))[0].replace("0x", "");
    const state = { stack, memory, calldata };
    // console.log(`Stack in final step: ${util.inspect(stack, { depth: 5 })}`);
    // TODO: read variable values and decode them.
    return Promise.all(variables.liveVariables.map((variable) => readValue(state, variable)));
}

function isPush(opcode) {
    return opcode.startsWith("PUSH");
}

module.exports = {
    retrieveLiveVariablesInTrace,
    instructionsByLine,
    mapLinesToFileOffsets,
    decodeInstructions
};
