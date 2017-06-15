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

