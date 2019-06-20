#!/usr/bin/env node --experimental-modules

/* Top Matter */

import assert   from "assert";
import LS       from "../../Source/Storage/leveldb_sim.mjs";
import * as UT  from "../../Source/Utilities/transit.mjs";

import * as SUD from "./simple_up_down.mjs";
import * as AU  from "./atomic_update.mjs";
import * as RN  from "./random_name.mjs";
import * as DS  from "./deletes.mjs";

/* NOTE: In order for this test to behave as expected, the DB should not yet exist */

async function main()
{
    const opts = UT.mapFromTuples(
        [ [ "DB_DIR", [ ".", "Testing", "Ignore" ] ],
          [ "DB_NAME", "Test1" ] ] );
    const s = LS( opts );
    await SUD.just_upload( s );
    await SUD.up_down( s );
    await AU.test1( s );
    await RN.test1( s );
    await DS.doSomeDeletes( s );
    //await up_down_crypto( s );
    //await up_down_crypto_verify( s );
}

main().then( () => { console.log( "FINISHED" ) } );
