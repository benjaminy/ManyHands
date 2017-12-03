/*
 * Top Matter
 */

define( [ 'Utilities/keyword' ], function ( keyword ) {
} ); // DELETEME


const make = function( storage )
{
    return {
        storage        : storage,
        datom_chain    : [],
        txn_chain      : null,
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
 * Transaction statements are arrays of objects one of the following shapes:
 * [ ':db/add', e, a, v ]
 * { a:v, a:v, ... } ( optionally, one of the attributes can be :db/id)
 * [ ':db/retract', e, a, v ]
 * [ fn-name (keyword), p1, p2, p3, ... ]
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

DB.txnStatementToWire( stmt )
{
 * [ TXN_STMT_ADD,     e, a, v ]
 * avs
 * [ TXN_STMT_RETRACT, e, a, v ]
 * [ fn-name (keyword), p1, p2, p3, ... ]
 */
}

DB.uploadOneTxn = async( '', function *( txn )
{
    var wire_txn = {
        prev : txn.prev;
    }
} );

DB.save = function()
{
    var txn_head = {}
    var datoms_head = {}
    var txn_prev = txn_head;
    var datoms_prev = datoms_head;
    var i;
    for( i = this.txn_chain.length - 1; i >= 0; i-- )
    {
        if( txn.saved )
            break;
    }
    i++;
    for( ; i < this.txn_chain.length; i++ )
    {
        var txn = txn_chain[ i ];
        if( txn.saved )
            break;
        file = save;
        txn_prev.next = file;
        txn_prev = txn;
    }
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

DB.add         = keyword( ':db/add' );
DB.retract     = keyword( ':db/retract' );
DB.id          = keyword( ':db/id' );

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
                  doc, unique, index, fulltext, isComponent, noHistory )
{
    ident       = keyword( ident );
    valueType   = keyword( valueType );
    cardinality = keyword( cardinality );

    attr             = {};
    attr.ident       = ident;
    attr.doc         = '';
    attr.unique      = null;
    attr.index       = false;
    attr.fulltext    = false;
    attr.isComponent = false;
    attr.noHistory   = false;

    /* TODO: check that ident doesn't break any naming rules */

    if( !DB.types.has( valueType ) )
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

