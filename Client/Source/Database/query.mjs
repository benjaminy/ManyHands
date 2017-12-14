/* Top Matter */

import { assert } from "../Utilities/assert.mjs";
import * as K from "../Utilities/keyword";

export const findK  = K.key( ":find" );
export const withK  = K.key( ":with" );
export const inK    = K.key( ":in" );
export const whereK = K.key( ":where" );

const variable_tag      = Symbol( "variable" );
const find_rel_tag      = Symbol( "find_rel" );
const where_clauses_tag = Symbol( "where_clauses" );
const data_pattern_tag  = Symbol( "data_pattern" );
const type_keyword_tag  = Symbol( "type_keyword" );
const type_number_tag   = Symbol( "type_number" );

export function parseQuery( q )
{
    assert( Array.isArray( q ) );

    var i = 0;

    function getPart( part, startK, endSet )
    {
        if( i < q.length && startK === K.key( q[ i ] ) )
        {
            i++;
            for( ; i < q.length; i++ )
            {
                try {
                    const k = K.key( q[ i ] );
                    if( endSet.has( k ) )
                        break;
                }
                catch( err ) {}
                part.push( q[ i ] );
            }
        }
    }

    const find_part = [], with_part = [], in_part = [], where_part = [];
    getPart(  find_part,  findK, new Set( [ withK, inK, whereK ] ) );
    getPart(  with_part,  withK, new Set( [ inK, whereK ] ) );
    getPart(    in_part,    inK, new Set( [ whereK ] ) );
    getPart( where_part, whereK, new Set( [] ) );

    assert( i === q.length );
    assert( find_part.length > 0 );

    function parseVariable( thing )
    {
        console.log( "parseVariable \"" + thing + "\"" );
        try {
            if( thing.startsWith( "?" ) )
            {
                return { tag: variable_tag,
                         name: thing.substring( 1 ) };
            }
        }
        catch( err ) {}
        throw new Error( "Query: Expecting variable.  Found: " + thing );
    }

    function parseConstant( thing )
    {
        console.log( "parseConstant \"" + thing + "\" \"" + typeof( thing ) + "\"" );
        if( thing === true )
            return { tag: type_bool_tag, val: true };
        if( thing === false )
            return { tag: type_bool_tag, val: false };

        if( typeof( thing ) === "number" )
            return { tag: type_number_tag, val: thing };
        // Long, Bigint, Float, Double, Bigdec

        if( typeof( thing ) === "symbol" )
            return { tag: type_keyword_tag, val: thing };

        if( typeof( thing ) === "string" )
        {
            if( thing.startsWith( ":" ) )
                return { tag: type_keyword_tag, val: K.key( thing ) };
            return { tag: type_string_tag, val: thing };
        }

        throw new Error( "Unimplemented" );
        // Ref, Instant, Uuid, Bytes
    }

    function parseVarConstUnder( thing )
    {
        if( thing === "_" )
        {
            return { tag: underbar_tag };
        }
        try {
            return parseConstant( thing );
        }
        catch( err ) {}
        try {
            return parseVariable( thing );
        }
        catch( err ) {}
        throw new Error( "Query: Expecting variable, constant or _.  Found: " + thing );
    }

    function parseFindElem( thing )
    {
        if( Array.isArray( thing ) )
        {
            if( thing.length === 3 && thing[ 0 ] === "pull" )
            {
                // pull-expr                  = ['pull' variable pattern]
                throw new Error( "Unimplemented" );
            }
            else
            {
                // aggregate                  = [aggregate-fn-name fn-arg+]
                // fn-arg                     = (variable | constant | src-var)
                throw new Error( "Unimplemented" );
            }
        }
        else
        {
            return parseVariable( thing );
        }
    }

    function parseFindSpec()
    {
        // find-spec = ':find' (find-rel | find-coll | find-tuple | find-scalar)
        if( find_part.length === 2 && find_part[ 1 ] === "." )
        {
            // find-scalar = find-elem '.'
            throw new Error( "Unimplemented" );
        }
        else if( find_part.length === 1 && Array.isArray( find_part[ 0 ] ) )
        {
            // find-coll = [find-elem '...']
            // find-tuple = [find-elem+]
            throw new Error( "Unimplemented" );
        }
        else
        {
            return { tag: find_rel_tag,
                     elems: find_part.map( parseFindElem ) };
        }
    }

    if( with_part.length > 0 )
    {
        throw new Error( "Unimplemented" );
    }

    if( in_part.length > 0 )
    {
        throw new Error( "Unimplemented" );
    }

    function isPlainSymbol( thing )
    {
        console.log( "isPlainSymbol \"" + thing + "\"" );
        try {
            if( thing.startsWith( "$" ) || thing.startsWith( "?" ) || thing.startsWith( ":" ) )
                return false
            return true;
        }
        catch( err ) {
            return false;
        }
    }

    function parseClause( thing )
    {
        if( !Array.isArray( thing ) )
        {
            throw new Error( "Query: Expecting clause.  Found: " + thing );
        }
        else if( thing.length === 1 && Array.isArray( thing[ 0 ] ) )
        {
            // pred-expr = [ [pred fn-arg+] ]
            throw new Error( "Unimplemented" );
        }
        else if( thing.length > 1 && Array.isArray( thing[ 0 ] ) )
        {
            // fn-expr = [ [fn fn-arg+] binding]
            throw new Error( "Unimplemented" );
        }
        else if( thing.length < 2 )
        {
            throw new Error( "Query: Expecting clause.  Found: " + thing );
        }
        else if( thing[ 0 ] === "not" || thing[ 1 ] === "not" )
        {
            // not-clause = [ src-var? 'not' clause+ ]
            throw new Error( "Unimplemented" );
        }
        else if( thing[ 0 ] === "not-join" || thing[ 1 ] === "not-join" )
        {
            // not-join-clause = [ src-var? 'not-join' [variable+] clause+ ]
            throw new Error( "Unimplemented" );
        }
        else if( thing[ 0 ] === "or" || thing[ 1 ] === "or" )
        {
            // or-clause = [ src-var? 'or' (clause | and-clause)+]
            throw new Error( "Unimplemented" );
        }
        else if( thing[ 0 ] === "or-join" || thing[ 1 ] === "or-join" )
        {
            // or-join-clause = [ src-var? 'or-join' rule-vars (clause | and-clause)+ ]
            throw new Error( "Unimplemented" );
        }
        else if( isPlainSymbol( thing[ 0 ] ) || isPlainSymbol( thing[ 1 ] ) )
        {
            // rule-expr = [ src-var? rule-name (variable | constant | '_')+]
            throw new Error( "Unimplemented" );
        }
        else
        {
            var src_var = null;
            try {
                if( thing[ 0 ].startsWith( "$" ) )
                {
                    src_var = thing[ 0 ].substring( 1 );
                    thing.shift( 1 );
                }
            }
            catch( err ) {}
            return { tag: data_pattern_tag,
                     parts: thing.map( parseVarConstUnder ) };
        }
    }

    function parseWhereClauses()
    {
        return { tag: where_clauses_tag,
                 clauses: where_part.map( parseClause ) };
    }

    return {
        find: parseFindSpec(),
        with: {},
        in:   {},
        where: parseWhereClauses()
    };
}
