/*
 *
 */

/* TODO: enumify */
var TXN_STMT_FORM_ADD     = 1;
var TXN_STMT_FORM_RETRACT = 2;
var TXN_STMT_FORM_MAP     = 3;
var TXN_STMT_FORM_FN      = 4;

var DB = {}

DB.new = function( team )
{
    return {
        team           : team,
        datoms         : [],
        cloud_head     : null,
        next_entity_id : 0,
        attributes     : {},
        functions      : {}
    };
}

DB.new_entity = function( db )
{
    var rv = db.next_entity_id;
    db.next_entity_id++;
    return rv;
}


/*
 * Transaction statements are arrays of one of the following shapes:
 * [ TXN_STMT_ADD,     e, a, v ]
 * [ TXN_STMT_MAP,     e, avs ]
 * [ TXN_STMT_RETRACT, e, a, v ]
 * [ TXN_STMT_FN,      fn-name (keyword), p1, p2, p3, ... ]
 */


DB.addDbFunction( db, name, params, body )
{
    /* TODO: validate input */
    var f = 'DB.db_functions[ '+name+' ] = function( 'params.join( ',' ) + ' ) { ' + body + ' }';
    /* DEBUG: log f */
    eval( f );
}

example = '[ "p1", "p2", "p3" ] {  }';

DB.callDbFunction();

DB.buildDbFunctionTxn( name, params, body )
{
    /* TODO: validate input */
    datoms = {
        keyword( ':DB/functionName' ) : name;
        keyword( ':DB/functionBody' ) : body;
    }
    params.forEach( function( p ) {
        keyword( ':DB/functionParam' ) : p;
    } );
    return buildMapStmt( 'fn', datoms );
}

DB.getAttribute( attr )
{
    return this.attributes[ keyword( attr ).idx ];
}

DB.checkValue( attribute, value )
{
    var attr = keyword( attribute.valueType );
    if( attr === DB.type.keyword )
        var v = keyword( value );
    else if( attr === DB.type.string )
        var v = value.toString();
    else if( attr === DB.type.boolean )
    {
        if( value === true || value === false )
            var v = value;
        else
            throw new Error( 'TODO' );
    }
    /* XXX stupid JavaScript numbers! */
    else if( attr === DB.type.long )
    {
        if( Number.isInteger( value ) )
            var v = value;
        else
            throw new Error( 'TODO' );
    }
    else if( attr === DB.type.bigint )
        throw new Error( 'Unimplemented' );
    else if( attr === DB.type.float )
    {
        if( Number.isInteger( value ) )
            var v = value;
        else
            throw new Error( 'TODO' );
    }


    :db.type/float
    :db.type/double
    :db.type/bigdec
    :db.type/ref
    :db.type/instant
    :db.type/uuid
    :db.type/uri
    :db.type/bytes


:db/cardinality specifies whether an attribute associates a single value or a set of values with an entity. The values allowed for :db/cardinality are:
:db.cardinality/one - the attribute is single valued, it associates a single value with an entity

:db.cardinality/many - the attribute is multi valued, it associates a set of values with an entity

Transactions can add or retract individual values for multi-valued attributes.


:db/unique - specifies a uniqueness constraint for the values of an attribute. Setting an attribute :db/unique also implies :db/index. The values allowed for :db/unique are:
:db.unique/value - only one entity can have a given value for this attribute. Attempts to assert a duplicate value for the same attribute for a different entity id will fail. More documentation on unique values is available here.
:db.unique/identity - only one entity can have a given value for this attribute and "upsert" is enabled; attempts to insert a duplicate value for a temporary entity id will cause all attributes associated with that temporary id to be merged with the entity already in the database. More documentation on unique identities is available here.
:db/unique defaults to nil.
    
}

/* Input: an array of txn statements
 * Output: either raise an exception, or return an array of datoms */
DB.processTxn = function*( db, txn )
{
    /* assert( typeof( db )  == database ) */
    /* assert( typeof( txn ) == array of statements ) */

    var datoms = [];
    var temp_ids = {};

    function getEntity( e ) {
        if( e )
        {
            if( Number.isInteger( e ) )
            {
                /* TODO: check that e is a valid entity id */
                return e;
            }
            /* else: */ if( e in temp_ids )
            {
                return temp_ids[ e ];
            }
            /* else: */
            var eid = DB.new_entity( db );
            temp_ids[ e ] = eid;
            return eid
        }
        else
        {
            return DB.new_entity( db );
        }
    }

    function addDatom( e, a, v )
    {
        var attribute = db.getAttribute( a );
        var value     = db.checkValue( attribute, v );
        datoms.push( [ e, attribute, value ] );
    }

    function processStmt( stmt, i ) {
        if( stmt[ 0 ] === TXN_STMT_FORM_ADD ) {
            addDatom( getEntity( stmt[ 1 ] ), stmt[ 2 ], stmt[ 3 ] );
        }
        else if( stmt[ 0 ] === TXN_STMT_FORM_RETRACT ) {
            var e = getEntity( stmt[ 1 ] );
            var attribute = db.getAttribute( stmt[ 2 ] );
            var value     = db.checkValue( attribute, stmt[ 3 ] );
            /* Check that v is e's value for attribute a? */
            datoms.push( [ e, attribute, value, true ] );
        }
        else if( stmt[ 0 ] === TXN_STMT_FORM_MAP ) {
            var e = getEntity( stmt[ 1 ] );
            stmt[ 2 ].forEach( function( [ a, v ] ) {
                addDatom( e, a, v );
            } );
        }
        else if( stmt[ 0 ] === TXN_STMT_FORM_FN ) {
            var f = db.functions[ keyword( stmt[ 1 ] ).idx ];
            stmt.shift(); // remove statement kind
            stmt.shift(); // remove function name
            var fn_datoms = f.fn.apply( db, stmt );
            fn_datoms.forEach( function( [ e, a, v ] ) {
                addDatom( getEntity( e ), a, v );
            } );
        }
        else {
            throw new Error( 'malformed stmt' );
        }
    }

    try {
        db.txns.forEach( processStmt );
    }
    catch( err ) {
    }
}

DB.uploadTxn = async( '', function *( db, txn )
{
    var wrapped = {
        t: txn,
        n: db.cloud_head,
        v: db.current_vector
    };
    /* new random file name */
    /* add timestamp */
} );

DB.sync = function( db )
{
    // ffoooo
}

DB.query = function( db, q )
{
    var datoms = [];
    function eatTxns( txn, i )
    {
        function eatDatoms( datom, j )
        {
            if( datom.a.startsWith( q ) )
            {
                datoms.push( datom );
            }
        }
        txn.datoms.map( eatDatoms );
    }
    db.txns.map( eatTxns );
    return datoms;
}

var DB.readFromCloud = async( 'DB.readFromCloud', function *(
    scp, log, download, decrypt ) {
    var txn_pointer_encrypted = yield download( [ 'Data', 'Txns' ] );
    var txn_pointer_encoded   = yield decrypt( txn_pointer_encrypted );
    var txn_pointer           =       JSON.parse( decode( txn_pointer_encoded ) );
    var filename = txn_pointer.filename;
    var txns = [];
    do {
        var txn_encrypted = yield download( [ 'Data', filename ] );
        var txn_encoded   = yield decrypt( txn_encrypted );
        var txn           =       JSON.parse( decode( txn_encoded ) );
        filename          = txn.n;
        txns.push( txn );
    } while( filename );
    return txns;
} );

DB.ident       = keyword( ':db/ident' );
DB.doc         = keyword( ':db/doc' );
DB.index       = keyword( ':db/index' );
DB.fulltext    = keyword( ':db/fulltext' );
DB.noHistory   = keyword( ':db/noHistory' );
DB.isComponent = keyword( ':db/isComponent' );

DB.cardinalityAttr = keyword( ':db/cardinalityAttr' );
DB.cardinality = {};
DB.cardinality.one  = keyword( ':db.cardinality/one' );
DB.cardinality.many = keyword( ':db.cardinality/many' );
DB.cardinalities = new Set( [ DB.cardinality.one, DB.cardinality.many ] );

DB.valueType = keyword( ':db/valueType' );
DB.type = {}
DB.type.keyword = keyword( ':db.type/keyword' ); // interned
DB.type.string  = keyword( ':db.type/string' );  // encoding???
DB.type.boolean = keyword( ':db.type/boolean' );
DB.type.long    = keyword( ':db.type/long' );    // stupid JS numbers
DB.type.bigint  = keyword( ':db.type/bigint' );  // library???
DB.type.float   = keyword( ':db.type/float' );   // stupid JS numbers
DB.type.double  = keyword( ':db.type/double' );  // yay JS numbers!
DB.type.bigdec  = keyword( ':db.type/bigdec' );  // library???
DB.type.ref     = keyword( ':db.type/ref' );
DB.type.instant = keyword( ':db.type/ref' );     // library???
DB.type.uuid    = keyword( ':db.type/uuid' );    // library???
DB.type.bytes   = keyword( ':db.type/uuid' );    // huh.
DB.types = new Set( [
    DB.type.keyword, DB.type.string, DB.type.boolean, DB.type.long, DB.type.bigint,
    DB.type.float, DB.type.double, DB.type.bigdec, DB.type.ref, DB.type.instant,
    DB.type.uuid, DB.type.bytes ] );

DB.uniqueAttr = keyword( ':db/unique' );
DB.unique = {}
DB.unique.value    = keyword( ':db.unique/value' );
DB.unique.identity = keyword( ':db.unique/identity' );
DB.uniques = new Set( [ DB.unique.value, DB.unique.identity ] );

DB.makeAttribute( ident, valueType, cardinality,
                  doc, unique, index, fulltext, noHistory, isComponent )
{
    attr = {};
    if( !DB.keyword_regex.test( ident ) )
        throw new Error( 'Bad ident keyword '+ident );
    attr[ DB.ident.idx ] = ident;

    if( !DB.types.has( valueType ) )
        throw new Error( 'Bad valueType '+valueType.toString() );
    attr[ DB.valueType.idx ] = valueType;

    if( !DB.cardinalities.has( cardinality ) )
        throw new Error( 'Bad cardinality '+cardinality.toString() );
    attr[ DB.cardinality.idx ] = cardinality;

    if( doc )
        attr[ DB.doc.idx ] = doc.toString();

    if( DB.uniques.has( unique ) )
        attr[ DB.uniqueAttr.idx ] = unique;

    if( index === true || index === false )
        attr[ DB.index.idx ] = index;

    if( fulltext === true || fulltext === false )
        attr[ DB.fulltext.idx ] = fulltext;

    if( noHistory === true || noHistory === false )
        attr[ DB.noHistory.idx ] = noHistory;

    if( isComponent === true || isComponent === false )
        attr[ DB.isComponent.idx ] = isComponent;

}

var example = [ DB.find, '?e', '?x',
                DB.where, [ '?e', ':age', '42' ], [ '?e', ':likes', '?x' ] ]

:db/doc specifies a documentation string.
:db/unique - specifies a uniqueness constraint for the values of an attribute. Setting an attribute :db/unique also implies :db/index. The values allowed for :db/unique are:
  :db.unique/value - only one entity can have a given value for this attribute. Attempts to assert a duplicate value for the same attribute for a different entity id will fail. More documentation on unique values is available here.
  :db.unique/identity - only one entity can have a given value for this attribute and "upsert" is enabled; attempts to insert a duplicate value for a temporary entity id will cause all attributes associated with that temporary id to be merged with the entity already in the database. More documentation on unique identities is available here.
:db/unique defaults to nil.

:db/index specifies a boolean value indicating that an index should be generated for this attribute. Defaults to false.
:db/fulltext specifies a boolean value indicating that an eventually consistent fulltext search index should be generated for the attribute. Defaults to false.
Fulltext search is constrained by several defaults (which cannot be altered): searches are case insensitive, remove apostrophe or apostrophe and s sequences, and filter out the following common English stop words:

"a", "an", "and", "are", "as", "at", "be", "but", "by",
"for", "if", "in", "into", "is", "it",
"no", "not", "of", "on", "or", "such",
"that", "the", "their", "then", "there", "these",
"they", "this", "to", "was", "will", "with"

:db/isComponent specifies a boolean value indicating that an attribute whose type is :db.type/ref refers to a subcomponent of the entity to which the attribute is applied. When you retract an entity with :db.fn/retractEntity, all subcomponents are also retracted. When you touch an entity, all its subcomponent entities are touched recursively. Defaults to false.

:db/noHistory specifies a boolean value indicating whether past values of an attribute should not be retained. Defaults to false.
The purpose of :db/noHistory is to conserve storage, not to make semantic guarantees about removing information. The

}


DB.Query = {};

DB.Query.find = function( find_spec, with_clause, inputs, where_clause )
{
}

DB.Query.findRel = function( find_elems )
{
    var result = { find_spec: 'find-rel' };
    return result;
}

/* collection */
DB.Query.findColl = function( TODO )
{
    var result = { find_spec: 'find-coll' };
    return result;
}

DB.Query.findScalar = function( find_elem )
{
    var result = { find_spec: 'find-scalar' };
    return result;
}

DB.Query.findTuple = function( TODO )
{
    var result = { find_spec: 'find-tuple' };
    return result;
}

DB.Query.variable = function( name )
{
    return { vname: name };
}

DB.Query.exprClause = function( param )
{
    
}

DB.Query.dataPattern = function( params )
{
    
}

