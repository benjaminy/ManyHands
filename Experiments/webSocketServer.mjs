#!usr/bin/env nodejs --experimental-modules

import T from "transit-js";
import WebSocket from "ws";

const TO = 0;
const FROM = 1;
const MESS = 2;
const TYPE = 3;

const clientMap = T.map();
let wss;

function start(){
    wss = new WebSocket.Server({
    port: 8080,
    backlog: 2,
  });

  wss.on('connection', function connection(ws) {
    let firstMessage = true;
    ws.on('message', function incoming(data) {
      console.log(data);
      let message = JSON.parse(data);
      parseMessage(message,ws);
    });
  });
}

function parseMessage(message,ws){

  let firstMessage = message[TYPE]=== "start";
  if (firstMessage){
    addClientToMap(ws, message);
  }
  else
  {
    notifyTargetClient(message);
  }
}

function addClientToMap(ws,message)
{
  let alias = message[FROM];
  wss.clients.forEach(function each(client) {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      var newMess = JSON.stringify([undefined,undefined,alias,"new"]);
      client.send(newMess);
    }
  });
  clientMap.set(alias,ws);
}
function notifyTargetClient(message){
  let targetName = message[TO];

  if(!(clientMap.has(targetName))) {
      throw Error("Target does not exist");
  }
  let targetSock = clientMap.get(targetName);
  let sendMessage = JSON.stringify(message);
  targetSock.send(sendMessage);
}

start();
