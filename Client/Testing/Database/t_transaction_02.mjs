#!/usr/bin/env node --experimental-modules

async function main()
{
    await test_01_rewind();
}

function new_plain_root()
{
    const in_mem_storage = SM();
    const options = T.map();
    options.set( SC.PATH_PREFIX, [ "demo_app2" ] );
    options.set( SC.ENCODE_OBJ, SC.ENCODE_TRANSIT );
    const root = ST.newRoot( [ "root" ], in_mem_storage, options );
    return [root, () => { return ST.openRoot( [ "root" ], in_mem_storage, options ) }];
}

async function setup(){
    const [root, retrieve_root] = new_plain_root();
    const like_insert = DT.getAttributeInserts(
        A.createAttribute(
            ":likes",
            A.vtypeRef,
            A.cardinalityMany,
            "Contains references to other entities this entity likes."
        )
    );
    const name_insert = DT.getAttributeInserts(
        A.createAttribute(
            ":name",
            A.vtypeString,
            A.cardinalityOne,
            "A person's single, full name"
        )
    );
    let db = DB.newDB( );
    db = await DB.commitTxn(db, [...like_insert, ...name_insert]);

    ST.setChild( root, "the database", db.node );
    const r2 = await ST.writeTree( root );    
    const r3 = await retrieve_root();
    const retrieved_raw = await ST.getChild( r3, "the database" );
    const retrieved_db = DB.wrapDB( retrieved_raw );
    return [ retrieved_db, retrieve_root ];
}


async function test_01_rewind()
{
    let [ db, retrieve_root ] = await setup();
    let db2 = await DB.commitTxn( db, [ [ DT.addK, "chad", T.keyword(":name"), "Chadictionary" ] ])
}

const udf = (query, Q, ...args) => {
    const a = query(
        [
            q.findK, "?current",
            q.inK, "$", "?entity", "?attribute"
            Q.whereK, [
                "?entity", 
                "?attribute", 
                "?current"
            ]
        ],
        args[0], args[1]
    );
}

async function test_02_execute()
{
    let [ db, retrieve_root ] = await setup();
    let db2 = await DB.commitTxn( db,
        [
            [ DT.addK, "newfunc", A.identK, ":subtract" ],
            [ DT.addK, "newfunc", A.functionK, udf ]
        ]);
}

main().then(() => {
    console.log("End of file reached: t_transaction_02");
}, (err) => {
    console.log("error:" + err);
})
