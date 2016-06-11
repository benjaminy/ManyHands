
function db_new()
{
    return { next_entity_id: 0, txns: [] };
}

function db_new_entity( db )
{
    var rv = db.next_entity_id;
    db.next_entity_id++;
    return rv;
}

function db_build_datom( e, a, v )
{
    return { e:e, a:a, v:v };
}

function db_build_txn( conditions, datoms )
{
    return { conditions: conditions, datoms: datoms };
}

function db_apply_txn( db, txn )
{
    /* XXX check conditions */
    db.txns = db.txns.concat( txn );
}
