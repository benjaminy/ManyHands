/* Top Matter */

"use strict";

import assert  from "../Utilities/assert";
import * as UM from "../Utilities/misc";
import * as L  from "../Utilities/logging";
import * as K  from "../Utilities/keyword";
import * as S  from "../Utilities/set";
import * as DA from "./attribute";

export const findK  = K.key( ":find" );
export const withK  = K.key( ":with" );
export const inK    = K.key( ":in" );
export const whereK = K.key( ":where" );

const variable_tag      = Symbol( "variable" );
const underbar_tag      = Symbol( "underbar" );
const src_var_tag       = Symbol( "src_var" );
const find_rel_tag      = Symbol( "find_rel" );
const find_tuple_tag    = Symbol( "find_tuple" );
const where_clauses_tag = Symbol( "where_clauses" );
const data_pattern_tag  = Symbol( "data_pattern" );
const type_keyword_tag  = Symbol( "type_keyword" );
const type_number_tag   = Symbol( "type_number" );

const constant_tags     = new Set( [ type_keyword_tag, type_number_tag ] );
const var_const_under_tags =
      S.union( new Set( [ variable_tag ] ), new Set( [ variable_tag ] ), constant_tags );

const attrQuery = parseQuery( [
    findK, [ "?vtype", "?card", "?doc", "?uniq", "?idx", "?ftxt", "?isComp", "?noHist" ],
    inK, "$", "?ident",
    whereK, [ "?attr", DA.identK,       "?ident" ],
            [ "?attr", DA.valueTypeK,   "?vtype" ],
            [ "?attr", DA.cardinalityK, "?card" ],
            [ "?attr", DA.docK,         "?doc" ],
            [ "?attr", DA.uniqueK,      "?uniq" ],
            [ "?attr", DA.indexK,       "?idx" ],
            [ "?attr", DA.fulltextK,    "?ftxt" ],
            [ "?attr", DA.isComponentK, "?isComp" ],
            [ "?attr", DA.noHistoryK,   "?noHist" ] ] );

/*
alternate syntax:
" [ :find [ ?vtype ?card ?doc ?uniq ?idx ?ftxt ?isComp ?noHist ]
    :in $ ?ident
    :where [ ?attr :db/ident       ?ident ]
           [ ?attr :db/valueType   ?vtype ]
           [ ?attr :db/cardinality ?card ]
           [ ?attr :db/doc         ?doc ]
           [ ?attr :db/unique      ?uniq ]
           [ ?attr :db/index       ?idx ]
           [ ?attr :db/fulltext    ?ftxt ]
           [ ?attr :db/isComponent ?isComp ]
           [ ?attr :db/noHistory   ?noHist ] ] "
*/

export function parseQuery( q )
{
    assert( Array.isArray( q ) );

    var i = 0;

    function getSection( section, startK, endMarkers )
    {
        if( i < q.length && startK === K.key( q[ i ] ) )
        {
            i++;
            for( ; i < q.length; i++ )
            {
                try {
                    const k = K.key( q[ i ] );
                    if( endMarkers.has( k ) )
                        break;
                }
                catch( err ) {}
                section.push( q[ i ] );
            }
            if( section.length < 1 )
            {
                throw new Error( "Empty section " + section );
            }
        }
    }

    const find_section = [], with_section = [], in_section = [], where_section = [];
    getSection(  find_section,  findK, new Set( [ withK, inK, whereK ] ) );
    getSection(  with_section,  withK, new Set( [ inK, whereK ] ) );
    getSection(    in_section,    inK, new Set( [ whereK ] ) );
    getSection( where_section, whereK, new Set( [] ) );

    assert( i === q.length );
    assert( find_section.length > 0 );

    L.debug( "FI " + find_section );
    L.debug( "WI " + with_section );
    L.debug( "IN " + in_section );
    L.debug( "WH " + JSON.stringify( where_section, UM.tagger ) );

    /* Functions for parsing the four main sections */
    function parseFindSpec()
    {
        // find-spec = ':find' (find-rel | find-coll | find-tuple | find-scalar)
        if( find_section.length === 2 && find_section[ 1 ] === "." )
        {
            // find-scalar = find-elem '.'
            throw new Error( "Unimplemented" );
        }
        else if( find_section.length === 1 && Array.isArray( find_section[ 0 ] ) )
        {
            const elems = find_section[ 0 ];
            if( elems.length === 2 && elems[ 1 ] === "..." )
            {
                return { tag: find_coll_tag,
                         elem: parseFindElem( elems[ 0 ] ) };
            }
            return { tag: find_tuple_tag,
                     elems: elems.map( parseFindElem ) };
        }
        else
        {
            return { tag: find_rel_tag,
                     elems: find_section.map( parseFindElem ) };
        }
    }

    function parseWithClause()
    {
        if( with_section.length > 0 )
            throw new Error( "Unimplemented" );
        return [];
    }

    function parseInputElem( thing )
    {
        if( thing === "%" )
            return { tag: rules_var_tag }
        try {
            return parseSrcVar( thing );
        }
        catch( err ) {}
        try {
            return parseVariable( thing );
        }
        catch( err ) {}
        if( isPlainSymbol( thing ) )
            return { tag: pattern_var_tag,
                     name: thing };
        throw new Error( "Query: Expecting input element.  Found: " + thing );
    }

    function parseWhereClauses()
    {
        return { tag: where_clauses_tag,
                 clauses: where_section.map( parseClause ) };
    }

    /* Functions for parsing smaller elements of a query: */
    function parseSrcVar( thing )
    {
        try {
            if( thing.startsWith( "$" ) )
            {
                return { tag: src_var_tag,
                         name: thing.substring( 1 ) };
            }
        }
        catch( err ) {}
        throw new Error( "Query: Expecting variable.  Found: " + thing );
    }

    function parseVariable( thing )
    {
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
        console.log( "parseFindElem " + thing );
        if( Array.isArray( thing ) )
        {
            if( thing.length === 3 && thing[ 0 ] === "pull" )
            {
                // pull-expr = ['pull' variable pattern]
                throw new Error( "Unimplemented" );
            }
            else
            {
                // aggregate = [aggregate-fn-name fn-arg+]
                // fn-arg    = (variable | constant | src-var)
                throw new Error( "Unimplemented" );
            }
        }
        else
        {
            return parseVariable( thing );
        }
    }

    function isPlainSymbol( thing )
    {
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
                     tuple: thing.map( parseVarConstUnder ) };
        }
    }

    return {
        find:  parseFindSpec(),
        with:  {},
        in:    in_section.map( parseInputElem ),
        where: parseWhereClauses()
    };
}

function is_compatible( query_const, datom_value )
{
    /* XXX Probably more cases to care about here */
    return query_const.val === datom_value;
}

export async function runQuery( db, q )
{
    const vars = [];
    const results = [];

    if( q.find.tag === find_rel_tag )
    {
        q.find.elems.forEach( ( elem ) => {
            if( elem.tag === variable_tag )
            {
                vars.push( elem.name );
            }
            else
            {
                throw new Error( "Unimplemented" );
            }
        } );
    }
    else
    {
        throw new Error( "Unimplemented" );
    }

    if( q.where.tag === where_clauses_tag )
    {
        const clauses = q.where.clauses;
        if( clauses.length === 1 )
        {
            const clause = clauses[ 0 ].tuple;
            for( const i in db.datoms )
            {
                const datom = db.datoms[ i ];
                assert( datom.length >= clause.length );
                var match_fail = false;
                const bindings = {};
                for( const j in clause )
                {
                    const c_elem = clause[ j ];
                    const d_elem = datom[ j ];
                    if( j.tag === underbar_tag )
                    {
                        // ignore
                    }
                    else if( c_elem.tag === variable_tag )
                    {
                        bindings[ c_elem.name ] = d_elem;
                    }
                    else if( constant_tags.has( c_elem.tag ) )
                    {
                        if( !is_compatible( c_elem, d_elem ) )
                        {
                            match_fail = true;
                            break;
                        }
                    }
                    else
                    {
                        throw new Error( "Query: Illegal data clause tag: " + c_elem.tag );
                    }
                }
                if( !match_fail )
                {
                    const result = [];
                    vars.forEach( ( v ) => { result.push( bindings[ v ] ) } );
                    results.push( result );
                }
            }
            return results;
        }
        else
        {
            throw new Error( "Unimplemented" );
        }
    }
    else
    {
        throw new Error( "Unimplemented" );
    }
}
