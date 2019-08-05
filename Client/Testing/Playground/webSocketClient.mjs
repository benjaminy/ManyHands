import WebSocket from "ws";
import readline from "readline";
import Stopwatch from "statman-stopwatch";
let rl;
let ws;
let myAlias;
const watch = new Stopwatch();

function startup(){
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  let dest;
  try{
    rl.question('What is the ip and port of your server in ip:port format\n', (answer) => {
      dest = answer;
      rl.question('What is your alias name!\n', (answer) => {
        myAlias = answer;
        ws = new WebSocket(`ws://${dest}`);
        ws.on('open', function open() {
          ws.send(`${myAlias}:`);
        });

        ws.on('message', function incoming(data) {
          parseMessage(data,ws);
        });
      });
    });

  }
  catch(ex){
  }


}

function parseMessage(message,ws){
  let pos = message.indexOf("new:");
  if (!(pos===-1)){
    let alias = message.slice(4);
    watch.start();
    ws.send(`${alias}:PING-${myAlias}`);
    return;
  }
  pos = message.indexOf("PING-");
  if (!(pos===-1)){
    let returnAlias = message.slice(pos+5);
    ws.send(`${returnAlias}:PONG`);
    return;
  }
  pos = message.indexOf("PONG")
  if(!(pos===-1)){
    let msTime = watch.stop();
    console.log("It took ",msTime," milliseconds for websocket ping pong");
    return;
  }
  if (pos===-1)
  {
    console.log("Error",message);
  }
}
startup();
