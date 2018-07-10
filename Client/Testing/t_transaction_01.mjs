/* Top Matter */

import Path from "path";
import assert  from "../Source/Utilities/assert";
import * as K  from "../Source/Utilities/keyword";
import * as DA from "../Source/Database/attribute";
import * as DT from "../Source/Database/transaction";
import * as DB from "../Source/Database/simple_txn_chain";
import * as DC from "../Source/Database/common";
import SM      from "../Source/Storage/in_memory";

// // [ DT.addK, "bob", ":age", 42 ]

async function main()
{
    const s = SM( { path_prefix: [ "bob", "misc" ] } );
    const db = DB.newDB( s );
// //     const storage = MS.init( { path_prefix: [ "alice", "DB2" ] } );
// //     const db = DB.newDB( storage, {} );

// //     ageAttr = DA.makeAttribute(
// //         ":age", DA.vtypeLong, DA.cardinalityOne,
// //         "doc doc doc" );
// //     likesAttr = DA.makeAttribute(
// //         ":likes", DA.vtypeLong, DA.cardinalityOne,
// //         "doc doc doc" );

// //     const ageAddStmt   = DA.makeAddTxnStmt( ageAttr );
// //     const likesAddStmt = DA.makeAddTxnStmt( likesAttr );
// //     //db.add
}

main();

console.log( "Reaching end of t_transaction_01.mjs" );
