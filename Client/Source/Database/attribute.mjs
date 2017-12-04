/* Top Matter */

import { keyword } from "../Utilities/keyword.mjs";

const identK       = keyword( ':db/ident' );
const docK         = keyword( ':db/doc' );
const indexK       = keyword( ':db/index' );
const fulltextK    = keyword( ':db/fulltext' );
const noHistoryK   = keyword( ':db/noHistory' );
const isComponentK = keyword( ':db/isComponent' );

const cardinalityK     = keyword( ':db/cardinality' );
const cardinalityOneK  = keyword( ':db.cardinality/one' );
const cardinalityManyK = keyword( ':db.cardinality/many' );
const cardinalities    = new Set( [ cardinality_one, cardinality_many ] );

const valueTypeK   = keyword( ':db/valueType' );
const typeKeywordK = keyword( ':db.type/keyword' ); // interned
const typeStringK  = keyword( ':db.type/string' );  // encoding???
const typeBooleanK = keyword( ':db.type/boolean' );
const typeLongK    = keyword( ':db.type/long' );    // stupid JS numbers
const typeBigintK  = keyword( ':db.type/bigint' );  // library???
const typeFloatK   = keyword( ':db.type/float' );   // stupid JS numbers
const typeDoubleK  = keyword( ':db.type/double' );  // yay JS numbers!
const typeBigdecK  = keyword( ':db.type/bigdec' );  // library???
const typeRefK     = keyword( ':db.type/ref' );
const typeInstantK = keyword( ':db.type/ref' );     // library???
const typeUuidK    = keyword( ':db.type/uuid' );    // library???
const typeBytesK   = keyword( ':db.type/uuid' );    // huh.
const types        = new Set( [
    typeKeywordK, typeStringK, typeBooleanK, typeLongK, typeBigintK,
    typeFloatK, typeDoubleK, typeBigdecK, typeRefK, typeInstantK,
    typeUuidK, typeBytesK ] );

const uniqueK         = keyword( ':db/unique' );
const uniqueValueK    = keyword( ':db.unique/value' );
const uniqueIdentityK = keyword( ':db.unique/identity' );
DB.uniques = new Set( [ DB.unique.value, DB.unique.identity ] );


function makeAttribute(
    ident, valueType, cardinality,
    doc, unique, index, fulltext, isComponent, noHistory )
{
    const ident       = keyword( ident );
    const valueType   = keyword( valueType );
    const cardinality = keyword( cardinality );

    attr             = {};
    attr.ident       = ident;
    attr.doc         = '';
    attr.unique      = null;
    attr.index       = false;
    attr.fulltext    = false;
    attr.isComponent = false;
    attr.noHistory   = false;

    /* TODO: check that ident doesn't break any naming rules */

    if( !types.has( valueType ) )
        throw new Error( 'Invalid attribute valueType: ' + valueType.str );
    attr.valueType = valueType;

    if( !DB.cardinalities.has( cardinality ) )
        throw new Error( 'Invalid attribute cardinality: ' + cardinality.str );
    attr.cardinality = cardinality;

    if( doc )
        attr.doc = doc.toString();

    if( unique )
    {
        unique = keyword( unique );
        if( !DB.uniques.has( unique ) )
            throw new Error( 'Invalid attribute uniqueness: ' + unique.str );
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
function normalizeValue( attribute, value )
{
    var vType = keyword( attribute.valueType );
    if( vType === typeBigintK )
        throw new Error( 'Unimplemented' );

    else if( vType === typeFloatK )
        throw new Error( 'Unimplemented' );

    else if( vType === typeInstantK )
        throw new Error( 'Unimplemented' );

    else if( vType === typeUuidK )
        throw new Error( 'Unimplemented' );

    else if( vType === typeUriK )
        throw new Error( 'Unimplemented' );

    else if( vType === typeBytesK )
        throw new Error( 'Unimplemented' );

    else if( vType === typeKeywordK )
        var v = keyword( value );

    else if( vType === typeDoubleK )
        var v = 0.0 + value;

    else if( vType === typeStringK )
        var v = String( value );

    else if( vType === DB.type.boolean )
    {
        if( value === true || value === false )
            var v = value;
        else
            throw new Error( 'TODO' );
    }

    /* XXX stupid JavaScript numbers!  Only get 52 bits. */
    else if( vType === DB.type.long )
    {
        var v = 0.0 + value;
        if( !Number.isInteger( v ) )
            throw new Error( 'TODO' );
    }

    else if( vType === DB.type.ref )
    {
        var v = 0.0 + value;
        if( !Number.isInteger( v ) )
            throw new Error( 'TODO' );
        /* TODO: check that v is an entity in the database */
    }

    else
        throw new Error( 'Invalid attribute valueType ' + vType );

    return v;
}
