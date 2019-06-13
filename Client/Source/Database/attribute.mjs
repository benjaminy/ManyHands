/* Top Matter */

import * as K  from "../Utilities/keyword.mjs";

import transit from "transit-js";

export const identK       = K.key( ":db/ident" );
export const docK         = K.key( ":db/doc" );
export const indexK       = K.key( ":db/index" );
export const fulltextK    = K.key( ":db/fulltext" );
export const noHistoryK   = K.key( ":db/noHistory" );
export const isComponentK = K.key( ":db/isComponent" );

export const cardinalityK    = K.key( ":db/cardinality" );
export const cardinalityOne  = K.key( ":db.cardinality/one" );
export const cardinalityMany = K.key( ":db.cardinality/many" );
const cardinalities = new Set( [ cardinalityOne, cardinalityMany ] );

export const valueTypeK   = K.key( ":db/valueType" );
export const vtypeKeyword = K.key( ":db.type/keyword" ); // interned
export const vtypeString  = K.key( ":db.type/string" );  // encoding???
export const vtypeBoolean = K.key( ":db.type/boolean" );
export const vtypeLong    = K.key( ":db.type/long" );    // stupid JS numbers
export const vtypeBigint  = K.key( ":db.type/bigint" );  // library???
export const vtypeFloat   = K.key( ":db.type/float" );   // stupid JS numbers
export const vtypeDouble  = K.key( ":db.type/double" );  // yay JS numbers!
export const vtypeBigdec  = K.key( ":db.type/bigdec" );  // library???
export const vtypeRef     = K.key( ":db.type/ref" );
export const vtypeInstant = K.key( ":db.type/ref" );     // library???
export const vtypeUuid    = K.key( ":db.type/uuid" );    // library???
export const vtypeBytes   = K.key( ":db.type/uuid" );    // huh.
const types = new Set( [
    vtypeKeyword, vtypeString, vtypeBoolean, vtypeLong, vtypeBigint,
    vtypeFloat, vtypeDouble, vtypeBigdec, vtypeRef, vtypeInstant,
    vtypeUuid, vtypeBytes ] );

export const uniqueK        = K.key( ":db/unique" );
export const uniqueValue    = K.key( ":db.unique/value" );
export const uniqueIdentity = K.key( ":db.unique/identity" );
export const uniques = new Set( [ uniqueValue, uniqueIdentity ] );

/*
export const dbKeys = new Set( [
    identK, docK, indexK, fulltextK, noHistoryK, isComponentK,
    cardinalityK, ...cardinalities, ...types, ...uniques] );
*/

export const dbIdMap = transit.map([
    1,  identK         ,
    2,  docK           ,
    3,  indexK         ,
    4,  fulltextK      ,
    5,  noHistoryK     ,
    6,  isComponentK   ,
    7,  cardinalityK   ,
    8,  cardinalityOne ,
    9,  cardinalityMany,
    10, valueTypeK     ,
    11, vtypeKeyword   ,
    12, vtypeString    ,
    13, vtypeBoolean   ,
    14, vtypeLong      ,
    15, vtypeBigint    ,
    16, vtypeFloat     ,
    17, vtypeDouble    ,
    18, vtypeBigdec    ,
    19, vtypeRef       ,
    20, vtypeInstant   ,
    21, vtypeUuid      ,
    22, vtypeBytes     ,
    23, uniqueK        ,
    24, uniqueValue    ,
    25, uniqueIdentity
]);

export const dbSymbolMap = transit.map();
for(let [k, v] of dbIdMap)
    dbSymbolMap.set(v, k); // reverse lookup map

export function makeBuiltin(ident_, id_){
    return {id: id_, builtin: true, ident: K.key(ident_)};
}

export function makeAttribute(
    ident_, id_, valueType_, cardinality_,
    doc, unique, index, fulltext, isComponent, noHistory )
{
    const ident       = K.key( ident_ );
    const valueType   = dbIdMap.get( valueType_ );
    const cardinality = dbIdMap.get( cardinality_ );

    const attr       = {id: id_};
    attr.builtin     = false;
    attr.ident       = ident;
    attr.doc         = "";
    attr.unique      = null;
    attr.index       = false;
    attr.fulltext    = false;
    attr.isComponent = false;
    attr.noHistory   = false;

    /* TODO: check that ident doesn't break any naming rules */

    if( !types.has( valueType ) )
        throw new Error( "Invalid attribute valueType: " + valueType.str );
    attr.valueType = valueType;

    if( !cardinalities.has( cardinality ) )
        throw new Error( "Invalid attribute cardinality: " + cardinality.str );
    attr.cardinality = cardinality;

    if( doc )
        attr.doc = doc.toString();

    if( unique )
    {
        unique = dbIdMap.get( unique );
        if( !uniques.has( unique ) )
            throw new Error( "Invalid attribute uniqueness: " + unique.str );
        attr.uniqueAttr = unique;
    }

    if( index === true || index === false )
        attr.index = index;

    if( fulltext === true || fulltext === false )
        attr.fulltext = fulltext;

    if( noHistory === true || noHistory === false )
        attr.noHistory = noHistory;

    if( isComponent === true || isComponent === false )
        attr.isComponent = isComponent;

    return attr;
}

/*
 * Convert "value" into the proper kind of value, as indicated by
 * "attribute".valueType.
 *
 * If value is already the proper kind, just return value.
 *
 * If conversion is not possible (i.e. the input is bad), throw an Error.
 */
export function normalizeValue( attribute, value )
{
    console.log("attribute", attribute);
    var vType = K.key( attribute.valueType );
    console.log(vType);
    if( vType === vtypeBigint )
        throw new Error( "Unimplemented" );

    else if( vType === vtypeFloat )
        throw new Error( "Unimplemented" );

    else if( vType === vtypeInstant )
        throw new Error( "Unimplemented" );

    else if( vType === vtypeUuid )
        throw new Error( "Unimplemented" );

    /*else if( vType === vtypeUri )
        throw new Error( "Unimplemented" );*/

    else if( vType === vtypeBytes )
        throw new Error( "Unimplemented" );

    else if( vType === vtypeKeyword )
        var v = K.key( value );

    else if( vType === vtypeDouble )
        var v = 0.0 + value;

    else if( vType === vtypeString )
        var v = String( value );

    else if( vType === vtypeBoolean )
    {
        if( value === true || value === false )
            var v = value;
        else
            throw new Error( "TODO" );
    }

    /* XXX stupid JavaScript numbers!  Only get 52 bits. */
    else if( vType === vtypeLong )
    {
        var v = 0.0 + value;
        if( !Number.isInteger( v ) )
            throw new Error( "TODO" );
    }

    else if( vType === vtypeRef )
    {
        var v = 0.0 + value;
        if( !Number.isInteger( v ) )
            throw new Error( "TODO" );
        /* TODO: check that v is an entity in the database */
    }

    else
        throw new Error( "Invalid attribute valueType " + vType );

    return v;
}

export function initializeBuiltInAttrs()
{
}

export function isBuiltInAttr( thing )
{
    
}

export function makeAddTxnStmt( attr )
{
    const txn = {};
    txn[ identK.key ]      = attr.ident;
    txn[ valueK.key ]      = attr.valueType;
    txn[ cardinality.key ] = attr.cardinality;
    if( attr.doc !== "" )
        txn[ docK.key ] = attr.doc;
    if( attr.unique !== null )
        txn[ uniqueK.key ] = attr.unique;
    if( attr.index )
        txn[ indexK.key ] = true;
    if( attr.fulltext )
        txn[ fulltextK.key ] = true;
    if( attr.isComponent )
        txn[ isComponentK.key ] = true;
    if( attr.noHistory )
        txn[ noHistoryK.key ] = true;
}
