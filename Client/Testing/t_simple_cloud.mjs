/* Top Matter */

import { assert }           from "../Source/Utilities/assert";
import { actFn, Scheduler } from "../Source/Utilities/act-thread";
import * as scc_init        from "../Source/Cloud/simple_cloud_client";
const SCC = scc_init();

const S = new Scheduler();

const main = actFn( function* main( actx ) {
    const x = yield SCC.upload( actx, "A", "B", "C" );
    actx.log( x );
} );

S.activate( main ).finally( function( done ) {
    console.log( "t_keyword_01.mjs tests passed." );
} );
