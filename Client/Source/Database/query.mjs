/* Top Matter */

"use strict";

import assert  from "../Utilities/assert.mjs";
import * as UM from "../Utilities/misc.mjs";
import * as UT from "../Utilities/transit.mjs";
import * as L  from "../Utilities/logging.mjs";
import * as K  from "../Utilities/keyword.mjs";
import * as S  from "../Utilities/set.mjs";
import * as DA from "./attribute.mjs";
import * as TX from "./transaction.mjs";
import * as D  from "./Tree/binary.mjs";
import * as DB from "./simple_txn_chain.mjs";

import T       from "transit-js";

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
const type_bool_tag     = Symbol("type_bool");
const type_string_tag   = Symbol("type_string");

const constant_tags     = new Set( [
    type_keyword_tag, type_number_tag, type_bool_tag, type_string_tag ] );
const var_const_under_tags =
      S.union( new Set( [ variable_tag ] ), new Set( [ variable_tag ] ), constant_tags );

export const attrQuery = parseQuery( [
    findK, [ "?attr", "?vtype", "?card", "?doc", "?uniq", "?idx", "?ftxt", "?isComp", "?noHist" ],
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

        if( T.isSymbol( thing ) ) // TODO T not transit
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
            return parseVariable( thing );
        }
        catch( err ) {}
        try {
            return parseConstant( thing );
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
            return !(thing.startsWith("$") || thing.startsWith("?") || thing.startsWith(":"));

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

export async function runQuery( db, q, ...ins )
{

    function identifyOutputVariables(q_find){

        const vars = [];

        if( q_find.tag === find_rel_tag || q.find.tag === find_tuple_tag )
        {
            for( const elem of q.find.elems )
            {
                if( elem.tag === variable_tag )
                {
                    vars.push( elem.name );
                }
                else
                {
                    throw new UM.UnimplementedError();
                }
            }
        }
        else
        {
            throw new Error( "Unimplemented" );
        }
        return vars;
    }
    const vars = identifyOutputVariables(q.find);


    function bindInParameters(q_ins, ...ins){
        const inParams = T.map();
        let i = 0;
        for( const q_in of q_ins ) {
            if(q_in.tag === src_var_tag){
                // TODO: allow several sources. right now we just use the
                // db variable for everything
                // this won't actually be very difficult to do, eventually!
            } else if(q_in.tag === variable_tag){
                if(ins.length <= i){
                    throw new Error(`Not enough variables provided (provided: ${ins.length})`);
                }
                inParams.set(q_in.name, ins[i++]); // post-incrementation
            }
        }
        return inParams;
    }
    const inParams = bindInParameters(q.in, ...ins);


    // this is a set of all the parameters have been bound.
    const bindingSet = T.set();

    // if something is bound multiple times, we consider it a "joining point"
    // and add it to this set.
    const joins = T.set();

    async function naiveWhereClauseQuery(db, clause){

        //console.log("CLAUSE :", clause);

        const [entity={}, attribute={}, value={}, timestamp={}, revoked={}] = clause.tuple;
        // these will either be empty, or have a `tag` attribute, and other optional
        // attributes which are necessary for describing the tag.

        //console.log("EAV", entity, attribute, value);

        const bindings = {};
        // we build a map so we can get from the binding name to the field it represents
        // within a datom; for example, datom[bindings["?entitybound"]] === datom.entity

        const setBindingsAndJoins = function(field, fieldName){
            if(field.tag === variable_tag) {
                if(bindingSet.has(field.name)){
                    joins.add(field.name);
                } else {
                    bindingSet.add(field.name);
                }
                bindings[field.name] = fieldName;
            }
        };

        setBindingsAndJoins(entity, D.ENTITY);
        setBindingsAndJoins(attribute, D.ATTRIBUTE);
        setBindingsAndJoins(value, D.VALUE);
        setBindingsAndJoins(timestamp, D.TIMESTAMP);
        setBindingsAndJoins(revoked, D.REVOKED);

        const get_constant = async function(field, is_value=false){
            if(constant_tags.has(field.tag)){
                if(field.tag === type_keyword_tag){
                    //console.log("tag sub", field.val, (await TX.getAttribute(db, field.val)).id);
                    if(is_value) return field.val;
                    return (await TX.getAttribute(db, field.val)).id; // TODO this affects the query, probably
                } // TODO reaching into the transaction file from query? I'd love for this to be much more agnostic
                return field.val;
            } else if(field.tag === variable_tag && inParams.has(field.name)){
                return inParams.get(field.name);
            }
            return undefined;
        };

        // in_query looks like a map from the name of the field to the constant specified.
        // for example, if you search [1 :is ?hello], this will be {entity: 1, attribute: :is}
        // and a search will be done on the specified fields.

        const _attribute = await get_constant(attribute);

        const in_query = {
            entity: await get_constant(entity),
            attribute: _attribute,
            // if ident, this may be an unsubstituted Symbol.
            value: await get_constant(value, _attribute === DA.dbSymbolMap.get(DA.identK)),
            timestamp: await get_constant(timestamp),
            revoked: await get_constant(revoked)
        };

        // bindings keeps track of the names of variables, and the field they refer to
        return {
            bindings: bindings,
            results: await DB.find( db, in_query )
        };
    }

    /*
     *
     */
    function filterIrrelevantResults(naiveWhereQueryResult)
    {
        const joinIntersections = T.map();

        for( const join of joins )
        {
            let joinIntersection = null;
            for( const singleResult of naiveWhereQueryResult )
            {
                if(!(join in singleResult.bindings)){
                    continue; // continue loop
                }
                const singleSet = new Set();
                for( const res of singleResult.results )
                {
                    singleSet.add(res[singleResult.bindings[join]])
                }
                if(joinIntersection === null) {
                    joinIntersection = singleSet;
                } else {
                    joinIntersection = new Set(
                        [...singleSet].filter(x => joinIntersection.has(x)));
                }
            }
            joinIntersections.set(join, joinIntersection);
        }

        // now, for every intersection made, delete any non-matching results
        for( const singleResult of naiveWhereQueryResult )
        {
            for( const [ res, val ] of joinIntersections )
            {
                if(res in singleResult.bindings)
                {
                    // val is a list of acceptable values to not filter out
                    singleResult.results = singleResult.results.filter(
                        x => val.has( x[ singleResult.bindings[ res ] ] ) );
                }
            }
        }
    }

    /*
     *
     */
    function buildMappedVariablesByConstraint(whereQueryResult)
    {
        const mappedVariablesByConstraint = T.map();
        for( const { bindings, results } of whereQueryResult )
        {
            for( const result of results )
            {
                const idx = T.map();
                for( const join of joins )
                {
                    if( bindings[ join ] in result )
                    {
                        idx.set( join, result[ bindings[ join ] ] );
                    }
                }
                if (!mappedVariablesByConstraint.has(idx)) {
                    mappedVariablesByConstraint.set( idx, [] );
                }
                const rs = T.map();

                for( const returned of vars )
                {
                    if( returned in bindings ) {
                        rs.set(returned, result[ bindings[ returned ] ]);
                    }
                }
                mappedVariablesByConstraint.get(idx).push(rs);
            }
        }
        return mappedVariablesByConstraint;
    }

    /*
     *
     */
    function filterIncompleteResults(constructedRows){
        const queryResults = [];
        // finally, filter out any results that did not match ALL of the where criterion.
        for( const obj of constructedRows )
        {
            const result = [];
            let incomplete = false;
            for( const variable of vars )
            {
                result.push(obj.get(variable));
                if(!(obj.has(variable))){
                    incomplete = true;
                }
            }
            if(!incomplete) {
                queryResults.push(result);
            }
        }
        return queryResults;
    }

    /*
   * Check if two objects are "compatible". By this we mean, there are no
   * overlapping keys with different values.
   *
   * A few examples: compatible({a: 1, b: 2}, {a: 1, b: 2}) === true
   * compatible({a: 1, b: 2}, {a: 1, c: 3}) === true
   * compatible({a: 1, b: 2}, {a: 1, b: 3}) === false
   *
   * The "connected" specifies if we should constrain this notion to
   * objects which have something in common, or not.
   *
   * compatible({a: 1, b: 2}, {c: 3, d: 4}, false) === true
   * compatible({a: 1, b: 2}, {c: 3, d: 4}, true) === false
   *
   * In cases with overlap (i.e. the three above example cases), the
   * connected flag has no effect.
   */
    function compatible(a, o, connected){
        let comp = true;
        let hit = false;
        for( const [ x, xv ] of a )
        {
            if(o.has(x)){
                hit = true;
            } else {
                continue;
            }
            if(o.get(x) !== xv){
                comp = false;
            }
        }
        return (hit || !connected) && comp;
    }

    /*
     * The structure passed into this function is a little bit complex,
     * but this function serves to couple up all results which are related by some factor.
     *
     * Consider this example set:
     *
     * mappedVariablesByConstraint = {
     *  {a: 1}: [
     *      {a: 1, b: 2},
     *      {a: 1, b: 3}],
     *  {a: 1, c: 3}: [
     *      {a: 1, c: 3, d: 4},
     *      {a: 1, c: 3, e: 5}
     *  ]
     * }
     *
     * Return: [{a: 1, b: 2, c: 3, d: 4, e: 5},
     *          {a: 1, b: 3, c: 3, d: 4, e: 5}]
     * TODO more thorough documentation and graph explanation
     */
    function pair(mappedVariablesByConstraint){

        const resultSet = T.set();

        for(let [k, v] of mappedVariablesByConstraint){
            const pairings = innerPair(k, k);
            for( const pair of pairings )
            {
                resultSet.add(pair);
            }
        }

        function innerPair(running, start, ...prev) {
            const results = [];
            for( const n of mappedVariablesByConstraint.get(start) )
            {
                const keys = n.clone();
                for (let [k, v] of mappedVariablesByConstraint) {
                    //console.log("F03", mappedVariablesByConstraint._entries);
                    for( const o of v )
                    {
                        if (k === start || prev.indexOf(k) !== -1) {
                            continue;
                        }
                        if( compatible( running, k, true ) ) {
                            const pairings = innerPair(
                                T.map([...k, ...running].flat()), k, start, ...prev);
                            for( const pairing of pairings )
                            {
                                UT.mapAssign( keys, pairing );
                            }
                            running = T.map([...o, ...running].flat());
                        }
                    }
                }
                results.push(keys);
            }

            // one last step: check all the combinations for merges/conflicts
            // and return a mappedVariablesByConstraint list
            const collected = [];
            const visited = T.set();

            for (let i = 0; i < results.length; i++) {
                let running_res = T.map([...results[i]].flat());
                if (visited.has(results[i])) {
                    continue;
                }
                for (let j = 0; j < results.length; j++) {
                    if (compatible(results[i], results[j], false)) {
                        running_res = T.map([...running_res, ...results[j]].flat());
                    }
                }
                visited.add(results[i]);
                collected.push(running_res);
            }

            return collected;
        }
        return resultSet;
    }

    if( q.where.tag === where_clauses_tag )
    {
        const clauses = q.where.clauses;
        const naiveWhereQueryResult = [];
        for( const clause of clauses )
        {
            naiveWhereQueryResult.push(await naiveWhereClauseQuery(db, clause));
        }
        if(naiveWhereQueryResult.length === 1) {
            // short-circuit shortcut where we don't have to worry
            // about any joining.
            const results = [];
            const res = naiveWhereQueryResult[0];

            for( const item of res.results )
            {
                const result = [];
                for( const variable of vars )
                {
                    result.push(item[res.bindings[variable]])
                }
                results.push(result);
            }
            return results;
        }
        // ELSE
        
        filterIrrelevantResults(naiveWhereQueryResult);

        const mappedVariablesByConstraint =
              buildMappedVariablesByConstraint( naiveWhereQueryResult );

        const constructedRows = pair(mappedVariablesByConstraint);

        return filterIncompleteResults(constructedRows);

    }
    else
    {
        throw new Error( "Unimplemented" );
    }
}
