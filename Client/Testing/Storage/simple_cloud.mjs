#!/usr/bin/env node --experimental-modules

/* Top Matter */

import assert   from "assert";
import SC       from "../../Source/Storage/simple_cloud_client.mjs";

import * as SUD from "./simple_up_down.mjs";
import * as AU  from "./atomic_update.mjs";
import * as RN  from "./random_name.mjs";
import * as DS  from "./deletes.mjs";
import * as LG  from "./simple_longpoll.mjs";

async function main()
{
    const s = SC( "alice" );
    await SUD.just_upload( s );
    await SUD.up_down( s );
    await AU.test1( s );
    await RN.test1( s );
    await DS.doSomeDeletes( s );
    await LG.longPollTests( s );
    //await up_down_crypto( s );
    //await up_down_crypto_verify( s );
}

main().then( () => { console.log( "FINISHED" ) } );
