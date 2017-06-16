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
        next_entity_id : 0
    };
}

DB.new_entity = function( db )
{
    var rv = db.next_entity_id;
    db.next_entity_id++;
    return rv;
}

DB.buildAddStmt = function( e, a, v )
{
    /* TODO: error-check parameters */
    var stmt = { form     : TXN_STMT_FORM_ADD,
                 attribute: a,
                 value    : v };
    if( e )
        stmt.entity = e;
    return stmt;
}

DB.buildMapStmt = function( e, avs )
{
    /* TODO: error-check parameters */
    var stmt = { form : TXN_STMT_FORM_ADD,
                 avs  : avs };
    if( e )
        stmt.entity = e;
    return stmt;
}

DB.buildRetractStmt = function( e, a, v )
{
    /* TODO: error-check parameters */
    var stmt = { form     : TXN_STMT_FORM_RETRACT,
                 attribute: a,
                 value    : v };
    if( e )
        stmt.entity = e;
    return stmt;
}

/* Totally broken, because of serialization */
DB.buildFnStmt = function( f )
{
    /* TODO: error-check parameters */
    return { form : TXN_STMT_FORM_FN,
             fn   : f };
}

DB.prepareTxn = function*( db, txn )
{
    /* assert( typeof( db )  == database ) */
    /* assert( typeof( txn ) == array of statements ) */

    var datoms = [];
    var temp_ids = {};

    function getEntity( stmt ) {
        try {
            var e = stmt.entity;
            if( Number.isInteger( e ) )
            {
                /* TODO: check that e is a valid entity id */
                return e;
            }
            if( e in temp_ids )
            {
                return temp_ids[ e ];
            }
            var eid = DB.new_entity( db );
            temp_ids[ e ] = eid;
            return eid
        }
        catch( err ) {
            return DB.new_entity( db );
        }
    }

    function processStmt( stmt, i ) {
        if( stmt.form == TXN_STMT_FORM_ADD ) {
            var entity_id = getEntity( stmt );
            acc.datoms.push( { e: entity_id, a: stmt.attribute, v: stmt.value } );
            return acc;
        }
        else if( stmt.form == TXN_STMT_FORM_RETRACT ) {
            var entity_id = getEntity( stmt );
            acc.datoms.push( { e: entity_id, a: stmt.attribute, v: stmt.value, r: true } );
            return acc;
        }
        else if( stmt.form == TXN_STMT_FORM_MAP ) {
            var entity_id = getEntity( stmt );
            stmt.avs.forEach( function( [ a, v ] ) {
                acc.datoms.push( { e: entity_id, a: a, v: v } );
            } );
            return acc;
        }
        else if( stmt.form == TXN_STMT_FORM_FN ) {
            stmt.fn( acc );
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

