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
async function retrieveLiveVariablesInTrace(trace, symbols, decodedInstructions, instructionsByLine, deployedBytecode = true) {
    const symbolsByOffset = {};
    for (const symbol of symbols.variables) {
        const bytecodeOffset = deployedBytecode ? symbol.deployedBytecodeOffset : symbol.bytecodeOffset;
        if (!symbolsByOffset[bytecodeOffset]) symbolsByOffset[bytecodeOffset] = [];
        symbolsByOffset[bytecodeOffset].push(symbol);
    }

    const symbolsByEndOffset = {};
    for (const symbol of symbols.variables) {
        const bytecodeEndOffset = deployedBytecode ? symbol.endDeployedBytecodeOffset : symbol.endBytecodeOffset;
        if (!symbolsByEndOffset[bytecodeEndOffset]) symbolsByEndOffset[bytecodeEndOffset] = [];
        symbolsByEndOffset[bytecodeEndOffset].push(symbol);
    }

    const liveVariablesInTrace = {};
    for (const [line, instructions] of Object.entries(instructionsByLine)) {
        const stopBytecodeOffset = instructions[0].pc;
        const variablesByIteration = await traceLiveVariablesStackLocations(trace, decodedInstructions, stopBytecodeOffset, symbolsByOffset, symbolsByEndOffset);
        const variablesValueByIteration = await Promise.all(variablesByIteration.map((liveVariables) => readVariableValues(trace, liveVariables)));
        liveVariablesInTrace[line] = variablesValueByIteration.map(it => it.reduce((o,v) => Object.assign(o, {[v.symbol.label]: v.value}), {}));
    }

    return liveVariablesInTrace;
}

// TODO: restrict liveVariables to a certain scope.
async function traceLiveVariablesStackLocations(trace, decodedInstructions, stopBytecodeOffset, symbolsByOffset, symbolsByEndOffset) {
    const numberOfSteps = await trace.getLength();
    const liveVariablesByIteration = [];
    let liveVariablesArray = [[]];
    let step = 0;
    for (; step < numberOfSteps; step++) {
        const pc = await trace.getCurrentPC(step);
        const instruction = decodedInstructions.find(i => i.pc === pc);
        const offsetSymbols = symbolsByOffset[pc];
        const endOffsetSymbols = symbolsByEndOffset[pc];
        const stack = await trace.getStackAt(step);


        if(endOffsetSymbols) {
            liveVariablesArray[liveVariablesArray.length -1] = liveVariablesArray[liveVariablesArray.length -1].filter((variable) => {
              return !endOffsetSymbols.map(s => s.id).includes(variable.symbol.id);
            });
        }

        liveVariablesArray[liveVariablesArray.length -1] = liveVariablesArray[liveVariablesArray.length -1].filter((variable) => {
            if(variable.stackPointer >= stack.length) {
                // This sometimes happens due to optimizations
                // console.error(`Variable ${variable.symbol.label} was poped but never released in the debug symbols`)
            }
            return variable.stackPointer < stack.length;
        });

        if (offsetSymbols) {
            for (const symbol of offsetSymbols) {
                if(symbol.stackOffset > 0) {
                    const stackPointer = stack.length - symbol.stackOffset;
                    liveVariablesArray[liveVariablesArray.length -1].push({
                        stackPointer,
                        symbol
                    });
                }
            }
        }

        if (pc === stopBytecodeOffset) {
            liveVariablesByIteration.push({
                liveVariables: liveVariablesArray[liveVariablesArray.length -1].slice(),
                step
            });
        }

        if (offsetSymbols) {
            for (const symbol of offsetSymbols) {
                if(symbol.stackOffset === 0) {
                    liveVariablesArray[liveVariablesArray.length -1].push({
                        stackPointer: stack.length,
                        symbol
                    });
                }
            }
        }

        if(isFunctionJump(instruction)) {
            liveVariablesArray.push([]);
        }

        if(isReturn(instruction)) {
            liveVariablesArray.pop();
        }
    }
    return liveVariablesByIteration;
}

async function readVariableValues(trace, variables) {
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

function isFunctionJump(instruction) {
    return instruction.jumpType === 1;
}

function isReturn(instruction) {
    return instruction.jumpType === 2;
}
module.exports = {
    retrieveLiveVariablesInTrace,
    instructionsByLine,
    mapLinesToFileOffsets,
    decodeInstructions
};
