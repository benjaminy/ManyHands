#!/usr/bin/env node --experimental-modules

/* Top Matter */

import T      from "transit-js";
import * as D from "../../Source/Consistency/dag.mjs";

async function main()
{
    const ta = "alice";
    const tb = "bob";
    const tc = "carol";

    const na0 = D.node( ta, 0, 0, [] );
    const pa0 = [ ta, 0 ];
    const na1 = D.node( ta, 1, 1, [ pa0 ] );
    const pa1 = [ ta, 1 ];
    const na2 = D.node( ta, 2, 2, [ pa1 ] );
    const pa2 = [ ta, 2 ];
    const nb0 = D.node( tb, 0, 1, [ pa0 ] );
    const pb0 = [ tb, 0 ];
    const nb1 = D.node( tb, 1, 2, [ pb0 ] );
    const pb1 = [ tb, 1 ];

    const edit_dag1 = T.map();
    for( const [ n, p ] of [ [ na0, pa0 ], [ na1, pa1 ], [ na2, pa2 ], [ nb0, pb0 ], [ nb1, pb1 ] ] )
    {
        edit_dag1.set( p, n );
    }

    const ca = T.map();
    ca.set( ta, T.set( [ pa2 ] ) );
    ca.set( tb, T.set( [ pa0 ] ) );
    const cb = T.map();
    cb.set( ta, T.set( [ pb0 ] ) );
    cb.set( tb, T.set( [ pb1 ] ) );
    const m = D.mergeMatrixClocksPrevPtrs( edit_dag1, ca, cb )
    console.log( "Matrix???", m.toString() );
}

main().then( () => console.log( "FINISHED" ) );
