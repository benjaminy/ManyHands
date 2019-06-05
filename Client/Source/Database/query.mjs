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

    let i = 0;

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
            return { tag: rules_var_tag };
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
                if( thing[ 0 ].startsWith( "$" ) ) // which database to search
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

export async function runQuery( db, q, ...ins ) // TODO ins: in-parameters (database + :in clause)
{
    const vars = [];

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

    const bindingSet = new Set();
    const joins = new Set();

    // TODO if( q.in.tag ===  )

    if( q.where.tag === where_clauses_tag )
    {
        const clauses = q.where.clauses;
        const whereResults = [];
        for( let i = 0; i < clauses.length; i++ )
        {
            console.log("CLAUSES:", clauses);
            const clause = clauses[ i ].tuple;

            console.log("CLAUSE :", clause);

            const [entity={}, attribute={}, value={}, timestamp={}, revoked={}] = clause;
            // these will either be empty, or have a `tag` attribute, and other optional
            // attributes which are necessary for describing the tag.

            console.log("EAV", entity, attribute, value);

            const bindings = {};
            // we build a map so we can get from the binding name to the field it represents
            // within a datom; for example, datom[bindings["?entitybound"]] === datom.entity
            if(entity.tag === variable_tag) {
                if(bindingSet.has(entity.name)){
                    joins.add(entity.name);
                } else {
                    bindingSet.add(entity.name);
                }
                bindings[entity.name] = 'entity';
            }
            if(attribute.tag === variable_tag) {
                if(bindingSet.has(attribute.name)){
                    joins.add(attribute.name);
                } else {
                    bindingSet.add(attribute.name);
                }
                bindings[attribute.name] = 'attribute';
            }
            if(value.tag === variable_tag) {
                if(bindingSet.has(value.name)){
                    joins.add(value.name);
                } else {
                    bindingSet.add(value.name);
                }
                bindings[value.name] = 'value';
            }
            if(timestamp.tag === variable_tag) {
                if(bindingSet.has(timestamp.name)){
                    joins.add(timestamp.name);
                } else {
                    bindingSet.add(timestamp.name);
                }
                bindings[timestamp.name] = 'timestamp';
            }
            if(revoked.tag === variable_tag) {
                if(bindingSet.has(revoked.name)){
                    joins.add(revoked.name);
                } else {
                    bindingSet.add(revoked.name);
                }
                bindings[revoked.name] = 'revoked';
            }

            L.debug("Binding Set:", bindingSet);
            L.debug("Joins:", joins);

            // is the tag for each field a constant? if so, it means we're "searching by" this field,
            // and we will pass this q object into our database to retrieve applicable datoms.
            const q = {
                entity: constant_tags.has(entity.tag) ? entity.val : undefined,
                attribute: constant_tags.has(attribute.tag) ? attribute.val : undefined,
                value: constant_tags.has(value.tag) ? value.val : undefined,
                timestamp: constant_tags.has(timestamp.tag) ? timestamp.val : undefined,
                revoked: constant_tags.has(revoked.tag) ? revoked.val : undefined
            };

            // retrieve a set of datoms through the DB's efficient indexing and searching capabilities
            const resultSet = db.find(q);
            whereResults.push({bindings: bindings, results: resultSet});
        }

        // Now process the whereResults into an actual result set
        const results = [];
        L.debug("Where results: ", JSON.stringify(whereResults));

        if(whereResults.length === 1) {
            const res = whereResults[0];

            res.results.forEach((item) => {
                const result = [];
                vars.forEach((v) => {
                    result.push(item[res.bindings[v]])
                });
                results.push(result);
            });

            return results;
        } else {
            const final = {};

            console.log("WHERE RESULTS", whereResults);
            console.log("VARS:", vars);

            const joinResults = {};

            joins.forEach(join => {
                let joinIntersection = null;
                whereResults.forEach(singleResult => {
                    console.log("loop", join, singleResult.bindings);
                    if(!(join in singleResult.bindings)){
                        return; // continue loop
                    }
                    const singleSet = new Set();
                    singleResult.results.forEach(res => {
                        console.log("asdfasdfs", res, singleResult, join);
                        singleSet.add(res[singleResult.bindings[join]])
                    });
                    console.log("singleset", singleSet);
                    if(joinIntersection === null) {
                        joinIntersection = singleSet;
                    } else {
                        joinIntersection = new Set([...singleSet].filter(x => joinIntersection.has(x)));
                    }
                });

                console.log("join intersection", join, joinIntersection);

                joinResults[join] = joinIntersection;

                console.log("JOIN INTERSECTION", joinIntersection);
            });

            // now, for every intersection made, delete any non-matching results

            console.log("whereresults before filter", whereResults);

            whereResults.forEach(singleResult => {
                Object.keys(joinResults).forEach(res => {
                    if(res in singleResult.bindings){
                        // joinResults[res] // is a list of acceptable values to not filter out
                        singleResult.results = singleResult.results.filter(x => {
                            console.log("adfadsfads", singleResult, joinResults[res]);
                            console.log("aaaaaa", x[singleResult.bindings[res]]);
                            return joinResults[res].has(x[singleResult.bindings[res]]);
                            /*console.log("whereResults", whereResults);
                            console.log("res", res);
                            console.log("single", singleResult);*/
                        });
                    }
                });
            });

            console.log("Whereresults after filter:", whereResults);

            whereResults.forEach(({bindings, results}) => {
                vars.forEach(returned => {
                    if(returned in bindings) {
                        results.forEach(result => {
                            console.log("result: ", result, bindings, returned, joins);

                            const cat = {};
                            joins.forEach(j => {cat[j] = result[bindings[j]]});


                            const idx = JSON.stringify(cat); // TODO we want to index by many variables-- is this ugly?

                            //const current_entity = result[bindings[join]];
                            if (final[idx] === undefined) {
                                final[idx] = {};
                            }
                            final[idx][returned] = result[bindings[returned]];

                        });
                    }
                });
            });

            // now we have all of our data collected and organized by their bindings-- build the final result set!

            const queryResults = [];
            console.log("FINAL:", final);

            const bigObj = {};

            const visitedNodes = []; // JSON strings again.


            const compatible = function(a, o){
                let comp = true;
                let hit = false;
                Object.keys(a).forEach(x => {
                    if(x in o){
                        hit = true;
                    } else {
                        return;
                    }
                    if(o[x] !== a[x]){
                        comp = false;
                    }
                });
                return hit && comp;
            };

            const pair = function(running, start, final, ...prev){
                let log = false;
                if(start === "{\"two\":2}"){log=true;}

                //console.log(final, start);
                const keys = Object.assign({}, final[start]);
                for(let o in final) {
                    //console.log("SFPO", start, final, prev, o);
                    if (!final.hasOwnProperty(o)) {
                        continue;
                    }
                    if (o === start || prev.indexOf(o) !== -1) {
                        continue;
                    }
                    if (compatible(running, JSON.parse(o))) {
                        if(log) console.log(running, o);
                        //console.log(`recursing on ${o}, start ${start}. prev is ${prev}`);
                        const pairings = pair({...JSON.parse(o), ...running}, o, final, start, ...prev);
                        for (let x in pairings) {
                            //console.log("recursive pairing", x, pairings, final, o, x, keys);
                            keys[x] = pairings[x];
                        }
                        running = {...JSON.parse(o), ...running};
                    }
                }
                return keys;
            };

            const rs = new Set();

            for(let i in final) {
                //console.log("i is", i);
                const pairings = pair(JSON.parse(i), i, final);
                //console.log("pairing: ", pairings);
                rs.add(JSON.stringify(pairings, Object.keys(pairings).sort()));
            }

            console.log(rs);
            console.log(final);

            /*joins.forEach(join => {
                Object.keys(final).forEach(jk => {
                    const joinK = JSON.parse(jk);
                    if(join in joinK){
                        bigObj[join][joinK[join]]
                    }
                });
            });*/



            rs.forEach(entity => {
                const result = [];
                const obj = JSON.parse(entity);
                vars.forEach((v) => {
                    result.push(obj[v]);
                });
                queryResults.push(result);
            });

            return queryResults;

        }
    }
    else
    {
        throw new Error( "Unimplemented" );
    }
}
