import fs from 'node:fs';
import solc from 'solc';

const source = fs.readFileSync(new URL('../contracts/IPPassport.sol',import.meta.url),'utf8');
const input = {language:'Solidity', sources:{'IPPassport.sol':{content:source}}, settings:{
  evmVersion:'shanghai', optimizer:{enabled:true,runs:200},
  outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}
}};
const result = JSON.parse(solc.compile(JSON.stringify(input)));
for (const message of result.errors || []) console.error(message.formattedMessage);
if (result.errors?.some(entry=>entry.severity==='error')) process.exit(1);
const {abi,evm} = result.contracts['IPPassport.sol'].IPPassport;
const artifact = JSON.stringify({compiler:solc.version(),abi,bytecode:'0x'+evm.bytecode.object},null,2)+'\n';
fs.mkdirSync(new URL('../public/',import.meta.url),{recursive:true});
for (const path of ['../contracts/IPPassport.json','../public/IPPassport.json']) {
  fs.writeFileSync(new URL(path,import.meta.url),artifact);
}
console.log('Compiled IPPassport');

