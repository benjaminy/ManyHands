/*
 *
 */

var DB = {}

DB.new = function()
{
    return { next_entity_id: 0, txns: [] };
}

DB.new_entity = function( db )
{
    var rv = db.next_entity_id;
    db.next_entity_id++;
    return rv;
}

DB.build_datom = function( e, a, v )
{
    return { e:e, a:a, v:v };
}

DB.build_txn = function( conditions, datoms )
{
    return { conditions: conditions, datoms: datoms };
}

DB.apply_txn = function( db, txn )
{
    /* XXX check conditions */
    db.txns = db.txns.concat( txn );
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
