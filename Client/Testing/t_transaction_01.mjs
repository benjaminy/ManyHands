/* Top Matter */

import assert  from "../Source/Utilities/assert";
import Path    from "path";
import * as K  from "../Source/Utilities/keyword";
import * as DA from "../Source/Database/attribute";
import * as DT from "../Source/Database/transaction";
import * as DB from "../Source/Database/simple_txn_chain";
import * as DC from "../Source/Database/common";
import * as MS from "../Source/Storage/in_memory";

[ DT.addK, "bob", ":age", 42 ]

async function main()
{
    const storage = MS.init( "alice", {} );
    const db = DB.newDB( "alice", storage,  )
    
    ageAttr = DA.makeAttribute(
        ":age", DA.vtypeLong, DA.cardinalityOne,
        "doc doc doc" );
    ageAttr = DA.makeAttribute(
        ":likes", DA.vtypeLong, DA.cardinalityOne,
        "doc doc doc" );
}

main()

console.log( "Reaching end of t_transaction_02.mjs" );
