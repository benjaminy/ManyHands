#!usr/bin/env nodejs --experimental-modules

import T from "transit-js";
import WebSocket from "ws";
const clientMap = T.map();
let wss;

function start(){
    wss = new WebSocket.Server({
    port: 8080,
    backlog: 2,
  });

  wss.on('connection', function connection(ws) {
    let firstMessage = true;
    ws.on('message', function incoming(message) {
      if (firstMessage){
        addClientToMap(ws, message);
        firstMessage = false;
      }
      else
      {
        notifyTargetClient(message);
      }
    });
  });
}

function addClientToMap(ws,message)
{
  let pos = message.indexOf(":");
  if(!(pos+1 === message.length) || pos === -1 )
  {
    throw Error("first message does not have Alias: format");
  }
  let alias = message.slice(0,pos);
  wss.clients.forEach(function each(client) {
    if (client !== ws && client.readyState === WebSocket.OPEN) {
      client.send(`new:${alias}`);
    }
  });
  clientMap.set(alias,ws);
}
function notifyTargetClient(message){
  let pos = message.indexOf(":");
  if(pos === -1 || pos+1 === message.length){
    throw Error ("first message does not have Target:message format")
  }
  let targetName = message.slice(0,pos)
  let targetMessage = message.slice(pos+1);

  if(!(clientMap.has(targetName))){
      throw Error("Target does not exist");
  }
  let targetSock = clientMap.get(targetName);
  targetSock.send(targetMessage);
}

start();
