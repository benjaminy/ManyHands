/* Top Matter */

import { assert } from "./assert.mjs";

/* \w may not be the right choice here.  It's fine for now, though. */
const regex       = /^:\w+(?:(?:\.\w+)*\/\w+)?$/;
const root        = {};
const keyword_tag = Symbol( "Keyword Tag" );

function helper( name )
{
    assert( typeof( name ) === "string" );
    if( !regex.test( name ) )
        throw new Error( "keyword: Invalid format ( " + name + " )" );

    /* TODO: Convert from a plain trie to a compressed version */
    var trie = root;
    for( var i = 0; i < name.length; i++ )
    {
        if( !trie.hasOwnProperty( name[ i ] ) )
        {
            trie[ name[ i ] ] = {};
        }
        trie = trie[ name[ i ] ];
    }

    if( "key" in trie )
        return trie.key;

    const key = {
        str   : name,
        tag   : keyword_tag
    }

    trie.key = key;
    return key;

}

function keyword( k )
{
    // console.log( "function keyword started" );
    try {
        if( k.tag === keyword_tag )
            return k;
    }
    catch( err ) {}

    try {
        var name = String( k );
    }
    catch( err ) {
        throw new Error( "keyword: String( " + k + " ) failed" );
    }

    return helper( name );
}

export { keyword };

console.log( "Utilities/keyword loaded." );
