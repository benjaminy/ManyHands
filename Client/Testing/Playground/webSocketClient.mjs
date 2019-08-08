import WebSocket from "ws";
import readline from "readline";
import Stopwatch from "statman-stopwatch";
let rl;
let ws;
let myAlias;
let theirAlias;
const watch = new Stopwatch();
let timeArr = new Array(100);
let counter = 0;

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
        const am_initiator = process.argv[ 2 ] === "initiator";
        if (am_initiator){
          ws.on('message', function incoming(data) {
            parseInitiatorMessage(data,ws);
          });
        }
        if(!(am_initiator)){
          ws.on('message', function incoming(data){
              parseNonInitMessage(data,ws)
          });
        }
      });
    });
  }
  catch(ex){
  }
}

function resetTime(counter){
  if(counter<100){
    watch.reset();
    watch.start();
    ws.send(`${alias}:PING-${myAlias}`);
    return counter++;
  }
  else{
    printTime()
  }
}

function printTime(){
  for(var l = 0; l<100;l++){
    console.log(timeArr[l]);
  }
}

function parseInitiatorMessage(message,ws){
  let pos = message.indexOf("new:");
  if (!(pos===-1)){
    theirAlias = message.slice(4);
    watch.start();
    ws.send(`${alias}:PING-${myAlias}`);
    ws.on('message', function incoming(data) {
      pos = message.indexOf("PONG")
      if(!(pos===-1)){
        let msTime = watch.stop();
        timeArr[counter] = msTime;
        counter = resetTime(counter)
      }
      else {
        console.log("something went wrong with Pong message");
      }
    });
  }
  else{
    Console.log("something went wrong with new: message");
  }
}



function parseNonInitMessage(message,ws){
  pos = message.indexOf("PING-");
  if (!(pos===-1)){
    let returnAlias = message.slice(pos+5);
    ws.send(`${returnAlias}:PONG`);
  }
  if (pos===-1)
  {
    console.log("Error",message);
  }
}
startup();
