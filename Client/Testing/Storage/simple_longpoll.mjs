#!/usr/bin/env node --experimental-modules

import T       from "transit-js";
import assert  from "assert";
import * as SC from "../../Source/Storage/common.mjs";
import * as UT from "../../Source/Utilities/transit.mjs";

const setupPath = "t12";
const notSetupPath = "t13";
const timeout = "10";
const notTimeout = "10x"

export async function longPollTests(s){
  const etag = await longpollSetup(s);
  await longPollTimeoutTest(s, etag);
  await longPollInvalidPathTest(s, etag);
  await longPollInvalidTimeoutTest(s, etag);
  await longPollSuccessfulNotificationTest(s, etag);
}

async function longPollTimeoutTest( s, etag ){
  const link = T.map();
  link.set("path",`${setupPath}`);
  const options = {
    etag: `${etag}`,
    timeoutLength: `${timeout}`
  }
  const watchMeta = await s.watch(link,options);
  assert(watchMeta === "timeout");
}

async function longPollInvalidPathTest(s, etag){
  const link = T.map();
  link.set("path",`${notSetupPath}`);
  const options = {
    etag: `${etag}`,
    timeoutLength: `${timeout}`
  }
  //assert(s.watch(link,options) === "path-format-error");
  const watchMeta = await s.watch(link,options);
  assert(watchMeta === "path-format-error");
}


async function longPollInvalidTimeoutTest(s, etag){
  const link = T.map();
  link.set("path",`${setupPath}`);
  const options = {
    etag: `${etag}`,
    timeoutLength: `${notTimeout}`
  }
  const watchMeta = await s.watch(link,options);
  assert(watchMeta === "timeout-format-error");
}

async function longPollSuccessfulNotificationTest(s, etag){
  const link = T.map();
  link.set("path",`${setupPath}`);
  const options = {
    etag: `${etag}`,
    timeoutLength: `${timeout}`
  }
  const watchMeta = s.watch(link,options)
  fileChange(s);
  const metaInfo = await watchMeta;
  assert(metaInfo === "file-changed");
}

async function fileChange(s)
{
  const options = T.map();
  options.set( SC.ENCODE_OBJ, SC.ENCODE_TRANSIT );
  const map_orig = T.map();
  map_orig.set( "a", "43" );
  map_orig.set( "D", 41 );
  map_orig.set( "c", new Uint8Array( 7 ) );
  const link_up = UT.mapFromTuples( [ [ "path", [ `${setupPath}` ] ] ] );
  var resp_u = await s.upload( link_up, map_orig, options );
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
  const link_down = UT.mapFromTuples( [ [ "path", [ `${setupPath}` ] ] ] );
  var [ map_down, l ] = await s.download( link_down, options );
  return l.get("Atomicity");
}
