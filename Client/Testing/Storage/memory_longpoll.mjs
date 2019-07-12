#!/usr/bin/env node --experimental-modules
import T       from "transit-js";
import assert  from "assert";
import SM      from "../../Source/Storage/in_memory.mjs";
import * as SC from "../../Source/Storage/common.mjs";
import * as UT from "../../Source/Utilities/transit.mjs";

const setupPath = "t12";
const notSetupPath = "t13";
const timeout = "10";

async function main(){
  const s = SM();
  await longpollSetup(s);
  await timeoutTest(s);
  await successfulNotificationTest(s);
  await wrongPathTest(s);
}

async function timeoutTest(s){
  const link = T.map();
  link.set("path",`${setupPath}`);

  const watchMeta = await s.watch(link);
  assert (watchMeta === "timeout");
}

async function successfulNotificationTest(s){
  const link = T.map();
  link.set("path",`${setupPath}`);
  const watchMeta = s.watch(link);
  longpollSetup(s);//just to trigger the longpoll
  const metaInfo = await watchMeta;
  assert (metaInfo === "file-changed");
}

async function wrongPathTest(s){
  const link = T.map();
  link.set("path",`${notSetupPath}`);

  const watchMeta = await s.watch(link);
  assert (watchMeta === "path-format-error");
}

async function longpollSetup(s){
  const options = T.map();
  options.set( SC.ENCODE_OBJ, SC.ENCODE_TRANSIT );
  const map_orig = T.map();
  map_orig.set( "a", "42" );
  map_orig.set( "b", 42 );
  map_orig.set( "c", new Uint8Array( 7 ) );
  const link_up = UT.mapFromTuples( [ [ "path", [ `${setupPath}` ] ] ] );
  var resp_u = await s.upload( link_up, map_orig, options );
}

main().then( () => { console.log( "FINISHED" ) } );
