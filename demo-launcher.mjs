// Launch a loopback-only fictional household with ephemeral demo credentials.
// Do not publish this local-authentication demo directly on the Internet.
import {randomBytes} from 'node:crypto';
import {createApp} from './server.mjs';
const actors=['priya','sam','alex'];
const generate=()=>Object.fromEntries(actors.map(actor=>[actor,randomBytes(32).toString('hex')]));
const tokens=generate(),mcpTokens=generate();
const app=createApp({tokens,mcpTokens,dbFile:process.env.RELAY_DB||'./relaycase-demo.sqlite',port:Number(process.env.PORT||3000),mcpMode:process.env.RELAY_MCP_TRANSPORT||'experimental'});
const url=await app.listen();
console.log(`\nRelayCase demo: ${url}`);
console.log('LOCAL ONLY · SIMULATED Alexa+ UX · deterministic assistant · not a live Amazon integration.');
console.log('MCP transport: '+(process.env.RELAY_MCP_TRANSPORT||'experimental')+' (official must be independently tested).');
console.log('Enter one of these browser credentials. They are not written into the repository:');
for(const actor of actors) console.log(`  ${actor}: ${tokens[actor]}`);
console.log('MCP credentials generated independently and kept server-side.');
console.log('Ctrl+C ends the demo. Optional RELAY_DB=:memory: makes the database ephemeral.\n');
const end=async()=>{await app.close();process.exit(0);};
process.once('SIGINT',end);process.once('SIGTERM',end);
