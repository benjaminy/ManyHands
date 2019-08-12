import WebSocket from "ws";
import readline from "readline";
import Stopwatch from "./Stopwatch.mjs";

//[to, from, message, type]
const TO = 0;
const FROM = 1;
const MESS = 2;
const TYPE = 3;

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
          var msg = JSON.stringify([undefined,myAlias,undefined,"start"])
          ws.send(msg);
        });
        const am_initiator = process.argv[ 2 ] === "initiator";
        if (am_initiator){
          ws.on("message",function incoming(data) {
            let message = JSON.parse(data);
            parseInitiatorMessage(message,ws);
          });
        }
        if(!(am_initiator)){
          ws.on('message', function incoming(data){
            let message = JSON.parse(data);
            parseNonInitMessage(message,ws)
          });
        }
        ws.on('close', function close() {
          console.log('disconnected');
        });
      });
    });
  }
  catch(ex){
  }
}

function parseInitiatorMessage(message,ws){
  if(counter<100)
  {
    let mess = message[MESS];
    let type = message[TYPE];
    if(type === "new"){
      theirAlias = mess;
      let newMess = JSON.stringify([theirAlias,myAlias,"PING","norm"]);
      watch.start();
      ws.send(newMess);
    }
    if (type === "norm" && mess === "PONG"){
      let time = watch.stop();
      timeArr[counter] = time;
      watch.reset();
      counter = counter+1;
      let newMess = JSON.stringify([theirAlias,myAlias,"PING","norm"]);
      watch.start();
      ws.send(newMess);
    }
  }
  else{
    printTime();
  }
}

function parseNonInitMessage(message,ws){
  let type = message[TYPE];
  theirAlias = message[FROM];
  let mess = message[MESS];

  if(type === "norm" && mess === "PING"){
    let newMessage = JSON.stringify([theirAlias, myAlias,"PONG","norm"]);
    ws.send(newMessage);
  }
}

function printTime(){
  for(var l = 0; l<100;l++){
    console.log(timeArr[l]);
  }
}

startup();
