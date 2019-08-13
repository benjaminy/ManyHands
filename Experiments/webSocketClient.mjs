#!/usr/bin/env node --experimental-modules


import WebSocket from "ws";
import readline from "readline";
import Stopwatch from "./Stopwatch.mjs";
import fs from "file-system";

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
let timeArr = new Array(1000);
let counter = 0;
let host;



function startup(){
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  host = process.argv[2];
  let port = process.argv[3];
  let dest = host+":"+port
  try{
    rl.question('What is your alias name!\n', (answer) => {
      myAlias = answer;
      ws = new WebSocket(`ws://${dest}`);

      ws.on('open', function open() {
        var msg = JSON.stringify([undefined,myAlias,undefined,"start"])
        ws.send(msg);
      });
      const am_initiator = process.argv[4] === "initiator";
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
  }
  catch(ex){
  }
}

function parseInitiatorMessage(message,ws){
  if(counter<1000)
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
  let JSONarr = JSON.stringify(timeArr);
  let local = host==="localhost";
  if (local)
  {
    fs.writeFileSync(`./Data/webSocketLocal.json`, JSONarr);
  }
  else {
    fs.writeFileSync("./Data/webSocketGlobal.json",JSONarr)
  }
}

startup();
