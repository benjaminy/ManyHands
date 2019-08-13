#!/usr/bin/env node --experimental-modules


import * as SC from "../Client/Source/Storage/common.mjs";
import * as UT from "../Client/Source/Utilities/transit.mjs";
import SimpleC      from "../Client/Source/Storage/simple_cloud_client.mjs";
import Stopwatch from "./Stopwatch.mjs";
import RL   from "readline";
import T from "transit-js";
import fs from "file-system";


let initiatorPath = "t12";
let nonInitPath = "t13";
let local = false;

async function main(){
  const hostname = process.argv[ 2 ]
  if (hostname === "localhost"){
    local = true;
  }
  let options_init = {
    host: `${hostname}`
  }
  const s = SimpleC("alice",options_init);
  const options = T.map();
  options.set( SC.ENCODE_OBJ, SC.ENCODE_TRANSIT );
  const data = T.map();
  data.set( "a", "42" );
  data.set( "b", 42 );

  const am_initiator = process.argv[ 3 ] === "initiator";

  let myFileLink;
  let theirFileLink;
  if(am_initiator){
    myFileLink = UT.mapFromTuples( [ [ "path", [ `${initiatorPath}` ] ] ] );
    theirFileLink = UT.mapFromTuples( [ [ "path", [ `${nonInitPath}` ] ] ] );
  }
  else {
    myFileLink = UT.mapFromTuples( [ [ "path", [ `${nonInitPath}` ] ] ] );
    theirFileLink = UT.mapFromTuples( [ [ "path", [ `${initiatorPath}` ] ] ] );
  }
  await s.upload(myFileLink,data,options);
  await question("ready?\n");
  //now both files should be uploaded, so lets set a watch on their file
  let [ map_down, l ]= await s.download(theirFileLink,options);
  let etag = l.get("Atomicity");
  const watchOptions = {
    etag: `${etag}`,
    timeoutLength: 20
  }

  const sw = new Stopwatch();
  let timeArr = new Array(1000);
  if (am_initiator){
    for (var i = 0; i<1000; i++)
    {
      const meta = s.watch(theirFileLink,watchOptions);//watch set
      sw.reset();
      sw.start();
      await s.upload(myFileLink, data, options)//if the initiator, upload to your file so that it triggers the timing
      const watchMeta = await meta;
      let time = sw.stop();
      if(watchMeta === "file-changed" ){
        timeArr[i] = time;
        console.log("Saved time ", i);
      }
    }
    console.log("finished");
    printTime(timeArr);
  }
  if (!(am_initiator)){
    let wCounter = 0;
    while(wCounter<1000)
    {
      const meta = s.watch(theirFileLink,watchOptions);//watch set
      const watchMeta = await meta;
      if (watchMeta === "file-changed"){
        wCounter ++;
        await s.upload(myFileLink, data, options)
      }
    }
  }
}

function printTime(timeArr){
  let JSONarr = JSON.stringify(timeArr);

  if (local)
  {
    fs.writeFileSync(`./Data/longPollTimingLocal.json`, JSONarr);
  }
  else {
    fs.writeFileSync("./Data/longPollTimingGLobal.json",JSONarr)
  }

}

function promiseRR()
{
    var resolve, reject;
    const p = new Promise( ( s, j, ) => { resolve = s; reject = j; } );
    return [ p, resolve, reject ];
}

/* just get a line of text from stdin. Probably there's a much simpler way. */
async function question( prompt )
{
    const [ p, resolve, reject ] = promiseRR();
    const rl = RL.createInterface( {
        input: process.stdin,
        output: process.stdout
    } );

    rl.question( prompt, ( answer ) => {
        resolve( answer );
        rl.close();
    } );
    return await p;
}
main();
